// Progressive enhancement. The service worker (public/sw.js) is registered early by the inline script in Base.astro; this one tells it
// to fill the rest of the default site once the player rests on a page, tells it which hidden tiers are on (it drops the files of the
// others, so lowering the dial clears that tier from the device), and reveals any [data-offline] element once the default cache is
// complete. Fails silently.
const READY = '/__lfg-ready';
const TIERS = { off: [], places: ['places'], mild: ['places', 'mild'] };

async function ready() {
  try {
    for (const key of await caches.keys()) {
      if (key.startsWith('lfg-') && (await (await caches.open(key)).match(READY))) return true;
    }
  } catch {}
  return false;
}
const reveal = () => document.querySelectorAll('[data-offline]').forEach((el) => (el.hidden = false));

async function start() {
  const sw = navigator.serviceWorker;
  sw.addEventListener('message', (e) => e.data?.type === 'ready' && reveal());
  if (await ready()) reveal();

  // The dial lives in settings.js; its data-dial attribute is the one signal every change goes through.
  const root = document.documentElement;
  let on = 0; // how many tiers were on before this message: a lower number is the dial being lowered, which clears every tier that is off now
  const sendTiers = async () => {
    const tiers = TIERS[root.dataset.dial || 'off'] ?? [];
    const lowered = tiers.length < on;
    on = tiers.length;
    (await sw.ready).active?.postMessage({ type: 'tiers', tiers, lowered });
  };
  new MutationObserver(sendTiers).observe(root, { attributes: true, attributeFilter: ['data-dial'] });
  sendTiers();
}

if ('serviceWorker' in navigator && 'caches' in window && import.meta.env.PROD) {
  // The fill fetches the whole guide a few files at a time, so it waits for the load event, a second and an idle moment: leaving for another page cancels it,
  // so it runs when the player rests, not between their taps.
  const fill = async () => (await navigator.serviceWorker.ready).active?.postMessage({ type: 'fill' });
  const run = () => start().then(fill).catch(() => {});
  const go = () => setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(run, { timeout: 2000 }) : run()), 1000);
  if (document.readyState === 'complete') go();
  else addEventListener('load', go, { once: true });
}
