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
import { stripCantillation, stripNikkud, divineNameAsYudYud } from '../lib/hebrew.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'reading', 'library.json');
const PRAYER_SOURCES = ['sources/prayers/prayers.json', 'sources/customs/customs.json'];

const forms = (text) => ({ withCantillation: text, withNikkud: stripCantillation(text), unpointed: stripNikkud(text) });

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
    if (!e) throw new Error(`prayer edition ${id} (role ${role}) is in none of ${PRAYER_SOURCES.join(', ')}`);
    lib.editions[role] = editionInfo(id, e);
    for (const key of keys) {
      if (!e.texts[key]) throw new Error(`${id} has no ${key}`);
      lib.prayers[key] = e.texts[key]
        .filter((s) => s.role !== 'instruction')
        .map((s) => (s.slot ? { role: s.role, slot: s.slot } : { role: s.role, ...(s.together ? { together: true } : {}), ...forms(divineNameAsYudYud(s.text)) }));
    }
  }
  return lib;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
  const lib = buildLibrary(read('sources/mishnah/mishnah.json'), ...PRAYER_SOURCES.map(read));
  writeFileSync(OUT, `${JSON.stringify(lib, null, 1)}\n`);
  console.log(`wrote ${OUT}`);
}
