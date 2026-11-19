// The one place that touches localStorage key `lfg:v1`. Other modules import read() and write().
// The stored value is the v2 state from src/lib/merge.js, a timestamp on every setting and tick so devices can
// sync. An old-shape value ({ console, dial, theme, stage, done }) is still read, and becomes v2 on first load.
// read() and write() keep their flat shape: { console, dial, theme, stage, done: string[] }.
import { ENUMS, load, merge, parse, validId } from '../lib/merge.js';

const KEY = 'lfg:v1';
const defaults = { console: '', dial: 'off', theme: 'system', stage: 'before' }; // console '' = never chosen

// The saved v2 state (timestamps included). sync.js sends this.
export function state() {
  try {
    return load(JSON.parse(localStorage.getItem(KEY)));
  } catch {
    return load();
  }
}

const flat = (s) => ({
  ...defaults,
  ...Object.fromEntries(Object.entries(s.settings).map(([k, e]) => [k, e.value])),
  done: Object.keys(s.items).filter((id) => s.items[id].done),
});
export const read = () => flat(state());

function apply(s) {
  const html = document.documentElement;
  if (s.console) html.dataset.console = s.console;
  else delete html.dataset.console; // never chosen: the page shows only every-console records and asks
  html.dataset.dial = s.dial;
  if (s.theme === 'day' || s.theme === 'night') html.dataset.theme = s.theme;
  else delete html.dataset.theme;
  for (const input of document.querySelectorAll('input[data-setting]')) input.checked = input.value === s[input.name];
  for (const b of document.querySelectorAll('button[data-set]')) b.setAttribute('aria-pressed', b.dataset.value === s[b.dataset.set]);
  dispatchEvent(new CustomEvent('lfg:change', { detail: s })); // reveal.js re-syncs on this
}

function save(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {} // blocked storage: the change still applies for this page
  apply(flat(s));
  return flat(s);
}

// A change made now must beat what is stored, even if this device's clock runs behind another's.
const stamp = (prev) => Math.max(Date.now(), (prev?.at ?? -1) + 1);

export function write(patch) {
  const s = state();
  const was = flat(s);
  for (const k of Object.keys(ENUMS)) {
    if (k in patch && patch[k] !== was[k] && ENUMS[k].includes(patch[k])) s.settings[k] = { value: patch[k], at: stamp(s.settings[k]) };
  }
  if (Array.isArray(patch.done)) {
    const next = new Set(patch.done.filter(validId));
    for (const id of next) if (!was.done.includes(id)) s.items[id] = { done: true, at: stamp(s.items[id]) };
    for (const id of was.done) if (!next.has(id)) s.items[id] = { done: false, at: stamp(s.items[id]) };
  }
  const out = save(s);
  dispatchEvent(new Event('lfg:write')); // sync.js pushes on this; absorb() below does not fire it
  return out;
}

// Merge a v2 state from elsewhere (the server, an import code) into this device and apply it.
export function absorb(remote) {
  const next = parse(remote);
  return next && save(merge(state(), next));
}

addEventListener('change', (e) => {
  if (e.target.matches?.('input[data-setting]')) write({ [e.target.name]: e.target.value });
});
// A link or button with data-set="dial" data-value="places" sets that value; data-focus="#id" names where focus goes.
addEventListener('click', (e) => {
  const el = e.target.closest?.('[data-set]');
  if (!el || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  write({ [el.dataset.set]: el.dataset.value });
  document.querySelector(el.dataset.focus)?.focus();
});
addEventListener('storage', (e) => e.key === KEY && apply(read()));

// First load after the update: store the old shape as v2, so every later change carries a timestamp.
try {
  const raw = JSON.parse(localStorage.getItem(KEY));
  if (raw && !parse(raw)) localStorage.setItem(KEY, JSON.stringify(load(raw)));
} catch {}
apply(read());
