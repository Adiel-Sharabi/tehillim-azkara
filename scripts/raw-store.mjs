// The raw-download cache every importer shares: fetch with retry, keep each response under the source's
// raw/ directory (gitignored, re-fetchable) with its sha256 in raw/manifest.json, and in --offline mode
// rebuild only from files whose sha256 still matches. Build-time only; the site never fetches sources.
//
// The User-Agent names the project and nothing about the person running it.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const USER_AGENT = 'tehillim-azkara-importer/0.1 (one-off build-time import; static site)';

export const sha256 = (bufOrStr) => createHash('sha256').update(bufOrStr).digest('hex');

const fail = (msg) => { throw new Error(msg); };

export async function fetchWithRetry(url, { attempts = 6 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept: 'application/json' } });
      if (res.status === 429) {
        // Rate limited (Wikimedia): wait as long as the server asks, bounded, then retry.
        const wait = Math.min(Number(res.headers.get('retry-after')) || 10 * attempt, 120);
        await new Promise((r) => setTimeout(r, wait * 1000));
        throw new Error('HTTP 429');
      }
      if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) fail(`HTTP ${res.status} for ${url}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      lastErr = e;
      if (/^HTTP 4/.test(e.message) && !/429/.test(e.message)) throw e;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  return fail(`giving up on ${url}: ${lastErr?.message} (${lastErr?.cause?.message ?? 'no cause'})`);
}

// rawStore(rawDir, { offline }) -> { manifest, getRaw(name, url), saveManifest() }
// getRaw returns the parsed JSON of raw/<name>, fetching it (and recording provenance) unless offline.
export function rawStore(rawDir, { offline = false } = {}) {
  const manifestPath = path.join(rawDir, 'manifest.json');
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { files: {} };

  async function getRaw(name, url) {
    const file = path.join(rawDir, name);
    if (offline) {
      if (!existsSync(file) || !manifest.files[name]) fail(`--offline: missing raw file ${name} (run without --offline first)`);
      if (sha256(readFileSync(file)) !== manifest.files[name].sha256) fail(`raw/${name} does not match the sha256 in raw/manifest.json`);
    } else {
      mkdirSync(rawDir, { recursive: true });
      const buf = await fetchWithRetry(url);
      writeFileSync(file, buf);
      manifest.files[name] = { url, sha256: sha256(buf), bytes: buf.length, retrievedAt: new Date().toISOString() };
    }
    return JSON.parse(readFileSync(file, 'utf8'));
  }

  function saveManifest() {
    if (!offline) writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  return { manifest, getRaw, saveManifest };
}
