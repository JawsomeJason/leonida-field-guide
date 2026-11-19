import test from 'node:test';
import assert from 'node:assert/strict';

// Loads the real function file the way the platform does (a bad relative import fails here, not only on Vercel),
// then swaps its storage for memory. No network, no token.
process.env.SITE_PASSWORD = 'a-made-up-test-password';
const { decide } = await import('../../src/lib/gate.js');
const signedIn = await decide({ path: '/', method: 'POST', cookie: null, formPassword: process.env.SITE_PASSWORD, expectedPassword: process.env.SITE_PASSWORD });
const cookie = signedIn.setCookie.split(';')[0];
const { default: fn } = await import('../../api/progress.ts');
let saved = null;
let writes = 0;
fn.store.read = async () => saved;
fn.store.write = async (s) => { saved = JSON.parse(JSON.stringify(s)); writes++; };

const url = 'https://example.test/api/progress';
const put = (body, headers = {}) =>
  fn.fetch(new Request(url, { method: 'PUT', headers: { 'content-type': 'application/json', cookie, ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
const state = (items = {}) => ({ v: 3, items });
const empty = state();

test('the function file loads and exports a fetch handler', () => {
  assert.equal(typeof fn.fetch, 'function');
});

test('GET on nothing saved returns the empty state', async () => {
  const res = await fn.fetch(new Request(url, { headers: { cookie } }));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await res.json(), empty);
});

test('PUT merges into what is saved and returns the merge', async () => {
  const a = state({ 'first-thing': { done: true, at: 5 }, same: { done: true, at: 1 } });
  const b = state({ 'second-thing': { done: true, at: 6 }, same: { done: false, at: 2 } });
  assert.equal((await put(a)).status, 200);
  const res = await put(b);
  const merged = await res.json();
  assert.deepEqual(Object.keys(merged), ['v', 'items']);
  assert.deepEqual(Object.keys(merged.items), ['first-thing', 'same', 'second-thing']);
  assert.deepEqual(merged.items.same, { done: false, at: 2 });
  assert.deepEqual(await (await fn.fetch(new Request(url, { headers: { cookie } }))).json(), merged);
});

test('a PUT that changes nothing does not write', async () => {
  const before = writes;
  await put(empty);
  assert.equal(writes, before);
});

test('bad bodies are refused before anything is stored', async () => {
  const before = writes;
  assert.equal((await put('not json')).status, 400);
  assert.equal((await put({ v: 1, settings: {}, items: {} })).status, 400);
  assert.equal((await put(state({ 'Bad Id': { done: true, at: 1 } }))).status, 400);
  assert.equal((await put(empty, { 'content-type': 'text/plain' })).status, 400);
  assert.equal((await put('x'.repeat(64 * 1024 + 1))).status, 413);
  assert.equal((await put(empty, { 'content-length': '70000' })).status, 413);
  assert.equal(writes, before);
});

test('a body that carries settings or any unknown field is a 400 and stores nothing', async () => {
  const before = writes;
  const tick = { a: { done: true, at: 1 } };
  const bodies = [
    { v: 3, settings: { dial: { value: 'mild', at: 1 } }, items: tick }, // a setting
    { v: 3, settings: {}, items: tick }, // an empty settings key is still a settings key
    { v: 2, settings: { dial: { value: 'mild', at: 1 } }, items: tick }, // the old shape
    { v: 2, settings: {}, items: tick },
    { v: 3, items: tick, dial: 'mild' }, // an unknown top-level field
    { v: 3, items: { a: { done: true, at: 1, note: 'x' } } }, // an unknown field on a tick
  ];
  for (const body of bodies) assert.equal((await put(body)).status, 400, JSON.stringify(body));
  assert.equal(writes, before);
});

test('GET returns only ticks, even if the stored blob carries settings or is the old shape', async () => {
  saved = { v: 3, settings: { dial: { value: 'mild', at: 9 } }, items: { a: { done: true, at: 1 } } };
  assert.deepEqual(await (await fn.fetch(new Request(url, { headers: { cookie } }))).json(), empty);
  saved = { v: 2, settings: { dial: { value: 'mild', at: 9 } }, items: { a: { done: true, at: 1 } } };
  assert.deepEqual(await (await fn.fetch(new Request(url, { headers: { cookie } }))).json(), empty);
  saved = state({ a: { done: true, at: 1 } });
  assert.deepEqual(await (await fn.fetch(new Request(url, { headers: { cookie } }))).json(), saved);
});

test('the function stores under progress/ticks.json, not the abandoned state.json', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../../api/progress.ts', import.meta.url), 'utf8');
  assert.match(src, /const PATH = 'progress\/ticks\.json'/);
});

test('other methods are 405', async () => {
  for (const method of ['POST', 'DELETE', 'PATCH']) {
    const res = await fn.fetch(new Request(url, { method, headers: { cookie } }));
    assert.equal(res.status, 405, method);
    assert.equal(res.headers.get('allow'), 'GET, PUT');
  }
});

test('a damaged saved blob reads as empty, and a storage failure is a plain 500', async () => {
  saved = { nonsense: true };
  assert.deepEqual(await (await fn.fetch(new Request(url, { headers: { cookie } }))).json(), empty);
  fn.store.read = async () => { throw new Error('secret detail'); };
  const res = await fn.fetch(new Request(url, { headers: { cookie } }));
  assert.equal(res.status, 500);
  assert.doesNotMatch(await res.text(), /secret/);
});

test('without the cookie the function answers 401 and stores nothing', async () => {
  const before = writes;
  for (const init of [{}, { headers: { cookie: 'lfg_gate=wrong' } }, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(state()) }]) {
    const res = await fn.fetch(new Request(url, init));
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { error: 'Sign in first' });
  }
  assert.equal(writes, before);
});

test('with no password configured the function refuses everything', async () => {
  const keep = process.env.SITE_PASSWORD;
  delete process.env.SITE_PASSWORD;
  assert.equal((await fn.fetch(new Request(url, { headers: { cookie } }))).status, 503);
  process.env.SITE_PASSWORD = keep;
});
