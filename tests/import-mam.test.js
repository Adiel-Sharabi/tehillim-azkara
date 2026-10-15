import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { buildPsalms, gitBlobSha1, LOCK, EXPECTED_VERSES } from '../scripts/import-mam.mjs';
import { ALEPH_BET } from '../lib/psalm119.js';
import { consonantsOf } from '../lib/hebrew.js';

const DATA = new URL('../data/psalms/psalms_mam.json', import.meta.url);
const RAW = new URL('../sources/mam/raw/Ps.json', import.meta.url);
const data = JSON.parse(readFileSync(DATA, 'utf8'));

// Minimal synthetic source in MAM-simple shape, sized to EXPECTED_VERSES.
function synthetic(patch) {
  const chapters = Object.entries(EXPECTED_VERSES).map(([ch, n]) => ({
    type: 'chapter',
    osisID: `Ps.${ch}`,
    contents: Array.from({ length: n }, (_, i) => ({ type: 'verse', osisID: `Ps.${ch}.${i + 1}`, text: 'אָמֵ֥ן׃' })),
  }));
  const root = { 'versification-tradition': 'vtmam,vtbhs,vtsef', contents: [{ type: 'book39', osisID: 'Ps', contents: chapters }] };
  patch?.(root);
  return root;
}

test('git blob sha matches `git hash-object`', () => {
  assert.equal(gitBlobSha1(Buffer.from('hello\n')), 'ce013625030ba8dba906f756967f9e9ca394464a');
});

const TOTAL = Object.values(EXPECTED_VERSES).reduce((a, b) => a + b, 0);

test('committed data: every verse of every chapter the site reads, locked source recorded', () => {
  assert.equal(data.stats.verses, TOTAL);
  for (const [ch, n] of Object.entries(EXPECTED_VERSES)) assert.equal(data.chapters[ch].length, n, `Ps.${ch}`);
  assert.equal(data.edition.source.gitBlobSha1, LOCK.gitBlobSha1);
  assert.equal(data.edition.license, 'CC BY-SA 4.0');
  assert.notEqual(data.edition.reviewStatus, 'PROOFREAD');
});

test('Psalm 119: every verse starts with its section letter (22 x 8 acrostic)', () => {
  data.chapters['119'].forEach((verse, i) => {
    assert.equal(consonantsOf(verse.withNikkud)[0], ALEPH_BET[Math.floor(i / 8)], `Ps 119:${verse.v}`);
  });
});

test('ketiv/qere: qere is read, ketiv kept (Ps 17:11)', () => {
  const v = data.chapters['17'][10];
  assert.match(v.withNikkud, /סְבָבוּנוּ/);
  assert.equal(v.ketivQere[0].ketiv, 'סבבוני');
  assert.equal(data.stats.ketivQere, 7);
});

test('a trivial ketiv/qere (Ps 90:8) is read as MAM points it and recorded', () => {
  const v = data.chapters['90'][7];
  // MAM keeps its own mark order, so compare in NFC rather than against typed literals.
  const nfc = (x) => x.normalize('NFC');
  assert.equal(nfc(v.withNikkud.split(' ')[0]), nfc('שַׁתָּ'));
  assert.equal(v.ketivQere.length, 1);
  assert.equal(nfc(v.ketivQere[0].trivial), nfc('שַׁתָּ֣'));
});

test('legarmeh is a cantillation mark: shown with te\'amim, gone without; paseq stays', () => {
  // MAM keeps its own mark order, so compare in NFC rather than against typed literals.
  const v = data.chapters['72'][18]; // Ps 72:19 has both
  const nfc = (s) => s.normalize('NFC');
  assert.ok(nfc(v.withCantillation).startsWith(nfc('וּבָר֤וּךְ ׀ ')));
  assert.ok(nfc(v.withNikkud).startsWith(nfc('וּבָרוּךְ שֵׁם')));
  assert.ok(nfc(v.withNikkud).endsWith(nfc('אָמֵן ׀ וְאָמֵן׃')));
});

test('import is deterministic from the locked raw file', { skip: !existsSync(RAW) && 'raw source not downloaded' }, () => {
  const buf = readFileSync(RAW);
  assert.equal(gitBlobSha1(buf), LOCK.gitBlobSha1);
  const rebuilt = JSON.stringify(buildPsalms(JSON.parse(buf.toString('utf8')), LOCK.gitBlobSha1), null, 1) + '\n';
  assert.equal(rebuilt, readFileSync(DATA, 'utf8'));
});

test('unknown MAM element fails closed', () => {
  const root = synthetic((r) => {
    r.contents[0].contents[0].contents[0] = { type: 'verse', osisID: 'Ps.16.1', contents: [{ type: 'cant-all-three' }] };
  });
  assert.throws(() => buildPsalms(root, 'x'), /unhandled MAM element "cant-all-three"/);
});

test('verse count mismatch fails closed', () => {
  const root = synthetic((r) => r.contents[0].contents[0].contents.pop());
  assert.throws(() => buildPsalms(root, 'x'), /Ps\.16: 10 verses, expected 11/);
});

test('synthetic well-formed source imports', () => {
  assert.equal(buildPsalms(synthetic(), 'x').stats.verses, TOTAL);
});
