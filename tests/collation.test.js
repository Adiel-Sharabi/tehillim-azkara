import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collate, readEditions } from '../scripts/collate-psalms.mjs';

// The known MAM-vs-UXLC differences, as listed in sources/wlc/COLLATION.md. Each is a
// spelling/vowel variant between the Aleppo-based and Leningrad-based traditions awaiting a
// human decision. If an upstream re-import changes this list, this test fails on purpose:
// the new difference must be looked at, not absorbed.
const KNOWN_CONSONANT = ['17:12', '33:7', '104:9', '119:15', '119:87'];
const KNOWN_VOWEL = ['17:14', '72:15', '104:1', '104:35', '119:69', '119:175'];

const report = collate(...Object.values(readEditions()));

test('all 303 verses are compared', () => {
  assert.equal(report.verses, 303);
});

test('consonant differences are exactly the known plene/defective variants', () => {
  assert.deepEqual(report.consonantDiffs.map((d) => d.ref), KNOWN_CONSONANT);
});

test('vowel differences are exactly the known variants', () => {
  assert.deepEqual(report.vowelDiffs.map((d) => d.ref), KNOWN_VOWEL);
});

test('convention differences are counted, not dropped', () => {
  assert.equal(report.conventions.divineNameHolam, 60);
  assert.equal(report.conventions.rafe, 1);
});
