// Offline cache. src/integrations/offline.mjs runs after the build: it replaces __BUILD__ below and writes
//   /offline-urls.json            { version, urls }  default-tier URLs only, cached on install
//   /h/<tier>/offline-urls.json   { urls }           one hidden tier, cached only once the player turns it on
// Only same-origin GETs are touched. Redirects and error pages are never stored, so a password gate
// in front of the network cannot overwrite a good cached page.
const VERSION = '__BUILD__';
const CACHE = `lfg-${VERSION}`;
const READY = '/__lfg-ready';
const TIERS = ['places', 'mild'];

const store = async (cache, url) => {
  try {
    const res = await fetch(url, { cache: 'reload' });
    if (!res.ok || res.redirected) return false;
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
  if (e.data?.type === 'tiers' && Array.isArray(e.data.tiers)) e.waitUntil(Promise.all(e.data.tiers.map(addTier)));
});

// Only what is already stored is served or refreshed here; nothing new is added by browsing,
// so a hidden page is never cached before its tier is on.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const refresh = async (cache) => {
    try {
      const res = await fetch(req);
      if (res.ok && !res.redirected) await cache.put(req, res);
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
          if (held && res.ok && !res.redirected) await cache.put(new URL(req.url).pathname, res.clone());
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
