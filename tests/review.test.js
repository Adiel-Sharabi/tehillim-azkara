import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyReview, REVIEW_LADDER } from '../lib/corrections.js';
import { consonantsOf } from '../lib/hebrew.js';
import { collate, readEditions } from '../scripts/collate-psalms.mjs';

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const mishnah = read('sources/mishnah/mishnah.json');
const prayers = read('sources/prayers/prayers.json');
const reviews = {
  psalms: read('sources/wlc/review.json'),
  mishnah: read('sources/mishnah/review.json'),
  prayers: read('sources/prayers/review.json'),
};

test('no review file claims more than a machine comparison can give', () => {
  const max = REVIEW_LADDER.indexOf('INDEPENDENTLY_COMPARED');
  for (const [corpus, r] of Object.entries(reviews)) {
    for (const [id, s] of Object.entries(r.status)) {
      assert.ok(REVIEW_LADDER.indexOf(s.status) >= 0 && REVIEW_LADDER.indexOf(s.status) <= max, `${corpus}/${id}: ${s.status}`);
    }
    for (const c of r.corrections) assert.ok(c.witnesses.length && c.reason, `${corpus}: correction without evidence`);
  }
});

test('Psalms: every MAM/UXLC difference has exactly one reviewed verdict', () => {
  const report = collate(...Object.values(readEditions()));
  const diffs = [...report.consonantDiffs, ...report.vowelDiffs].map((d) => `${d.ref}#${d.word ?? ''}`).sort();
  const decided = reviews.psalms.verdicts.map((v) => `${v.ref}#${v.word ?? ''}`).sort();
  assert.deepEqual(decided, diffs);
  for (const v of reviews.psalms.verdicts) {
    assert.ok(['keep-mam', 'adopt-uxlc', 'human'].includes(v.verdict), v.ref);
    assert.ok(v.witnesses.length >= 2 && v.reason, `${v.ref}: needs at least two witnesses and a reason`);
  }
  // A verdict against MAM must come with a correction, or the reading would not change.
  const against = reviews.psalms.verdicts.filter((v) => v.verdict === 'adopt-uxlc').map((v) => v.ref);
  assert.deepEqual(reviews.psalms.corrections.map((c) => c.ref), against);
});

test('Mishnah: the review applies cleanly and writes out the merged holam in שלשה', () => {
  const out = applyReview(mishnah, reviews.mishnah);
  const te = out.editions['sefaria-torat-emet-357'];
  assert.equal(te.reviewStatus, 'INDEPENDENTLY_COMPARED');
  for (const c of reviews.mishnah.corrections) {
    assert.ok(!te.texts[c.text][c.ref].includes(c.from), `${c.ref} still has the uncorrected form`);
    assert.equal(consonantsOf(te.texts[c.text][c.ref]), consonantsOf(mishnah.editions[c.edition].texts[c.text][c.ref]), 'letters unchanged');
  }
  // The other editions are untouched.
  assert.deepEqual(out.editions['wikisource-beeri'], mishnah.editions['wikisource-beeri']);
});

test('Prayers: the reciter says ואמרו אמן; the congregation still answers אמן', () => {
  const out = applyReview(prayers, reviews.prayers);
  for (const key of ['kaddish-yatom', 'kaddish-derabbanan']) {
    const segs = out.editions['sefaria-metsudah-siddur-1981'].texts[key].filter((s) => s.role !== 'instruction');
    segs.forEach((s, i) => {
      if (s.role !== 'leader' || !consonantsOf(s.text).endsWith('ואמרו') && !consonantsOf(s.text).endsWith('ואמרואמן')) return;
      assert.ok(consonantsOf(s.text).endsWith('ואמרואמן'), `${key}[${i}] ends without אמן`);
      assert.equal(segs[i + 1].role, 'congregation', `${key}[${i + 1}]`);
      assert.equal(consonantsOf(segs[i + 1].text), 'אמן', `${key}[${i + 1}]`);
    });
  }
  const derabbanan = out.editions['sefaria-metsudah-siddur-1981'].texts['kaddish-derabbanan'].map((s) => consonantsOf(s.text ?? '')).join(' ');
  assert.ok(derabbanan.includes('ומזונירויחי') && !derabbanan.includes('ומזונארויחי'));
  assert.equal(out.editions['sefaria-metsudah-machzor-yk-ashkenaz-linear'].reviewStatus, 'INDEPENDENTLY_COMPARED');
  assert.equal(out.editions['sefaria-daat-siddur-ashkenaz'].reviewStatus, 'IMPORTED', 'comparison witnesses keep their own status');
});

test('applyReview fails closed and never mutates its input', () => {
  const source = { editions: { e: { reviewStatus: 'IMPORTED', texts: { t: { 1: 'abc abc' }, p: [{ role: 'leader', text: 'x y' }, { role: 'congregation', text: 'x' }] } } } };
  const before = structuredClone(source);
  const c = (o) => ({ edition: 'e', text: 't', ref: '1', from: 'abc', to: 'abd', count: 2, witnesses: ['w'], reason: 'r', ...o });
  assert.equal(applyReview(source, { corrections: [c()] }).editions.e.texts.t[1], 'abd abd');
  assert.deepEqual(source, before);
  assert.throws(() => applyReview(source, { corrections: [c({ count: 1 })] }), /expected 1 occurrence/);
  assert.throws(() => applyReview(source, { corrections: [c({ from: 'zzz' })] }), /found 0/);
  assert.throws(() => applyReview(source, { corrections: [c({ witnesses: [] })] }), /witnesses/);
  assert.equal(applyReview(source, { corrections: [{ edition: 'e', text: 'p', role: 'congregation', from: 'x', to: 'z', witnesses: ['w'], reason: 'r' }] }).editions.e.texts.p[0].text, 'x y');
  assert.throws(() => applyReview(source, { status: { e: { status: 'PROOFREAD' } } }), /human/);
  const down = applyReview({ editions: { e: { reviewStatus: 'INDEPENDENTLY_COMPARED', texts: {} } } }, { status: { e: { status: 'IMPORTED' } } });
  assert.equal(down.editions.e.reviewStatus, 'INDEPENDENTLY_COMPARED', 'a review never lowers a status');
});
