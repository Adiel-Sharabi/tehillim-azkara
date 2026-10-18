import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HISTORY_LIMIT, parseHistory, recordVisit, removeEntry } from '../lib/history.js';

let n = 0;
const ids = { newId: () => `id${++n}` };

test('a new order goes to the top', () => {
  const a = recordVisit([], { query: 'n=a', at: 1 }, ids);
  const b = recordVisit(a.entries, { query: 'n=b', at: 2 }, ids);
  assert.deepEqual(b.entries.map((e) => e.query), ['n=b', 'n=a']);
});

test('opening the same link again moves it up instead of adding it twice', () => {
  let h = recordVisit([], { query: 'n=a', at: 1 }, ids);
  const first = h.id;
  h = recordVisit(h.entries, { query: 'n=b', at: 2 }, ids);
  h = recordVisit(h.entries, { query: 'n=a', at: 3 }, ids);
  assert.deepEqual(h.entries.map((e) => e.query), ['n=a', 'n=b']);
  assert.equal(h.id, first);
  assert.equal(h.entries[0].at, 3);
});

test('an edit replaces the entry it was made from', () => {
  let h = recordVisit([], { query: 'n=a', at: 1 }, ids);
  const id = h.id;
  h = recordVisit(h.entries, { query: 'n=b', at: 2 }, ids);
  h = recordVisit(h.entries, { query: 'n=a2', at: 3 }, { ...ids, replaceId: id });
  assert.deepEqual(h.entries.map((e) => e.query), ['n=a2', 'n=b']);
  assert.equal(h.id, id);
});

test('an edit that lands on a link already in the list leaves one entry', () => {
  let h = recordVisit([], { query: 'n=a', at: 1 }, ids);
  h = recordVisit(h.entries, { query: 'n=b', at: 2 }, ids);
  h = recordVisit(h.entries, { query: 'n=a', at: 3 }, { ...ids, replaceId: h.id });
  assert.deepEqual(h.entries.map((e) => e.query), ['n=a']);
});

test('the list keeps only the newest entries', () => {
  let h = { entries: [] };
  for (let i = 0; i < HISTORY_LIMIT + 5; i++) h = recordVisit(h.entries, { query: `n=${i}`, at: i }, ids);
  assert.equal(h.entries.length, HISTORY_LIMIT);
  assert.equal(h.entries[0].query, `n=${HISTORY_LIMIT + 4}`);
});

test('one entry can be removed', () => {
  let h = recordVisit([], { query: 'n=a', at: 1 }, ids);
  h = recordVisit(h.entries, { query: 'n=b', at: 2 }, ids);
  assert.deepEqual(removeEntry(h.entries, h.id).map((e) => e.query), ['n=a']);
});

test('damaged storage reads as an empty list', () => {
  for (const raw of [null, '', 'not json', '{}', '[1,"x",null]', '[{"id":"a","query":"","at":1}]']) assert.deepEqual(parseHistory(raw), []);
  assert.deepEqual(parseHistory('[{"id":"a","query":"n=a","at":1},{"id":"b","query":"n=b","at":2}]').map((e) => e.id), ['b', 'a']);
});
