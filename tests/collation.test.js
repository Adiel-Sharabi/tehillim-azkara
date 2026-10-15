import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collate, readEditions } from '../scripts/collate-psalms.mjs';
import { EXPECTED_VERSES } from '../scripts/psalms-chapters.mjs';

const TOTAL = Object.values(EXPECTED_VERSES).reduce((a, b) => a + b, 0);

// The known MAM-vs-UXLC differences, as listed in sources/wlc/COLLATION.md. Each is a spelling/vowel
// variant between the Aleppo-based and Leningrad-based traditions, decided in sources/wlc/review.json.
// If an upstream re-import changes this list, this test fails on purpose: the new difference must be
// looked at, not absorbed.
const KNOWN_CONSONANT = ['17:12', '33:7', '90:8', '104:9', '119:15', '119:87'];
const KNOWN_VOWEL = ['17:14', '72:15', '104:1', '104:35', '119:69', '119:175'];

const report = collate(...Object.values(readEditions()));

test('every verse of every chapter the site reads is compared', () => {
  assert.equal(report.verses, TOTAL);
});

test('consonant differences are exactly the known plene/defective variants', () => {
  assert.deepEqual(report.consonantDiffs.map((d) => d.ref), KNOWN_CONSONANT);
});

test('vowel differences are exactly the known variants', () => {
  assert.deepEqual(report.vowelDiffs.map((d) => d.ref), KNOWN_VOWEL);
});

test('convention differences are counted, not dropped', () => {
  assert.equal(report.conventions.divineNameHolam, 61);
  assert.equal(report.conventions.rafe, 1);
});
