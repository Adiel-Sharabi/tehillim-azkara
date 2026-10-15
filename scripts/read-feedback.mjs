#!/usr/bin/env node
// Prints the feedback reports from the site (newest first), using the Firebase CLI's own login.
// The web cannot read reports (firestore.rules); a signed-in project member can, through the API.
//
//   npm run feedback            all reports
//   npm run feedback -- 10      the newest 10
//
// Needs `firebase login` with an account that is a member of the project in .firebaserc.

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PROJECT = JSON.parse(readFileSync(new URL('../.firebaserc', import.meta.url), 'utf8')).projects.default;
const limit = Number(process.argv[2]) || Infinity;

// firebase-tools is installed globally; borrow its OAuth client to refresh the stored login.
const require = createRequire(join(execSync('npm root -g').toString().trim(), 'firebase-tools', 'package.json'));
const api = require('./lib/api.js');
const store = JSON.parse(readFileSync(join(homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8'));
if (!store.tokens?.refresh_token) throw new Error('not signed in: run `firebase login`');

const tok = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  body: new URLSearchParams({ refresh_token: store.tokens.refresh_token, client_id: api.clientId(), client_secret: api.clientSecret(), grant_type: 'refresh_token' }),
}).then((r) => r.json());
if (!tok.access_token) throw new Error(`login refresh failed: ${tok.error_description ?? tok.error}`);

const docs = [];
let pageToken = '';
do {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/feedback?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${tok.access_token}` } }).then((r) => r.json());
  if (res.error) throw new Error(res.error.message);
  docs.push(...(res.documents ?? []));
  pageToken = res.nextPageToken ?? '';
} while (pageToken);

const rows = docs
  .map((d) => ({ id: d.name.split('/').pop(), created: d.createTime, ...Object.fromEntries(Object.entries(d.fields).map(([k, v]) => [k, v.stringValue])) }))
  .sort((a, b) => b.created.localeCompare(a.created))
  .slice(0, limit);

console.log(`${docs.length} report(s) in ${PROJECT}${rows.length < docs.length ? `, newest ${rows.length} shown` : ''}\n`);
for (const r of rows) {
  console.log(`— ${r.created.slice(0, 16).replace('T', ' ')} UTC · ${r.template}${r.section ? ` · ${r.section}` : ''} · build ${r.build} · ${r.id}`);
  console.log(`  ${r.message.replace(/\n/g, '\n  ')}`);
  if (r.contact) console.log(`  contact: ${r.contact}`);
  console.log(`  ${r.link}\n`);
}
