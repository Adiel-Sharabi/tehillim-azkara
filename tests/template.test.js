import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOrder, inputsFromParams, paramsFromInputs, defaultKeys, addableKeys, fullName,
  MINYAN_NOTE, DEFAULT_TEMPLATE, TEMPLATES,
} from '../lib/template.js';

const kinds = (o) => o.sections.map((s) => s.kind).join(',');
const prayer = (o, text) => o.sections.find((s) => s.text?.startsWith(text));
const params = (s) => new URLSearchParams(s);

test('ashkenaz_base: 7 psalms, 119 by name, 119 נשמה, mishnayot נשמה, Kaddish Yatom, El Male', () => {
  const o = buildOrder('ashkenaz_base', { name: 'משה', gender: 'male', hasMinyan: true });
  assert.equal(kinds(o), 'psalm,psalm,psalm,psalm,psalm,psalm,psalm,psalm119,psalm119,mishnah,prayer,prayer');
  assert.deepEqual(o.sections.filter((s) => s.kind === 'psalm').map((s) => s.chapter), [33, 16, 17, 72, 91, 104, 130]);
  assert.equal(o.sections[0].title, 'תהילים ל״ג');
  assert.deepEqual(o.sections[7].groups.map((g) => g.letter), ['מ', 'ש', 'ה']);
  assert.deepEqual(o.sections[8].groups.map((g) => g.letter), ['נ', 'ש', 'מ', 'ה']);
  assert.deepEqual([o.sections[9].ref, o.sections[9].from, o.sections[9].to], ['Mikvaot.7', 4, 7]);
});

test('every section carries its key, and the default order is the template order', () => {
  const keys = defaultKeys('ashkenaz_base');
  assert.deepEqual(keys, ['p33', 'p16', 'p17', 'p72', 'p91', 'p104', 'p130', 'n', 's', 'm.Mikvaot.7.4.7', 'r.kaddish-yatom', 'r.el-male-rachamim']);
  assert.deepEqual(buildOrder('ashkenaz_base', { name: 'משה' }).sections.map((s) => s.key), keys);
});

test('El Male follows the gender and carries the name (with the parent, when given) for its slot', () => {
  assert.equal(prayer(buildOrder('ashkenaz_base', { name: 'משה' }), 'el-male').text, 'el-male-rachamim');
  const f = prayer(buildOrder('ashkenaz_base', { name: 'שרה', gender: 'female' }), 'el-male');
  assert.equal(f.text, 'el-male-rachamim-female');
  assert.equal(f.name, 'שרה');
  assert.equal(prayer(buildOrder('ashkenaz_base', { name: 'שרה', gender: 'female', parent: 'רבקה' }), 'el-male').name, 'שרה בת רבקה');
  assert.equal(fullName({ name: 'משה', parent: ' אברהם ' }), 'משה בן אברהם');
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

test('an edited order: removed, added and moved sections, unknown keys skipped and reported', () => {
  const order = ['r.el-male-rachamim', 'p91', 'r.kaddish-derabbanan', 'p23', 'x.future-thing', 'm.Mikvaot.7.1.7'];
  const o = buildOrder('ashkenaz_base', { name: 'משה', hasMinyan: false, order });
  assert.deepEqual(o.sections.map((s) => s.key), ['r.el-male-rachamim', 'p91', 'r.kaddish-derabbanan', 'p23', 'm.Mikvaot.7.1.7']);
  assert.deepEqual(o.unknownKeys, ['x.future-thing']);
  assert.equal(o.sections[2].note, MINYAN_NOTE, 'Kaddish DeRabbanan keeps its minyan rule when added');
  assert.equal(o.sections[3].title, 'תהילים כ״ג', 'any psalm can be keyed, even one no template lists');
  assert.equal(o.sections[0].name, 'משה', 'El Male keeps its name slot when moved');
});

test('the edit panel can offer the extras and the template sections', () => {
  const keys = addableKeys('ashkenaz_base').map((a) => a.key);
  assert.ok(keys.includes('r.kaddish-derabbanan'));
  assert.ok(keys.includes('m.Mikvaot.7.1.7'));
  assert.ok(keys.includes('p33'));
  assert.ok(addableKeys('ashkenaz_base').every((a) => a.title && a.kind));
});

test('link v1 round-trips every input', () => {
  const inputs = { template: 'ashkenaz_base', name: 'שרה', gender: 'female', hasMinyan: false, parent: 'רבקה', order: ['p91', 'n', 'r.el-male-rachamim'] };
  const back = inputsFromParams(paramsFromInputs(inputs));
  assert.deepEqual({ ...back, unknownTemplate: undefined }, { ...inputs, unknownTemplate: undefined });
  assert.equal(paramsFromInputs(inputs).get('v'), '1');
});

test('an unedited order is not written into the link, so the link follows fixes to its template', () => {
  const p = paramsFromInputs({ name: 'משה', gender: 'male', hasMinyan: true, order: defaultKeys(DEFAULT_TEMPLATE) });
  assert.equal(p.get('o'), null);
  assert.equal(p.get('p'), null);
});

test('links made before v1 still open the same order (back-compat for printed QR codes)', () => {
  const old = inputsFromParams(params('n=משה&g=f&minyan=0'));
  assert.deepEqual(old, { template: DEFAULT_TEMPLATE, unknownTemplate: null, name: 'משה', gender: 'female', hasMinyan: false, parent: '', order: null });
  assert.deepEqual(inputsFromParams(params('n=משה')), { template: DEFAULT_TEMPLATE, unknownTemplate: null, name: 'משה', gender: 'male', hasMinyan: true, parent: '', order: null });
});

test('unknown params are ignored; an unknown template falls back to the default and is reported', () => {
  const i = inputsFromParams(params('v=7&n=משה&utm_source=x&t=no-such-template'));
  assert.equal(i.template, DEFAULT_TEMPLATE);
  assert.equal(i.unknownTemplate, 'no-such-template');
  assert.equal(i.name, 'משה');
});

test('order keys need no escaping in a query string (short QR codes)', () => {
  const p = paramsFromInputs({ name: 'a', gender: 'male', hasMinyan: true, order: ['p91', 'r.kaddish-yatom', 'm.Mikvaot.7.4.7'] });
  assert.match(p.toString(), /o=p91_r\.kaddish-yatom_m\.Mikvaot\.7\.4\.7/);
});

test('every registered template builds without unknown keys', () => {
  for (const id of Object.keys(TEMPLATES)) {
    const o = buildOrder(id, { name: 'משה' });
    assert.deepEqual(o.unknownKeys, [], id);
    assert.ok(o.sections.length > 0, id);
  }
});

test('unknown template fails loudly in the builder helpers', () => {
  assert.throws(() => defaultKeys('nope'), /unknown template/);
  assert.throws(() => buildOrder('nope', {}), /unknown template/);
});

test('links for every custom resolve: template, parent and an edited order survive the round trip', () => {
  // A link written today for the Edot HaMizrach template, with the mother's name and an edited order.
  const i = inputsFromParams(params('v=1&t=edot_hamizrach_base&n=יוסף&g=m&minyan=1&p=רחל&o=n_s_r.hashkava'));
  assert.equal(i.template, 'edot_hamizrach_base');
  const o = buildOrder(i.template, i);
  assert.deepEqual(o.sections.map((s) => s.key), ['n', 's', 'r.hashkava']);
  assert.equal(o.sections[2].name, 'יוסף בן רחל');
  // Psalm 119 by the name reads the mother's name too in this custom (withParent).
  assert.equal(o.sections[0].groups.map((g) => g.letter).join(''), 'יוספבנרחל');
  for (const id of Object.keys(TEMPLATES)) {
    const back = inputsFromParams(paramsFromInputs({ template: id, name: 'שרה', gender: 'female', hasMinyan: false, parent: 'לאה' }));
    assert.equal(back.template, id);
    assert.equal(back.parent, 'לאה');
  }
});
