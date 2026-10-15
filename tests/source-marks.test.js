import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// Code in lib/ and scripts/ must write combining marks and invisible characters as escapes.
// A literal one is invisible in a diff and can be normalised away in transit, silently
// changing what a regex or constant matches. Comments may hold vowelled Hebrew examples.
// (The pattern is built from code points so this file obeys its own rule.)
const ranges = [[0x0300, 0x036f], [0x0591, 0x05c7], [0x200b, 0x200f], [0x00a0, 0x00a0]];
const isMark = (cp) => ranges.some(([a, b]) => cp >= a && cp <= b);

const files = ['lib', 'scripts'].flatMap((dir) =>
  readdirSync(new URL(`../${dir}/`, import.meta.url))
    .filter((f) => /\.(m?js)$/.test(f))
    .map((f) => new URL(`../${dir}/${f}`, import.meta.url)),
);

test('no literal combining marks on code lines in lib/ and scripts/', () => {
  const offenders = [];
  for (const url of files) {
    readFileSync(url, 'utf8').split('\n').forEach((line, i) => {
      if (line.trim().startsWith('//')) return;
      for (const ch of line) {
        const cp = ch.codePointAt(0);
        if (isMark(cp)) offenders.push(`${url.pathname.split('/').slice(-2).join('/')}:${i + 1} U+${cp.toString(16).toUpperCase()}`);
      }
    });
  }
  assert.deepEqual(offenders, []);
});
