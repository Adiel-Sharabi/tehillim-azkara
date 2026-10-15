// Import the Psalms the site needs from the Unicode/XML Leningrad Codex (UXLC, tanach.us),
// the WLC-derived text used as an INDEPENDENT comparison base for collating MAM.
// It is not the primary edition and nothing here is proofread.
//
//   node scripts/import-wlc.mjs                          import sources/wlc/raw/Psalms.xml
//   node scripts/import-wlc.mjs --raw other.xml          import a file you downloaded yourself
//   node scripts/import-wlc.mjs --retrieved-at 2026-11-02   stamp a different retrieval date
//
// Fail-closed:
//  * a raw file whose SHA-256 differs from LOCK is refused unless --allow-source-update
//    is passed (a reviewed update only; tanach.us republishes twice a year);
//  * any element type not handled below, inside the chapters we extract, throws;
//  * a verse count that differs from EXPECTED_VERSIONS or from the source's own <vs>
//    chapter count throws, listing every discrepancy. Nothing is papered over.
//
// Only Node built-ins. The text is kept exactly as in the source: NO Unicode normalisation.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { EXPECTED_VERSES } from './psalms-chapters.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW_PATH = join(ROOT, 'sources', 'wlc', 'raw', 'Psalms.xml');
const OUT_PATH = join(ROOT, 'sources', 'wlc', 'psalms_wlc.json');

const MAQAF = '\u05BE';

export const LOCK = {
  url: 'https://tanach.us/Books/Psalms.xml',
  sha256: '7b09e7fc308858a25da6f95f9c9a24078a1b4e160dbf89a2cac786ea3142e05c',
  bytes: 780618,
};

export const LICENSE = {
  // Verbatim from https://tanach.us/License.html (retrieved 2026-10-15).
  license: 'All biblical Hebrew text, in any format, may be viewed or copied without restriction.',
  licenseUrl: 'https://tanach.us/License.html',
  citation: 'Unicode/XML Leningrad Codex: UXLC 2.5 (27.6), Tanach.us Inc., West Redding, CT, USA, Apr 2026.',
  notice: 'The text presented at this site is not the Westminster Leningrad Codex (WLC); please do not represent it as such.',
};

// Chapters and verse counts: scripts/psalms-chapters.mjs (shared with the other Psalms importer).
export { EXPECTED_VERSES };

// ---------------------------------------------------------------------------------------------
// Minimal XML parser (built-ins only). Handles the constructs the UXLC files use; anything
// else (CDATA, DOCTYPE, undeclared entities, malformed nesting) throws.
// ---------------------------------------------------------------------------------------------

const TOKEN = new RegExp(
  [
    '<!--([\\s\\S]*?)-->', //                                   1 comment
    '<\\?([\\s\\S]*?)\\?>', //                                  2 processing instruction / xml decl
    '(<!\\[CDATA\\[|<!DOCTYPE)', //                             3 unsupported
    '</([^\\s>]+)\\s*>', //                                     4 close tag
    '<([^\\s/>!?]+)((?:\\s+[^\\s=/>]+\\s*=\\s*(?:"[^"]*"|\'[^\']*\'))*)\\s*(/?)>', // 5 name 6 attrs 7 selfclose
    '([^<]+)', //                                               8 text
  ].join('|'),
  'y',
);

const ENTITY = /&(#x[0-9A-Fa-f]+|#[0-9]+|[A-Za-z][A-Za-z0-9]*);/g;
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decode(s, where) {
  const decoded = s.replace(ENTITY, (m, e) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      if (!Number.isInteger(cp) || cp < 0 || cp > 0x10ffff) throw new Error(`${where}: bad character reference ${m}`);
      return String.fromCodePoint(cp);
    }
    if (!(e in NAMED)) throw new Error(`${where}: unhandled entity ${m}`);
    return NAMED[e];
  });
  if (s.replace(ENTITY, '').includes('&')) throw new Error(`${where}: stray "&" in text`);
  return decoded;
}

export function parseXml(src) {
  if (src.charCodeAt(0) === 0xfeff) src = src.slice(1);
  const root = { name: '#document', attrs: {}, children: [] };
  const stack = [root];
  let pos = 0;
  while (pos < src.length) {
    TOKEN.lastIndex = pos;
    const m = TOKEN.exec(src);
    if (!m) throw new Error(`XML parse error at offset ${pos}: ${JSON.stringify(src.slice(pos, pos + 40))}`);
    pos = TOKEN.lastIndex;
    const top = stack[stack.length - 1];
    if (m[1] !== undefined || m[2] !== undefined) continue; // comment / PI
    if (m[3] !== undefined) throw new Error(`XML parse error at offset ${m.index}: unsupported ${m[3]}`);
    if (m[4] !== undefined) {
      if (top.name !== m[4]) throw new Error(`XML parse error at offset ${m.index}: </${m[4]}> closes <${top.name}>`);
      stack.pop();
    } else if (m[5] !== undefined) {
      const attrs = {};
      for (const a of m[6].matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
        attrs[a[1]] = decode(a[2] ?? a[3], `<${m[5]}> attribute ${a[1]}`);
      }
      const el = { name: m[5], attrs, children: [] };
      top.children.push(el);
      if (m[7] !== '/') stack.push(el);
    } else {
      top.children.push(decode(m[8], `text at offset ${m.index}`));
    }
  }
  if (stack.length !== 1) throw new Error(`XML parse error: <${stack[stack.length - 1].name}> never closed`);
  return root;
}

// ---------------------------------------------------------------------------------------------
// Tree helpers
// ---------------------------------------------------------------------------------------------

const elementsOf = (el) => el.children.filter((c) => typeof c !== 'string');
const childrenNamed = (el, name) => elementsOf(el).filter((c) => c.name === name);

function one(el, name) {
  const found = childrenNamed(el, name);
  if (found.length !== 1) throw new Error(`expected exactly one <${name}> in <${el.name}>, found ${found.length}`);
  return found[0];
}

function deepText(el) {
  return el.children.map((c) => (typeof c === 'string' ? c : deepText(c))).join('');
}

/** An element that must hold only whitespace between its child elements. */
function assertNoStrayText(el, loc) {
  for (const c of el.children) {
    if (typeof c === 'string' && c.trim() !== '') {
      throw new Error(`${loc}: unexpected text ${JSON.stringify(c.trim().slice(0, 30))} directly inside <${el.name}>`);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// WLC/UXLC extraction
// ---------------------------------------------------------------------------------------------

/** Text of a <w>, <k> or <q>. Allowed child: <x> (transcription note, dropped). */
function unitText(el, loc, stats) {
  let out = '';
  for (const c of el.children) {
    if (typeof c === 'string') {
      out += c;
    } else if (c.name === 'x') {
      if (elementsOf(c).length) throw new Error(`${loc}: <x> note with child elements`);
      stats.notesDropped[deepText(c)] = (stats.notesDropped[deepText(c)] ?? 0) + 1;
    } else {
      throw new Error(`${loc}: unhandled element <${c.name}> inside <${el.name}>`);
    }
  }
  if (out === '') throw new Error(`${loc}: empty <${el.name}> after dropping notes`);
  if (/[^\S ]/.test(out)) throw new Error(`${loc}: <${el.name}> contains whitespace other than U+0020: ${JSON.stringify(out)}`);
  if (out !== out.trim()) throw new Error(`${loc}: <${el.name}> has leading/trailing space: ${JSON.stringify(out)}`);
  return out;
}

/** Join words with a single space, except straight after a maqaf. */
export function joinWords(words) {
  let out = '';
  for (const w of words) {
    if (out !== '' && !out.endsWith(MAQAF)) out += ' ';
    out += w;
  }
  return out;
}

/**
 * One <v>. The main text takes the QERE as the reading; each ketiv/qere group is also
 * returned separately. A group is a run of <k>/<q> siblings (a <k> following a <q> starts a
 * new group); a group may be one ketiv to several qere words, or have no qere or no ketiv.
 */
function extractVerse(vEl, loc, stats) {
  assertNoStrayText(vEl, loc);
  const words = []; // source units in reading order: <w> text, or the <q> text of a group
  const groups = [];
  let group = null;
  const closeGroup = () => {
    if (!group) return;
    groups.push({ wordIndex: words.length, ketiv: group.ketiv, qere: group.qere });
    words.push(...group.qere);
    group = null;
  };
  for (const c of elementsOf(vEl)) {
    if (c.name === 'k') {
      if (group && group.qere.length) closeGroup();
      group ??= { ketiv: [], qere: [] };
      group.ketiv.push(unitText(c, loc, stats));
    } else if (c.name === 'q') {
      group ??= { ketiv: [], qere: [] };
      group.qere.push(unitText(c, loc, stats));
    } else {
      closeGroup();
      if (c.name === 'w') {
        words.push(unitText(c, loc, stats));
      } else if (c.name === 'x') {
        stats.notesDropped[deepText(c)] = (stats.notesDropped[deepText(c)] ?? 0) + 1;
      } else if (c.name === 'pe' || c.name === 'samekh') {
        stats.markers[c.name] = (stats.markers[c.name] ?? 0) + 1; // petuha/setuma: not text
      } else {
        throw new Error(`${loc}: unhandled element <${c.name}> inside <v>`);
      }
    }
  }
  closeGroup();
  if (words.length === 0) throw new Error(`${loc}: verse has no words`);
  return { text: joinWords(words), groups };
}

export function extractPsalms(doc, expected = EXPECTED_VERSES) {
  const stats = { notesDropped: {}, markers: {} };
  const tanachRoot = one(doc, 'Tanach');
  const header = one(tanachRoot, 'teiHeader');
  const book = one(one(tanachRoot, 'tanach'), 'book');

  const edition = one(one(one(header, 'fileDesc'), 'editionStmt'), 'edition');
  const bibl = childrenNamed(one(one(header, 'fileDesc'), 'sourceDesc'), 'biblItem');
  const wlcBibl = bibl.find((b) => childrenNamed(b, 'title').some((t) => deepText(t).includes('Westminster Leningrad Codex')));
  if (!wlcBibl) throw new Error('header: no WLC <biblItem> found');
  const info = {
    version: deepText(one(edition, 'version')).trim(),
    editionDate: deepText(one(edition, 'date')).trim(),
    build: deepText(one(edition, 'build')).trim(),
    buildDateTime: deepText(one(edition, 'buildDateTime')).trim().replace(/\s+/g, ' '),
    derivedFrom: deepText(one(wlcBibl, 'edition')).trim(),
    bookName: deepText(one(one(book, 'names'), 'name')).trim(),
  };
  if (info.bookName !== 'Psalms') throw new Error(`book is ${info.bookName}, not Psalms`);

  const wanted = new Set(Object.keys(expected).map(Number));
  const chapters = {};
  const ketiv = {};
  const sourceVs = {};
  const problems = [];
  let chapterCount = 0;
  let verseCount = 0; // every <v> in the book, not only the chapters we extract
  const bookTotals = {}; // the source's own book-level <vs> (verses) and <cs> (chapters)

  for (const ch of elementsOf(book)) {
    if (ch.name === 'names') continue;
    if (ch.name === 'vs' || ch.name === 'cs') {
      bookTotals[ch.name] = Number(deepText(ch).trim());
      continue;
    }
    if (ch.name !== 'c') throw new Error(`book: unexpected <${ch.name}>`);
    const cn = Number(ch.attrs.n);
    if (!Number.isInteger(cn)) throw new Error(`<c> with bad n=${JSON.stringify(ch.attrs.n)}`);
    chapterCount++;
    verseCount += childrenNamed(ch, 'v').length;
    if (!wanted.has(cn)) continue;
    if (chapters[cn]) throw new Error(`chapter ${cn} appears twice`);
    assertNoStrayText(ch, `Ps ${cn}`);

    const verses = {};
    let expectedNo = 1;
    for (const c of elementsOf(ch)) {
      if (c.name === 'vs') {
        sourceVs[cn] = Number(deepText(c).trim());
        continue;
      }
      if (c.name !== 'v') throw new Error(`Ps ${cn}: unhandled element <${c.name}> inside <c>`);
      const vn = Number(c.attrs.n);
      const loc = `Ps ${cn}:${c.attrs.n}`;
      if (vn !== expectedNo) throw new Error(`${loc}: verse number out of sequence (expected ${expectedNo})`);
      expectedNo++;
      const { text, groups } = extractVerse(c, loc, stats);
      verses[vn] = text;
      if (groups.length) (ketiv[cn] ??= {})[vn] = groups;
    }
    chapters[cn] = verses;
  }

  for (const cn of wanted) {
    if (!chapters[cn]) {
      problems.push(`chapter ${cn}: missing from source`);
      continue;
    }
    const got = Object.keys(chapters[cn]).length;
    if (got !== expected[cn]) problems.push(`chapter ${cn}: expected ${expected[cn]} verses, source has ${got}`);
    if (sourceVs[cn] !== got) problems.push(`chapter ${cn}: source <vs> says ${sourceVs[cn]}, but ${got} <v> elements`);
  }
  if (bookTotals.cs !== chapterCount) problems.push(`book: source <cs> says ${bookTotals.cs} chapters, found ${chapterCount} <c>`);
  if (bookTotals.vs !== verseCount) problems.push(`book: source <vs> says ${bookTotals.vs} verses, found ${verseCount} <v>`);
  if (problems.length) throw new Error(`versification mismatch:\n  ${problems.join('\n  ')}`);

  return { header: info, chapters, ketiv, stats, bookTotals: { chapters: chapterCount, verses: verseCount } };
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { raw: RAW_PATH, out: OUT_PATH, retrievedAt: '2026-10-15', allowSourceUpdate: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--raw') opts.raw = argv[++i];
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--retrieved-at') opts.retrievedAt = argv[++i];
    else if (a === '--allow-source-update') opts.allowSourceUpdate = true;
    else throw new Error(`unknown argument ${a}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.retrievedAt)) throw new Error('--retrieved-at must be YYYY-MM-DD');
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const buf = readFileSync(opts.raw);
  const sha256 = createHash('sha256').update(buf).digest('hex');
  if (sha256 !== LOCK.sha256 && !opts.allowSourceUpdate) {
    throw new Error(
      `${opts.raw}: SHA-256 ${sha256} differs from LOCK ${LOCK.sha256}.\n` +
        'The source changed (or is not the locked file). Review it, then re-run with --allow-source-update and update LOCK and SOURCE.md.',
    );
  }
  const xml = buf.toString('utf8');
  const { header, chapters, ketiv, stats } = extractPsalms(parseXml(xml));

  const allVerses = Object.values(chapters).flatMap((c) => Object.values(c));
  const versesNotNfc = allVerses.filter((t) => t.normalize('NFC') !== t).length;
  const counts = Object.fromEntries(Object.entries(chapters).map(([c, v]) => [c, Object.keys(v).length]));
  const ketivQereGroups = Object.values(ketiv).reduce((n, vs) => n + Object.values(vs).reduce((m, g) => m + g.length, 0), 0);

  const out = {
    source: {
      name: 'Unicode/XML Leningrad Codex (UXLC), derived from the Westminster Leningrad Codex',
      url: LOCK.url,
      license: LICENSE.license,
      licenseUrl: LICENSE.licenseUrl,
      citation: LICENSE.citation,
      notice: LICENSE.notice,
      version: header.version,
      build: header.build,
      editionDate: header.editionDate,
      derivedFrom: header.derivedFrom,
      retrievedAt: opts.retrievedAt,
      sha256,
      normalization: {
        applied: 'none',
        sourceXmlIsNFC: xml.normalize('NFC') === xml,
        versesNotNFC: versesNotNfc,
        versesTotal: allVerses.length,
      },
      reading: 'Verse text uses the QERE where the source has ketiv/qere; ketiv forms are in the top-level "ketiv" map.',
    },
    chapters,
    // ketiv[chapter][verse] = [{ wordIndex, ketiv: [...], qere: [...] }]
    // wordIndex = 0-based index, among the verse's source units (<w>, or each <q>), of the first
    // qere word that replaced the ketiv in the verse text (a <w> may itself contain a space + paseq).
    ketiv,
  };

  mkdirSync(dirname(opts.out), { recursive: true });
  writeFileSync(opts.out, JSON.stringify(out, null, 2) + '\n', 'utf8');

  console.log(`source   ${header.version} (build ${header.build}, ${header.editionDate}), from ${header.derivedFrom}`);
  console.log(`sha256   ${sha256}`);
  console.log(`chapters ${JSON.stringify(counts)}`);
  console.log(`verses   ${allVerses.length} (expected ${Object.values(EXPECTED_VERSES).reduce((a, b) => a + b, 0)})`);
  console.log(`ketiv/qere groups ${ketivQereGroups}`);
  console.log(`notes dropped (<x> by code) ${JSON.stringify(stats.notesDropped)}; markers ${JSON.stringify(stats.markers)}`);
  console.log(`NFC: source ${out.source.normalization.sourceXmlIsNFC ? 'is' : 'is NOT'} NFC; ${versesNotNfc}/${allVerses.length} verses would change under NFC (not applied)`);
  console.log(`wrote ${opts.out}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (e) {
    console.error(`import-wlc: ${e.message}`);
    process.exit(1);
  }
}
