import { test } from 'node:test';
import assert from 'node:assert/strict';
import { merge, parse, fromV1, load, empty, LIMITS } from '../../src/lib/merge.js';

const item = (done, at) => ({ done, at });
const set = (value, at) => ({ value, at });
const st = (settings = {}, items = {}) => ({ v: 2, settings, items });

test('two devices ticking different items offline both survive', () => {
  const phone = st({}, { 'first-thing': item(true, 100) });
  const tablet = st({}, { 'second-thing': item(true, 200) });
  assert.deepEqual(merge(phone, tablet).items, { 'first-thing': item(true, 100), 'second-thing': item(true, 200) });
});

test('an untick newer than a tick wins, and an older untick loses', () => {
  const ticked = st({}, { a: item(true, 100) });
  assert.deepEqual(merge(ticked, st({}, { a: item(false, 101) })).items.a, item(false, 101));
  assert.deepEqual(merge(ticked, st({}, { a: item(false, 99) })).items.a, item(true, 100));
});

test('a tie at the same time keeps the tick; equal settings stay equal', () => {
  assert.equal(merge(st({}, { a: item(true, 5) }), st({}, { a: item(false, 5) })).items.a.done, true);
  assert.deepEqual(merge(st({ dial: set('mild', 5) }), st({ dial: set('places', 5) })).settings.dial, set('places', 5));
});

test('each setting is decided on its own: newest wins per key', () => {
  const a = st({ dial: set('mild', 10), theme: set('night', 1) });
  const b = st({ dial: set('off', 5), theme: set('day', 2), console: set('xbox-x', 3) });
  assert.deepEqual(merge(a, b).settings, { console: set('xbox-x', 3), dial: set('mild', 10), theme: set('day', 2) });
});

test('idempotent, commutative and associative', () => {
  const a = st({ dial: set('mild', 10) }, { x: item(true, 1), y: item(false, 9) });
  const b = st({ dial: set('off', 5), theme: set('day', 2) }, { x: item(false, 4), z: item(true, 3) });
  const c = st({ theme: set('night', 2) }, { y: item(true, 9), z: item(false, 3) });
  assert.deepEqual(merge(a, a), a);
  assert.deepEqual(merge(merge(a, b), b), merge(a, b));
  assert.deepEqual(merge(a, b), merge(b, a));
  assert.deepEqual(merge(merge(a, b), c), merge(a, merge(b, c)));
  assert.deepEqual(merge(merge(a, b), c), merge(c, merge(b, a)));
});

test('the same state from either order stringifies the same', () => {
  const a = st({}, { b: item(true, 1), a: item(true, 1) });
  const b = st({}, { c: item(true, 1) });
  assert.equal(JSON.stringify(merge(a, b)), JSON.stringify(merge(b, a)));
});

test('empty, undefined and junk inputs give a valid state', () => {
  assert.deepEqual(merge(), empty());
  assert.deepEqual(merge(undefined, null), empty());
  assert.deepEqual(merge('junk', 42), empty());
  const a = st({ dial: set('off', 1) }, { a: item(true, 1) });
  assert.deepEqual(merge(a, undefined), a);
  assert.deepEqual(merge(undefined, a), a);
});

test('an id that is also an Object.prototype name merges like any other', () => {
  const r = merge(st({}, { constructor: item(true, 1) }), st({}, { 'to-string': item(true, 1) }));
  assert.deepEqual(Object.keys(r.items), ['constructor', 'to-string']);
});

test('the old lfg:v1 shape migrates with nothing dropped, at time 0', () => {
  const old = { console: 'xbox-x', dial: 'mild', theme: 'night', stage: 'day-1', done: ['a', 'b'] };
  assert.deepEqual(fromV1(old), st(
    { console: set('xbox-x', 0), dial: set('mild', 0), stage: set('day-1', 0), theme: set('night', 0) },
    { a: item(true, 0), b: item(true, 0) },
  ));
  assert.deepEqual(fromV1(old, 7).items.a, item(true, 7));
});

test('old values never beat a newer change from another device', () => {
  const old = { console: 'ps5', dial: 'off', theme: 'system', stage: 'before', done: ['a'] };
  const newer = st({ dial: set('mild', 50) }, { a: item(false, 60) });
  const r = merge(old, newer);
  assert.deepEqual(r.settings.dial, set('mild', 50));
  assert.deepEqual(r.items.a, item(false, 60));
  assert.deepEqual(r.settings.console, set('ps5', 0)); // still kept where nothing newer exists
});

test('migration skips bad values instead of failing', () => {
  const r = fromV1({ console: 'switch', dial: 'story', done: ['Not A Slug', 1, '', 'ok'] });
  assert.deepEqual(r, st({}, { ok: item(true, 0) }));
  assert.deepEqual(fromV1(null), empty());
  assert.equal(Object.keys(fromV1({ done: Array.from({ length: 999 }, (_, i) => `i-${i}`) }).items).length, LIMITS.items);
});

test('parse accepts only the exact v2 shape', () => {
  const good = st({ dial: set('off', 1) }, { a: item(true, 1) });
  assert.deepEqual(parse(good), good);
  const bad = [
    null, [], 'x', { v: 1, settings: {}, items: {} }, { ...good, extra: 1 },
    st({ dial: set('story', 1) }), st({ nope: set('x', 1) }), st({ dial: { value: 'off' } }),
    st({ dial: { value: 'off', at: -1 } }), st({ dial: { value: 'off', at: 1.5 } }), st({ dial: { value: 'off', at: 1, x: 1 } }),
    st({}, { 'Not A Slug': item(true, 1) }), st({}, { a: { done: 'yes', at: 1 } }), st({}, { a: item(true, 1e15) }),
    st({}, { ['a'.repeat(LIMITS.id + 1)]: item(true, 1) }),
    st({}, Object.fromEntries(Array.from({ length: LIMITS.items + 1 }, (_, i) => [`i-${i}`, item(true, 1)]))),
  ];
  for (const x of bad) assert.equal(parse(x), null, JSON.stringify(x).slice(0, 80));
  assert.notEqual(parse(st({}, Object.fromEntries(Array.from({ length: LIMITS.items }, (_, i) => [`i-${i}`, item(true, 1)])))), null);
});

test('load reads either shape', () => {
  const v2 = st({ dial: set('off', 3) }, { a: item(true, 3) });
  assert.deepEqual(load(v2), v2);
  assert.deepEqual(load({ dial: 'places', done: ['a'] }).settings.dial, set('places', 0));
});
