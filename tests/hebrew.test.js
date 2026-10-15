import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripCantillation, stripNikkud, consonantsOf } from '../lib/hebrew.js';

// Ps 130:1 as in MAM
const WITH_TEAMIM = 'שִׁ֥יר הַֽמַּעֲל֑וֹת מִמַּעֲמַקִּ֖ים קְרָאתִ֣יךָ יְהֹוָֽה׃';

test('removing cantillation keeps dagesh, sheva, qamats, shin dot and sof pasuq', () => {
  assert.equal(stripCantillation(WITH_TEAMIM), 'שִׁיר הַמַּעֲלוֹת מִמַּעֲמַקִּים קְרָאתִיךָ יְהֹוָה׃');
});

test('removing nikkud leaves letters and punctuation only', () => {
  assert.equal(stripNikkud(WITH_TEAMIM), 'שיר המעלות ממעמקים קראתיך יהוה׃');
});

test('maqaf and paseq survive both strips', () => {
  assert.equal(stripNikkud('אֶת־כֹּ֥ל אָמֵ֥ן ׀ וְאָמֵֽן'), 'את־כל אמן ׀ ואמן');
});

test('consonantsOf keeps letters only', () => {
  assert.equal(consonantsOf('אֶת־כֹּ֥ל ׃'), 'אתכל');
});

test('divine name: יְהֹוָה becomes יְיָ, a prefix keeps its pointing, other words are untouched', async () => {
  const { divineNameAsYudYud } = await import('../lib/hebrew.js');
  assert.equal(divineNameAsYudYud('יְהֹוָה הוּא נַחֲלָתוֹ'), 'יְיָ הוּא נַחֲלָתוֹ');
  assert.equal(divineNameAsYudYud('הוֹדוּ לַיהוָה כִּי טוֹב'), 'הוֹדוּ לַיְיָ כִּי טוֹב');
  assert.equal(divineNameAsYudYud('וַיְהִי וְהָיָה יְהוּדָה'), 'וַיְהִי וְהָיָה יְהוּדָה');
});

test('Hebrew numerals: ט״ו/ט״ז, geresh on one letter, gershayim before the last', async () => {
  const { hebrewNumeral } = await import('../lib/hebrew.js');
  assert.deepEqual([7, 15, 16, 33, 104, 119, 130].map(hebrewNumeral), ['ז׳', 'ט״ו', 'ט״ז', 'ל״ג', 'ק״ד', 'קי״ט', 'ק״ל']);
  assert.throws(() => hebrewNumeral(0), RangeError);
});
