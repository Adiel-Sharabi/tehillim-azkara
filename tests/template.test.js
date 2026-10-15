import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOrder, inputsFromParams, paramsFromInputs, MINYAN_NOTE } from '../lib/template.js';

const kinds = (o) => o.sections.map((s) => s.kind).join(',');
const prayer = (o, text) => o.sections.find((s) => s.text?.startsWith(text));

test('ashkenaz_base: 7 psalms, 119 by name, 119 נשמה, mishnayot נשמה, Kaddish Yatom, El Male', () => {
  const o = buildOrder('ashkenaz_base', { name: 'משה', gender: 'male', hasMinyan: true });
  assert.equal(kinds(o), 'psalm,psalm,psalm,psalm,psalm,psalm,psalm,psalm119,psalm119,mishnah,prayer,prayer');
  assert.deepEqual(o.sections.filter((s) => s.kind === 'psalm').map((s) => s.chapter), [33, 16, 17, 72, 91, 104, 130]);
  assert.equal(o.sections[0].title, 'תהילים ל״ג');
  assert.deepEqual(o.sections[7].groups.map((g) => g.letter), ['מ', 'ש', 'ה']);
  assert.deepEqual(o.sections[8].groups.map((g) => g.letter), ['נ', 'ש', 'מ', 'ה']);
  assert.deepEqual([o.sections[9].ref, o.sections[9].from, o.sections[9].to], ['Mikvaot.7', 4, 7]);
});

test('El Male follows the gender and carries the name for its slot', () => {
  assert.equal(prayer(buildOrder('ashkenaz_base', { name: 'משה' }), 'el-male').text, 'el-male-rachamim');
  const f = prayer(buildOrder('ashkenaz_base', { name: 'שרה', gender: 'female' }), 'el-male');
  assert.equal(f.text, 'el-male-rachamim-female');
  assert.equal(f.name, 'שרה');
});

test('Kaddish is always present; without a minyan it carries the minyan note (decision ה5)', () => {
  assert.equal(prayer(buildOrder('ashkenaz_base', { name: 'משה', hasMinyan: true }), 'kaddish').note, undefined);
  const k = prayer(buildOrder('ashkenaz_base', { name: 'משה', hasMinyan: false }), 'kaddish');
  assert.equal(k.text, 'kaddish-yatom');
  assert.equal(k.note, MINYAN_NOTE);
});

test('a name with no Hebrew letters drops only the by-name section and reports what was ignored', () => {
  const o = buildOrder('ashkenaz_base', { name: 'Moshe' });
  assert.equal(o.sections.filter((s) => s.kind === 'psalm119').length, 1);
  assert.ok(o.ignored.length > 0);
});

test('inputs round-trip through the link, defaults are male with a minyan', () => {
  const inputs = { name: 'שרה', gender: 'female', hasMinyan: false };
  assert.deepEqual(inputsFromParams(paramsFromInputs(inputs)), inputs);
  assert.deepEqual(inputsFromParams(new URLSearchParams('n=משה')), { name: 'משה', gender: 'male', hasMinyan: true });
});

test('unknown template fails loudly', () => {
  assert.throws(() => buildOrder('nope', {}), /unknown template/);
});
