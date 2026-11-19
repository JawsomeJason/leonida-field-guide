// Synced progress: the pure state shape and merge, shared by the browser and api/progress.ts.
// No imports, no DOM, no storage. See "Synced progress" in docs/spec.md.
//
// State v2: { v: 2, settings: { <key>: { value, at } }, items: { <id>: { done, at } } }, `at` = ms timestamp.
// Per key and per item the newest `at` wins. Ties: the larger value string wins for a setting, done=true
// wins for an item. That makes merge idempotent, commutative and associative, so devices can sync in any
// order and a lost update is healed by the next sync. Entries are shared with the inputs: treat as read-only.

export const ENUMS = {
  console: ['ps5', 'xbox-x', 'xbox-s'],
  dial: ['off', 'places', 'mild'],
  theme: ['system', 'day', 'night'],
  stage: ['before', 'hour-1', 'day-1', 'week-1'],
};
export const LIMITS = { items: 300, id: 64 };
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_AT = 4e12; // shortcut: rejects only absurd timestamps (year 2096+); a skewed clock still wins, tighten if that bites

export const validId = (id) => typeof id === 'string' && id.length > 0 && id.length <= LIMITS.id && SLUG.test(id);
export const empty = () => ({ v: 2, settings: {}, items: {} });

const isObj = (o) => Boolean(o) && typeof o === 'object' && !Array.isArray(o);
const isAt = (n) => Number.isInteger(n) && n >= 0 && n <= MAX_AT;
const exactly = (o, keys) => Object.keys(o).length === keys.length && keys.every((k) => Object.hasOwn(o, k));

// Union of two records; where both have a key, `wins` picks. Keys come out sorted, so equal states stringify equal.
const pick = (x, y, wins) => {
  const out = {};
  for (const k of [...new Set([...Object.keys(x), ...Object.keys(y)])].sort()) {
    out[k] = !Object.hasOwn(x, k) ? y[k] : !Object.hasOwn(y, k) ? x[k] : wins(x[k], y[k]);
  }
  return out;
};
const newest = (tie) => (a, b) => (a.at !== b.at ? (a.at > b.at ? a : b) : tie(a, b));
const bySetting = newest((a, b) => (String(a.value) >= String(b.value) ? a : b));
const byItem = newest((a, b) => (a.done ? a : b));
const join = (a, b) => ({ v: 2, settings: pick(a.settings, b.settings, bySetting), items: pick(a.items, b.items, byItem) });

// Strict check for a v2 state, used at every boundary (the API, an import code, a response). Returns the
// state in canonical form, or null if anything is off: unknown key, bad enum, bad id, bad time, too many items.
export function parse(x) {
  if (!isObj(x) || x.v !== 2 || !isObj(x.settings) || !isObj(x.items) || !exactly(x, ['v', 'settings', 'items'])) return null;
  const ids = Object.keys(x.items);
  const ok =
    Object.entries(x.settings).every(
      ([k, e]) => Object.hasOwn(ENUMS, k) && isObj(e) && exactly(e, ['value', 'at']) && ENUMS[k].includes(e.value) && isAt(e.at),
    ) &&
    ids.length <= LIMITS.items &&
    ids.every((id) => {
      const e = x.items[id];
      return validId(id) && isObj(e) && exactly(e, ['done', 'at']) && typeof e.done === 'boolean' && isAt(e.at);
    });
  return ok ? join(x, empty()) : null;
}

// The old lfg:v1 shape { console, dial, theme, stage, done: string[] } as v2. Every old value gets `at`
// (default 0, older than any change made since), so it never beats a newer value from another device and
// nothing is dropped. Unknown values and bad ids are skipped.
export function fromV1(old, at = 0) {
  const s = empty();
  if (!isObj(old)) return s;
  for (const k of Object.keys(ENUMS)) if (ENUMS[k].includes(old[k])) s.settings[k] = { value: old[k], at };
  if (Array.isArray(old.done)) for (const id of old.done.slice(0, LIMITS.items)) if (validId(id)) s.items[id] = { done: true, at };
  return join(s, empty());
}

// Anything (undefined, junk, v1, v2) as a valid v2 state. Never throws.
export const load = (x) => parse(x) ?? fromV1(x);

export const merge = (a, b) => join(load(a), load(b));
