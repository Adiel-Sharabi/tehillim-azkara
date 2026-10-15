// Hebrew mark handling — the one owner of "which code points are cantillation, which are nikkud".
// Pure ES module: imported by the Node import scripts, the tests and the browser alike.

// Cantillation (te'amim): U+0591–U+05AF, plus meteg (U+05BD), which is shown with the te'amim
// and hidden with them.
const CANTILLATION_RE = /[\u0591-\u05AF\u05BD]/g;

// Nikkud: vowel points, dagesh/mappiq, rafe, shin/sin dots, upper/lower dots, qamats qatan.
// Removing it leaves letters, maqaf (U+05BE), paseq (U+05C0) and sof pasuq (U+05C3).
const NIKKUD_RE = /[\u05B0-\u05BC\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g;

export const PASEQ = '\u05C0';
export const MAQAF = '\u05BE';
export const SOF_PASUQ = '\u05C3';

export function stripCantillation(s) {
  return s.replace(CANTILLATION_RE, '');
}

export function stripNikkud(s) {
  return stripCantillation(s).replace(NIKKUD_RE, '');
}

// Letters only (no marks, no punctuation) — for consonant-level comparison between editions.
export function consonantsOf(s) {
  return stripNikkud(s).replace(/[^א-ת]/g, '');
}

// Mark classes used to cut text into letter clusters (a letter plus the marks on it). Maqaf, paseq,
// sof pasuq and nun hafukha are punctuation, not marks on a letter, so they end a word.
const MARKS = '\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7';
const WORD_RE = new RegExp(`(?:[א-ת][${MARKS}]*)+`, 'g');
const CLUSTER_RE = new RegExp(`[א-ת][${MARKS}]*`, 'g');

// The divine name as prayer books print it: yud-yud, pointed with sheva and qamats (יְיָ).
export const DIVINE_NAME_YY = 'י\u05B0י\u05B8';
const NAME_PREFIXES = 'ובלמשכה';

// Prayers show the four-letter divine name as יְיָ (master doc, decision ה3); Psalms keep the
// Masoretic spelling and never pass through this. A one- or two-letter prefix (לַ, וּבַ) keeps its
// own pointing, so לַיהוָה becomes לַיְיָ.
export function divineNameAsYudYud(s) {
  return s.replace(WORD_RE, (word) => {
    const clusters = word.match(CLUSTER_RE);
    const letters = clusters.map((c) => c[0]).join('');
    const prefix = letters.length - 4;
    if (!letters.endsWith('יהוה') || prefix > 2) return word;
    if (![...letters.slice(0, prefix)].every((l) => NAME_PREFIXES.includes(l))) return word;
    return clusters.slice(0, prefix).join('') + DIVINE_NAME_YY;
  });
}

// Hebrew numerals for chapter and verse numbers (1-499): 15 and 16 are written ט״ו and ט״ז, a
// single letter takes a geresh and several letters take gershayim before the last one.
const HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת'];
const TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
const ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
export function hebrewNumeral(n) {
  if (!Number.isInteger(n) || n < 1 || n > 499) throw new RangeError(`hebrewNumeral: ${n}`);
  const rest = n % 100;
  const tail = rest === 15 ? 'טו' : rest === 16 ? 'טז' : TENS[Math.floor(rest / 10)] + ONES[rest % 10];
  const letters = HUNDREDS[Math.floor(n / 100)] + tail;
  return letters.length === 1 ? `${letters}׳` : `${letters.slice(0, -1)}״${letters.slice(-1)}`;
}
