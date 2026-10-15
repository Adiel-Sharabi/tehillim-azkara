import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileFor, assemble, ROOT } from '../scripts/assemble-site.mjs';

test('the page is at the root; lib/ and data/ sit beside it', () => {
  assert.equal(fileFor('/'), join(ROOT, 'site', 'index.html'));
  assert.equal(fileFor('/app.js'), join(ROOT, 'site', 'app.js'));
  assert.equal(fileFor('/lib/template.js'), join(ROOT, 'lib', 'template.js'));
  assert.equal(fileFor('/data/reading/library.json'), join(ROOT, 'data', 'reading', 'library.json'));
});

test('paths cannot climb out of the mapping', () => {
  assert.equal(fileFor('/../package.json'), null);
  assert.equal(fileFor('/lib/../../package.json'), null);
});

test('everything the page loads resolves to a real file', () => {
  const html = readFileSync(join(ROOT, 'site', 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"#:]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length > 0);
  for (const r of refs) assert.ok(existsSync(fileFor(`/${r.replace(/^\.\//, '')}`)), r);
  const app = readFileSync(join(ROOT, 'site', 'app.js'), 'utf8');
  for (const [, r] of app.matchAll(/from '(\.\/[^']+)'/g)) assert.ok(existsSync(fileFor(r.slice(1))), r);
  for (const [, r] of app.matchAll(/'(\.\/data\/[^']+)'/g)) assert.ok(existsSync(fileFor(r.slice(1))), r);
});

test('assemble copies the layout and writes build.json', () => {
  const out = mkdtempSync(join(tmpdir(), 'azkara-site-'));
  try {
    assemble(out);
    for (const f of ['index.html', 'app.js', 'lib/template.js', 'data/reading/library.json', 'fonts/FrankRuehlCLM-Medium.woff2']) {
      assert.ok(existsSync(join(out, f)), f);
    }
    const info = JSON.parse(readFileSync(join(out, 'build.json'), 'utf8'));
    assert.match(info.sha, /^([0-9a-f]{7,40}|unknown)$/);
    assert.ok(!Number.isNaN(Date.parse(info.builtAt)));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
