import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { encode, decode, LIMITS } from '../../src/scripts/state-code.js';

const state = { console: 'xbox-x', dial: 'places', theme: 'night', stage: 'day-1', done: ['first-thing', 'second-thing'] };
const code = (obj) => encode(obj);
const rejects = (input) => {
  const r = decode(input);
  assert.equal(r.ok, false);
  assert.ok(r.error.length > 0);
};

test('a valid code round-trips, and the code is base64url', () => {
  const c = encode(state);
  assert.match(c, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decode(c), { ok: true, state });
});

test('line breaks and spaces from pasting are ignored', () => {
  const c = encode(state);
  assert.equal(decode(`  ${c.slice(0, 10)}\n${c.slice(10)}\n`).ok, true);
});

test('keys outside the five are not exported, and duplicates collapse', () => {
  const r = decode(encode({ ...state, extra: 1, done: ['a', 'a'] }));
  assert.deepEqual(r.state.done, ['a']);
  assert.equal('extra' in r.state, false);
});

test('a tampered code is rejected', () => {
  const c = encode(state);
  rejects('A' + c.slice(1)); // breaks the opening brace
  rejects(c + '!');
  rejects(c.slice(0, -5));
  rejects('not a code at all');
  rejects('');
});

test('the wrong shape is rejected', () => {
  rejects(code({ ...state, console: 'switch' }));
  rejects(code({ ...state, dial: 'story' }));
  rejects(code({ ...state, theme: 'blue' }));
  rejects(code({ ...state, stage: 'year-1' }));
  rejects(code({ ...state, done: 'a' }));
  rejects(code({ ...state, done: [1] }));
  rejects(code({ ...state, done: ['Not A Slug'] }));
  rejects(code({ ...state, done: [''] }));
  const { dial, ...missing } = state;
  rejects(btoa(JSON.stringify(missing)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, ''));
  rejects(btoa(JSON.stringify([state])).replace(/=+$/, ''));
  rejects(btoa('null'));
});

test('an oversize code or list is rejected', () => {
  rejects('A'.repeat(LIMITS.code + 1));
  const ids = (n) => Array.from({ length: n }, (_, i) => `item-${i}`);
  assert.equal(decode(code({ ...state, done: ids(LIMITS.done) })).ok, true);
  rejects(code({ ...state, done: ids(LIMITS.done + 1) }));
  rejects(code({ ...state, done: ['a'.repeat(LIMITS.id + 1)] }));
});

test('the stage list matches src/data/stages.ts', () => {
  const ids = [...readFileSync('src/data/stages.ts', 'utf8').matchAll(/id: '([^']+)'/g)].map((m) => m[1]);
  for (const stage of ids) assert.equal(decode(code({ ...state, stage })).ok, true, stage);
  assert.equal(ids.length, 4);
});
