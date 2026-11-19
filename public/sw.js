// Offline cache. src/integrations/offline.mjs runs after the build: it replaces __BUILD__ below and writes
//   /offline-urls.json            { version, urls }  default-tier URLs only, cached on install
//   /h/<tier>/offline-urls.json   { urls }           one hidden tier, cached only once the player turns it on
// Only same-origin GETs are touched. Redirects, error pages and the gate's login page (header x-lfg-gate, which
// the gate may answer with a 200) are never stored, so a password gate in front of the network cannot
// overwrite a good cached page. When the player lowers the dial, the page sends the tiers that stay on and the
// worker deletes the files of every other hidden tier from the cache.
const VERSION = '__BUILD__';
const CACHE = `lfg-${VERSION}`;
const READY = '/__lfg-ready';
const TIERS = ['places', 'mild'];

// Only a real page or asset is kept: not an error, a redirect (a hidden URL below the player's dial is sent to a 200 gate
// page: storing that would poison the cache) or the gate's login page.
const keepable = (res) => res.ok && !res.redirected && !res.headers.has('x-lfg-gate') && !res.headers.has('x-lfg-redirect');

const store = async (cache, url) => {
  try {
    const res = await fetch(url, { cache: 'reload' });
    if (!keepable(res)) return false;
    await cache.put(url, res);
    return true;
  } catch {
    return false;
  }
};
const storeAll = async (cache, urls) => (await Promise.all(urls.map((u) => store(cache, u)))).every(Boolean);

async function precache() {
  const cache = await caches.open(CACHE);
  let list;
  try {
    list = await (await fetch('/offline-urls.json', { cache: 'reload' })).json();
  } catch {
    return; // no list (dev server, or offline): stay a plain pass-through
  }
  if (await storeAll(cache, list.urls)) {
    await cache.put(READY, new Response('1'));
    for (const c of await self.clients.matchAll({ includeUncontrolled: true })) c.postMessage({ type: 'ready' });
  }
}

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

// The player lowered the dial: delete that tier's pages, fragments, search index and its cached mark.
async function dropTier(tier) {
  const cache = await caches.open(CACHE);
  for (const req of await cache.keys()) {
    const { pathname } = new URL(req.url);
    if (pathname.startsWith(`/${tier}/`) || pathname.startsWith(`/h/${tier}/`) || pathname === `/__lfg-tier-${tier}`) await cache.delete(req);
  }
}

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(precache());
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
  // `tiers` is every hidden tier that is on now: those are added, all the others are dropped.
  if (e.data?.type === 'tiers' && Array.isArray(e.data.tiers)) {
    e.waitUntil(Promise.all(TIERS.map((t) => (e.data.tiers.includes(t) ? addTier(t) : dropTier(t)))));
  }
});

// Only what is already stored is served or refreshed here; nothing new is added by browsing,
// so a hidden page is never cached before its tier is on.
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
          if (held && keepable(res)) await cache.put(new URL(req.url).pathname, res.clone());
          return res;
        } catch {
          return held || Response.error();
        }
      })(),
    );
    return;
  }

  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const held = await cache.match(req);
      if (!held) return fetch(req);
      e.waitUntil(refresh(cache)); // cache first, refreshed in the background
      return held;
    })(),
  );
});
