import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildOrder, TEMPLATES } from '../lib/template.js';

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const lib = read('data/reading/library.json');
const psalms = read('data/psalms/psalms_mam.json');

const INPUTS = [
  { name: 'משה', gender: 'male', hasMinyan: true, parentName: 'רחל' },
  { name: 'שרה', gender: 'female', hasMinyan: false, parentName: '' },
];

// Every block a template can produce, default or optional, must name text the reading library has.
function checkSection(id, s) {
  if (s.kind === 'psalm') assert.ok(psalms.chapters[String(s.chapter)], `${id}: psalm ${s.chapter} not imported`);
  if (s.kind === 'psalm119') assert.ok(s.groups.length > 0, `${id}: empty Psalm 119 section`);
  if (s.kind === 'mishnah') {
    for (let n = s.from; n <= s.to; n++) assert.ok(lib.mishnah[s.ref]?.[String(n)], `${id}: ${s.ref} ${n} not in the reading library`);
  }
  if (s.kind === 'prayer') assert.ok(lib.prayers[s.text], `${id}: prayer ${s.text} not in the reading library`);
}

test('every template builds for both genders, with and without a minyan, and names only texts the library has', () => {
  for (const [id, t] of Object.entries(TEMPLATES)) {
    for (const inputs of INPUTS) {
      const o = buildOrder(id, inputs);
      assert.ok(o.sections.length >= 5, id);
      o.sections.forEach((s) => checkSection(id, s));
    }
    // Optional blocks resolve too: build them as a one-off template.
    for (const b of t.optional ?? []) {
      for (const g of ['male', 'female']) {
        TEMPLATES.__probe = { title: 'probe', blocks: [b] };
        try { buildOrder('__probe', { name: 'משה', gender: g }).sections.forEach((s) => checkSection(`${id} optional`, s)); } finally { delete TEMPLATES.__probe; }
      }
    }
  }
});

test('every template records its custom status, confidence and sources', () => {
  for (const [id, t] of Object.entries(TEMPLATES)) {
    assert.ok(t.title && t.status?.includes('מועמד'), id);
    assert.ok(['medium', 'low'].includes(t.confidence), id);
    assert.ok(t.sources?.length > 0, id);
  }
  assert.equal(TEMPLATES.yemen_baladi_base.confidence, 'low');
});

test('Edot HaMizrach: Psalm 119 and the Hashkava use the mother\'s name when given (בן/בת), the name alone otherwise', () => {
  const o = buildOrder('edot_hamizrach_base', { name: 'יוסף', gender: 'male', parentName: 'רחל' });
  assert.deepEqual(o.sections[0].groups.map((g) => g.letter), ['י', 'ו', 'ס', 'פ', 'ב', 'נ', 'ר', 'ח', 'ל']);
  assert.equal(o.sections.find((s) => s.text === 'hashkava').name, 'יוסף בן רחל');
  const f = buildOrder('edot_hamizrach_base', { name: 'שרה', gender: 'female', parentName: 'לאה' });
  assert.equal(f.sections.find((s) => s.text === 'hashkava-female').name, 'שרה בת לאה');
  assert.equal(buildOrder('edot_hamizrach_base', { name: 'יוסף' }).sections.find((s) => s.text === 'hashkava').name, 'יוסף');
});

test('a template without a parent rule ignores parentName (Ashkenaz El Male keeps the name alone)', () => {
  const o = buildOrder('ashkenaz_base', { name: 'משה', parentName: 'רחל' });
  assert.equal(o.sections.find((s) => s.text === 'el-male-rachamim').name, 'משה');
});

test('Morocco reads Psalm 119 by קרע שטן and the long Hashkava; Sefard uses the Sefard Kaddish', () => {
  const m = buildOrder('morocco_base', { name: 'דוד' });
  assert.ok(m.sections.some((s) => s.kind === 'psalm119' && s.groups.map((g) => g.letter).join('') === 'קרעשטנ'));
  assert.ok(m.sections.some((s) => s.text === 'hashkava-long'));
  assert.ok(m.sections.some((s) => s.text === 'kol-yisrael'));
  const s = buildOrder('sefard_base', { name: 'דוד', hasMinyan: false });
  assert.ok(s.sections.filter((x) => x.text?.startsWith('kaddish')).every((x) => x.text.endsWith('-sefard') && x.note));
});
