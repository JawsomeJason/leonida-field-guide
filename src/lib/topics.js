// What a topic's tile says at each dial level. Pure: node:test imports it. Counts are numbers only; no record text.
export const LEVELS = ['off', 'places', 'mild'];
const NAME = { places: 'Places', mild: 'Mild' };

/** counts: { none, places, mild } records of one topic. Returns the variants to render, each with the levels it holds for:
 *  { levels: 'off places', count, until }. `until` is the lowest level that holds an answer when the tile has none at this level ('' = none at any level). */
export function tileStates({ none = 0, places = 0, mild = 0 }) {
  const shown = [none, none + places, none + places + mild];
  const first = shown.findIndex(Boolean);
  const states = shown.map((count, i) => ({ level: LEVELS[i], count, until: count || first < 0 ? '' : NAME[LEVELS[first]] }));
  /** @type {{ levels: string, count: number, until: string }[]} */
  const init = [];
  return states.reduce((out, s) => {
    const last = out.at(-1);
    if (last && last.count === s.count && last.until === s.until) last.levels += ` ${s.level}`;
    else out.push({ levels: s.level, count: s.count, until: s.until });
    return out;
  }, init);
}

/** The level that first opens something for a topic with no default answers, as its name ('Places', 'Mild'), or '' when nothing is hidden either. */
export const hiddenUntil = (counts) => tileStates(counts).find((s) => s.levels.startsWith('off'))?.until ?? '';

/** The rows a tile renders. A topic with nothing at Off is its closed state plus ONE open row for every level that opens it, with no count at all:
 *  the page never carries a number a level hides, so the script counts from the hidden index once the dial reaches it. Other topics render as tileStates says. */
export function tileRows(counts) {
  const [first, ...rest] = tileStates(counts);
  return first.count === 0 && rest.length ? [{ ...first, open: false }, { levels: rest.map((s) => s.levels).join(' '), open: true }] : tileStates(counts).map((s) => ({ ...s, open: s.count > 0 }));
}
