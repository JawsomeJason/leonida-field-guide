// Tier helpers. Pure functions on record data, so node:test can import this file.
import type { CollectionEntry } from 'astro:content';

export type AnswerData = CollectionEntry<'answers'>['data'];
export type Tier = AnswerData['tier'];
export type HiddenTier = Exclude<Tier, 'none'>;
export type Dial = 'off' | 'places' | 'mild';

export const hiddenTiers: HiddenTier[] = ['places', 'mild'];
const rank: Record<Tier, number> = { none: 0, places: 1, mild: 2 };

/** Tiers the dial lets through: Off is none, Places adds places, Mild adds both. */
export const tiersFor = (dial: Dial): Tier[] => (['none', ...hiddenTiers] as Tier[]).slice(0, rank[dial === 'off' ? 'none' : dial] + 1);

export const byTier = (all: AnswerData[], tier: Tier) => all.filter((a) => a.tier === tier);

/** Hidden tiers that a `none` answer carries details for. */
export const revealTiers = (a: AnswerData) => hiddenTiers.filter((t) => a.reveal?.some((r) => r.tier === t));
export const revealsOf = (a: AnswerData, tier: HiddenTier) => (a.reveal ?? []).filter((r) => r.tier === tier).map((r) => r.text);

/** Every string a reader sees for a record on its own page. */
export const visibleText = (a: AnswerData): string[] =>
  [a.question, a.short, ...Object.values(a.byConsole ?? {}), a.body, a.todo, ...(a.reveal ?? []).map((r) => r.text)].filter((s): s is string => !!s);

/** Strings that may only be written under their tier's own paths. */
export const hiddenText = (a: AnswerData): string[] => (a.tier === 'none' ? (a.reveal ?? []).map((r) => r.text) : visibleText(a));

/** Ids that get a page under `/<tier>/` (or `/a/` for none): the tier's records, plus none answers with details at that tier. */
export function pageIds(all: AnswerData[], tier: Tier) {
  const own = byTier(all, tier).map((a) => ({ id: a.id, detail: false }));
  if (tier === 'none') return own;
  return [...own, ...all.filter((a) => a.tier === 'none' && revealTiers(a).includes(tier)).map((a) => ({ id: a.id, detail: true }))];
}

/** The to-dos of the default tier, in the one order the Ask screen and the Checklist both use: most asked first, then by id. */
export const todosOf = (all: AnswerData[]) =>
  byTier(all, 'none')
    .filter((a) => a.todo)
    .sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || a.id.localeCompare(b.id));

/** Same topic first, then same stage; never above the page's own tier. */
export function related(a: AnswerData, all: AnswerData[], limit = 4) {
  const pool = all.filter((b) => b.id !== a.id && rank[b.tier] <= rank[a.tier]);
  const score = (b: AnswerData) => (b.topic === a.topic ? 2 : 0) + (b.stage === a.stage ? 1 : 0);
  return pool
    .filter((b) => score(b) > 0)
    .sort((x, y) => score(y) - score(x) || (x.rank ?? 1e9) - (y.rank ?? 1e9) || x.id.localeCompare(y.id))
    .slice(0, limit);
}

/** Button names in text: write `{cross}`; both console labels are emitted and CSS shows the chosen console's. */
const buttons: Record<string, [string, string]> = {
  cross: ['✕', 'A'], circle: ['○', 'B'], square: ['□', 'X'], triangle: ['△', 'Y'],
  l1: ['L1', 'LB'], r1: ['R1', 'RB'], l2: ['L2', 'LT'], r2: ['R2', 'RT'], l3: ['L3', 'LS'], r3: ['R3', 'RS'],
  options: ['Options', 'Menu'], create: ['Create', 'View'],
};
export const withButtons = (text: string) =>
  text.replace(/\{(\w+)\}/g, (m, k: string) => (buttons[k] ? `<kbd><span class="ps">${buttons[k][0]}</span><span class="xb">${buttons[k][1]}</span></kbd>` : m));

export const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Plain text to safe HTML with button names. */
export const textHtml = (s: string) => withButtons(escapeHtml(s));

/** Markdown body to HTML with Astro's own renderer (a dependency of astro, so nothing new ships). */
export async function renderBody(md: string) {
  const { satteri } = await import('@astrojs/markdown-satteri');
  const r = await satteri().createRenderer({ gfm: true, smartypants: true, syntaxHighlight: false });
  return (await r.render(withButtons(md), { frontmatter: {} })).code;
}

export const consoleLabels = { ps5: 'PS5', 'xbox-x': 'Xbox Series X', 'xbox-s': 'Xbox Series S' } as const;

/** Where a record's own page lives: /a/ for none, /<tier>/ otherwise. */
export const pathOf = (a: Pick<AnswerData, 'id' | 'tier'>) => `/${a.tier === 'none' ? 'a' : a.tier}/${a.id}/`;
