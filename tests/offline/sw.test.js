// Runs the real public/sw.js in a sandbox with an in-memory Cache Storage and a fake network. No browser, no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ORIGIN = 'https://example.test';
const src = readFileSync('public/sw.js', 'utf8');

function boot(network) {
  const stores = new Map();
  const listeners = {};
  const open = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    const key = (r) => new URL(typeof r === 'string' ? r : r.url, ORIGIN).href;
    return {
      put: async (r, res) => void m.set(key(r), res),
      match: async (r) => m.get(key(r)),
      delete: async (r) => m.delete(key(r)),
      keys: async () => [...m.keys()].map((url) => new Request(url)),
    };
  };
  const self = { location: { origin: ORIGIN }, skipWaiting() {}, clients: { claim: async () => {}, matchAll: async () => [] }, addEventListener: (t, f) => (listeners[t] = f) };
  vm.runInNewContext(src, { self, location: self.location, caches: { open: async (n) => open(n), keys: async () => [...stores.keys()], delete: async (n) => stores.delete(n) }, fetch: async (r) => network(new URL(typeof r === 'string' ? r : r.url, ORIGIN).pathname, r), Request, Response, URL, Promise });
  const cache = open('lfg-__BUILD__');
  const wait = async (type, event) => {
    const jobs = [];
    listeners[type]({ ...event, waitUntil: (p) => jobs.push(p) });
    await Promise.all(jobs);
  };
  return { cache, listeners, send: (data) => wait('message', { data }), wait };
}

const page = (body) => new Response(body, { status: 200 });
const loginPage = () => new Response('login', { status: 200, headers: { 'x-lfg-gate': 'login' } }); // the gate's 200 for a document navigation

test('tier purge: lowering the dial deletes that tier from the cache and keeps the rest', async () => {
  const sw = boot((path) => page(path));
  const { cache } = sw;
  for (const u of ['/', '/topics/', '/places/', '/places/spot/', '/h/places/search.json', '/mild/x/', '/h/mild/search.json', '/h/mild/a/x/']) await (await cache).put(u, page(u));
  await (await cache).put('/__lfg-tier-places', page('1'));
  await (await cache).put('/__lfg-tier-mild', page('1'));
  const has = async (u) => Boolean(await (await cache).match(u));

  await sw.send({ type: 'tiers', tiers: ['places'] }); // Mild lowered to Places
  assert.equal(await has('/mild/x/'), false);
  assert.equal(await has('/h/mild/search.json'), false);
  assert.equal(await has('/h/mild/a/x/'), false);
  assert.equal(await has('/__lfg-tier-mild'), false);
  assert.equal(await has('/places/spot/'), true);
  assert.equal(await has('/h/places/search.json'), true);

  await sw.send({ type: 'tiers', tiers: [] }); // Places lowered to Off
  assert.equal(await has('/places/'), false);
  assert.equal(await has('/places/spot/'), false);
  assert.equal(await has('/h/places/search.json'), false);
  assert.equal(await has('/__lfg-tier-places'), false);
  assert.equal(await has('/'), true); // default pages stay
  assert.equal(await has('/topics/'), true);
});

test('a tier turned on is still cached from its own list', async () => {
  const sw = boot((path) => (path === '/h/mild/offline-urls.json' ? Response.json({ urls: ['/mild/x/'] }) : page(path)));
  await sw.send({ type: 'tiers', tiers: ['mild'] });
  assert.equal(await (await sw.cache).match('/mild/x/') !== undefined, true);
});

test('the worker refuses to cache a response that carries x-lfg-gate (a 200 login page)', async () => {
  const sw = boot((path) => (path === '/topics/' ? loginPage() : page(path)));
  const cache = await sw.cache;
  await cache.put('/topics/', page('the real page'));
  await cache.put('/a.js', page('asset'));

  // A page navigation: the gate answers a 200 login page. The player sees it, the cached page is not replaced.
  let shown;
  sw.listeners.fetch({ request: { method: 'GET', url: `${ORIGIN}/topics/`, mode: 'navigate' }, respondWith: (p) => (shown = p), waitUntil() {} });
  assert.equal(await (await shown).text(), 'login');
  assert.equal(await (await cache.match('/topics/')).text(), 'the real page');

  // The background refresh of a cached asset behaves the same.
  const jobs = [];
  const swAsset = boot((path) => (path === '/a.js' ? loginPage() : page(path)));
  const c2 = await swAsset.cache;
  await c2.put('/a.js', page('asset'));
  swAsset.listeners.fetch({ request: { method: 'GET', url: `${ORIGIN}/a.js`, mode: 'no-cors' }, respondWith() {}, waitUntil: (p) => jobs.push(p) });
  await new Promise((r) => setTimeout(r, 20));
  await Promise.all(jobs);
  assert.equal(await (await c2.match('/a.js')).text(), 'asset');

  // Install: a login page in place of a listed URL is not stored, so the cache is not marked ready.
  const bad = boot((path) => (path === '/offline-urls.json' ? Response.json({ urls: ['/x/'] }) : loginPage()));
  await bad.wait('install', {});
  assert.equal(await (await bad.cache).match('/x/'), undefined);
  assert.equal(await (await bad.cache).match('/__lfg-ready'), undefined);
});

test('a good navigation response still refreshes the cached page', async () => {
  const sw = boot((path) => page(`fresh ${path}`));
  const cache = await sw.cache;
  await cache.put('/topics/', page('old'));
  let shown;
  sw.listeners.fetch({ request: { method: 'GET', url: `${ORIGIN}/topics/`, mode: 'navigate' }, respondWith: (p) => (shown = p), waitUntil() {} });
  await shown;
  assert.equal(await (await cache.match('/topics/')).text(), 'fresh /topics/');
});
