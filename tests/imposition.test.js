import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookletPageCount, bookletSheets } from '../lib/imposition.js';

test('page count pads up to a multiple of 4, at least 4', () => {
  assert.deepEqual([1, 4, 5, 8, 9, 17].map(bookletPageCount), [4, 4, 8, 8, 12, 20]);
  assert.throws(() => bookletPageCount(0), RangeError);
});

test('4-page Hebrew booklet: cover on the left of the outer face, 2 faces 3 with 2 on the right', () => {
  assert.deepEqual(bookletSheets(4), [{ front: [1, 4], back: [3, 2] }]);
});

test('8-page Hebrew booklet nests the second sheet inside the first', () => {
  assert.deepEqual(bookletSheets(8), [
    { front: [1, 8], back: [7, 2] },
    { front: [3, 6], back: [5, 4] },
  ]);
});

test('left-to-right layout mirrors it (the usual English booklet)', () => {
  assert.deepEqual(bookletSheets(4, { rtl: false }), [{ front: [4, 1], back: [2, 3] }]);
});

test('every page appears exactly once, and each face holds a pair that sums to N+1', () => {
  for (const n of [4, 8, 12, 16, 40]) {
    const sheets = bookletSheets(n);
    const all = sheets.flatMap((s) => [...s.front, ...s.back]).sort((a, b) => a - b);
    assert.deepEqual(all, Array.from({ length: n }, (_, i) => i + 1));
    for (const s of sheets) for (const face of [s.front, s.back]) assert.equal(face[0] + face[1], n + 1);
  }
});

test('a page count that is not a multiple of 4 is refused', () => {
  assert.throws(() => bookletSheets(6), RangeError);
});
