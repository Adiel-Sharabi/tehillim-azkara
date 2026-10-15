// Hebrew mark handling — the one owner of "which code points are cantillation, which are nikkud".
// Pure ES module: imported by the Node import scripts, the tests and the browser alike.

// Cantillation (te'amim): U+0591–U+05AF, plus meteg (U+05BD), which is shown with the te'amim
// and hidden with them.
const CANTILLATION_RE = /[֑-ֽ֯]/g;

// Nikkud: vowel points, dagesh/mappiq, rafe, shin/sin dots, upper/lower dots, qamats qatan.
// Removing it leaves letters, maqaf (U+05BE), paseq (U+05C0) and sof pasuq (U+05C3).
const NIKKUD_RE = /[ְ-ׇּֿׁׂׅׄ]/g;

export const PASEQ = '׀';
export const MAQAF = '־';
export const SOF_PASUQ = '׃';

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
