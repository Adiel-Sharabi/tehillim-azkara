import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FEEDBACK_FIELDS, buildFeedbackDoc, feedbackEndpoint, sendBlockedReason, MIN_OPEN_MS, RESEND_WAIT_MS,
} from '../lib/feedback.js';

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');

test('a report carries every field as a string, trimmed and clipped to its limit', () => {
  const r = buildFeedbackDoc({ message: '  חסר ניקוד בפסוק ג  ', section: 'תהילים ט״ז', link: 'https://x/?n=a', template: 'ashkenaz_base', build: 'abc', clientTime: '2026-10-15T09:00:00Z', contact: 'x'.repeat(500) });
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.body.fields).sort(), Object.keys(FEEDBACK_FIELDS).sort());
  assert.equal(r.body.fields.message.stringValue, 'חסר ניקוד בפסוק ג');
  assert.equal(r.body.fields.contact.stringValue.length, FEEDBACK_FIELDS.contact);
  for (const v of Object.values(r.body.fields)) assert.equal(typeof v.stringValue, 'string');
});

test('an empty or over-long message is refused rather than sent or cut', () => {
  assert.deepEqual(buildFeedbackDoc({ message: '   ' }), { ok: false, error: 'empty' });
  assert.deepEqual(buildFeedbackDoc({ message: 'א'.repeat(FEEDBACK_FIELDS.message + 1) }), { ok: false, error: 'too-long' });
  assert.equal(buildFeedbackDoc({ message: 'א'.repeat(FEEDBACK_FIELDS.message) }).ok, true);
});

test('anti-spam: honeypot, too fast, one report a minute', () => {
  const openedAt = 1_000_000;
  assert.equal(sendBlockedReason({ honeypot: 'http://spam', openedAt, now: openedAt + 60000 }), 'bot');
  assert.equal(sendBlockedReason({ openedAt, now: openedAt + MIN_OPEN_MS - 1 }), 'too-fast');
  assert.equal(sendBlockedReason({ openedAt, now: openedAt + 10000, lastSentAt: openedAt + 10000 - RESEND_WAIT_MS + 1 }), 'wait');
  assert.equal(sendBlockedReason({ openedAt, now: openedAt + 10000 }), null);
});

test('the endpoint is the Firestore REST create for the feedback collection', () => {
  assert.equal(feedbackEndpoint({ projectId: 'p-1', apiKey: 'k' }),
    'https://firestore.googleapis.com/v1/projects/p-1/databases/(default)/documents/feedback?key=k');
});

test('firestore.rules allows exactly the report fields, with the same limits, and never reads', () => {
  const list = (fn) => new RegExp(`${fn}\\(\\[([^\\]]*)\\]\\)`).exec(rules)[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1)).sort();
  const fields = Object.keys(FEEDBACK_FIELDS).sort();
  assert.deepEqual(list('hasOnly'), fields);
  assert.deepEqual(list('hasAll'), fields);
  for (const [k, n] of Object.entries(FEEDBACK_FIELDS)) assert.match(rules, new RegExp(`text\\(d\\.${k}, ${n}\\)`), k);
  // Every allow other than the one create is "if false".
  const allows = [...rules.matchAll(/allow ([a-z, ]+): if ([^;]+);/g)].map((m) => [m[1], m[2].trim()]);
  assert.deepEqual(allows.filter(([, cond]) => cond !== 'false'), [['create', 'isReport(request.resource.data)']]);
  assert.ok(allows.some(([verbs, cond]) => verbs.includes('read') && cond === 'false'));
});
