// Booklet imposition: which page goes where on each printed sheet, for a saddle-stitched booklet
// (sheets printed on both sides, stacked, folded in the middle, stapled on the fold).
//
// Hebrew booklets open from the right: the fold (spine) is on the right of the front cover. So on the
// outer face of the outermost sheet the front cover (page 1) is on the LEFT half and the back cover
// (page N) on the RIGHT half; inside, page 2 faces page 3 with 2 on the right.
//
// Pages are numbered 1..N. Print the sheets double-sided, flipping on the short edge.

export function bookletPageCount(pages) {
  if (!Number.isInteger(pages) || pages < 1) throw new RangeError(`bookletPageCount: ${pages}`);
  return Math.max(4, Math.ceil(pages / 4) * 4);
}

// -> [{ front: [left, right], back: [left, right] }, ...] for N pages (N a multiple of 4), outermost
// sheet first. rtl=false gives the left-to-right layout (spine on the left).
export function bookletSheets(n, { rtl = true } = {}) {
  if (!Number.isInteger(n) || n < 4 || n % 4) throw new RangeError(`bookletSheets: ${n} is not a multiple of 4`);
  const sheets = [];
  for (let i = 0; i < n / 4; i++) {
    const outerA = 2 * i + 1; // odd page on the outer face
    const outerB = n - 2 * i; // its partner across the fold
    const innerA = 2 * i + 2;
    const innerB = n - 2 * i - 1;
    sheets.push(rtl
      ? { front: [outerA, outerB], back: [innerB, innerA] }
      : { front: [outerB, outerA], back: [innerA, innerB] });
  }
  return sheets;
}
