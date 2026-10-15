import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildOrder, TEMPLATES } from '../lib/template.js';

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const lib = read('data/reading/library.json');
const psalms = read('data/psalms/psalms_mam.json');

const INPUTS = [
  { name: 'משה', gender: 'male', parent: 'רחל' },
  { name: 'שרה', gender: 'female', parent: '' },
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

test('every template builds for both genders, and names only texts the library has', () => {
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
  const o = buildOrder('edot_hamizrach_base', { name: 'יוסף', gender: 'male', parent: 'רחל' });
  assert.deepEqual(o.sections[0].groups.map((g) => g.letter), ['י', 'ו', 'ס', 'פ', 'ב', 'נ', 'ר', 'ח', 'ל']);
  assert.equal(o.sections.find((s) => s.text === 'hashkava').name, 'יוסף בן רחל');
  const f = buildOrder('edot_hamizrach_base', { name: 'שרה', gender: 'female', parent: 'לאה' });
  assert.equal(f.sections.find((s) => s.text === 'hashkava-female').name, 'שרה בת לאה');
  assert.equal(buildOrder('edot_hamizrach_base', { name: 'יוסף' }).sections.find((s) => s.text === 'hashkava').name, 'יוסף');
});

test('templates do not prescribe a parent (the family chooses); only withParent blocks read it', () => {
  for (const [id, t] of Object.entries(TEMPLATES)) assert.equal(t.parent, undefined, id);
  const o = buildOrder('ashkenaz_base', { name: 'משה', parent: 'אברהם' });
  assert.equal(o.sections.find((s) => s.text === 'el-male-rachamim').name, 'משה בן אברהם');
  // Psalm 119 by the name has no withParent in Ashkenaz: the letters stay those of the name alone.
  assert.deepEqual(o.sections.find((s) => s.kind === 'psalm119').groups.map((g) => g.letter), ['מ', 'ש', 'ה']);
  assert.equal(buildOrder('ashkenaz_base', { name: 'משה' }).sections.find((s) => s.text === 'el-male-rachamim').name, 'משה');
});

test('Morocco reads Psalm 119 by קרע שטן and the long Hashkava; Sefard uses the Sefard Kaddish', () => {
  const m = buildOrder('morocco_base', { name: 'דוד' });
  assert.ok(m.sections.some((s) => s.kind === 'psalm119' && s.groups.map((g) => g.letter).join('') === 'קרעשטנ'));
  assert.ok(m.sections.some((s) => s.text === 'hashkava-long'));
  assert.ok(m.sections.some((s) => s.text === 'kol-yisrael'));
  const s = buildOrder('sefard_base', { name: 'דוד' });
  assert.ok(s.sections.filter((x) => x.text?.startsWith('kaddish')).every((x) => x.text.endsWith('-sefard') && x.note));
});

test('Morocco opens with ויהי נועם: one verse of Psalm 90, carried in the link as p90.17.17', () => {
  const m = buildOrder('morocco_base', { name: 'דוד' });
  assert.deepEqual({ key: m.sections[0].key, chapter: m.sections[0].chapter, from: m.sections[0].from, to: m.sections[0].to }, { key: 'p90.17.17', chapter: 90, from: 17, to: 17 });
  assert.ok(psalms.chapters['90'][16], 'Psalm 90:17 is in the data');
  // The key form works from any template, so an edited link can carry it.
  const a = buildOrder('ashkenaz_base', { name: 'דוד', order: ['p90.17.17', 'p91'] });
  assert.deepEqual(a.sections.map((s) => [s.chapter, s.from ?? null]), [[90, 17], [91, null]]);
  assert.deepEqual(buildOrder('ashkenaz_base', { name: 'דוד', order: ['p90.18.17', 'p151.1.1'] }).unknownKeys, ['p90.18.17', 'p151.1.1']);
});

test('every template has a one-line summary for its nusach card, distinct from the others', () => {
  const seen = new Set();
  for (const [id, t] of Object.entries(TEMPLATES)) {
    assert.ok(typeof t.summary === 'string' && t.summary.trim().length > 10, id);
    assert.ok(!/[\r\n]/.test(t.summary), id);
    assert.ok(!seen.has(t.summary), `${id}: same summary as another template`);
    seen.add(t.summary);
  }
});

test('summaries name the memorial prayer each template actually uses', () => {
  for (const [id, t] of Object.entries(TEMPLATES)) {
    const texts = t.blocks.filter((b) => b.type === 'prayer').map((b) => b.text);
    if (texts.some((x) => x.startsWith('hashkava'))) assert.ok(t.summary.includes('השכבה'), id);
    if (texts.includes('el-male-rachamim') && id !== 'sefard_base') assert.ok(t.summary.includes('מלא רחמים'), id);
  }
});
