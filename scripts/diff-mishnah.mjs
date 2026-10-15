#!/usr/bin/env node
// Quick consonant-level signal: compares every edition in sources/mishnah/mishnah.json against the
// Wikisource edition, per mishnah. NOT a proofread. Letters only: every character outside U+05D0-U+05EA
// (vowel/cantillation marks U+0591-U+05C7, spaces, punctuation) is dropped before comparing, so word
// spacing and punctuation never count as a difference.
//
//   node scripts/diff-mishnah.mjs            summary + per-mishnah table
//
// Also prints a vowel-mark density (marks per letter) per mishnah per edition. A sharply lower density in
// one edition's mishnah is a hint that vowel marks (e.g. shva, holam on lo) are missing there.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { consonantsOf, stripNikkud } from '../lib/hebrew.js';

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'sources', 'mishnah', 'mishnah.json');
const BASE = 'wikisource-beeri';
const { editions } = JSON.parse(readFileSync(FILE, 'utf8'));
if (!editions[BASE]) throw new Error(`edition ${BASE} missing from ${FILE}`);

const letters = consonantsOf;
const marks = (s) => s.length - stripNikkud(s).length; // nikkud + cantillation code points

function levenshtein(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

const ids = Object.keys(editions).filter((id) => id !== BASE).sort();
console.log(`Consonant-level diff vs ${BASE} (letters only; a signal, not a proofread)\n`);
for (const id of ids) {
  console.log(id);
  for (const key of Object.keys(editions[BASE].texts)) {
    const base = editions[BASE].texts[key];
    const other = editions[id].texts[key];
    const diffs = [];
    for (const n of Object.keys(base)) {
      const a = letters(base[n]);
      const b = letters(other[n]);
      if (a !== b) diffs.push({ n, dist: levenshtein(a, b), len: a.length });
    }
    const total = Object.keys(base).length;
    const detail = diffs.map((d) => `${d.n}(${d.dist}/${d.len})`).join(' ') || '-';
    console.log(`  ${key}: ${diffs.length} of ${total} differ   [mishnah(edit-distance/letters)] ${detail}`);
  }
}

console.log('\nVowel-mark density (marks per letter)');
for (const key of Object.keys(editions[BASE].texts)) {
  const allIds = [BASE, ...ids];
  console.log(`  ${key}   ${allIds.map((id) => id.padEnd(24)).join('')}`);
  for (const n of Object.keys(editions[BASE].texts[key])) {
    const cells = allIds.map((id) => {
      const t = editions[id].texts[key][n];
      return (marks(t) / letters(t).length).toFixed(2).padEnd(24);
    });
    console.log(`  ${n.padStart(2)}       ${cells.join('')}`);
  }
}
