import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { consonantsOf } from '../lib/hebrew.js';

const { editions } = JSON.parse(readFileSync(new URL('../sources/mishnah/mishnah.json', import.meta.url), 'utf8'));

test('every edition has Mikvaot 7 (7 mishnayot) and Kelim 24 (17 mishnayot)', () => {
  for (const [id, e] of Object.entries(editions)) {
    assert.equal(Object.keys(e.texts['Mikvaot.7']).length, 7, id);
    assert.equal(Object.keys(e.texts['Kelim.24']).length, 17, id);
  }
});

test('Mikvaot 7:4-7 open with נ-ש-מ-ה in every edition (the M4 "Neshama" mishnayot)', () => {
  for (const [id, e] of Object.entries(editions)) {
    const initials = ['4', '5', '6', '7'].map((n) => consonantsOf(e.texts['Mikvaot.7'][n])[0]).join('');
    assert.equal(initials, 'נשמה', id);
  }
});

test('nothing is marked proofread by an import', () => {
  for (const [id, e] of Object.entries(editions)) assert.notEqual(e.reviewStatus, 'PROOFREAD', id);
});
