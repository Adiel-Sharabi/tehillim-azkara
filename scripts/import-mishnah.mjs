#!/usr/bin/env node
// Import vowelled Mishnah text (Mikvaot 7, Kelim 24) into sources/mishnah/mishnah.json.
//
//   node scripts/import-mishnah.mjs --download   fetch raw API responses into sources/mishnah/raw/ (gitignored)
//                                                and write raw/manifest.json, then build mishnah.json
//   node scripts/import-mishnah.mjs              build mishnah.json from the saved raw files only (offline)
//
// The site never calls these APIs at runtime; this script is the only place that does, and only on --download.
// Node built-ins only. Every unexpected shape throws: nothing is guessed, nothing is silently dropped.
// Vowel marks are never added, removed or normalised; only wiki markup / HTML / editorial notes are stripped.

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(ROOT, 'sources', 'mishnah');
const RAW_DIR = join(SRC_DIR, 'raw');
const OUT_FILE = join(SRC_DIR, 'mishnah.json');
const MANIFEST_FILE = join(RAW_DIR, 'manifest.json');

const WS_API = 'https://he.wikisource.org/w/api.php';
const WS_SITE = 'https://he.wikisource.org';
const SEFARIA = 'https://www.sefaria.org';
const USER_AGENT = 'tehillim-azkara-import/1.0 (one-off static data import)';
const METHODOLOGY_TITLE = 'ויקיטקסט:משנה מנוקדת ומעוצבת';

// What we import. `tractate` is the Hebrew tractate name used in the Wikisource header templates.
const TARGETS = [
  { key: 'Mikvaot.7', wsTitle: 'משנה מקוואות ז ניקוד', tractate: 'מקוואות', chapterHe: 'ז', count: 7,
    sefariaBook: 'Mishnah_Mikvaot', sefariaRef: 'Mishnah_Mikvaot.7', sefariaRefHuman: 'Mishnah Mikvaot 7' },
  { key: 'Kelim.24', wsTitle: 'משנה כלים כד ניקוד', tractate: 'כלים', chapterHe: 'כד', count: 17,
    sefariaBook: 'Mishnah_Kelim', sefariaRef: 'Mishnah_Kelim.24', sefariaRefHuman: 'Mishnah Kelim 24' },
];

// Sefaria Hebrew versions we accept. License strings are matched EXACTLY as Sefaria spells them
// ("PD" is Sefaria's own spelling for the Be'eri edition; it is Public Domain).
const ELIGIBLE_LICENSES = new Set(['Public Domain', 'PD', 'CC0', 'CC-BY', 'CC-BY-SA']);
// Edition ids are fixed by hand so a renamed/new Sefaria version cannot silently change the JSON keys.
const SEFARIA_EDITION_IDS = new Map([
  ['Torat Emet 357', { id: 'sefaria-torat-emet-357', profile: 'plain' }],
  ['Mishnah, ed. Romm, Vilna 1913', { id: 'sefaria-romm-vilna-1913', profile: 'plain' }],
  ["Mishnah based on the Kaufmann manuscript, edited by Dan Be'eri", { id: 'sefaria-beeri-kaufmann', profile: 'beeri' }],
]);

const WS_EDITION_ID = 'wikisource-beeri';

// ---------------------------------------------------------------- helpers

function fail(msg) { throw new Error(`import-mishnah: ${msg}`); }
function assert(cond, msg) { if (!cond) fail(msg); }
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const GEMATRIA = { א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9, י: 10, כ: 20, ל: 30, מ: 40, נ: 50, ס: 60, ע: 70, פ: 80, צ: 90, ק: 100, ר: 200, ש: 300, ת: 400 };
function gematria(s) {
  assert(/^[א-ת]{1,3}$/.test(s), `not a Hebrew numeral: ${JSON.stringify(s)}`);
  return [...s].reduce((n, c) => n + GEMATRIA[c], 0);
}

function hebNum(n) {
  assert(Number.isInteger(n) && n >= 1 && n <= 29, `hebNum supports 1..29, got ${n}`);
  if (n === 15) return 'טו';
  if (n === 16) return 'טז';
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  return ['', 'י', 'כ'][Math.floor(n / 10)] + ones[n % 10];
}
// Reader-facing page for one mishnah, e.g. "משנה מקוואות ז ד".
const readerTitle = (t, n) => `משנה ${t.tractate} ${t.chapterHe} ${hebNum(n)}`;
const isIp = (u) => /^(\d{1,3}\.){3}\d{1,3}$/.test(u) || /^[0-9a-f]*:[0-9a-f:]+$/i.test(u);

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, '\u00A0')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

// Final gate for every imported string: Hebrew letters, Hebrew points/cantillation (U+0591-U+05C7,
// includes maqaf U+05BE), plain spaces and a small ASCII punctuation set. Anything else throws.
const ALLOWED_TEXT = /^[\u05D0-\u05EA\u0591-\u05C7 .,:;!?'"()\-]+$/;
function checkFinalText(s, where) {
  assert(s.length > 0, `${where}: empty text`);
  assert(s === s.trim(), `${where}: leading/trailing whitespace`);
  assert(!/ {2,}/.test(s), `${where}: double space`);
  if (!ALLOWED_TEXT.test(s)) {
    const bad = [...new Set([...s].filter((c) => !ALLOWED_TEXT.test(c)))].map((c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'));
    fail(`${where}: unexpected characters ${bad.join(', ')}`);
  }
  assert(/[\u05D0-\u05EA]/.test(s), `${where}: no Hebrew letters`);
}

// ---------------------------------------------------------------- download

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Polite fetch: one request at a time, a pause after each, and back-off on 429/503 (honouring Retry-After).
async function getText(url) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
    if (res.ok) { const body = await res.text(); await sleep(500); return body; }
    if ((res.status === 429 || res.status === 503) && attempt < 6) {
      const wait = Math.max(Number(res.headers.get('retry-after')) || 0, 2 ** attempt) * 1000;
      console.log(`  HTTP ${res.status}, waiting ${wait / 1000}s (attempt ${attempt})`);
      await sleep(wait);
      continue;
    }
    fail(`HTTP ${res.status} for ${url}`);
  }
}

function wsUrl(params) {
  const u = new URL(WS_API);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  u.searchParams.set('format', 'json');
  return u.toString();
}

async function download() {
  mkdirSync(RAW_DIR, { recursive: true });
  const retrievedAt = new Date().toISOString();
  const files = {};

  async function save(name, url) {
    const body = await getText(url);
    const parsed = JSON.parse(body);
    assert(!parsed.error, `API error from ${url}: ${JSON.stringify(parsed.error)}`);
    writeFileSync(join(RAW_DIR, name), body, 'utf8');
    files[name] = { url, sha256: sha256(Buffer.from(body, 'utf8')), bytes: Buffer.byteLength(body, 'utf8') };
    console.log(`  saved ${name} (${files[name].bytes} bytes)`);
    return parsed;
  }

  console.log('Wikisource:');
  for (const t of TARGETS) {
    await save(`wikisource-${t.key}.wikitext.json`, wsUrl({
      action: 'query', prop: 'revisions', rvprop: 'ids|timestamp|content', rvslots: 'main', titles: t.wsTitle }));
    // What a reader actually sees: the rendered per-mishnah pages (they transclude the vowelled section).
    // The "ניקוד" page itself renders empty for Mikvaot (Parsoid hides the section body), so it cannot be used.
    for (let n = 1; n <= t.count; n++) {
      await save(`wikisource-render-${t.key}-${n}.json`, wsUrl({ action: 'parse', page: readerTitle(t, n), prop: 'text|revid' }));
    }
    // Contributor list for CC BY-SA attribution.
    await save(`wikisource-${t.key}.history.json`, wsUrl({
      action: 'query', prop: 'revisions', rvprop: 'ids|timestamp|user|comment', rvlimit: 'max', titles: t.wsTitle }));
  }
  await save('wikisource-methodology.json', wsUrl({
    action: 'query', prop: 'revisions', rvprop: 'ids|timestamp|content', rvslots: 'main', titles: METHODOLOGY_TITLE }));
  await save('wikisource-siteinfo.json', wsUrl({ action: 'query', meta: 'siteinfo', siprop: 'rightsinfo' }));

  console.log('Sefaria:');
  for (const t of TARGETS) {
    await save(`sefaria-versions-${t.sefariaBook}.json`, `${SEFARIA}/api/texts/versions/${t.sefariaBook}`);
    await save(`sefaria-${t.sefariaRef}.json`, `${SEFARIA}/api/v3/texts/${t.sefariaRef}?version=hebrew|all`);
  }

  writeFileSync(MANIFEST_FILE, JSON.stringify({ retrievedAt, files }, null, 2) + '\n', 'utf8');
  console.log(`  saved manifest.json (retrievedAt ${retrievedAt})`);
}

// ---------------------------------------------------------------- raw loading

function loadManifest() {
  assert(existsSync(MANIFEST_FILE), `no ${MANIFEST_FILE}; run with --download first`);
  return JSON.parse(readFileSync(MANIFEST_FILE, 'utf8'));
}

function loadRaw(manifest, name) {
  const entry = manifest.files[name];
  assert(entry, `manifest has no entry for ${name}`);
  const body = readFileSync(join(RAW_DIR, name), 'utf8');
  assert(sha256(Buffer.from(body, 'utf8')) === entry.sha256, `raw file ${name} does not match its manifest sha256 (edited or corrupt)`);
  return { json: JSON.parse(body), entry };
}

// ---------------------------------------------------------------- Wikisource

function wsPage(json, expectedTitle, history = false) {
  const pages = Object.values(json.query.pages);
  assert(pages.length === 1, 'expected exactly one page in response');
  const p = pages[0];
  assert(!('missing' in p), `page missing: ${expectedTitle}`);
  assert(p.title === expectedTitle, `title mismatch: got ${p.title}, expected ${expectedTitle}`);
  assert(history ? p.revisions?.length >= 1 : p.revisions?.length === 1, `unexpected revision count for ${expectedTitle}`);
  return p;
}

// Pull the numbered mishnayot out of a "<tractate> <chapter> ניקוד" page.
function extractWikisource(wikitext, target) {
  // Header template inside <noinclude>: {{התחלת משנה מנוקדת|<tractate>|<prev>|<this>|<next>|משניות=N}}
  const head = wikitext.match(/<noinclude>\s*\{\{התחלת משנה מנוקדת\|([^|}]+)\|([^|}]+)\|([^|}]+)\|([^|}]+)\|משניות=(\d+)\}\}\s*<\/noinclude>/);
  assert(head, `${target.key}: header template not found`);
  assert(head[1] === target.tractate, `${target.key}: header tractate ${head[1]}`);
  assert(head[3] === target.chapterHe, `${target.key}: header chapter ${head[3]}`);
  assert(Number(head[5]) === target.count, `${target.key}: header says ${head[5]} mishnayot, expected ${target.count}`);

  const body = wikitext.replace(/<noinclude>[\s\S]*?<\/noinclude>/g, '');
  const sectionRe = new RegExp(
    '(?:\\{\\{המשנה\\|([^|}]+)\\|([^|}]+)\\|([^|}]+)\\}\\}[ \\t]*|===\\[\\[[^\\]|]+\\|משנה ([^\\]]+)\\]\\]===\\s*)?' +
    '<קטע התחלה=([^/>]+)/>([\\s\\S]*?)<קטע סוף=\\5/>', 'g');
  const out = {};
  let n = 0;
  for (const m of body.matchAll(sectionRe)) {
    n++;
    const label = m[5];
    assert(gematria(label) === n, `${target.key}: section ${n} has label ${label}`);
    if (m[1] !== undefined) { // {{המשנה|label|chapter|tractate}}
      assert(m[1] === label && m[2] === target.chapterHe && m[3] === target.tractate, `${target.key}: {{המשנה}} header mismatch at ${label}`);
    } else if (m[4] !== undefined) { // ===[[...|משנה label]]===
      assert(m[4] === label, `${target.key}: heading label mismatch at ${label}`);
    }
    out[String(n)] = cleanWikitextSection(m[6], `${target.key}:${n}`);
  }
  assert(n === target.count, `${target.key}: found ${n} sections, expected ${target.count}`);
  const leftover = body.replace(sectionRe, '').trim();
  assert(leftover === '', `${target.key}: unexpected content outside mishnah sections: ${JSON.stringify(leftover.slice(0, 120))}`);
  return out;
}

function cleanWikitextSection(raw, where) {
  const text = raw.split('\n')
    .map((line) => line.replace(/^[:*#;]+/, '').trim())
    .filter((line) => line !== '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  assert(!/[<>\[\]{}|=]|''|&[a-z#0-9]+;/i.test(text), `${where}: leftover wiki/HTML markup in ${JSON.stringify(text.slice(0, 80))}`);
  checkFinalText(text, where);
  return text;
}

// Quote-aware tag matcher: Parsoid puts '>' inside quoted data-mw attributes, so a naive /<[^>]*>/ leaks them.
const HTML_TAG = /<\/?[a-zA-Z][a-zA-Z0-9:-]*(?:\s+[^\s=>\/"']+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*\s*\/?>/g;
function htmlToText(html) {
  return decodeEntities(
    html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(HTML_TAG, ' ')
  ).replace(/[\s\u00A0]+/g, ' ');
}

// Every extracted mishnah must appear verbatim in the rendered reader page for that mishnah.
function crossCheckAgainstRendered(manifest, texts, target) {
  for (const [n, t] of Object.entries(texts)) {
    const r = loadRaw(manifest, `wikisource-render-${target.key}-${n}.json`).json;
    assert(r.parse && r.parse.title === readerTitle(target, Number(n)), `${target.key}:${n}: rendered page title ${r.parse?.title}`);
    assert(htmlToText(r.parse.text['*']).includes(t), `${target.key}:${n}: extracted text not found verbatim in rendered page "${r.parse.title}"`);
  }
}

// Read which tractates the methodology page lists as proofread by S. G. Borer.
function parseBorerList(methodologyJson) {
  const page = wsPage(methodologyJson, METHODOLOGY_TITLE);
  const rev = page.revisions[0];
  const wt = rev.slots.main['*'];
  const marker = 'בינתיים בוצעה הגהה למסכתות הבאות:';
  const i = wt.indexOf(marker);
  assert(i >= 0, 'methodology page: proofread-tractates marker not found (page changed?)');
  let rest = wt.slice(i + marker.length);
  const end = rest.search(/\n==[^=]/);
  assert(end > 0, 'methodology page: end of proofread list not found');
  rest = rest.slice(0, end);
  const items = [...rest.matchAll(/^'''([^'\n]+)'''/gm)].map((m) => m[1].trim());
  const orders = items.filter((s) => s.startsWith('סדר '));
  const tractates = items.filter((s) => !s.startsWith('סדר '));
  assert(orders.length >= 1 && tractates.length >= 5, `methodology page: unexpected list shape ${JSON.stringify(items)}`);
  return {
    page: `${WS_SITE}/wiki/${encodeURIComponent(METHODOLOGY_TITLE.replace(/ /g, '_'))}`,
    revid: rev.revid, timestamp: rev.timestamp,
    statement: 'Listed as proofread (הגהה) by Simcha Gershon Borer on the methodology page',
    ordersListed: orders,
    tractatesListed: tractates,
    mikvaotListed: tractates.some((s) => s.includes('מקוו')),
    kelimListed: tractates.some((s) => s.includes('כלים')),
  };
}

function buildWikisource(manifest) {
  const siteinfo = loadRaw(manifest, 'wikisource-siteinfo.json').json.query.rightsinfo;
  assert(/creativecommons\.org\/licenses\/by-sa\/4\.0\//.test(siteinfo.url) && /Share[- ]Alike 4\.0/.test(siteinfo.text), `unexpected site license ${JSON.stringify(siteinfo)}`);
  const licenseUrl = siteinfo.url.replace(/deed\.[a-z-]+$/, '');
  const borer = parseBorerList(loadRaw(manifest, 'wikisource-methodology.json').json);

  const texts = {};
  const pages = {};
  const flags = [];
  for (const t of TARGETS) {
    const wt = loadRaw(manifest, `wikisource-${t.key}.wikitext.json`);
    const page = wsPage(wt.json, t.wsTitle);
    const rev = page.revisions[0];
    texts[t.key] = extractWikisource(rev.slots.main['*'], t);
    crossCheckAgainstRendered(manifest, texts[t.key], t);

    const hist = wsPage(loadRaw(manifest, `wikisource-${t.key}.history.json`).json, t.wsTitle, true).revisions;
    assert(hist.some((r) => r.revid === rev.revid), `${t.key}: pinned revid ${rev.revid} not in page history`);
    pages[t.key] = {
      title: t.wsTitle,
      url: `${WS_SITE}/wiki/${encodeURIComponent(t.wsTitle.replace(/ /g, '_'))}?oldid=${rev.revid}`,
      revid: rev.revid,
      timestamp: rev.timestamp,
      historyUrl: `${WS_SITE}/w/index.php?title=${encodeURIComponent(t.wsTitle.replace(/ /g, '_'))}&action=history`,
      // Registered usernames only; anonymous (IP) edits are counted, never listed.
      contributors: [...new Set(hist.map((r) => r.user).filter((u) => !isIp(u)))].sort(),
      anonymousRevisions: hist.filter((r) => isIp(r.user)).length,
    };
    for (const [n, s] of Object.entries(texts[t.key])) {
      for (const p of s.match(/\([^)]*\)/g) ?? []) {
        flags.push({ text: t.key, mishnah: n, kind: 'parenthetical-kept-verbatim', excerpt: p });
      }
    }
  }

  return {
    source: {
      url: `${WS_SITE}/wiki/${encodeURIComponent('ויקיטקסט:משנה_מנוקדת_ומעוצבת')}`,
      title: 'Hebrew Wikisource, Mishnah vowelled edition (Kaufmann MS, base text by Rabbi Dan Be\'eri)',
      license: 'CC BY-SA 4.0',
      licenseUrl,
      method: 'MediaWiki API action=query&prop=revisions (wikitext, section-tag extraction); cross-checked verbatim against action=parse rendered reader pages (one per mishnah, e.g. "משנה מקוואות ז ד")',
      retrievedAt: manifest.retrievedAt,
      pages,
    },
    reviewStatus: 'IMPORTED',
    upstreamProofreading: borer,
    importFlags: flags,
    texts,
  };
}

// ---------------------------------------------------------------- Sefaria

function cleanSefariaText(raw, profile, where) {
  let s = decodeEntities(raw);
  if (profile === 'beeri') {
    // Be'eri's source file: <small>X</small> = sub-mishnah numeral, <...> = the manuscript reading he replaced
    // (or a note to himself), and a leading bare numeral line when the label is not wrapped in <small>.
    s = s.replace(/<small>[^<]*<\/small>/g, '');
    s = s.replace(/<[^<>]*>/g, '');
    s = s.replace(/^\s*[א-ת]{1,2}[ \t]*\n/, '');
  }
  assert(!/[<>&]/.test(s), `${where}: leftover markup ${JSON.stringify(s.slice(0, 80))}`);
  s = s.split('\n').map((l) => l.trim()).filter((l) => l !== '').join(' ').replace(/\s+/g, ' ').trim();
  checkFinalText(s, where);
  return s;
}

function buildSefaria(manifest) {
  const editions = {};
  const skipped = [];
  for (const t of TARGETS) {
    const vers = loadRaw(manifest, `sefaria-versions-${t.sefariaBook}.json`);
    const v3 = loadRaw(manifest, `sefaria-${t.sefariaRef}.json`);
    assert(v3.json.ref === t.sefariaRefHuman, `${t.key}: Sefaria ref ${v3.json.ref}`);
    assert(Array.isArray(vers.json), 'versions endpoint did not return an array');
    const heVersions = vers.json.filter((v) => v.language === 'he');
    const v3Titles = v3.json.versions.map((v) => v.versionTitle).sort();
    assert(JSON.stringify(v3Titles) === JSON.stringify(heVersions.map((v) => v.versionTitle).sort()),
      `${t.key}: v3 returned versions ${JSON.stringify(v3Titles)} but versions endpoint lists Hebrew ${JSON.stringify(heVersions.map((v) => v.versionTitle))}`);

    for (const v of heVersions) {
      if (!ELIGIBLE_LICENSES.has(v.license)) { skipped.push(`${t.key}: ${v.versionTitle} [${v.license}]`); continue; }
      const cfg = SEFARIA_EDITION_IDS.get(v.versionTitle);
      assert(cfg, `${t.key}: new eligible Sefaria version "${v.versionTitle}" [${v.license}] has no edition id; add it to SEFARIA_EDITION_IDS`);
      const data = v3.json.versions.find((x) => x.versionTitle === v.versionTitle);
      assert(data.license === v.license, `${t.key}: license differs between endpoints for ${v.versionTitle}: ${data.license} vs ${v.license}`);
      assert(Array.isArray(data.text) && data.text.length === t.count && data.text.every((x) => typeof x === 'string'),
        `${t.key}: ${v.versionTitle}: expected ${t.count} string mishnayot`);

      const ed = (editions[cfg.id] ??= {
        source: {
          url: v.versionSource,
          title: v.versionTitle,
          license: v.license,
          licenseUrl: null,
          method: `Sefaria API: /api/texts/versions/<book> (license) + /api/v3/texts/<ref>?version=hebrew|all (text); no revision id exists, raw sha256 recorded per page`,
          retrievedAt: manifest.retrievedAt,
          pages: {},
        },
        reviewStatus: 'IMPORTED',
        texts: {},
      });
      assert(ed.source.license === v.license && ed.source.title === v.versionTitle, `${v.versionTitle}: version metadata differs between books`);
      ed.source.pages[t.key] = {
        title: t.sefariaRefHuman,
        url: `${SEFARIA}/${t.sefariaRef}?lang=he&ven=${encodeURIComponent(v.versionTitle.replace(/ /g, '_'))}`,
        apiUrl: v3.entry.url,
        rawSha256: v3.entry.sha256,
      };
      ed.texts[t.key] = Object.fromEntries(data.text.map((raw, i) => [String(i + 1), cleanSefariaText(raw, cfg.profile, `${cfg.id} ${t.key}:${i + 1}`)]));
    }
  }
  for (const s of skipped) console.log(`  skipped (license not eligible): ${s}`);
  for (const [title, cfg] of SEFARIA_EDITION_IDS) assert(editions[cfg.id], `expected Sefaria edition "${title}" was not found`);
  return editions;
}

// ---------------------------------------------------------------- main

async function main() {
  if (process.argv.includes('--download')) await download();
  const manifest = loadManifest();
  const editions = { [WS_EDITION_ID]: buildWikisource(manifest) };
  const sef = buildSefaria(manifest);
  for (const id of Object.keys(sef).sort()) editions[id] = sef[id];
  writeFileSync(OUT_FILE, JSON.stringify({ editions }, null, 2) + '\n', 'utf8');
  for (const [id, ed] of Object.entries(editions)) {
    const counts = Object.entries(ed.texts).map(([k, v]) => `${k}=${Object.keys(v).length}`).join(' ');
    console.log(`${id}: ${counts} [${ed.source.license}] ${ed.reviewStatus}`);
  }
  console.log(`wrote ${OUT_FILE}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
