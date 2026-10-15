#!/usr/bin/env node
// Import the memorial texts that the non-Ashkenaz templates need (Sefard, Edot HaMizrach, Morocco, Yemen),
// each from a license-clear reading edition plus independent witnesses, ONCE, with provenance.
//
//   node scripts/import-customs.mjs             fetch from Sefaria + Hebrew Wikisource, build sources/customs/*
//   node scripts/import-customs.mjs --offline   rebuild from sources/customs/raw/ (no network)
//   node scripts/import-customs.mjs --relock    accept changed upstream text and rewrite customs.lock.json
//
// Build-time only; the site never calls these APIs. Node built-ins only; every unexpected input throws.
//
// Outputs (repo-relative):
//   sources/customs/raw/*               raw API responses + manifest.json (gitignored via sources/**/raw/)
//   sources/customs/customs.json        editions -> texts -> [{role, text, slot?, together?}]
//   sources/customs/customs.lock.json   sha256 of each upstream payload (version lock; commit this)
//   sources/customs/diff-report.json    word-level consonant comparison of every reading text with its witnesses,
//                                       plus every pointing completion taken from a witness (see completePointing)
//
// Which edition is READ for each text is decided in lib/editions.js, not here; this script imports all of them.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rawStore, sha256 } from './raw-store.mjs';
import { consonantsOf } from '../lib/hebrew.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'sources', 'customs');
const RAW_DIR = path.join(OUT_DIR, 'raw');
const OFFLINE = process.argv.includes('--offline');
const RELOCK = process.argv.includes('--relock');
// No personal data: identifies the project and the purpose only.
const WS_API = 'https://he.wikisource.org/w/api.php';
const WS_SITE = 'https://he.wikisource.org';

const LICENSE_URLS = {
  'Public Domain': 'https://en.wikipedia.org/wiki/Public_domain',
  CC0: 'https://creativecommons.org/publicdomain/zero/1.0/',
  'CC-BY': 'https://creativecommons.org/licenses/by/3.0/',
  'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
};

// ---------------------------------------------------------------------------------------------
// Code points (marks are never written literally in code: see tests/source-marks.test.js)
// ---------------------------------------------------------------------------------------------
const cp = (...n) => String.fromCodePoint(...n);
const MARK_RE = /[\u0591-\u05C7]/u;
const NIKKUD_RE = /[\u05B0-\u05BC\u05C1\u05C2\u05C7]/u;
const LETTER_RE = /[א-ת]/u;
const MAQAF = cp(0x5be);
// אָמֵן: alef qamats, mem tsere, final nun. Used only where a source says in words that the congregation answers Amen.
const AMEN = cp(0x5d0, 0x5b8, 0x5de, 0x5b5, 0x5df);
// A parenthesised or bracketed placeholder that stands for the deceased's name.
const NAME_PLACEHOLDER_RE = /^(?:פלוני(?:ת)?(?: (?:בן|בת) פלוני(?:ת)?)?|פב"פ|פב״פ|שם(?: (?:בן|בת) שם (?:האב|האם))?)$/;

const fail = (msg) => { throw new Error(msg); };
const assert = (cond, msg) => { if (!cond) fail(msg); };

// ---------------------------------------------------------------------------------------------
// Editions. `texts[key]` names where the text is; `segments` is a 1-based inclusive slice of the
// returned segment array (Sefaria), `section` a heading (Wikisource wikitext), `render` a wikitext
// to render (Wikisource multi-nusach templates).
// ---------------------------------------------------------------------------------------------
const EDOT_MOURNING = 'Siddur Edot HaMizrach, Fast Days and Mourning, Mourning';
const EDITIONS = {
  'sefaria-metsudah-siddur-sefard-1981': {
    reviewStatus: 'INDEPENDENTLY_COMPARED', // see diff-report.json and sources/customs/SOURCE.md
    kind: 'sefaria', index: 'Siddur_Sefard', versionTitle: 'The Metsudah siddur, 1981', license: 'CC-BY',
    nusach: 'ספרד', smallRole: 'instruction', bracketRole: 'instruction',
    texts: {
      'kaddish-yatom-sefard': { ref: 'Siddur Sefard, Weekday Shacharit, Aleinu', segments: [6, 9] },
      'kaddish-derabbanan-sefard': { ref: "Siddur Sefard, Weekday Shacharit, B'raita d'Rabi Yishmael", segments: [4, 9] },
    },
    notes: [
      'Metsudah linear siddur, nusach Sefard (Avrohom Davis, 1981), Hebrew column. The Kaddish DeRabbanan is the one after the Braita of Rabbi Yishmael; the explanatory note before it (from the Tur) is segment 3 and is not imported.',
      'The source marks no congregation responses other than the bold יהא שמה רבא; none are added.',
      'Parenthesised rubrics such as (בעשי"ת ...) become instruction segments. The optional (ק\u05B5ץ) stays in the text, as printed.',
      'Contains U+0592 used as a sheva-na marker, as in the Metsudah Ashkenaz siddur; kept as the source has it.',
    ],
  },
  'sefaria-shaliehsaboo-edot': {
    reviewStatus: 'INDEPENDENTLY_COMPARED', // see diff-report.json and sources/customs/SOURCE.md
    kind: 'sefaria', index: 'Siddur_Edot_HaMizrach', versionTitle: ' Shaliehsaboo Edition', license: 'CC0',
    nusach: 'עדות המזרח', smallRole: 'ignore', bracketRole: 'congregation',
    texts: {
      'kaddish-yatom-edot': { ref: 'Siddur Edot HaMizrach, Weekday Shacharit, Song of the Day', segments: [29, 30] },
      'kaddish-derabbanan-edot': { ref: 'Siddur Edot HaMizrach, Weekday Shacharit, Kaveh', segments: [14, 16] },
      hashkava: { ref: EDOT_MOURNING, segments: [21, 21] },
      'hashkava-female': { ref: EDOT_MOURNING, segments: [28, 28] },
    },
    notes: [
      'Sefaria lists this Hebrew version twice, once titled " Shaliehsaboo Edition" (leading space, license CC0) and once "Shaliehsaboo Edition" (license unknown). Only the CC0 one is used.',
      'A cleaned derivative of the Torat Emet text (it fixes, e.g., the stray sheva in Torat Emet\'s ב\u05B4\u05BCר\u05B0כ\u05B8ת\u05B8א \u05B0ש\u05B4\u05C1יר\u05B8ת\u05B8א), so it is not independent of Torat Emet; Wikisource is the independent witness.',
      'Congregation responses are bracketed [א\u05B8מ\u05B5ן] in the source. Its short Hashkava ends at "רוח ה\' תניחנו בגן עדן" (shorter than Torat Emet and Wikisource), so it is a witness only for the Hashkava.',
    ],
  },
  'sefaria-torat-emet-357-edot': {
    reviewStatus: 'INDEPENDENTLY_COMPARED', // see diff-report.json and sources/customs/SOURCE.md
    kind: 'sefaria', index: 'Siddur_Edot_HaMizrach', versionTitle: 'Torat Emet 357', license: 'Public Domain',
    nusach: 'עדות המזרח', smallRole: 'ignore', bracketRole: 'congregation',
    texts: {
      'kaddish-yatom-edot': { ref: 'Siddur Edot HaMizrach, Weekday Shacharit, Song of the Day', segments: [29, 30] },
      'kaddish-derabbanan-edot': { ref: 'Siddur Edot HaMizrach, Weekday Shacharit, Kaveh', segments: [14, 16] },
      hashkava: { ref: EDOT_MOURNING, segments: [21, 21] },
      'hashkava-female': { ref: EDOT_MOURNING, segments: [27, 28] },
      'hashkava-long': { ref: EDOT_MOURNING, segments: [23, 24] },
      'hashkava-long-female': { ref: EDOT_MOURNING, segments: [30, 31] },
    },
    notes: [
      'Torat Emet 357 siddur, nusach Edot HaMizrach, via Sefaria (Public Domain). Its Hashkava section gives the standard form for a man and for a woman, and a longer form "for a great person"; the rubrics between them are not imported.',
      'Some words lack vowel points (e.g. מנו\u05BCח\u05B8ה נכו\u05B9נ\u05B8ה, ה\u05B7מ\u05BCר\u05B7ח\u05B5ם); missing points are completed from a witness only where the consonants and every existing mark agree (diff-report.json lists each one).',
    ],
  },
  'sefaria-torat-emet-357-sanhedrin': {
    reviewStatus: 'INDEPENDENTLY_COMPARED', // see diff-report.json and sources/customs/SOURCE.md
    kind: 'sefaria', index: 'Mishnah_Sanhedrin', versionTitle: 'Torat Emet 357', license: 'Public Domain',
    smallRole: 'instruction', bracketRole: 'instruction',
    texts: { 'kol-yisrael': { ref: 'Mishnah Sanhedrin 10:1', segments: [1, 1], cutAfter: 'להתפאר' } },
    notes: ['כל ישראל: the opening sentence of Mishnah Sanhedrin 10:1 (to להתפאר), read before Mishnah study in Sephardic and Moroccan custom. The verse reference (ישעיה ס) is an instruction segment.'],
  },
  'sefaria-romm-vilna-1913-sanhedrin': {
    kind: 'sefaria', index: 'Mishnah_Sanhedrin', versionTitle: 'Mishnah, ed. Romm, Vilna 1913', license: 'Public Domain',
    smallRole: 'instruction', bracketRole: 'instruction', unvowelled: true,
    texts: { 'kol-yisrael': { ref: 'Mishnah Sanhedrin 10:1', segments: [1, 1], cutAfter: 'להתפאר' } },
    notes: ['Unvowelled; a consonant-level witness only.'],
  },
  'wikisource-kaddish-nusachim': {
    reviewStatus: 'INDEPENDENTLY_COMPARED', // see diff-report.json and sources/customs/SOURCE.md
    kind: 'wikisource-render', nusach: 'multi', smallRole: 'instruction', bracketRole: 'instruction',
    pages: ['קדיש יתום', 'חצי קדיש', 'קדיש דרבנן'],
    texts: {
      'kaddish-yatom-sefard': { render: '{{:קדיש יתום|נוסח=ספרד}}' },
      'kaddish-derabbanan-sefard': { render: '{{:קדיש דרבנן|נוסח=ספרד}}' },
      'kaddish-yatom-edot': { render: '{{:קדיש יתום|נוסח=מזרח}}' },
      'kaddish-derabbanan-edot': { render: '{{:קדיש דרבנן|נוסח=מזרח}}' },
      'kaddish-yatom-baladi': { render: '{{:קדיש יתום|נוסח=בלדי}}' },
      'kaddish-derabbanan-baladi': { render: '{{:קדיש דרבנן|נוסח=בלדי}}' },
    },
    notes: [
      'Hebrew Wikisource keeps one Kaddish text with per-nusach variants (templates נוסחי תפילה); it is rendered by the Wikisource parser with נוסח=ספרד / מזרח / בלדי. The revision ids of the three pages at fetch time are recorded; the rendered HTML is sha256-locked.',
      'Rubrics in <small> are instruction segments. Where the source says in words "(ועונים: אמן)" the reading gets a congregation segment א\u05B8מ\u05B5ן; nothing else is added.',
      'Square brackets in this source hold local variants (e.g. [בא"י: ק\u05B7ד\u05B4\u05BCיש\u05B8\u05C1א]) and become instruction segments.',
      'The Baladi (Yemenite) text was cross-checked against the Yemenite variants listed in the Hamichlol article "חצי קדיש" (comparison only, not copied): ו\u05B0י\u05B4מ\u05B0לו\u05B9ך\u05B0, ו\u05B0י\u05B4פ\u05B0רו\u05B9ק ע\u05B7מ\u05B5\u05BCיה\u05BC, ו\u05BCב\u05B0ח\u05B7י\u05B5\u05BCיהו\u05B9ן, the order ו\u05B0י\u05B4ת\u05B0ע\u05B7ל\u05B6\u05BCה ו\u05B0י\u05B4ת\u05B0ה\u05B7ד\u05B7\u05BCר ו\u05B0י\u05B4ת\u05B0ה\u05B7ל\u05B7\u05BCל ו\u05B0י\u05B4ת\u05B0נ\u05B7ש\u05B5\u05BC\u05C2א, ל\u05B0ע\u05B5יל\u05B8א ל\u05B0ע\u05B5יל\u05B8א מ\u05B4כ\u05B8\u05BCל and ו\u05B0ס\u05B4יי\u05B7\u05BCע\u05B0ת\u05B8\u05BCא ... ל\u05B0ח\u05B7י\u05B4ים ו\u05BCל\u05B0ש\u05B8\u05C1לו\u05B9ם all agree; Hamichlol has "ועל כל קהלהון דכל בית ישראל" where Wikisource has "ו\u05B0ע\u05B7ל כ\u05B8\u05BCל י\u05B4ש\u05B0\u05C2ר\u05B8א\u05B5ל".',
    ],
  },
  'wikisource-hashkava': {
    kind: 'wikisource-wikitext', page: 'השכבה', revid: 3020102, nusach: 'ספרדי', smallRole: 'instruction', bracketRole: 'instruction',
    texts: {
      hashkava: { section: 'השכבה לאיש' },
      'hashkava-female': { section: 'השכבה לאישה' },
      'hashkava-long': { section: 'השכבה לאיש מורחב' },
      'hashkava-long-female': { section: 'השכבה לאישה מורחב' },
    },
    notes: [
      'Hebrew Wikisource page "השכבה", pinned revision. Verses transcluded with {{צת לעיצוב}} are not in the page wikitext and are left out, so this witness covers the Hashkava prayer itself, not the verses before it.',
      'Its short form for a woman reads "ו\u05B0כ\u05C7ל\u05BEב\u05B0\u05BCנ\u05B5י י\u05B4ש\u05B0\u05C2ר\u05B8א\u05B5ל ה\u05B7ש\u05BC\u05C1ו\u05B9כ\u05B0ב\u05B4ים ע\u05B4מ\u05BCו\u05B9" (masculine), against "ב\u05B0\u05BCנו\u05B9ת ... ה\u05B7ש\u05BC\u05C1ו\u05B9כ\u05B0בו\u05B9ת ע\u05B4מ\u05B8\u05BCה\u05BC" in Torat Emet and the Yemenite text.',
    ],
  },
  'wikisource-siddur-baladi': {
    kind: 'wikisource-wikitext', page: 'סידור/נוסח תימן בלדי/מספדות והצדקת הדין', revid: 3081604, nusach: 'תימן בלדי',
    smallRole: 'instruction', bracketRole: 'instruction',
    texts: {
      'hashkava-baladi': { section: 'השכבה לאיש', fromTemplate: 'רן' },
      'hashkava-baladi-female': { section: 'השכבה לאישה', fromTemplate: 'רן' },
    },
    notes: [
      'Hebrew Wikisource, Yemenite Baladi siddur, "מספדות והצדקת הדין", pinned revision. The Hashkava for a man is the block the page marks "מכאן גם לשאר נפטרים" (the verses before it are for an eminent person and are not imported).',
      'The name placeholder "(א\u05B8ח\u05B4ינו\u05BC / מו\u05B9ר\u05B5נו\u05BC ו\u05B0ר\u05B7ב\u05B5\u05BCנו\u05BC פלוני)" becomes the name slot; the honorific is left to the reader.',
    ],
  },
};

// ---------------------------------------------------------------------------------------------
// Raw cache with provenance
// ---------------------------------------------------------------------------------------------
const { manifest, getRaw, saveManifest } = rawStore(RAW_DIR, { offline: OFFLINE });

const wsUrl = (params) => `${WS_API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;

// ---------------------------------------------------------------------------------------------
// Tokenising source text into reading segments.
//   Words are classified by pointing: liturgy is vowelled, rubrics are not. A run of two or more
//   unvowelled words is an instruction; a single unvowelled word inside vowelled text (ה׳) stays.
//   ( ... ) holding a name placeholder -> name slot; unvowelled or mixed -> instruction; vowelled -> text.
//   [ ... ] -> per edition: congregation response (Sefaria Edot editions) or instruction (variants).
//   <small> -> per edition: instruction, or ignored (Torat Emet wraps whole paragraphs in it).
// ---------------------------------------------------------------------------------------------
const NAMED_ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decodeEntities = (s) => s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  if (e in NAMED_ENTITIES) return NAMED_ENTITIES[e];
  return fail(`unknown HTML entity ${m}`);
});

const SMALL_OPEN = cp(0xe002), SMALL_CLOSE = cp(0xe003);
const isHebrewWord = (w) => LETTER_RE.test(w);
const isVowelled = (w) => NIKKUD_RE.test(w);

// HTML (Sefaria segments, rendered Wikisource paragraphs) -> plain text with <small> kept as sentinels.
function htmlToMarked(html, { smallRole }) {
  assert(!/[-]/u.test(html), 'private-use character in source');
  let s = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<span class="yamim">[\s\S]*?<\/span><\/span>/g, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ');
  s = s.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (m, slash, name) => {
    const n = name.toLowerCase();
    if (n === 'small') return smallRole === 'instruction' ? (slash ? SMALL_CLOSE : SMALL_OPEN) : ' ';
    if (['b', 'i', 'em', 'strong', 'span', 'p', 'section', 'div', 'sup', 'sub', 'a', 'big', 'u', 'font'].includes(n)) return n === 'b' || n === 'span' || n === 'a' || n === 'big' ? '' : ' ';
    return fail(`unexpected HTML tag ${m}`);
  });
  assert(!/[<>]/.test(s), `stray angle bracket: ${s.slice(0, 80)}`);
  return decodeEntities(s);
}

// Split into groups: {type: 'small'|'bracket'|'paren'|'text', text}.
function groups(marked) {
  const out = [];
  let i = 0, buf = '';
  const flush = () => { if (buf) out.push({ type: 'text', text: buf }); buf = ''; };
  const closers = { [SMALL_OPEN]: [SMALL_CLOSE, 'small'], '[': [']', 'bracket'], '(': [')', 'paren'] };
  while (i < marked.length) {
    const ch = marked[i];
    if (closers[ch]) {
      const [close, type] = closers[ch];
      let depth = 0, j = i;
      for (; j < marked.length; j++) {
        if (marked[j] === ch) depth++;
        else if (marked[j] === close && --depth === 0) break;
      }
      assert(j < marked.length, `unbalanced ${ch} in: ${marked.slice(i, i + 80)}`);
      flush();
      out.push({ type, text: marked.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    assert(ch !== SMALL_CLOSE && ch !== ']' && ch !== ')', `unbalanced closer ${JSON.stringify(ch)} near: ${marked.slice(Math.max(0, i - 40), i + 40)}`);
    buf += ch;
    i++;
  }
  flush();
  return out;
}

const words = (s) => s.split(/\s+/).filter(Boolean);
const hasHebrew = (s) => words(s).some(isHebrewWord);
const allUnvowelled = (s) => words(s).filter(isHebrewWord).every((w) => !isVowelled(w));
const isAmenInstruction = (s) => /^\(?ועונים:? אמן\.?\)?$/.test(s.replace(/\s+/g, ' ').trim());

function toSegments(marked, ed, where) {
  const segs = [];
  const push = (role, text, extra = {}) => {
    const t = unmark(text).replace(/\s+/g, ' ').trim();
    if (!t && !extra.slot) return;
    const last = segs[segs.length - 1];
    if (last && last.role === role && !last.slot && !extra.slot && !last.together && !extra.together) last.text = `${last.text} ${t}`;
    else segs.push(extra.slot ? { role, slot: extra.slot } : { role, text: t, ...extra });
  };
  for (const g of groups(marked)) {
    if (g.type === 'small') {
      if (isAmenInstruction(g.text)) push('congregation', AMEN);
      else if (hasHebrew(g.text)) push('instruction', g.text);
      continue;
    }
    if (g.type === 'paren') {
      const inner = unmark(g.text).replace(/\s+/g, ' ').trim();
      const hw = words(inner).filter(isHebrewWord);
      if (NAME_PLACEHOLDER_RE.test(inner) || /פלוני|פב"פ|פב״פ/.test(inner)) push('leader', '', { slot: 'name' });
      else if (isAmenInstruction(inner)) push('congregation', AMEN);
      else if (hw.length && hw.every(isVowelled)) push('leader', `(${inner})`);
      else push('instruction', `(${inner})`);
      continue;
    }
    if (g.type === 'bracket') {
      const ws = words(g.text);
      if (ed.bracketRole === 'congregation') {
        const vow = ws.filter((w) => isHebrewWord(w) && isVowelled(w));
        const rest = ws.filter((w) => !(isHebrewWord(w) && isVowelled(w)) && w !== '-');
        if (vow.length) push('congregation', vow.join(' '));
        if (rest.some(isHebrewWord)) push('instruction', rest.join(' '));
      } else push('instruction', `[${g.text}]`);
      continue;
    }
    // Plain text: a run of 2+ unvowelled Hebrew words is a rubric; a lone one (ה׳) is read.
    const ws = words(g.text);
    const unv = (w) => isHebrewWord(w) && !isVowelled(w);
    for (let k = 0; k < ws.length;) {
      let e = k;
      if (unv(ws[k])) {
        while (e < ws.length && (unv(ws[e]) || !isHebrewWord(ws[e]))) e++;
        const run = ws.slice(k, e);
        push(run.filter(isHebrewWord).length >= 2 && !ed.unvowelled ? 'instruction' : 'leader', run.join(' '));
      } else {
        while (e < ws.length && !unv(ws[e])) e++;
        push('leader', ws.slice(k, e).join(' '));
      }
      k = e;
    }
  }
  assert(segs.some((s) => s.role === 'leader' && s.text && LETTER_RE.test(s.text)), `${where}: no text`);
  return segs.map((s) => (s.text !== undefined ? { ...s, text: tidy(s.text) } : s)).filter((s) => s.slot || s.text);
}
const unmark = (s) => s.split(SMALL_OPEN).join(' ').split(SMALL_CLOSE).join(' ');
const tidy = (s) => s.replace(/\s+([,.:;\u05C3])/g, '$1').replace(/^[,.:;\s]+/, '').replace(/\s+/g, ' ').trim();

// Kaddish: "יהא שמה רבא מברך לעלם ולעלמי עלמיא" is said by everyone. Every edition prints it, some as the
// reader's text; it is split out as a congregation segment said together, so all nuschaot show it alike.
const YSR = ['יהא', /^שמ(ה|יה)$/, 'רבא', 'מברך', 'לעלם', 'ולעלמי', 'עלמיא'];
function markYehaShmeh(segs) {
  const out = [];
  for (const s of segs) {
    if (s.role !== 'leader' || !s.text) { out.push(s); continue; }
    const ws = s.text.split(' ');
    const cons = ws.map((w) => consonantsOf(w));
    let at = -1;
    for (let i = 0; i + YSR.length <= ws.length && at < 0; i++) {
      if (YSR.every((p, k) => (p instanceof RegExp ? p.test(cons[i + k]) : cons[i + k] === p))) at = i;
    }
    if (at < 0) { out.push(s); continue; }
    const before = ws.slice(0, at).join(' ');
    const phrase = ws.slice(at, at + YSR.length).join(' ');
    const after = ws.slice(at + YSR.length).join(' ');
    if (before) out.push({ role: 'leader', text: before });
    out.push({ role: 'congregation', text: phrase.replace(/[.,:]$/, ''), together: true });
    if (after.replace(/[.,:\s]/g, '')) out.push({ role: 'leader', text: after.replace(/^[.,:\s]+/, '') });
  }
  // A congregation segment that is already the phrase (Metsudah bold) gets the together flag too.
  return out.map((s) => (s.role === 'congregation' && consonantsOf(s.text ?? '').startsWith('יהאשמ') ? { ...s, together: true } : s));
}

// ---------------------------------------------------------------------------------------------
// Wikitext (pinned revision) -> marked text. Only templates listed here are understood; any other throws.
// ---------------------------------------------------------------------------------------------
function wikitextToMarked(wt, where) {
  let s = wt.replace(/<!--[\s\S]*?-->/g, '');
  const TEMPLATES = {
    ש: () => ' ', ר1: () => ' ', 'רווח קשיח': () => ' ', רווח: () => ' ',
    ממס: () => ' ', ממ: () => ' ', 'מ"מ': () => ' ', 'עוגן בשורה': () => ' ', 'צת לעיצוב': () => ' ',
    הור: (args) => `${SMALL_OPEN}${args[0]}${SMALL_CLOSE}`,
    'הוראה למתפללים': (args) => `${SMALL_OPEN}${args[0]}${SMALL_CLOSE}`,
    רן: (args) => args.join('|'), קטן: (args) => `${SMALL_OPEN}${args[0]}${SMALL_CLOSE}`,
    סי: (args) => args[0], 'צבע גופן': (args) => args[1] ?? '', גודל: (args) => args[1] ?? args[0],
    // {{פבפ|<gender of the deceased: ז/נ>|<gender of the parent>}} renders "שם בן/בת שם האב/האם": the name slot.
    פבפ: (args) => `(${args[0] === 'נ' ? 'פלונית' : 'פלוני'})`,
  };
  // Innermost templates first.
  for (let guard = 0; /\{\{/.test(s); guard++) {
    assert(guard < 500, `${where}: template expansion did not converge`);
    s = s.replace(/\{\{([^{}]*)\}\}/g, (m, body) => {
      const [nameRaw, ...args] = body.split('|');
      const name = nameRaw.trim();
      const fn = TEMPLATES[name];
      if (!fn) fail(`${where}: unknown template {{${name}}}`);
      // Named parameters (key=value) pass only their value.
      return fn(args.map((a) => (/^[^\s=]+=/.test(a) ? a.slice(a.indexOf('=') + 1) : a).trim()));
    });
  }
  s = s.replace(/\[\[(?:קטגוריה|Category):[^\]]*\]\]/g, ' ').replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1').replace(/'''?/g, '').replace(/^:+/gm, '').replace(/<[^>]+>/g, ' ');
  return decodeEntities(s);
}

function wikitextSection(wt, heading, where) {
  const re = new RegExp(`^(=+)\\s*${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\1\\s*$`, 'm');
  const m = re.exec(wt);
  assert(m, `${where}: section "${heading}" not found`);
  const rest = wt.slice(m.index + m[0].length);
  const next = new RegExp(`^={1,${m[1].length}}[^=].*?={1,${m[1].length}}\\s*$`, 'm').exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

function templateBody(wt, name, where) {
  const start = wt.indexOf(`{{${name}|`);
  assert(start >= 0, `${where}: no {{${name}|...}} block`);
  let depth = 0, i = start;
  for (; i < wt.length - 1; i++) {
    if (wt.startsWith('{{', i)) { depth++; i++; } else if (wt.startsWith('}}', i)) { depth--; i++; if (depth === 0) break; }
  }
  return wt.slice(start + name.length + 3, i - 1);
}

// ---------------------------------------------------------------------------------------------
// Pointing completion: fill marks a reading word lacks from a witness word with the same letters,
// only when every mark the reading word already has is present in the witness at the same letter.
// It never removes or changes a mark; each completion is logged.
// ---------------------------------------------------------------------------------------------
function clusters(word) {
  const out = [];
  for (const ch of word) {
    if (MARK_RE.test(ch) && out.length) out[out.length - 1].marks.push(ch);
    else out.push({ base: ch, marks: [] });
  }
  return out;
}
// Marks a completion may add: vowel points and the shin/sin dots. Never dagesh/mappiq (they depend on
// context, e.g. בְגַן after an open syllable), never cantillation, meteg or rafe.
const ADDABLE = (m) => { const c = m.codePointAt(0); return (c >= 0x5b0 && c <= 0x5bb) || c === 0x5c7 || c === 0x5c1 || c === 0x5c2; };
const COMPARABLE = (m) => { const c = m.codePointAt(0); return !(c >= 0x591 && c <= 0x5af) && c !== 0x5bd && c !== 0x5bf; };
function completeWord(r, w) {
  const a = clusters(r), b = clusters(w);
  if (a.length !== b.length || a.some((c, i) => c.base !== b[i].base)) return null;
  let changed = false;
  const merged = a.map((c, i) => {
    const wm = b[i].marks.filter(COMPARABLE);
    // Only vowels are compared: a dagesh one edition prints and the other omits does not block a completion.
    if (!c.marks.filter(ADDABLE).every((m) => wm.includes(m))) return null;
    const add = wm.filter((m) => ADDABLE(m) && !c.marks.includes(m));
    if (add.length) changed = true;
    return add.length ? (c.base + c.marks.join('') + add.join('')).normalize('NFC') : c.base + c.marks.join('');
  });
  if (merged.includes(null) || !changed) return null;
  return merged.join('');
}
function completePointing(segs, witnessSegsList) {
  const log = [];
  const witnessWords = witnessSegsList.map((ws) => ws.filter((s) => s.text && s.role !== 'instruction').flatMap((s) => s.text.split(/[\s\u05BE]+/u)).filter(isHebrewWord));
  const out = segs.map((s) => {
    if (!s.text || s.role === 'instruction') return s;
    const text = s.text.replace(/[^\s\u05BE]+/gu, (tok) => {
      const lead = tok.match(/^[^א-ת]*/u)[0], trail = tok.match(/[^א-ת\u0591-\u05C7]*$/u)[0];
      const core = tok.slice(lead.length, tok.length - trail.length);
      if (!isHebrewWord(core)) return tok;
      for (const ww of witnessWords) {
        for (const cand of ww) {
          const c = cand.replace(/^[^א-ת]+|[^א-ת\u0591-\u05C7]+$/gu, '');
          if (consonantsOf(c) !== consonantsOf(core)) continue;
          const done = completeWord(core, c);
          if (done) { log.push({ from: core, to: done }); return lead + done + trail; }
        }
      }
      return tok;
    });
    return { ...s, text };
  });
  return { segs: out, log };
}

// ---------------------------------------------------------------------------------------------
// Comparison (consonant words, LCS)
// ---------------------------------------------------------------------------------------------
const IGNORED_WORDS = new Set(['אמן']);
const comparableWords = (segs) => segs.filter((s) => s.text && s.role !== 'instruction')
  .flatMap((s) => s.text.split(new RegExp(`[\\s${MAQAF}]+`))).map(consonantsOf).filter((w) => w && !IGNORED_WORDS.has(w));
function wordDiff(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const changes = [];
  let i = 0, j = 0, cur = null;
  const close = () => { if (cur) { changes.push({ reading: cur.a.join(' '), witness: cur.b.join(' '), after: cur.at }); cur = null; } };
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { close(); i++; j++; continue; }
    if (!cur) cur = { a: [], b: [], at: a.slice(Math.max(0, i - 3), i).join(' ') };
    if (j >= m || (i < n && dp[i + 1][j] >= dp[i][j + 1])) cur.a.push(a[i++]); else cur.b.push(b[j++]);
  }
  close();
  return changes;
}

// ---------------------------------------------------------------------------------------------
// Fetch + parse per edition
// ---------------------------------------------------------------------------------------------
const lock = { payloads: {} };
const oldLock = existsSync(path.join(OUT_DIR, 'customs.lock.json')) ? JSON.parse(readFileSync(path.join(OUT_DIR, 'customs.lock.json'), 'utf8')) : null;
function lockPayload(name, digest) {
  lock.payloads[name] = digest;
  const old = oldLock?.payloads?.[name];
  if (old && old !== digest && !RELOCK) fail(`${name}: upstream content changed (sha256 ${old} -> ${digest}); review it, then re-run with --relock`);
}

async function importSefaria(id, ed) {
  const versions = await getRaw(`sefaria-versions-${ed.index}.json`, `https://www.sefaria.org/api/texts/versions/${ed.index}`);
  const vm = versions.filter((v) => v.language === 'he' && v.versionTitle === ed.versionTitle);
  assert(vm.length === 1 && vm[0].license === ed.license, `${id}: expected one Hebrew version ${JSON.stringify(ed.versionTitle)} licensed ${ed.license}, got ${JSON.stringify(vm.map((v) => v.license))}`);
  const texts = {}, refs = {};
  const byRef = new Map();
  for (const [key, t] of Object.entries(ed.texts)) {
    if (!byRef.has(t.ref)) {
      const url = `https://www.sefaria.org/api/v3/texts/${encodeURIComponent(t.ref)}?version=${encodeURIComponent(`hebrew|${ed.versionTitle}`)}`;
      const raw = `sefaria-${id}-${t.ref.replace(/[^A-Za-z0-9]+/g, '-')}.json`;
      const j = await getRaw(raw, url);
      assert(j.versions?.length === 1 && j.versions[0].versionTitle === ed.versionTitle && j.versions[0].license === ed.license, `${id} ${t.ref}: unexpected version returned`);
      const flat = [j.versions[0].text].flat(Infinity); // a single-segment ref returns a string
      assert(flat.every((x) => typeof x === 'string'), `${id} ${t.ref}: non-string segments`);
      lockPayload(raw, sha256(JSON.stringify(flat)));
      byRef.set(t.ref, { flat, url });
    }
    const { flat, url } = byRef.get(t.ref);
    const [from, to] = t.segments;
    assert(to <= flat.length, `${id} ${key}: segments ${from}-${to} beyond ${flat.length}`);
    let marked = flat.slice(from - 1, to).map((h) => htmlToMarked(h, ed)).join(' ');
    if (t.cutAfter) {
      const ws = marked.split(/\s+/);
      const at = ws.findIndex((w) => consonantsOf(w) === t.cutAfter);
      assert(at >= 0, `${id} ${key}: cut word ${t.cutAfter} not found`);
      marked = ws.slice(0, at + 1).join(' ');
    }
    texts[key] = toSegments(marked, ed, `${id}/${key}`);
    refs[key] = { ref: t.ref, segments: t.segments, url };
  }
  return {
    source: { site: 'sefaria.org', url: `https://www.sefaria.org/${encodeURIComponent(Object.values(ed.texts)[0].ref.replace(/ /g, '_'))}?lang=he&ven=${encodeURIComponent(`hebrew|${ed.versionTitle.trim().replace(/ /g, '_')}`)}`, versionTitle: ed.versionTitle, title: ed.versionTitle.trim(), license: ed.license, licenseUrl: LICENSE_URLS[ed.license], versionSource: vm[0].versionSource ?? null, refs },
    texts,
  };
}

let wsRights = null;
async function wikisourceLicense() {
  if (wsRights) return wsRights;
  const si = await getRaw('wikisource-siteinfo.json', wsUrl({ action: 'query', meta: 'siteinfo', siprop: 'rightsinfo' }));
  const r = si.query.rightsinfo;
  assert(/creativecommons\.org\/licenses\/by-sa\/4\.0\//.test(r.url), `unexpected Wikisource license ${JSON.stringify(r)}`);
  wsRights = 'CC BY-SA 4.0';
  return wsRights;
}

async function importWikisourceWikitext(id, ed) {
  const license = await wikisourceLicense();
  const raw = `wikisource-${id}.wikitext.json`;
  const j = await getRaw(raw, wsUrl({ action: 'query', prop: 'revisions', rvprop: 'ids|timestamp|content', rvslots: 'main', revids: String(ed.revid) }));
  const page = j.query.pages[0];
  assert(page.title === ed.page, `${id}: page ${page.title} is not ${ed.page}`);
  const rev = page.revisions[0];
  assert(rev.revid === ed.revid, `${id}: got revid ${rev.revid}`);
  const wt = rev.slots.main.content;
  lockPayload(raw, sha256(wt));
  const texts = {};
  for (const [key, t] of Object.entries(ed.texts)) {
    let sec = wikitextSection(wt, t.section, `${id}/${key}`);
    if (t.fromTemplate) sec = templateBody(sec, t.fromTemplate, `${id}/${key}`);
    texts[key] = toSegments(wikitextToMarked(sec, `${id}/${key}`), ed, `${id}/${key}`);
  }
  return {
    source: { site: 'he.wikisource.org', title: ed.page, revid: rev.revid, timestamp: rev.timestamp, license, licenseUrl: LICENSE_URLS[license],
      url: `${WS_SITE}/w/index.php?title=${encodeURIComponent(ed.page)}&oldid=${rev.revid}`, historyUrl: `${WS_SITE}/w/index.php?title=${encodeURIComponent(ed.page)}&action=history` },
    texts,
  };
}

async function importWikisourceRender(id, ed) {
  const license = await wikisourceLicense();
  const revs = {};
  for (const p of ed.pages) {
    const j = await getRaw(`wikisource-${id}-${sha256(p).slice(0, 8)}.rev.json`, wsUrl({ action: 'query', prop: 'revisions', rvprop: 'ids|timestamp', titles: p }));
    revs[p] = j.query.pages[0].revisions[0].revid;
  }
  const texts = {};
  for (const [key, t] of Object.entries(ed.texts)) {
    const raw = `wikisource-${id}-${key}.parse.json`;
    const j = await getRaw(raw, wsUrl({ action: 'parse', text: t.render, contentmodel: 'wikitext', prop: 'text', disablelimitreport: '1', title: 'קדיש' }));
    const html = j.parse.text;
    lockPayload(raw, sha256(html));
    texts[key] = toSegments(htmlToMarked(html, ed), ed, `${id}/${key}`);
  }
  return {
    source: { site: 'he.wikisource.org', title: ed.pages.join(', '), revids: revs, license, licenseUrl: LICENSE_URLS[license],
      url: `${WS_SITE}/wiki/${encodeURIComponent('קדיש יתום')}`, render: Object.fromEntries(Object.entries(ed.texts).map(([k, t]) => [k, t.render])) },
    texts,
  };
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------
// Pointing completion sources, in order of preference, per text (only for the editions a template reads).
const COMPLETE_FROM = {
  'sefaria-torat-emet-357-edot': ['wikisource-hashkava', 'wikisource-siddur-baladi', 'sefaria-shaliehsaboo-edot'],
};

export async function main() {
  const out = { note: 'Generated by scripts/import-customs.mjs. Reading editions are chosen in lib/editions.js; the others are witnesses.', editions: {} };
  for (const [id, ed] of Object.entries(EDITIONS)) {
    const imported = ed.kind === 'sefaria' ? await importSefaria(id, ed)
      : ed.kind === 'wikisource-wikitext' ? await importWikisourceWikitext(id, ed)
        : await importWikisourceRender(id, ed);
    for (const key of Object.keys(imported.texts)) {
      if (key.startsWith('kaddish')) imported.texts[key] = markYehaShmeh(imported.texts[key]);
    }
    out.editions[id] = { source: imported.source, nusach: ed.nusach ?? null, reviewStatus: ed.reviewStatus ?? 'IMPORTED', notes: ed.notes, texts: imported.texts };
  }

  // Pointing completion (logged) for editions that need it.
  const report = { note: 'Consonant-level word comparison of each text across editions (signal for review, not a proofread), and every pointing completion.', completions: {}, comparisons: {} };
  for (const [id, sources] of Object.entries(COMPLETE_FROM)) {
    for (const [key, segs] of Object.entries(out.editions[id].texts)) {
      const wit = sources.map((w) => out.editions[w]?.texts[key] ?? out.editions[w]?.texts[key.replace(/^hashkava/, 'hashkava-baladi')]).filter(Boolean);
      const { segs: done, log } = completePointing(segs, wit);
      out.editions[id].texts[key] = done;
      if (log.length) report.completions[`${id}/${key}`] = log;
    }
  }

  // Gender checks on the Hashkava forms.
  for (const [id, e] of Object.entries(out.editions)) {
    for (const [key, segs] of Object.entries(e.texts)) {
      if (!key.startsWith('hashkava')) continue;
      const female = key.endsWith('-female');
      const cons = comparableWords(segs);
      if (cons.some((w) => w === 'תניחנו' || w === 'תניחנה')) assert(cons.includes(female ? 'תניחנה' : 'תניחנו'), `${id}/${key}: gender wording does not match the key`);
      assert(segs.filter((s) => s.slot === 'name').length === 1, `${id}/${key}: expected exactly one name slot, got ${segs.filter((s) => s.slot === 'name').length}`);
    }
  }

  // Comparisons: every text key, every pair (first edition holding the key vs the rest).
  const keys = [...new Set(Object.values(out.editions).flatMap((e) => Object.keys(e.texts)))].sort();
  for (const key of keys) {
    const holders = Object.entries(out.editions).filter(([, e]) => e.texts[key]);
    report.comparisons[key] = [];
    for (let a = 0; a < holders.length; a++) {
      for (let b = a + 1; b < holders.length; b++) {
        const wa = comparableWords(holders[a][1].texts[key]), wb = comparableWords(holders[b][1].texts[key]);
        const changes = wordDiff(wa, wb);
        report.comparisons[key].push({ a: holders[a][0], b: holders[b][0], wordsA: wa.length, wordsB: wb.length, identicalConsonants: changes.length === 0, changes });
      }
    }
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(path.join(OUT_DIR, 'customs.json'), `${JSON.stringify(out, null, 1)}\n`);
  writeFileSync(path.join(OUT_DIR, 'customs.lock.json'), `${JSON.stringify({ note: 'sha256 of each upstream payload (Sefaria: JSON of the flattened text; Wikisource: wikitext of the pinned revision, or rendered HTML). A mismatch aborts the import unless --relock.', payloads: lock.payloads }, null, 1)}\n`);
  writeFileSync(path.join(OUT_DIR, 'diff-report.json'), `${JSON.stringify(report, null, 1)}\n`);
  saveManifest();
  console.log(`wrote ${Object.keys(out.editions).length} editions, ${keys.length} texts`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main().catch((e) => { console.error(e); process.exit(1); });
