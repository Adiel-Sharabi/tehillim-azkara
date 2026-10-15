import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALEPH_BET, lettersOf, groupFor, groupsForName } from '../lib/psalm119.js';

const ranges = (name) => groupsForName(name).groups.map((g) => `${g.letter}${g.from}-${g.to}`);

test('22 letters x 8 verses = 176', () => {
  assert.equal(ALEPH_BET.length, 22);
  assert.deepEqual(groupFor('ת'), { letter: 'ת', index: 21, from: 169, to: 176 });
});

test('documented reference ranges (master doc §4.2)', () => {
  assert.equal(groupFor('מ').from, 97);
  assert.equal(groupFor('מ').to, 104);
  assert.equal(groupFor('ש').from, 161);
  assert.equal(groupFor('ש').to, 168);
  assert.equal(groupFor('ה').from, 33);
  assert.equal(groupFor('ה').to, 40);
});

test('משה then נשמה, as in the Chabad rabbi answer', () => {
  assert.deepEqual(ranges('משה'), ['מ97-104', 'ש161-168', 'ה33-40']);
  assert.deepEqual(ranges('נשמה'), ['נ105-112', 'ש161-168', 'מ97-104', 'ה33-40']);
});

test('final letters map to their regular form', () => {
  assert.deepEqual(lettersOf('אברהם').letters, ['א', 'ב', 'ר', 'ה', 'מ']);
  assert.deepEqual(lettersOf('ךםןףץ').letters, ['כ', 'מ', 'נ', 'פ', 'צ']);
});

test('repeated letters repeat their group (no silent de-duplication)', () => {
  assert.deepEqual(lettersOf('חנה').letters, ['ח', 'נ', 'ה']);
  assert.deepEqual(lettersOf('אהרן').letters, ['א', 'ה', 'ר', 'נ']);
  assert.deepEqual(lettersOf('דוד').letters, ['ד', 'ו', 'ד']);
});

test('nikkud, spaces, hyphens, maqaf and geresh are ignored; compound names work', () => {
  assert.deepEqual(lettersOf('מֹשֶׁה').letters, ['מ', 'ש', 'ה']);
  assert.deepEqual(lettersOf('יוסף-חיים').letters, lettersOf('יוסף חיים').letters);
  assert.deepEqual(lettersOf('ז\'אק').letters, ['ז', 'א', 'ק']);
  assert.deepEqual(lettersOf('אברהם בן יצחק').ignored, []);
});

test('non-Hebrew input is reported, never guessed at', () => {
  const r = lettersOf('דוד David 2');
  assert.deepEqual(r.letters, ['ד', 'ו', 'ד']);
  assert.deepEqual(r.ignored, ['D', 'a', 'v', 'i', 'd', '2']);
});

test('groupFor rejects a non-letter', () => {
  assert.throws(() => groupFor('x'));
});
