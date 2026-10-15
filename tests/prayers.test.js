import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { consonantsOf } from '../lib/hebrew.js';

const { editions } = JSON.parse(readFileSync(new URL('../sources/prayers/prayers.json', import.meta.url), 'utf8'));
const textsWith = (key) => Object.entries(editions).filter(([, e]) => e.texts[key]);
// Spoken text only: instruction segments (rubrics, explanatory notes) are not part of the reading.
const joined = (segs) => consonantsOf(segs.filter((s) => s.role !== 'instruction').map((s) => s.text ?? '').join(' '));

test('each Kaddish has two license-clear editions with congregation responses marked', () => {
  for (const key of ['kaddish-yatom', 'kaddish-derabbanan']) {
    const eds = textsWith(key);
    assert.equal(eds.length, 2, key);
    for (const [id, e] of eds) {
      const segs = e.texts[key];
      assert.ok(segs.some((s) => s.role === 'congregation'), `${id} ${key}: no congregation segment`);
      assert.ok(joined(segs).startsWith('יתגדל'), `${id} ${key}: does not open with יתגדל`);
    }
  }
});

test('El Male Rachamim (man and woman) has a name slot in every edition', () => {
  for (const key of ['el-male-rachamim', 'el-male-rachamim-female']) {
    const eds = textsWith(key);
    assert.ok(eds.length >= 2, key);
    for (const [id, e] of eds) {
      assert.ok(e.texts[key].some((s) => s.slot === 'name'), `${id} ${key}: no name slot`);
      assert.ok(joined(e.texts[key]).startsWith('אלמלארחמים'), `${id} ${key}`);
    }
  }
});

test('licenses are only the allowed kinds, and nothing is proofread by an import', () => {
  for (const [id, e] of Object.entries(editions)) {
    assert.match(e.source.license, /^(Public Domain|CC-BY|CC BY-SA 4\.0)$/, id);
    assert.notEqual(e.reviewStatus, 'PROOFREAD', id);
  }
});
