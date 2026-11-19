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
      // Like the real Cache: a fresh copy each time, and ignoreSearch drops the query from both sides.
      match: async (r, opts) => (opts?.ignoreSearch ? [...m].find(([k]) => k.split('?')[0] === key(r).split('?')[0])?.[1] : m.get(key(r)))?.clone(),
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

// Below the player's dial the server answers a hidden URL with a 302 to a 200 gate page: fetch follows it (redirected: true).
const redirected = (body) => Object.defineProperty(new Response(body), 'redirected', { value: true });
const hidden = /^\/(places|mild|h)\//;
const navigate = (sw, path) => {
  let shown;
  sw.listeners.fetch({ request: { method: 'GET', url: `${ORIGIN}${path}`, mode: 'navigate' }, respondWith: (p) => (shown = p), waitUntil() {} });
  return shown;
};

test('the worker does not store a redirected response or one with the redirect header under a hidden URL', async () => {
  const gatePage = (path) => (hidden.test(path) ? redirected('gate page') : page(path));
  // A tier turned on while the cookie is missing: every file is refused and sent to a gate page. Nothing is stored, no tier mark.
  const sw = boot((path) => (path === '/h/mild/offline-urls.json' ? Response.json({ urls: ['/mild/x/show/', '/h/mild/search.json'] }) : gatePage(path)));
  await sw.send({ type: 'tiers', tiers: ['mild'] });
  const cache = await sw.cache;
  assert.equal(await cache.match('/mild/x/show/'), undefined);
  assert.equal(await cache.match('/h/mild/search.json'), undefined);
  assert.equal(await cache.match('/__lfg-tier-mild'), undefined);

  // The same through a refreshed navigation and the background refresh of a cached file.
  const held = boot((path) => gatePage(path));
  const c2 = await held.cache;
  await c2.put('/mild/x/show/', page('the real page'));
  await c2.put('/h/mild/a/x/', page('the real fragment'));
  assert.equal(await (await navigate(held, '/mild/x/show/')).text(), 'gate page'); // the player sees the gate page, as the server meant
  held.listeners.fetch({ request: { method: 'GET', url: `${ORIGIN}/h/mild/a/x/`, mode: 'cors' }, respondWith() {}, waitUntil() {} });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(await (await c2.match('/mild/x/show/')).text(), 'the real page');
  assert.equal(await (await c2.match('/h/mild/a/x/')).text(), 'the real fragment');

  // A 200 that carries the redirect header (a redirect that was already followed) is not kept either.
  const header = boot((path) => (hidden.test(path) ? new Response('gate page', { headers: { 'x-lfg-redirect': 'dial' } }) : page(path)));
  const c3 = await header.cache;
  await c3.put('/places/x/show/', page('the real page'));
  await navigate(header, '/places/x/show/');
  assert.equal(await (await c3.match('/places/x/show/')).text(), 'the real page');
});

test('no warming: with the dial Off the worker fetches no hidden address, at install or when told so', async () => {
  const asked = [];
  const sw = boot((path) => {
    asked.push(path);
    return path === '/offline-urls.json' ? Response.json({ urls: ['/', '/topics/'] }) : page(path);
  });
  await sw.wait('install', {});
  await sw.send({ type: 'tiers', tiers: [] });
  assert.ok(asked.includes('/topics/'));
  assert.deepEqual(asked.filter((p) => hidden.test(p)), []);
  await sw.send({ type: 'tiers', tiers: ['places'] }); // only after the player raises the dial
  assert.ok(asked.includes('/h/places/offline-urls.json'));
  assert.equal(asked.some((p) => p.startsWith('/h/mild/') || p.startsWith('/mild/')), false);
});

test('offline: a page and a fragment already revealed are read from the cache, with or without the reveal marker in the address', async () => {
  const sw = boot(() => Promise.reject(new Error('offline')));
  const cache = await sw.cache;
  await cache.put('/places/x/show/', page('the places page'));
  await cache.put('/h/places/a/y/', page('the fragment'));
  assert.equal(await (await navigate(sw, '/places/x/show/')).text(), 'the places page');
  assert.equal(await (await navigate(sw, '/places/x/show/?reveal=1')).text(), 'the places page');
  let fragment;
  sw.listeners.fetch({ request: { method: 'GET', url: `${ORIGIN}/h/places/a/y/`, mode: 'cors' }, respondWith: (p) => (fragment = p), waitUntil() {} });
  assert.equal(await (await fragment).text(), 'the fragment');
});

// Fix round 8: a detail opened with one tap is kept for offline use, and a hidden page that is not on the device answers a small notice.
const fetchEvent = (path, headers = {}) => {
  const jobs = [];
  let shown;
  return { jobs, event: { request: new Request(`${ORIGIN}${path}`, { headers }), respondWith: (p) => (shown = p), waitUntil: (p) => jobs.push(p) }, shown: () => shown };
};
const ask = async (sw, path, headers) => {
  const f = fetchEvent(path, headers);
  sw.listeners.fetch(f.event);
  const res = await f.shown();
  await Promise.all(f.jobs);
  return res;
};

test('a fragment fetched with the reveal header is stored by that one tap, and a later request is answered from the cache', async () => {
  let online = true;
  const sw = boot((path) => {
    if (!online) throw new TypeError('offline');
    return page(`detail ${path}`);
  });
  const cache = await sw.cache;
  await ask(sw, '/h/mild/a/x/', { 'x-lfg-reveal': '1' });
  assert.equal(await (await cache.match('/h/mild/a/x/')).text(), 'detail /h/mild/a/x/');
  online = false;
  assert.equal(await (await ask(sw, '/h/mild/a/x/', { 'x-lfg-reveal': '1' })).text(), 'detail /h/mild/a/x/'); // the header does not make it a miss

  // Not stored: a fetch with no tap, an index, or a refused (redirected) answer.
  online = true;
  await ask(sw, '/h/mild/a/y/');
  await ask(sw, '/h/mild/search.json', { 'x-lfg-reveal': '1' });
  assert.equal(await cache.match('/h/mild/a/y/'), undefined);
  assert.equal(await cache.match('/h/mild/search.json'), undefined);
  const refusing = boot(() => redirected('gate page'));
  await ask(refusing, '/h/mild/a/z/', { 'x-lfg-reveal': '1' });
  assert.equal(await (await refusing.cache).match('/h/mild/a/z/'), undefined);
});

test('a page loading at Off keeps a detail opened by a tap; lowering the dial removes it', async () => {
  const sw = boot((path) => page(path));
  const cache = await sw.cache;
  await ask(sw, '/h/mild/a/x/', { 'x-lfg-reveal': '1' });
  await sw.send({ type: 'tiers', tiers: [], lowered: false }); // a page load at Off
  assert.notEqual(await cache.match('/h/mild/a/x/'), undefined);
  await sw.send({ type: 'tiers', tiers: ['places'], lowered: false }); // the dial goes up
  assert.notEqual(await cache.match('/h/mild/a/x/'), undefined);
  await sw.send({ type: 'tiers', tiers: [], lowered: true }); // and down
  assert.equal(await cache.match('/h/mild/a/x/'), undefined);
});

test('offline, a navigation to a hidden address that is not on the device gets a small notice with a way back and no hidden text', async () => {
  const sw = boot(() => {
    throw new TypeError('offline');
  });
  for (const path of ['/mild/x/show/?reveal=1', '/places/', '/h/mild/a/x/']) {
    const res = await navigate(sw, path);
    assert.equal(res.status, 503, path);
    const body = await res.text();
    assert.match(body, /cannot load without a connection/);
    assert.match(body, /href="\/"/);
    assert.ok(!body.includes('reveal') && !body.includes('x/show'), path); // nothing of the address is echoed
  }
  // An ordinary page that is not cached keeps the browser's own answer; a cached hidden page is still served.
  assert.equal((await navigate(sw, '/nope/')).type, 'error');
  await (await sw.cache).put('/mild/y/show/', page('held'));
  assert.equal(await (await navigate(sw, '/mild/y/show/?reveal=1')).text(), 'held');
});
