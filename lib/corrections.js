// The review layer: reviewed corrections and comparison status, applied on top of an imported source
// without editing it. Each corpus keeps its review next to its source (sources/<corpus>/review.json);
// the evidence behind every entry is in REVIEW.md beside it.
//
// A correction names its edition, text and (for Mishnah) ref, the exact `from` and `to` strings, and how
// many times `from` must occur (`count`, default 1). Prayer texts are segment arrays: `role` limits the
// correction to segments of that role. Anything that does not match exactly fails, so an upstream change
// to the source can never be silently "corrected" into something else.

export const REVIEW_LADDER = [
  'DISCOVERED', 'RIGHTS_CHECKED', 'IMPORTED', 'STRUCTURE_VALIDATED', 'INDEPENDENTLY_COMPARED',
  'PROOFREAD', 'COMMUNITY_REVIEWED', 'PUBLISHED',
];
// Raising a text to PROOFREAD or beyond takes a person; the review layer never does it.
const MAX_MACHINE_STATUS = 'INDEPENDENTLY_COMPARED';

const occurrences = (s, sub) => s.split(sub).length - 1;

function correctString(s, c) {
  return s.split(c.from).join(c.to);
}

export function applyReview(source, review) {
  const out = structuredClone(source);
  for (const c of review.corrections ?? []) {
    const id = `${c.edition}/${c.text}${c.ref ? `/${c.ref}` : ''}: "${c.from}"`;
    if (!c.from || c.from === c.to) throw new Error(`correction ${id}: empty or no-op`);
    if (!c.witnesses?.length || !c.reason) throw new Error(`correction ${id}: witnesses and reason are required`);
    const edition = out.editions[c.edition];
    const text = edition?.texts[c.text];
    if (text === undefined) throw new Error(`correction ${id}: no such text`);
    const want = c.count ?? 1;
    if (Array.isArray(text)) {
      const targets = text.filter((seg) => typeof seg.text === 'string' && (!c.role || seg.role === c.role));
      const found = targets.reduce((n, seg) => n + occurrences(seg.text, c.from), 0);
      if (found !== want) throw new Error(`correction ${id}: expected ${want} occurrence(s), found ${found}`);
      for (const seg of targets) seg.text = correctString(seg.text, c);
    } else {
      if (!c.ref || typeof text[c.ref] !== 'string') throw new Error(`correction ${id}: no such ref`);
      const found = occurrences(text[c.ref], c.from);
      if (found !== want) throw new Error(`correction ${id}: expected ${want} occurrence(s), found ${found}`);
      text[c.ref] = correctString(text[c.ref], c);
    }
  }
  for (const [editionId, s] of Object.entries(review.status ?? {})) {
    const edition = out.editions[editionId];
    if (!edition) throw new Error(`review status for unknown edition ${editionId}`);
    if (!REVIEW_LADDER.includes(s.status)) throw new Error(`${editionId}: unknown status ${s.status}`);
    if (REVIEW_LADDER.indexOf(s.status) > REVIEW_LADDER.indexOf(MAX_MACHINE_STATUS)) {
      throw new Error(`${editionId}: ${s.status} needs a human proofread, not a review file`);
    }
    if (REVIEW_LADDER.indexOf(s.status) > REVIEW_LADDER.indexOf(edition.reviewStatus)) edition.reviewStatus = s.status;
  }
  return out;
}
