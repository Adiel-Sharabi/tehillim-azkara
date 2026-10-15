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
