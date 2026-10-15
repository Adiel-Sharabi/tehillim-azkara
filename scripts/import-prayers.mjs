#!/usr/bin/env node
// Import vowelled Ashkenaz prayers (Kaddish Yatom, Kaddish DeRabbanan, El Male Rachamim) ONCE, with provenance.
//
//   node scripts/import-prayers.mjs             fetch from Sefaria + Hebrew Wikisource, build prayers.json
//   node scripts/import-prayers.mjs --offline   rebuild from sources/prayers/raw/ (no network)
//   node scripts/import-prayers.mjs --relock    accept changed upstream text and rewrite prayers.lock.json
//
// The site itself never calls these APIs; this script is the only network consumer, and it is a build-time tool.
// Node built-ins only. Every unexpected input throws (no silent fallbacks, no guessing).
//
// Outputs (paths relative to the repo root):
//   sources/prayers/raw/*              raw API responses + manifest.json (gitignored via sources/**/raw/)
//   sources/prayers/prayers.json       editions -> texts -> [{role, text, ...}]
//   sources/prayers/prayers.lock.json  sha256 of each upstream payload (version lock; commit this)
//   sources/prayers/diff-report.json   consonant-level comparison of the license-clear editions

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rawStore, sha256 } from './raw-store.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'sources', 'prayers');
const RAW_DIR = path.join(OUT_DIR, 'raw');
const OFFLINE = process.argv.includes('--offline');
const RELOCK = process.argv.includes('--relock');

// ---------------------------------------------------------------------------------------------
// Licensing policy. Only these Sefaria `license` strings are accepted, whatever the version title says
// (note: Sefaria has a version literally titled "Public Domain" whose license field is "unknown").
// URL mapping copied from Sefaria-Project static/js/sefaria/sefaria.js (licenseMap, lines ~1140-1145).
// ---------------------------------------------------------------------------------------------
const LICENSE_URLS = {
  'Public Domain': 'https://en.wikipedia.org/wiki/Public_domain',
  'CC0': 'https://creativecommons.org/publicdomain/zero/1.0/',
  'CC-BY': 'https://creativecommons.org/licenses/by/3.0/',
  'CC-BY-SA': 'https://creativecommons.org/licenses/by-sa/3.0/',
};

// Sefaria editions. `texts[key]` = { ref, from?, to? (1-based inclusive slice of the returned segment array), parser }.
const SEFARIA_EDITIONS = {
  'sefaria-daat-siddur-ashkenaz': {
    index: 'Siddur_Ashkenaz',
    versionTitle: 'Daat Siddur Ashkenaz',
    expectLicense: 'Public Domain',
    texts: {
      'kaddish-yatom': { ref: "Siddur Ashkenaz, Kaddish, Mourner's Kaddish", parser: 'daat', expectCongregation: 7 },
      'kaddish-derabbanan': { ref: "Siddur Ashkenaz, Kaddish, Kaddish d'Rabbanan", parser: 'daat', expectCongregation: 7 },
    },
    notes: [
      'Hebrew text of the Ashkenaz siddur as digitised from daat.ac.il (Sefaria versionSource).',
      'Congregation responses are marked by the source itself: a bracketed [..] group, and in the Mourner\'s Kaddish also an explicit label (קהל:, קהל ואבל:, אבל:). Unmarked text is the reader (leader/mourner).',
    ],
  },
  'sefaria-metsudah-siddur-1981': {
    index: 'Siddur_Ashkenaz',
    versionTitle: 'The Metsudah siddur, 1981',
    expectLicense: 'CC-BY',
    texts: {
      'kaddish-yatom': { ref: "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Mourner's Kaddish", parser: 'metsudah', expectCongregation: 7 },
      'kaddish-derabbanan': { ref: 'Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Korbanot, Kaddish DeRabbanan', parser: 'metsudah', expectCongregation: 8 },
    },
    notes: [
      'Metsudah linear siddur (Avrohom Davis, 1981), Hebrew column only. Sefaria carries it under the weekday/Shabbat refs, not under the stand-alone "Kaddish" section.',
      'Congregation responses are bold in the source (א\u05B8מ\u05B5ן, ב\u05B0\u05BCר\u05B4יך\u05B0 הו\u05BCא, י\u05B0ה\u05B5א ש\u05B0\u05C1מ\u05B5ה\u05BC ר\u05B7ב\u05B8\u05BCא...); the first Amen of each paragraph is also in parentheses. Sefaria gives no legend for the bold, so the convention is inferred from use: every bold run in these two prayers other than the opening word is a congregational response.',
      'The opening word י\u05B4ת\u05B0ג\u05B7\u05BCד\u05B7\u05BCל is bold too, but it is an incipit marker (the same bolding opens א\u05B7ב ה\u05B8ר\u05B7ח\u05B2מ\u05B4ים and א\u05B7ש\u05B0\u05C1ר\u05B5י elsewhere in the Metsudah machzor), not a response; it stays with the reader.',
      'Aseret Yemei Teshuva alternates are parenthesised in the source and are emitted as role "instruction" segments, e.g. (בעשי"ת ...). The optional "(ו\u05B0א\u05B7ר\u05B0ע\u05B8א)" is kept inside the reader text as printed.',
      'Contains non-standard marks: U+0592 (a sheva-na marker, e.g. ב\u05B0\u05BCע\u05B8ל\u05B0\u0592מ\u05B8\u05BDא) and U+05BD meteg. They are kept as the source has them; a display layer may want to strip U+0592.',
    ],
  },
};

// El Male Rachamim: Siddur Ashkenaz on Sefaria has no El Male (only Av HaRachamim), so it comes from the
// Metsudah Yom Kippur Machzor (Memorial Services). One fetch of the whole section; two slices.
const SEFARIA_MACHZOR = {
  id: 'sefaria-metsudah-machzor-yk-ashkenaz-linear',
  index: 'Machzor_Yom_Kippur_Ashkenaz_Linear',
  versionTitle: 'The Metsudah Machzor. Metsudah Publications, New York',
  expectLicense: 'CC-BY',
  ref: 'Machzor Yom Kippur Ashkenaz Linear, Memorial Services',
  // 1-based segment numbers inside the section, validated by content below
  slices: { 'el-male-rachamim': [72, 93], 'el-male-rachamim-female': [95, 117] },
  notes: [
    'El Male Rachamim as printed in the Metsudah Yom Kippur Machzor (Ashkenaz), Hebrew column. Two paragraphs: for a man (ש\u05B6\u05C1ה\u05B8ל\u05B7ך\u05B0 ל\u05B0עו\u05B9ל\u05B8מו\u05B9 ...) and for a woman (ש\u05B6\u05C1ה\u05B8ל\u05B0כ\u05B8ה ל\u05B0עו\u05B9ל\u05B8מ\u05B8ה\u05BC ...). Key "el-male-rachamim" = man, "el-male-rachamim-female" = woman.',
    'Name slot: its own line (פב"פ) between "א\u05B6ת נ\u05B4ש\u05B0\u05C1מ\u05B7ת" and the relative clause; flagged slot:"name". It abbreviates פלוני בן פלוני; the source prints the same abbreviation for the woman\'s form (no separate בת/אמה wording).',
    'The Tetragrammaton is printed fully pointed (י\u05B0ה\u05B9ו\u05B8ה). That is how the source has it; the display layer must decide how to render the Name. It is NOT altered here.',
    'The source is line-per-phrase; each source line is one segment. Nothing in this prayer is marked as a congregation response in the source, so every segment is "leader" (the person reciting).',
    'Same Yom Kippur Memorial Services section also holds the Yizkor paragraphs and Av HaRachamim; they are not imported.',
  ],
};

// Hebrew Wikisource fallback for El Male Rachamim. Revision is pinned so a rerun gets identical text.
const WIKISOURCE = {
  id: 'wikisource-he-el-male-rachamim',
  api: 'https://he.wikisource.org/w/api.php',
  title: 'אל מלא רחמים',
  pinnedRevid: 3007226,
  expectLicenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  sections: { 'el-male-rachamim': 'לנפטר', 'el-male-rachamim-female': 'לנפטרת' },
  notes: [
    'FALLBACK edition (not Sefaria). Hebrew Wikisource page "אל מלא רחמים", sections לנפטר (man) and לנפטרת (woman); the other sections of the page (IDF fallen, Shoah victims) are not imported.',
    'Name slot: rendered by the wiki template {{פבפ}} as "שם ב\u05B6\u05BCן שם האב" (man) / "שם ב\u05B7\u05BCת שם האב" (woman); emitted as one segment flagged slot:"name". The grey sub-scripts are the placeholders.',
    'The page does not state a nusach. The wording is Ashkenaz (על כנפי, שנדבו צדקה, יסתירהו בסתר כנפיו) and agrees with the Metsudah text apart from the differences listed in diff-report.json.',
    'The Name is written י\u05B0י\u05B8 (as in most Ashkenaz printings), unlike Metsudah\'s pointed Tetragrammaton.',
    'The woman\'s form carries an alternative reading in parentheses, (נ״א: י\u05B7ס\u05B0ת\u05B4\u05BCיר\u05B8ה\u05BC), emitted as role "instruction".',
    'CC BY-SA 4.0 requires attribution (page title + revision link + source.historyUrl; registered contributors are in source.contributors, anonymous ones are only counted) and share-alike for adaptations of the text.',
  ],
};

// ---------------------------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------------------------
const fail = (msg) => { throw new Error(msg); };
const assert = (cond, msg) => { if (!cond) fail(msg); };

const { manifest, getRaw, saveManifest } = rawStore(RAW_DIR, { offline: OFFLINE });

// ---------------------------------------------------------------------------------------------
// Hebrew helpers
// ---------------------------------------------------------------------------------------------
const cp = (n) => String.fromCodePoint(n);
const range = (a, b) => cp(a) + '-' + cp(b);
const MARK_CLASS = range(0x591, 0x5c7); // cantillation, points, maqaf, paseq, sof pasuq, nun hafukha
const NIKKUD_CLASS = range(0x5b0, 0x5bc) + cp(0x5c1) + cp(0x5c2) + cp(0x5c7); // vowels, dagesh, shin/sin dot
const MAQAF = cp(0x5be);
const SHIN = cp(0x5e9);
const MARKS_RE = new RegExp('[' + MARK_CLASS + ']', 'g');
const NIKKUD_RE = new RegExp('[' + NIKKUD_CLASS + ']');
const LETTER_RE = /[א-ת]/;

/** Consonants only, words separated by single spaces. Maqaf becomes a space BEFORE marks are stripped. */
function skeleton(s) {
  return s.replace(new RegExp(MAQAF, 'g'), ' ').replace(MARKS_RE, '').replace(/[^א-ת]+/g, ' ').trim();
}

function vowelStats(texts) {
  const words = texts.join(' ').split(new RegExp('[\\s' + MAQAF + ']+')).filter((w) => LETTER_RE.test(w));
  const unvowelled = words.filter((w) => !NIKKUD_RE.test(w));
  const all = texts.join(' ');
  const shinNoDot = (all.match(new RegExp(SHIN + '(?![' + MARK_CLASS + ']*[' + cp(0x5c1) + cp(0x5c2) + '])', 'g')) || []).length;
  const cantillation = {};
  for (const ch of all) {
    const c = ch.codePointAt(0);
    if ((c >= 0x591 && c <= 0x5af) || c === 0x5bd) cantillation['U+' + c.toString(16).toUpperCase().padStart(4, '0')] = (cantillation['U+' + c.toString(16).toUpperCase().padStart(4, '0')] || 0) + 1;
  }
  const M = '[' + MARK_CLASS + ']*';
  const tetragrammaton = (all.match(new RegExp('(?:^|[\\s' + MAQAF + '])[בכלומש]?' + M + 'י' + M + 'ה' + M + 'ו' + M + 'ה(?![א-ת])', 'g')) || []).length;
  return {
    words: words.length,
    wordsWithoutNikkud: unvowelled.length,
    unvowelledWords: [...new Set(unvowelled)],
    shinWithoutDot: shinNoDot,
    cantillationAndMetegMarks: cantillation,
    pointedTetragrammatonWords: tetragrammaton,
    yiAbbreviationWords: words.filter((w) => skeleton(w) === 'יי').length,
  };
}

/** Man's form has שהלך (final kaf), woman's has שהלכה; compared on consonants so mark order cannot matter. */
function checkGender(key, text) {
  const w = skeleton(text).split(' ');
  const female = key.endsWith('-female');
  assert(female ? w.includes('שהלכה') && !w.includes('שהלך') : w.includes('שהלך') && !w.includes('שהלכה'), `${key}: gender wording does not match the key`);
}

// ---------------------------------------------------------------------------------------------
// HTML handling (Sefaria segments carry <b>, <small>, <em>)
// ---------------------------------------------------------------------------------------------
const NAMED_ENTITIES = { nbsp: cp(0xa0), amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    if (e in NAMED_ENTITIES) return NAMED_ENTITIES[e];
    return fail(`unknown HTML entity ${m}`);
  });
}

// Private-use sentinels stand in for the three tag pairs we allow; anything else is an error.
const B_OPEN = cp(0xe000), B_CLOSE = cp(0xe001), S_OPEN = cp(0xe002), S_CLOSE = cp(0xe003), E_OPEN = cp(0xe004), E_CLOSE = cp(0xe005);
const TAG_SENTINELS = { b: [B_OPEN, B_CLOSE], small: [S_OPEN, S_CLOSE], em: [E_OPEN, E_CLOSE] };
const SENTINEL_CLASS = range(0xe000, 0xe005);
const SENTINEL_RE = new RegExp('[' + SENTINEL_CLASS + ']', 'g'); // for replace only
const HAS_SENTINEL = new RegExp('[' + SENTINEL_CLASS + ']'); // for test

function mark(html) {
  assert(!HAS_SENTINEL.test(html), 'private-use character in source');
  const marked = html.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (m, slash, name) => {
    const pair = TAG_SENTINELS[name.toLowerCase()];
    if (!pair) fail(`unexpected HTML tag ${m} in: ${html.slice(0, 80)}`);
    if (/\sstyle=|\sclass=/.test(m)) fail(`unexpected attributes in ${m}`);
    return slash ? pair[1] : pair[0];
  });
  assert(!/[<>]/.test(marked), `stray angle bracket after tag handling: ${html.slice(0, 80)}`);
  return decodeEntities(marked);
}

/** Final text cleanup: no sentinels may remain; whitespace collapsed; ends trimmed. */
function clean(s, where) {
  assert(!HAS_SENTINEL.test(s), `markup left in text (${where}): ${JSON.stringify(s)}`);
  return s.replace(/\s+/g, ' ').trim(); // JS \s already covers NBSP
}
const strip = (s) => s.replace(SENTINEL_RE, '');

// ---------------------------------------------------------------------------------------------
// Parsers -> segments [{role, text, together?, slot?}]
//   role: "leader" (the person reciting) | "congregation" | "instruction" (rubric / variant / note)
// ---------------------------------------------------------------------------------------------

/** Daat Siddur Ashkenaz: [..] = congregation; labels <em><small>אבל:|קהל:|קהל ואבל:</small></em>; small-em בעשי"ת = instruction. */
function parseDaat(lines, key) {
  const segs = [];
  const labelRe = new RegExp(`${E_OPEN}${S_OPEN}([^${S_CLOSE}]*)${S_CLOSE}${E_CLOSE}|\\[([^\\]]*)\\]`, 'g');
  for (const line of lines) {
    if (line.trim() === '') continue;
    const m = mark(line);
    let role = 'leader', together = false, last = 0, mm;
    const flush = (t) => {
      const text = clean(t, key);
      if (!text) return;
      const seg = { role, text };
      if (role === 'congregation' && together) seg.together = true;
      segs.push(seg);
    };
    labelRe.lastIndex = 0;
    while ((mm = labelRe.exec(m))) {
      flush(m.slice(last, mm.index));
      last = labelRe.lastIndex;
      if (mm[1] !== undefined) {
        const label = mm[1].trim();
        if (label === 'אבל:') { role = 'leader'; together = false; }
        else if (label === 'קהל:') { role = 'congregation'; together = false; }
        else if (label === 'קהל ואבל:') { role = 'congregation'; together = true; }
        else if (/^בעשי[”"״]ת/.test(label)) segs.push({ role: 'instruction', text: clean(label, key) });
        else fail(`${key}: unknown Daat label ${JSON.stringify(label)}`);
      } else {
        // bracket group = congregation response, optionally prefixed by an explicit קהל: label
        let inner = mm[2];
        const lab = new RegExp(`^\\s*${E_OPEN}${S_OPEN}([^${S_CLOSE}]*)${S_CLOSE}${E_CLOSE}`).exec(inner);
        if (lab) {
          assert(lab[1].trim() === 'קהל:', `${key}: unexpected label inside brackets: ${JSON.stringify(lab[1])}`);
          inner = inner.slice(lab[0].length);
        }
        const text = clean(inner, key);
        assert(text, `${key}: empty bracket group`);
        segs.push({ role: 'congregation', text });
      }
    }
    flush(m.slice(last));
  }
  return segs;
}

/** Metsudah: bold = congregation response (whitelist), bold opening word = incipit (leader),
 *  parenthesised <small>בעשי"ת</small> alternates and stand-alone <small> lines = instruction. */
const METSUDAH_RESPONSES = new Set(['אמן', 'בריך הוא', 'יהא שמה רבא מברך לעלם ולעלמי עלמיא']);
function parseMetsudah(lines, key) {
  const segs = [];
  let firstContent = true;
  const parenInstrRe = new RegExp(`\\(${S_OPEN}[^${S_CLOSE}]*${S_CLOSE}[^()]*\\)`, 'g');
  const boldRe = new RegExp(`${B_OPEN}([^${B_CLOSE}]*)${B_CLOSE}`, 'g');
  for (const line of lines) {
    if (line.trim() === '') continue;
    const m = mark(line);
    // 1. whole line is a <small> note
    if (new RegExp(`^${S_OPEN}[^${S_CLOSE}]*${S_CLOSE}$`).test(m.trim())) {
      segs.push({ role: 'instruction', text: clean(strip(m), key) });
      continue;
    }
    // 2. split out parenthesised small-led alternates
    const pieces = []; // {k:'text'|'instr', s}
    let last = 0, pm;
    parenInstrRe.lastIndex = 0;
    while ((pm = parenInstrRe.exec(m))) {
      pieces.push({ k: 'text', s: m.slice(last, pm.index) });
      pieces.push({ k: 'instr', s: pm[0] });
      last = parenInstrRe.lastIndex;
    }
    pieces.push({ k: 'text', s: m.slice(last) });
    // 3. split text pieces on bold
    const parts = [];
    for (const p of pieces) {
      if (p.k === 'instr') {
        const t = clean(strip(p.s), key);
        assert(/^\(בעשי"ת/.test(t), `${key}: unexpected parenthetical <small>: ${t}`);
        parts.push({ k: 'instr', s: t });
        continue;
      }
      let l = 0, bm;
      boldRe.lastIndex = 0;
      while ((bm = boldRe.exec(p.s))) {
        parts.push({ k: 'plain', s: p.s.slice(l, bm.index) });
        parts.push({ k: 'bold', s: bm[1] });
        l = boldRe.lastIndex;
      }
      parts.push({ k: 'plain', s: p.s.slice(l) });
    }
    // 4. resolve roles; fold "(" bold ")" and trailing punctuation into the congregation segment
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.k === 'bold') {
        const text0 = clean(p.s, key);
        const sk = skeleton(text0);
        let role;
        if (METSUDAH_RESPONSES.has(sk)) role = 'congregation';
        else if (firstContent && !parts.slice(0, i).some((x) => x.k === 'instr' || (x.k === 'plain' && clean(x.s, key)))) role = 'leader'; // incipit: opening word of the prayer
        else fail(`${key}: bold run that is neither a known response nor the opening word: ${JSON.stringify(text0)}`);
        if (role === 'congregation') {
          const prev = parts[i - 1], next = parts[i + 1];
          if (prev && prev.k === 'plain' && /\(\s*$/.test(prev.s) && next && next.k === 'plain' && /^\s*\)/.test(next.s)) {
            prev.s = prev.s.replace(/\(\s*$/, '');
            next.s = next.s.replace(/^\s*\)/, '');
          }
          let text = text0;
          if (next && next.k === 'plain') {
            const punct = /^\s*([:.,;]+)/.exec(next.s);
            if (punct) { text += punct[1]; next.s = next.s.slice(punct[0].length); }
          }
          p.role = 'congregation';
          p.text = text;
        } else {
          p.k = 'plain'; // the incipit is reader text; it is simply merged with its neighbours below
        }
      }
    }
    // 5. emit in order; adjacent reader text on one source line is one segment
    const lineStart = segs.length;
    const pushLeader = (text) => {
      const prev = segs[segs.length - 1];
      if (segs.length > lineStart && prev.role === 'leader') prev.text += ' ' + text;
      else segs.push({ role: 'leader', text });
    };
    for (const p of parts) {
      if (p.k === 'instr') segs.push({ role: 'instruction', text: p.s });
      else if (p.k === 'bold') { if (p.text) segs.push({ role: p.role, text: p.text }); }
      else { const t = clean(p.s, key); if (t) pushLeader(t); } // cleaned late: neighbours may have folded "(" / ")" / ":" out of it
    }
    firstContent = false;
  }
  return segs;
}

/** Metsudah machzor El Male: plain lines; the (פב"פ) line is the name slot. No role information in the source. */
function parsePlainLines(lines, key, slotRe) {
  const segs = [];
  let slots = 0;
  for (const line of lines) {
    if (line.trim() === '') continue;
    assert(!/[<>&]/.test(line), `${key}: unexpected markup in line ${JSON.stringify(line)}`);
    const text = clean(line, key);
    if (slotRe.test(text)) { segs.push({ role: 'leader', text, slot: 'name' }); slots++; }
    else segs.push({ role: 'leader', text });
  }
  assert(slots === 1, `${key}: expected exactly one name slot, found ${slots}`);
  return segs;
}

/** Hebrew Wikisource rendered HTML (action=parse&oldid=...) -> segments for one <section>. */
function parseWikisourceSection(html, sectionId, key) {
  const secRe = new RegExp(`<section [^>]*aria-labelledby="${sectionId}"[^>]*>([\\s\\S]*?)</section>`);
  const sm = secRe.exec(html);
  assert(sm, `${key}: section ${sectionId} not found in parse output`);
  const dds = [...sm[1].matchAll(/<dd\b[^>]*>([\s\S]*?)<\/dd>/g)].map((x) => x[1]);
  assert(dds.length >= 8, `${key}: only ${dds.length} lines in section ${sectionId}`);
  const segs = [];
  let slots = 0;
  for (let dd of dds) {
    // name slot: <b ... typeof="mw:Transclusion" ...> grey "שם" + בֶּן/בַּת + grey "שם האב" </b>
    const slotRe = /<b\b[^>]*typeof="mw:Transclusion"[^>]*>([\s\S]*?)<\/b>/;
    const sl = slotRe.exec(dd);
    // optional alternative reading: ( <small ... typeof="mw:Transclusion">נ״א: ...</small> )
    const smallRe = /\(<small\b[^>]*typeof="mw:Transclusion"[^>]*>([\s\S]*?)<\/small>\)/;
    const parts = [];
    let rest = dd;
    const emitText = (h) => {
      const t = clean(decodeEntities(h.replace(/<[^>]+>/g, '')), key);
      if (t) parts.push({ role: 'leader', text: t });
    };
    // Process in textual order: find earliest of the two special elements.
    for (;;) {
      const a = slotRe.exec(rest), b = smallRe.exec(rest);
      const hit = !a ? b : !b ? a : (a.index < b.index ? a : b);
      if (!hit) { emitText(rest); break; }
      emitText(rest.slice(0, hit.index));
      if (hit === a) {
        const text = clean(decodeEntities(hit[1].replace(/<[^>]+>/g, '')), key);
        assert(/^שם (בן|בת) שם ה(אב|אם)$/.test(skeleton(text)), `${key}: unexpected name-slot text ${JSON.stringify(text)}`);
        parts.push({ role: 'leader', text, slot: 'name' });
        slots++;
      } else {
        parts.push({ role: 'instruction', text: '(' + clean(decodeEntities(hit[1].replace(/<[^>]+>/g, '')), key) + ')' });
      }
      rest = rest.slice(hit.index + hit[0].length);
    }
    segs.push(...parts);
  }
  assert(slots === 1, `${key}: expected exactly one name slot, found ${slots}`);
  return segs;
}

// ---------------------------------------------------------------------------------------------
// Sefaria access with license + version guards
// ---------------------------------------------------------------------------------------------
const sefariaTextUrl = (ref, versionTitle) =>
  'https://www.sefaria.org/api/v3/texts/' + encodeURIComponent(ref) + '?version=' + encodeURIComponent('hebrew|' + versionTitle);
const sefariaViewUrl = (ref, versionTitle) =>
  'https://www.sefaria.org/' + encodeURIComponent(ref.replace(/ /g, '_')).replace(/%27/g, "'") + '?lang=he&ven=' + encodeURIComponent('hebrew|' + versionTitle.replace(/ /g, '_'));

async function checkedVersionMeta(index, versionTitle, expectLicense) {
  const url = 'https://www.sefaria.org/api/texts/versions/' + encodeURIComponent(index);
  const list = await getRaw(`sefaria-versions-${index}.json`, url);
  const matches = list.filter((v) => v.language === 'he' && v.versionTitle === versionTitle);
  assert(matches.length === 1, `${index}: expected exactly one Hebrew version titled ${JSON.stringify(versionTitle)}, found ${matches.length}`);
  const v = matches[0];
  assert(v.license === expectLicense, `${index}/${versionTitle}: license is ${JSON.stringify(v.license)}, expected ${expectLicense}`);
  assert(Object.hasOwn(LICENSE_URLS, v.license), `${index}/${versionTitle}: license ${v.license} is not on the allow-list`);
  return v;
}

async function fetchSefariaText(rawName, ref, versionTitle, expectLicense) {
  const url = sefariaTextUrl(ref, versionTitle);
  const j = await getRaw(rawName, url);
  assert(Array.isArray(j.versions) && j.versions.length === 1, `${ref}: expected exactly one returned version, got ${j.versions?.length}`);
  const v = j.versions[0];
  assert(v.versionTitle === versionTitle, `${ref}: Sefaria returned version ${JSON.stringify(v.versionTitle)}, not ${JSON.stringify(versionTitle)}`);
  assert(v.language === 'he', `${ref}: returned language ${v.language}`);
  assert(v.license === expectLicense, `${ref}: returned license ${v.license}, expected ${expectLicense}`);
  assert(Array.isArray(v.text) && v.text.every((x) => typeof x === 'string'), `${ref}: text is not a flat array of strings`);
  return { url, json: j, version: v, payloadSha: sha256(JSON.stringify(v.text)) };
}

// ---------------------------------------------------------------------------------------------
// Diff (consonant level, word LCS)
// ---------------------------------------------------------------------------------------------
// The word אמן is dropped before comparing: Daat prints the reader's "ואמרו אמן" AND a separate bracketed congregation
// Amen, Metsudah prints one bold Amen, so Amen counts differ by layout, not by text.
const IGNORED_WORDS = new Set(['אמן']);
function comparableWords(segs) {
  return skeleton(segs.filter((s) => s.role !== 'instruction' && !s.slot).map((s) => s.text).join(' ')).split(' ').filter((w) => w && !IGNORED_WORDS.has(w));
}
function wordDiff(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const changes = [];
  let i = 0, j = 0, cur = null;
  const close = () => { if (cur) { changes.push({ a: cur.a.join(' '), b: cur.b.join(' '), at: cur.at }); cur = null; } };
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { close(); i++; j++; continue; }
    if (!cur) cur = { a: [], b: [], at: a.slice(Math.max(0, i - 3), i).join(' ') };
    if (j >= m || (i < n && dp[i + 1][j] >= dp[i][j + 1])) cur.a.push(a[i++]); else cur.b.push(b[j++]);
  }
  close();
  return changes;
}
function compare(key, idA, segsA, idB, segsB) {
  const wa = comparableWords(segsA), wb = comparableWords(segsB);
  const changes = wordDiff(wa, wb);
  return { text: key, a: idA, b: idB, wordsA: wa.length, wordsB: wb.length, identicalConsonants: changes.length === 0, changes };
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------
async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const lockPath = path.join(OUT_DIR, 'prayers.lock.json');
  const priorLock = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, 'utf8')) : null;
  const lock = { note: 'sha256 of each upstream payload (Sefaria: JSON.stringify(version.text); Wikisource: parse HTML of the pinned revid). A mismatch aborts the import unless --relock.', payloads: {} };
  const editions = {};
  const diffs = [];
  const textsByEdition = {};

  // ---- Sefaria siddur editions (Kaddish) ----
  for (const [id, cfg] of Object.entries(SEFARIA_EDITIONS)) {
    const meta = await checkedVersionMeta(cfg.index, cfg.versionTitle, cfg.expectLicense);
    const texts = {}, refs = {}, apiUrls = {}, viewUrls = {}, payloadSha = {}, validation = {};
    let retrievedAt = '';
    for (const [key, t] of Object.entries(cfg.texts)) {
      const rawName = `sefaria-${id.replace(/^sefaria-/, '')}-${key}.json`;
      const r = await fetchSefariaText(rawName, t.ref, cfg.versionTitle, cfg.expectLicense);
      const segs = (t.parser === 'daat' ? parseDaat : parseMetsudah)(r.version.text, `${id}/${key}`);
      const cong = segs.filter((s) => s.role === 'congregation').length;
      assert(cong === t.expectCongregation, `${id}/${key}: expected ${t.expectCongregation} congregation segments, found ${cong} (source shape changed?)`);
      assert(segs.some((s) => s.role === 'leader'), `${id}/${key}: no leader text`);
      texts[key] = segs;
      refs[key] = r.json.ref;
      apiUrls[key] = r.url;
      viewUrls[key] = sefariaViewUrl(t.ref, cfg.versionTitle);
      payloadSha[key] = r.payloadSha;
      lock.payloads[rawName] = r.payloadSha;
      validation[key] = { segments: segs.length, congregationSegments: cong, ...vowelStats(segs.filter((s) => s.role !== 'instruction').map((s) => s.text)) };
      retrievedAt = [retrievedAt, manifest.files[rawName].retrievedAt].sort().pop();
    }
    editions[id] = {
      source: {
        site: 'sefaria.org', ref: 'Siddur Ashkenaz', refs, versionTitle: cfg.versionTitle,
        license: meta.license, licenseUrl: LICENSE_URLS[meta.license],
        upstreamSource: meta.versionSource, url: viewUrls['kaddish-yatom'], viewUrls, apiUrls, payloadSha256: payloadSha, retrievedAt,
      },
      nusach: 'ashkenaz', reviewStatus: 'IMPORTED', texts, notes: cfg.notes, validation,
    };
    textsByEdition[id] = texts;
  }

  // ---- Sefaria Metsudah machzor (El Male) ----
  {
    const cfg = SEFARIA_MACHZOR;
    const meta = await checkedVersionMeta(cfg.index, cfg.versionTitle, cfg.expectLicense);
    const rawName = 'sefaria-metsudah-machzor-yk-ashkenaz-linear-memorial-services.json';
    const r = await fetchSefariaText(rawName, cfg.ref, cfg.versionTitle, cfg.expectLicense);
    const all = r.version.text;
    assert(all.length === 319, `${cfg.ref}: expected 319 segments, got ${all.length} (section changed?)`);
    lock.payloads[rawName] = r.payloadSha;
    const texts = {}, refs = {}, validation = {};
    for (const [key, [from, to]] of Object.entries(cfg.slices)) {
      const lines = all.slice(from - 1, to);
      const nonEmpty = lines.filter((l) => l.trim() !== '');
      assert(skeleton(nonEmpty[0]) === 'אל מלא רחמים', `${key}: slice ${from}-${to} does not start with El Male Rachamim: ${nonEmpty[0]}`);
      assert(skeleton(nonEmpty[nonEmpty.length - 1]) === 'ונאמר אמן', `${key}: slice ${from}-${to} does not end with "ו\u05B0נ\u05B9אמ\u05B7ר א\u05B8מ\u05B5ן:"`);
      const joined = nonEmpty.join(' ');
      checkGender(key, joined);
      texts[key] = parsePlainLines(lines, `${cfg.id}/${key}`, /^\(פב"פ\)$/);
      refs[key] = `${cfg.ref} ${from}-${to}`;
      validation[key] = { segments: texts[key].length, congregationSegments: 0, ...vowelStats(texts[key].filter((s) => !s.slot).map((s) => s.text)) };
    }
    editions[cfg.id] = {
      source: {
        site: 'sefaria.org', ref: 'Machzor Yom Kippur Ashkenaz Linear', refs, versionTitle: cfg.versionTitle,
        license: meta.license, licenseUrl: LICENSE_URLS[meta.license],
        upstreamSource: meta.versionSource, url: sefariaViewUrl(cfg.ref, cfg.versionTitle), apiUrls: { 'memorial-services (whole section)': r.url },
        payloadSha256: { 'memorial-services (whole section)': r.payloadSha }, retrievedAt: manifest.files[rawName].retrievedAt,
      },
      nusach: 'ashkenaz', reviewStatus: 'IMPORTED', texts, notes: cfg.notes, validation,
    };
    textsByEdition[cfg.id] = texts;
  }

  // ---- Hebrew Wikisource (El Male, fallback) ----
  {
    const w = WIKISOURCE;
    const q = (params) => w.api + '?' + new URLSearchParams({ format: 'json', formatversion: '2', ...params }).toString();
    const siteinfo = await getRaw('wikisource-siteinfo.json', q({ action: 'query', meta: 'siteinfo', siprop: 'rightsinfo' }));
    const rightsUrl = siteinfo.query.rightsinfo.url.replace(/[/]deed[.][a-z-]+$/i, '/'); // the wiki reports the localised deed page
    assert(rightsUrl === w.expectLicenseUrl, `Wikisource license is ${siteinfo.query.rightsinfo.url}, expected ${w.expectLicenseUrl}`);
    const latest = await getRaw('wikisource-el-male-rachamim.latest.json', q({ action: 'query', titles: w.title, prop: 'info|revisions', rvprop: 'ids|timestamp' }));
    const lp = latest.query.pages[0];
    assert(!lp.missing, 'Wikisource page is missing');
    const history = await getRaw('wikisource-el-male-rachamim.history.json', q({ action: 'query', titles: w.title, prop: 'revisions', rvprop: 'ids|timestamp|user', rvlimit: 'max' }));
    const parse = await getRaw('wikisource-el-male-rachamim.parse.json', q({ action: 'parse', oldid: String(w.pinnedRevid), prop: 'text|revid|displaytitle|wikitext' }));
    assert(parse.parse.revid === w.pinnedRevid && parse.parse.title === w.title, 'Wikisource parse returned a different revision/title than pinned');
    const html = parse.parse.text;
    const revs = history.query.pages[0].revisions;
    const pinned = revs.find((r) => r.revid === w.pinnedRevid);
    assert(pinned, 'pinned revid not found in page history');
    // Registered usernames only: anonymous edits are logged under IP addresses, which are personal data and stay out of tracked files.
    // Attribution for the rest is satisfied by the history link below (CC BY-SA allows attribution by hyperlink to the page history).
    const allUsers = [...new Set(revs.filter((r) => r.revid <= w.pinnedRevid).map((r) => r.user).filter(Boolean))];
    const isIp = (u) => /^([0-9]{1,3}[.]){3}[0-9]{1,3}$/.test(u) || u.includes(':');
    const contributors = allUsers.filter((u) => !isIp(u)).sort((x, y) => x.localeCompare(y));
    const anonymousContributorCount = allUsers.length - contributors.length;
    const historyUrl = `https://he.wikisource.org/w/index.php?title=${encodeURIComponent(w.title.replace(/ /g, '_'))}&action=history`;
    const newerExists = lp.lastrevid !== w.pinnedRevid;
    const payload = sha256(html);
    lock.payloads['wikisource-el-male-rachamim.parse.json'] = payload;
    const texts = {}, refs = {}, validation = {};
    for (const [key, sectionId] of Object.entries(w.sections)) {
      texts[key] = parseWikisourceSection(html, sectionId, `${w.id}/${key}`);
      refs[key] = `${w.title}#${sectionId}`;
      const joined = texts[key].map((s) => s.text).join(' ');
      checkGender(key, joined);
      validation[key] = { segments: texts[key].length, congregationSegments: 0, ...vowelStats(texts[key].filter((s) => !s.slot && s.role !== 'instruction').map((s) => s.text)) };
    }
    const retrievedAt = ['wikisource-el-male-rachamim.parse.json', 'wikisource-el-male-rachamim.latest.json', 'wikisource-el-male-rachamim.history.json', 'wikisource-siteinfo.json'].map((n) => manifest.files[n].retrievedAt).sort().pop();
    editions[w.id] = {
      source: {
        site: 'he.wikisource.org', ref: w.title, refs, versionTitle: `${w.title} (revision ${w.pinnedRevid}, ${pinned.timestamp})`,
        license: 'CC BY-SA 4.0', licenseUrl: w.expectLicenseUrl, revid: w.pinnedRevid, revisionTimestamp: pinned.timestamp,
        url: `https://he.wikisource.org/wiki/${encodeURIComponent(w.title.replace(/ /g, '_'))}?oldid=${w.pinnedRevid}`,
        apiUrls: { parse: manifest.files['wikisource-el-male-rachamim.parse.json'].url }, payloadSha256: { parse: payload },
        historyUrl, contributors, anonymousContributorCount, newerRevisionExistsAtRetrieval: newerExists, latestRevidAtRetrieval: lp.lastrevid, retrievedAt,
      },
      nusach: 'ashkenaz', reviewStatus: 'IMPORTED', texts, notes: w.notes, validation,
    };
    textsByEdition[w.id] = texts;
  }

  // ---- version lock ----
  if (priorLock && !RELOCK) {
    for (const [name, sha] of Object.entries(lock.payloads)) {
      assert(priorLock.payloads[name] === sha, `UPSTREAM CHANGED: ${name}\n  locked ${priorLock.payloads[name]}\n  now    ${sha}\nReview the change, then rerun with --relock.`);
    }
    for (const name of Object.keys(priorLock.payloads)) assert(name in lock.payloads, `lock file lists ${name} which is no longer imported`);
  } else {
    writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
    console.log(priorLock ? 'prayers.lock.json rewritten (--relock)' : 'prayers.lock.json created');
  }

  // ---- diffs between license-clear editions ----
  for (const key of ['kaddish-yatom', 'kaddish-derabbanan']) {
    diffs.push(compare(key, 'sefaria-daat-siddur-ashkenaz', textsByEdition['sefaria-daat-siddur-ashkenaz'][key], 'sefaria-metsudah-siddur-1981', textsByEdition['sefaria-metsudah-siddur-1981'][key]));
  }
  for (const key of ['el-male-rachamim', 'el-male-rachamim-female']) {
    diffs.push(compare(key, 'sefaria-metsudah-machzor-yk-ashkenaz-linear', textsByEdition['sefaria-metsudah-machzor-yk-ashkenaz-linear'][key], 'wikisource-he-el-male-rachamim', textsByEdition['wikisource-he-el-male-rachamim'][key]));
  }

  // ---- write ----
  writeFileSync(path.join(OUT_DIR, 'prayers.json'), JSON.stringify({ editions }, null, 2) + '\n');
  writeFileSync(path.join(OUT_DIR, 'diff-report.json'), JSON.stringify({ method: 'word-level LCS on consonant skeletons (marks U+0591-U+05C7 stripped, maqaf -> space, punctuation dropped); instruction and name-slot segments excluded; the word אמן ignored (layout, not text)', comparisons: diffs }, null, 2) + '\n');
  saveManifest();

  // ---- summary ----
  for (const [id, ed] of Object.entries(editions)) {
    console.log(`\n${id}  [${ed.source.license}]  retrieved ${ed.source.retrievedAt}`);
    for (const [k, v] of Object.entries(ed.validation)) {
      console.log(`  ${k}: ${v.segments} segments, ${v.congregationSegments} congregation, ${v.words} words, ${v.wordsWithoutNikkud} without nikkud, ${v.shinWithoutDot} shin without dot, Tetragrammaton words ${v.pointedTetragrammatonWords}` + (v.wordsWithoutNikkud ? `  unvowelled: ${v.unvowelledWords.join(' | ')}` : ''));
    }
  }
  console.log('\ndiffs:');
  for (const d of diffs) console.log(`  ${d.text}: ${d.a} vs ${d.b}: ${d.wordsA}/${d.wordsB} words, ${d.changes.length} change(s)`);
  console.log('\nwrote sources/prayers/prayers.json, diff-report.json');
}

main().catch((e) => { console.error('IMPORT FAILED: ' + e.message); process.exit(1); });
