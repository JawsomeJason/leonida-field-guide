// Offline cache. src/integrations/offline.mjs runs after the build: it replaces __BUILD__ below (and in each page's inline script) and writes
//   SHELL below                   the shared scripts and app files: all that install fetches (written in, so install needs no list round trip)
//   /offline-urls.json            { version, urls }  default-tier URLs only: the whole default site, filled in the background after activation, when a page
//                                 asks (message `fill`), and never a condition of activation
//   /h/<tier>/offline-urls.json   { urls }           one hidden tier, cached only once the player turns it on
// Only same-origin GETs are touched. Redirects, error pages and the gate's login page (header x-lfg-gate, which
// the gate may answer with a 200) are never stored, so a password gate in front of the network cannot
// overwrite a good cached page. When the player lowers the dial, the page sends the tiers that stay on and the
// worker deletes the files of every other hidden tier from the cache.
const VERSION = '__BUILD__';
const SHELL = ['__SHELL__'];
const CACHE = `lfg-${VERSION}`;
const READY = '/__lfg-ready';
const TIERS = ['places', 'mild'];

// Only a real page or asset is kept: not an error, a redirect (a hidden URL below the player's dial is sent to a 200 gate
// page: storing that would poison the cache) or the gate's login page.
// A document navigation to a hidden address that is not on the device while offline gets this small page, not the browser's error page.
// It holds no hidden text: only what it is and a way back.
const NOTICE = '<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Not available offline</title><style>:root{color-scheme:light dark}body{font:1rem/1.5 system-ui,sans-serif;margin:0;padding:1rem;max-inline-size:40rem}a{display:flex;align-items:center;min-block-size:3rem}</style><h1>Not available offline</h1><p>This page cannot load without a connection. Once you have opened it online, it will work offline.</p><a href="/">Go back to Ask</a>';
const HIDDEN = /^\/(places|mild|h)\//;
// One item's fragment: the player's own tap (the reveal header) puts just this one in the cache, so it opens again offline.
const FRAGMENT = /^\/h\/(places|mild)\/a\/[^/]+\/$/;

const keepable = (res) => res.ok && !res.redirected && !res.headers.has('x-lfg-gate') && !res.headers.has('x-lfg-redirect');

const store = async (cache, url) => {
  try {
    const res = await fetch(url, { cache: url.startsWith('/_astro/') ? 'default' : 'reload' }); // a hashed file is immutable: the browser's copy is exact
    if (!keepable(res)) return false;
    await cache.put(url, res);
    return true;
  } catch {
    return false;
  }
};
// A few at a time: the first install must not fill the connection and keep the player's own requests waiting.
const BATCH = 4;
const storeAll = async (cache, urls) => {
  let ok = true;
  for (let i = 0; i < urls.length; i += BATCH) ok = (await Promise.all(urls.slice(i, i + BATCH).map((u) => store(cache, u)))).every(Boolean) && ok;
  return ok;
};

const list = () => fetch('/offline-urls.json', { cache: 'reload' }).then((r) => r.json());

// Install: the shared scripts only, so the worker is active and in control within a second or two of the first visit.
async function install() {
  const cache = await caches.open(CACHE);
  await Promise.all(SHELL.map((u) => store(cache, u)));
}

// Background fill of the default site, after activation: what is not held yet, a few at a time. Marks the cache ready only when every page is in.
let filling;
const fill = () =>
  (filling ??= (async () => {
    try {
      const cache = await caches.open(CACHE);
      const todo = [];
      for (const u of (await list()).urls) if (!(await cache.match(u))) todo.push(u);
      if (await storeAll(cache, todo)) {
        await cache.put(READY, new Response('1'));
        for (const c of await self.clients.matchAll({ includeUncontrolled: true })) c.postMessage({ type: 'ready' });
      }
    } catch {}
  })().finally(() => (filling = null)));

async function addTier(tier) {
  if (!TIERS.includes(tier)) return;
  const cache = await caches.open(CACHE);
  const mark = `/__lfg-tier-${tier}`;
  if (await cache.match(mark)) return;
  try {
    const { urls } = await (await fetch(`/h/${tier}/offline-urls.json`, { cache: 'reload' })).json();
    if (await storeAll(cache, urls)) await cache.put(mark, new Response('1'));
  } catch {}
}

// The player lowered the dial (`lowered`: the page says the dial just went down) or the tier was cached whole before: delete its pages,
// fragments, search index and its cached mark. Otherwise (a page loading at Off, or the dial going up) a detail the player opened with one tap stays for offline use.
async function dropTier(tier, lowered) {
  const cache = await caches.open(CACHE);
  if (!lowered && !(await cache.match(`/__lfg-tier-${tier}`))) return;
  for (const req of await cache.keys()) {
    const { pathname } = new URL(req.url);
    if (pathname.startsWith(`/${tier}/`) || pathname.startsWith(`/h/${tier}/`) || pathname === `/__lfg-tier-${tier}`) await cache.delete(req);
  }
}

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(install());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k.startsWith('lfg-') && k !== CACHE) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (e) => {
  if (e.data?.type === 'fill') e.waitUntil(fill());
  // `tiers` is every hidden tier that is on now: those are added, all the others are dropped.
  if (e.data?.type === 'tiers' && Array.isArray(e.data.tiers)) {
    e.waitUntil(Promise.all(TIERS.map((t) => (e.data.tiers.includes(t) ? addTier(t) : dropTier(t, e.data.lowered)))));
  }
});

// Hidden files are never added by browsing (only by the tier being on, or one reveal tap, below); every other page the player opens is kept.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const { origin, pathname } = new URL(req.url);
  // /api is network-only: synced progress must never come from the cache. Returning without respondWith leaves it to the browser.
  if (req.method !== 'GET' || origin !== location.origin || pathname.startsWith('/api/')) return;
  const refresh = async (cache) => {
    try {
      const res = await fetch(req);
      if (keepable(res)) await cache.put(req, res);
      return res;
    } catch {}
  };

  if (req.mode === 'navigate') {
    e.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const held = await cache.match(req, { ignoreSearch: true });
        try {
          const res = await fetch(req); // network first
          // Every page the player opens is kept, so it opens again offline; a hidden page only when it is held already (its tier's own rules).
          if (keepable(res) && (held || !HIDDEN.test(pathname))) e.waitUntil(cache.put(pathname, res.clone()));
          return res;
        } catch {
          return held || (HIDDEN.test(pathname) ? new Response(NOTICE, { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } }) : Response.error());
        }
      })(),
    );
    return;
  }

  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const held = await cache.match(req, { ignoreVary: true }); // the reveal header must not make a cached fragment a miss
      if (!held) {
        const res = await fetch(req);
        if (FRAGMENT.test(pathname) && req.headers.get('x-lfg-reveal') && keepable(res)) e.waitUntil(cache.put(pathname, res.clone()));
        return res;
      }
      e.waitUntil(refresh(cache)); // cache first, refreshed in the background
      return held;
    })(),
  );
});
