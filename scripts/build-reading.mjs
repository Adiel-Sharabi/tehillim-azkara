#!/usr/bin/env node
// Builds data/reading/library.json: the Mishnah and prayer texts the reading page shows, taken only
// from the editions named in lib/editions.js. Psalms are read from data/psalms directly. Prayer editions
// come from sources/prayers (Ashkenaz) and sources/customs (Sefard, Edot HaMizrach, Yemen, Morocco).
//
//   node scripts/build-reading.mjs        (npm run build:reading)
//
// Prayers: instruction segments (rubrics, explanatory notes, holiday variants) are dropped, since the
// reading carries no commentary; the divine name is written יְיָ (decision ה3). Every text gets the
// three display forms the page switches between, as Psalms have.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { READING_EDITIONS, READING_TEXTS, READING_MISHNAH } from '../lib/editions.js';
import { applyReview } from '../lib/corrections.js';
import { stripCantillation, stripNikkud, divineNameAsYudYud } from '../lib/hebrew.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'reading', 'library.json');
// Prayer sources with their reviewed corrections (#6); a source with no review file is read as imported.
const PRAYER_SOURCES = [
  { data: 'sources/prayers/prayers.json', review: 'sources/prayers/review.json' },
  { data: 'sources/customs/customs.json' },
];

const forms = (text) => ({ withCantillation: text, withNikkud: stripCantillation(text), unpointed: stripNikkud(text) });
// Prayers carry no cantillation; Metsudah uses an accent code point (U+0592) to flag a vocal sheva, which
// would show as a stray accent. So every prayer form starts from the plain-vowel text.
const prayerForms = (text) => forms(stripCantillation(text));

function editionInfo(id, e) {
  const s = e.source;
  return { id, title: s.versionTitle ?? s.title, license: s.license, licenseUrl: s.licenseUrl ?? null, url: s.url ?? null, reviewStatus: e.reviewStatus };
}

// prayerSources: one or more {editions} objects; edition ids must be unique across them.
export { PRAYER_SOURCES };

export function buildLibrary(mishnahSource, ...prayerSources) {
  const lib = { editions: {}, mishnah: {}, prayers: {} };
  const editions = {};
  for (const src of prayerSources) {
    for (const [id, e] of Object.entries(src.editions)) {
      if (editions[id]) throw new Error(`prayer edition id ${id} appears in two sources`);
      editions[id] = e;
    }
  }

  const mId = READING_EDITIONS.mishnah;
  const m = mishnahSource.editions[mId];
  if (!m) throw new Error(`Mishnah edition ${mId} not in sources/mishnah/mishnah.json`);
  lib.editions.mishnah = editionInfo(mId, m);
  for (const ch of READING_MISHNAH) {
    if (!m.texts[ch]) throw new Error(`${mId} has no ${ch}`);
    lib.mishnah[ch] = Object.fromEntries(Object.entries(m.texts[ch]).map(([n, t]) => [n, forms(t)]));
  }

  for (const [role, keys] of Object.entries(READING_TEXTS)) {
    const id = READING_EDITIONS[role];
    const e = editions[id];
    if (!e) throw new Error(`prayer edition ${id} (role ${role}) is in none of ${PRAYER_SOURCES.map((p) => p.data).join(', ')}`);
    lib.editions[role] = editionInfo(id, e);
    for (const key of keys) {
      if (!e.texts[key]) throw new Error(`${id} has no ${key}`);
      lib.prayers[key] = e.texts[key]
        .filter((s) => s.role !== 'instruction')
        .map((s) => (s.slot ? { role: s.role, slot: s.slot } : { role: s.role, ...(s.together ? { together: true } : {}), ...prayerForms(divineNameAsYudYud(s.text)) }));
    }
  }
  return lib;
}

// The sources as the reading uses them: imported data with its reviewed corrections applied (#6).
export function reviewedSources(read) {
  return [
    applyReview(read('sources/mishnah/mishnah.json'), read('sources/mishnah/review.json')),
    ...PRAYER_SOURCES.map((p) => (p.review ? applyReview(read(p.data), read(p.review)) : read(p.data))),
  ];
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
  const lib = buildLibrary(...reviewedSources(read));
  writeFileSync(OUT, `${JSON.stringify(lib, null, 1)}\n`);
  console.log(`wrote ${OUT}`);
}
