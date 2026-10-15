#!/usr/bin/env node
// The one definition of how the repo maps onto the published site. The page lives at the site root
// (that is the link people share and print as a QR code), with lib/ and data/ beside it:
//
//   /            <- site/
//   /lib/...     <- lib/
//   /data/...    <- data/
//   /build.json  <- written here at deploy time: { sha, builtAt } (the footer shows it)
//
// scripts/serve.mjs serves the same mapping through fileFor(), and the Pages workflow runs
//   node scripts/assemble-site.mjs _site
// to copy it into a folder for upload.

import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, normalize, dirname, sep, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Longest prefix first: /lib/ and /data/ win over the site root.
export const LAYOUT = [
  { url: '/lib/', dir: 'lib' },
  { url: '/data/', dir: 'data' },
  { url: '/', dir: 'site' },
];

// URL path -> absolute file path in the repo, or null if it falls outside the mapping.
export function fileFor(urlPath) {
  let path = urlPath;
  if (path.endsWith('/')) path += 'index.html';
  const entry = LAYOUT.find((e) => path.startsWith(e.url));
  if (!entry) return null;
  const base = join(ROOT, entry.dir);
  const file = normalize(join(base, path.slice(entry.url.length)));
  return file.startsWith(base + sep) ? file : null;
}

export function buildInfo() {
  let sha = process.env.GITHUB_SHA;
  if (!sha) {
    try { sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { sha = 'unknown'; }
  }
  return { sha, builtAt: new Date().toISOString() };
}

export function assemble(outDir) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  for (const { url, dir } of LAYOUT) cpSync(join(ROOT, dir), join(outDir, url), { recursive: true });
  writeFileSync(join(outDir, 'build.json'), `${JSON.stringify(buildInfo())}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const out = process.argv[2];
  if (!out) throw new Error('usage: node scripts/assemble-site.mjs <outDir>');
  assemble(resolve(out));
  console.log(`assembled site into ${out}`);
}
