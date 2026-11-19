// A page for one console, opened by a player on another (see "Console" in docs/spec.md). Plain JS: the build and node:test use it.
const NAMES = { ps5: 'PS5', 'xbox-x': 'Xbox Series X', 'xbox-s': 'Xbox Series S' };
const SKIP = new Set(['ps5', 'ps', 'playstation', 'xbox', 'series', 'x', 's', 'the', 'a', 'an', 'my', 'do', 'does', 'how', 'what', 'is', 'to', 'i', 'it', 'on', 'for', 'of', 'and', 'or', 'will', 'not', 'when', 'can', 'if', 'in']);

/** The words a record is about: its question and keywords, console names and filler dropped. */
const words = (r) => new Set([r.question, ...(r.keywords ?? [])].join(' ').toLowerCase().match(/[a-z0-9]+/g)?.filter((w) => !SKIP.has(w)) ?? []);

/** "PS5", "Xbox" or "PS5 and Xbox X": how to name the consoles a page is for. */
export const forWhom = (consoles) => {
  const xbox = consoles.filter((c) => c.startsWith('xbox'));
  return [...(consoles.includes('ps5') ? ['PS5'] : []), ...(xbox.length === 2 ? ['Xbox'] : xbox.map((c) => NAMES[c].replace('Series ', '')))].join(' and ');
};

/** The best page for `owned` next to `record`: same topic, `consoles` a list that holds `owned`, most words in common.
 *  Nothing in common (or no such page) gives the topic's cheat sheet instead. */
export function counterpart(record, all, owned) {
  const mine = words(record);
  const score = (b) => [...words(b)].filter((w) => mine.has(w)).length;
  const best = all
    .filter((b) => b.id !== record.id && b.topic === record.topic && b.tier === 'none' && Array.isArray(b.consoles) && b.consoles.includes(owned))
    .map((b) => ({ b, n: score(b) }))
    .sort((x, y) => y.n - x.n || x.b.id.localeCompare(y.b.id))[0];
  return best?.n ? { href: `/a/${best.b.id}/`, title: best.b.question } : { href: `/topics/${record.topic}/`, title: null };
}

/** For a single-console record: one entry per console it is not for. */
export const others = (record, all) =>
  Array.isArray(record.consoles) ? Object.keys(NAMES).filter((c) => !record.consoles.includes(c)).map((c) => ({ console: c, name: NAMES[c], ...counterpart(record, all, c) })) : [];
