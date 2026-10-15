// Import the Psalms the site needs from MAM (Miqra according to the Masorah), version-locked.
//
//   node scripts/import-mam.mjs --download            fetch the locked file from GitHub, then import
//   node scripts/import-mam.mjs --source-file Ps.json import a file you downloaded yourself
//   node scripts/import-mam.mjs                       re-import from sources/mam/raw/Ps.json
//
// Fail-closed: a source whose git blob SHA differs from LOCK is refused unless
// --allow-source-update is passed, and that is for a reviewed update only.
// Any MAM element type not handled below throws rather than being skipped.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { EXPECTED_VERSES } from './psalms-chapters.mjs';
import { stripCantillation, stripNikkud, PASEQ, MAQAF } from '../lib/hebrew.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW_PATH = join(ROOT, 'sources', 'mam', 'raw', 'Ps.json');
const OUT_PATH = join(ROOT, 'data', 'psalms', 'psalms_mam.json');

export const LOCK = {
  repo: 'https://github.com/bdenckla/MAM-basics',
  path: 'MAM-simple/json-vtrad-mam/Ps.json',
  rawUrl: 'https://raw.githubusercontent.com/bdenckla/MAM-basics/main/MAM-simple/json-vtrad-mam/Ps.json',
  gitBlobSha1: 'a5e2296bb38fd253cc0dbe7aff39e79439434f6d',
};

export const EDITION = {
  editionId: 'mam-psalms',
  title: 'מקרא על פי המסורה — תהלים',
  titleEn: 'Miqra according to the Masorah — Psalms',
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  attributionHe: 'מקרא על פי המסורה, ויקיטקסט העברי (אבי קדיש ושותפיו), ברישיון CC BY-SA 4.0',
  attributionEn: 'Hebrew Wikisource, "Miqra according to the Masorah" (CC BY-SA 4.0)',
  attributionUrl: 'https://he.wikisource.org/wiki/מקרא_על_פי_המסורה',
};

// Chapters and verse counts: scripts/psalms-chapters.mjs (shared with the other Psalms importer).
export { EXPECTED_VERSES };

export function gitBlobSha1(buf) {
  return createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
}

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

// One verse -> pieces in document order. Each piece is {kind, text}; kind decides how each
// display form renders it. Ketiv/qere: the qere is what is read aloud, so it is the running
// text; the ketiv is kept beside it.
function versePieces(verse) {
  if ('text' in verse) {
    if ('contents' in verse) throw new Error(`${verse.osisID}: text and contents co-occur`);
    return { pieces: [{ kind: 'text', text: verse.text }], ketiv: [] };
  }
  const pieces = [];
  const ketiv = [];
  for (const node of verse.contents ?? []) {
    switch (node.type) {
      case 'text':
        pieces.push({ kind: 'text', text: node.text });
        break;
      case 'lp-legarmeih': // part of the cantillation: glued to the preceding word
        pieces.push({ kind: 'legarmeih' });
        break;
      case 'lp-paseq': // narrow-sense paseq: not cantillation; MAM leaves its spacing to us
        pieces.push({ kind: 'paseq' });
        break;
      case 'implicit-maqaf':
        pieces.push({ kind: 'text', text: MAQAF });
        break;
      case 'kq': {
        const k = node.contents?.find((c) => c.type === 'kq-k');
        const q = node.contents?.find((c) => c.type === 'kq-q');
        if (node.contents?.length !== 2 || !k || !q || typeof k.text !== 'string' || typeof q.text !== 'string') {
          throw new Error(`${verse.osisID}: unsupported kq shape ${JSON.stringify(node)}`);
        }
        pieces.push({ kind: 'text', text: q.text });
        ketiv.push({ ketiv: k.text, qere: q.text });
        break;
      }
      case 'kq-trivial': // MAM's "trivial" ketiv/qere (90:8): one pointed word, read as written
        if (typeof node.text !== 'string' || 'contents' in node) throw new Error(`${verse.osisID}: unsupported kq-trivial shape ${JSON.stringify(node)}`);
        pieces.push({ kind: 'text', text: node.text });
        ketiv.push({ trivial: node.text });
        break;
      default:
        throw new Error(`${verse.osisID}: unhandled MAM element "${node.type}"`);
    }
  }
  return { pieces, ketiv };
}

function render(pieces, form) {
  let out = '';
  for (const p of pieces) {
    if (p.kind === 'text') out += p.text;
    // Analytically legarmeh belongs to the preceding atom; printed editions set it off by a space.
    else if (p.kind === 'legarmeih') out += form === 'withCantillation' ? ` ${PASEQ}` : '';
    else if (p.kind === 'paseq') out += ` ${PASEQ} `;
  }
  out = out.replace(/ {2,}/g, ' ').trim();
  if (form === 'withNikkud') return stripCantillation(out);
  if (form === 'unpointed') return stripNikkud(out);
  return out;
}

// Pure: parsed MAM Ps.json -> the site's data file (an object). Deterministic, no clock.
export function buildPsalms(root, sourceSha1) {
  const book = root.contents?.find((n) => n.type === 'book39' && n.osisID === 'Ps');
  if (!book) throw new Error('No book39 Ps in source');
  if (!String(root['versification-tradition'] ?? '').split(',').includes('vtmam')) {
    throw new Error('Source does not declare MAM versification');
  }
  const chapters = {};
  let complexVerses = 0;
  let ketivQere = 0;
  for (const [ch, expected] of Object.entries(EXPECTED_VERSES)) {
    const chapter = book.contents.find((n) => n.type === 'chapter' && n.osisID === `Ps.${ch}`);
    if (!chapter) throw new Error(`Missing Ps.${ch}`);
    const verses = [];
    for (const node of chapter.contents) {
      if (node.type === 'spi-pe2' || node.type === 'spi-pe3') continue; // paragraph break, not text
      if (node.type !== 'verse') throw new Error(`Ps.${ch}: unhandled chapter element "${node.type}"`);
      const v = Number(node.osisID.split('.')[2]);
      if (v !== verses.length + 1) throw new Error(`${node.osisID}: out of sequence`);
      const { pieces, ketiv } = versePieces(node);
      if ('contents' in node) complexVerses++;
      ketivQere += ketiv.length;
      const entry = {
        v,
        withCantillation: render(pieces, 'withCantillation'),
        withNikkud: render(pieces, 'withNikkud'),
        unpointed: render(pieces, 'unpointed'),
      };
      if (ketiv.length) entry.ketivQere = ketiv;
      verses.push(entry);
    }
    if (verses.length !== expected) throw new Error(`Ps.${ch}: ${verses.length} verses, expected ${expected}`);
    chapters[ch] = verses;
  }
  const checksums = Object.fromEntries(
    Object.entries(chapters).map(([ch, vs]) => [ch, sha256(vs.map((x) => x.withCantillation).join('\n'))]),
  );
  return {
    edition: {
      ...EDITION,
      source: { ...LOCK, gitBlobSha1: sourceSha1 },
      unicodeOrder: 'MAM mark order preserved (not NFC-normalised)',
      ketivQerePolicy: 'qere in running text; ketiv kept in ketivQere',
      reviewStatus: 'STRUCTURE_VALIDATED',
      reviewNote: 'Imported and structure-checked. Not yet independently compared or proofread.',
    },
    stats: {
      verses: Object.values(chapters).reduce((n, vs) => n + vs.length, 0),
      complexVerses,
      ketivQere,
    },
    checksums,
    chapters,
  };
}

async function main(argv) {
  const allowUpdate = argv.includes('--allow-source-update');
  let buf;
  if (argv.includes('--download')) {
    const res = await fetch(LOCK.rawUrl).catch((e) => {
      throw new Error(`Download failed: ${e.message} (${e.cause?.code ?? e.cause ?? 'no cause'})`);
    });
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
  } else {
    const i = argv.indexOf('--source-file');
    const from = i >= 0 ? argv[i + 1] : RAW_PATH;
    if (!from || !existsSync(from)) throw new Error(`Source file not found: ${from} (use --download)`);
    buf = readFileSync(from);
  }

  const sha1 = gitBlobSha1(buf);
  if (sha1 !== LOCK.gitBlobSha1) {
    if (!allowUpdate) {
      throw new Error(`Source git blob SHA ${sha1} != locked ${LOCK.gitBlobSha1}. Review the upstream change, then update LOCK.`);
    }
    console.warn(`WARNING: importing unlocked source ${sha1} (--allow-source-update)`);
  }

  mkdirSync(dirname(RAW_PATH), { recursive: true });
  writeFileSync(RAW_PATH, buf);

  const data = buildPsalms(JSON.parse(buf.toString('utf8')), sha1);
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(data, null, 1) + '\n', 'utf8');
  console.log(`Imported ${data.stats.verses} verses (${data.stats.complexVerses} complex, ${data.stats.ketivQere} ketiv/qere) -> ${OUT_PATH}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
