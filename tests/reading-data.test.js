import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildLibrary } from '../scripts/build-reading.mjs';
import { READING_EDITIONS } from '../lib/editions.js';
import { consonantsOf } from '../lib/hebrew.js';

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const lib = read('data/reading/library.json');

test('data/reading/library.json is current: rebuilding from sources gives the same file', () => {
  assert.deepEqual(buildLibrary(read('sources/mishnah/mishnah.json'), read('sources/prayers/prayers.json')), lib);
});

test('reading texts come only from the editions named in lib/editions.js', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(lib.editions).map(([k, e]) => [k, e.id])), READING_EDITIONS);
});

test('no instruction segments reach the reading (no-commentary rule)', () => {
  for (const [key, segs] of Object.entries(lib.prayers)) {
    assert.ok(segs.every((s) => s.role !== 'instruction'), key);
  }
});

test('prayers never spell the four-letter name; they write it יְיָ (decision ה3)', () => {
  const words = Object.values(lib.prayers).flat().flatMap((s) => (s.withCantillation ?? '').split(/\s+/));
  assert.ok(!words.some((w) => consonantsOf(w).endsWith('יהוה')));
  assert.ok(words.some((w) => consonantsOf(w) === 'יי'), 'El Male should contain the name as יְיָ');
});

test('Psalms keep the Masoretic spelling of the name', () => {
  assert.ok(read('data/psalms/psalms_mam.json').chapters['130'][0].withNikkud.endsWith('יְהֹוָה׃'));
});

test('Mikvaot 7:4-7 in the reading edition open with נ-ש-מ-ה', () => {
  const initials = ['4', '5', '6', '7'].map((n) => consonantsOf(lib.mishnah['Mikvaot.7'][n].withNikkud)[0]).join('');
  assert.equal(initials, 'נשמה');
});

test('each El Male has exactly one name slot and no text in it', () => {
  for (const key of ['el-male-rachamim', 'el-male-rachamim-female']) {
    const slots = lib.prayers[key].filter((s) => s.slot);
    assert.deepEqual(slots, [{ role: 'leader', slot: 'name' }], key);
  }
});
