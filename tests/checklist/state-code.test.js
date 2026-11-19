import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { encode, decode, LIMITS } from '../../src/scripts/state-code.js';

const at = 1_700_000_000_000;
const state = {
  v: 2,
  settings: { console: { value: 'xbox-x', at }, dial: { value: 'places', at }, stage: { value: 'day-1', at }, theme: { value: 'night', at } },
  items: { 'first-thing': { done: true, at }, 'second-thing': { done: false, at: at + 1 } },
};
const old = { console: 'xbox-x', dial: 'places', theme: 'night', stage: 'day-1', done: ['first-thing', 'second-thing'] };
// Any JSON as a code, so the tests can hand over shapes encode() would never make.
const code = (obj) => btoa(JSON.stringify(obj)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const ticks = { v: 3, items: state.items };
const rejects = (input) => {
  const r = decode(input);
  assert.equal(r.ok, false);
  assert.ok(r.error.length > 0);
};

test('export code: ticks only. A device state round-trips to its ticks, and no setting is in the code', () => {
  const c = encode(state);
  assert.match(c, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decode(c), { ok: true, state: ticks });
  const text = atob(c.replaceAll('-', '+').replaceAll('_', '/'));
  assert.deepEqual(JSON.parse(text), ticks);
  assert.doesNotMatch(text, /settings|dial|console|theme|stage|places/);
});

test('an older v2 code is accepted but its settings are ignored', () => {
  assert.deepEqual(decode(code(state)), { ok: true, state: ticks });
});

test('a code made before synced progress is still accepted: ticks at time 0, settings ignored', () => {
  const r = decode(code(old));
  assert.equal(r.ok, true);
  assert.deepEqual(r.state, { v: 3, items: { 'first-thing': { done: true, at: 0 }, 'second-thing': { done: true, at: 0 } } });
});

test('line breaks and spaces from pasting are ignored', () => {
  const c = encode(state);
  assert.equal(decode(`  ${c.slice(0, 10)}\n${c.slice(10)}\n`).ok, true);
});

test('a duplicate id in an old code collapses', () => {
  assert.deepEqual(Object.keys(decode(code({ ...old, done: ['a', 'a'] })).state.items), ['a']);
});

test('a tampered code is rejected', () => {
  const c = encode(state);
  rejects('A' + c.slice(1)); // breaks the opening brace
  rejects(c + '!');
  rejects(c.slice(0, -5));
  rejects('not a code at all');
  rejects('');
});

test('the wrong shape is rejected, in both shapes', () => {
  rejects(code({ ...state, v: 3 })); // v3 carries no settings
  rejects(code({ ...ticks, extra: 1 }));
  rejects(code({ ...state, extra: 1 }));
  rejects(code({ ...state, settings: { dial: { value: 'story', at } } }));
  rejects(code({ ...state, settings: { dial: { value: 'off', at: -1 } } }));
  rejects(code({ ...state, items: { 'Not A Slug': { done: true, at } } }));
  rejects(code({ ...state, items: { a: { done: 'yes', at } } }));
  rejects(code({ ...old, console: 'switch' }));
  rejects(code({ ...old, dial: 'story' }));
  rejects(code({ ...old, theme: 'blue' }));
  rejects(code({ ...old, stage: 'year-1' }));
  rejects(code({ ...old, done: 'a' }));
  rejects(code({ ...old, done: [1] }));
  rejects(code({ ...old, done: ['Not A Slug'] }));
  rejects(code({ ...old, done: [''] }));
  rejects(code({ ...old, extra: 1 }));
  const { dial, ...missing } = old;
  rejects(btoa(JSON.stringify(missing)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, ''));
  rejects(btoa(JSON.stringify([state])).replace(/=+$/, ''));
  rejects(btoa('null'));
});

test('an oversize code or list is rejected, and the biggest valid state still fits', () => {
  rejects('A'.repeat(LIMITS.code + 1));
  const ids = (n) => Array.from({ length: n }, (_, i) => `item-${i}`);
  assert.equal(decode(code({ ...old, done: ids(LIMITS.done) })).ok, true);
  rejects(code({ ...old, done: ids(LIMITS.done + 1) }));
  rejects(code({ ...old, done: ['a'.repeat(LIMITS.id + 1)] }));
  const items = Object.fromEntries(Array.from({ length: LIMITS.done }, (_, i) => [`${'x'.repeat(LIMITS.id - 6)}-${String(i).padStart(4, '0')}`, { done: false, at: 4e12 }]));
  const biggest = { ...state, items };
  assert.ok(encode(biggest).length <= LIMITS.code);
  assert.equal(decode(encode(biggest)).ok, true);
});

test('the stage list matches src/data/stages.ts', () => {
  const ids = [...readFileSync('src/data/stages.ts', 'utf8').matchAll(/id: '([^']+)'/g)].map((m) => m[1]);
  for (const stage of ids) {
    assert.equal(decode(code({ ...state, settings: { stage: { value: stage, at } } })).ok, true, stage);
    assert.equal(decode(code({ ...old, stage })).ok, true, stage);
  }
  assert.equal(ids.length, 4);
});
