import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { consonantsOf } from '../lib/hebrew.js';
import { READING_EDITIONS } from '../lib/editions.js';

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const { editions } = read('sources/customs/customs.json');
const report = read('sources/customs/diff-report.json');

const spoken = (segs) => segs.filter((s) => s.text && s.role !== 'instruction').map((s) => s.text).join(' ');
const consWords = (segs) => spoken(segs).split(/[\s־]+/u).map(consonantsOf).filter(Boolean);
const reading = (role, key) => editions[READING_EDITIONS[role]].texts[key];

test('every edition is on the license allow-list and none is marked proofread by an import', () => {
  for (const [id, e] of Object.entries(editions)) {
    assert.match(e.source.license, /^(Public Domain|CC0|CC-BY|CC BY-SA 4\.0)$/, id);
    assert.notEqual(e.reviewStatus, 'PROOFREAD', id);
  }
});

test('each Kaddish opens with יתגדל and has יהא שמה רבא as a congregation response said together', () => {
  for (const [role, keys] of [['kaddishSefard', ['kaddish-yatom-sefard', 'kaddish-derabbanan-sefard']], ['kaddishEdot', ['kaddish-yatom-edot', 'kaddish-derabbanan-edot']], ['kaddishBaladi', ['kaddish-yatom-baladi', 'kaddish-derabbanan-baladi']]]) {
    for (const key of keys) {
      const segs = reading(role, key);
      assert.equal(consWords(segs)[0], 'יתגדל', key);
      assert.ok(segs.some((s) => s.role === 'congregation' && s.together && consonantsOf(s.text).startsWith('יהאשמ')), key);
      assert.ok(consWords(segs).includes('ויצמח'), `${key}: no ויצמח פורקנה (Sefard/Edot/Yemen all say it)`);
    }
  }
});

test('the Yemenite Kaddish has the Baladi variants an independent source lists (Hamichlol, "חצי קדיש")', () => {
  const w = consWords(reading('kaddishBaladi', 'kaddish-yatom-baladi')).join(' ');
  for (const phrase of ['ויפרוק עמיה', 'ובחייהון', 'ויתעלה ויתהדר ויתהלל ויתנשא', 'לעילא לעילא מכל', 'וסייעתא ופורקנא ורוחא']) assert.ok(w.includes(phrase), phrase);
});

test('Edot HaMizrach Kaddish: the reading text and Torat Emet differ only in two spellings', () => {
  for (const key of ['kaddish-yatom-edot', 'kaddish-derabbanan-edot']) {
    const cmp = report.comparisons[key].find((c) => c.a === 'sefaria-shaliehsaboo-edot' && c.b === 'sefaria-torat-emet-357-edot');
    assert.deepEqual(cmp.changes.map((c) => [c.reading, c.witness]), [['וגאולה', 'וגאלה'], ['ורוח', 'וריוח']], key);
  }
});

test('every Hashkava has exactly one name slot and the wording of its gender', () => {
  for (const [role, keys] of [['hashkava', ['hashkava', 'hashkava-female', 'hashkava-long', 'hashkava-long-female']], ['hashkavaBaladi', ['hashkava-baladi', 'hashkava-baladi-female']]]) {
    for (const key of keys) {
      const segs = reading(role, key);
      assert.equal(segs.filter((s) => s.slot === 'name').length, 1, key);
      const w = consWords(segs);
      if (key.endsWith('-female')) assert.ok(!w.includes('תניחנו') && !w.includes('השוכבים'), key);
      else assert.ok(!w.includes('תניחנה') && !w.includes('השוכבות'), key);
    }
  }
  assert.ok(consWords(reading('hashkava', 'hashkava-female')).join(' ').includes('בנות ישראל השוכבות עמה'));
});

test('כל ישראל is the opening of Sanhedrin 10:1, up to להתפאר, without the verse reference', () => {
  const w = consWords(reading('kolYisrael', 'kol-yisrael'));
  assert.deepEqual(w.slice(0, 2), ['כל', 'ישראל']);
  assert.equal(w.at(-1), 'להתפאר');
  assert.ok(!w.includes('ישעיה'));
});

test('pointing completions only add vowel points: same letters, every original mark kept', () => {
  const marks = (s) => [...s].filter((c) => /[֑-ׇ]/u.test(c)).sort().join('');
  for (const [where, list] of Object.entries(report.completions)) {
    for (const { from, to } of list) {
      assert.equal(consonantsOf(from), consonantsOf(to), where);
      const added = [...marks(to)];
      for (const m of marks(from)) added.splice(added.indexOf(m), 1);
      assert.ok(added.length > 0 && added.every((m) => /[ְ-ׇֻׁׂ]/u.test(m)), `${where}: ${from} -> ${to}`);
    }
  }
});
