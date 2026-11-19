// Tier helpers. Pure functions on record data, so node:test can import this file.
import type { CollectionEntry } from 'astro:content';
import { withButtons } from './console.js';

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
/** A revealed detail is set as short paragraphs: a blank line starts one, and so does every second sentence. One or two sentences stay as they are. */
export const paragraphs = (text: string) =>
  text.split(/\n\s*\n/).flatMap((block) => {
    const s = block.split(/(?<=[.!?])\s+/);
    return Array.from({ length: Math.ceil(s.length / 2) }, (_, i) => s.slice(i * 2, i * 2 + 2).join(' '));
  });
/** The reveal that carries a loss warning: the one with a `label` (generic words written for Off). The Ask search rows, the cards and the answer page all key on it. */
export const lossReveal = (a: Pick<AnswerData, 'reveal'>) => a.reveal?.find((r) => r.label);

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

/** The to-dos of the default tier, in the one order the Ask screen and the Checklist both use: `order` (what depends on what) first, then most asked, then by id. */
export const todosOf = (all: AnswerData[]) =>
  byTier(all, 'none')
    .filter((a) => a.todo)
    .sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || (a.rank ?? 1e9) - (b.rank ?? 1e9) || a.id.localeCompare(b.id));

/** Same topic first, then same stage. A hidden page (mild or places) lists only default answers and its own tier: another hidden tier's question is that tier's hidden text, so it may not sit on this page. */
export function related(a: AnswerData, all: AnswerData[], limit = 4) {
  const pool = all.filter((b) => b.id !== a.id && (b.tier === 'none' || b.tier === a.tier));
  const score = (b: AnswerData) => (b.topic === a.topic ? 2 : 0) + (b.stage === a.stage ? 1 : 0);
  return pool
    .filter((b) => score(b) > 0)
    .sort((x, y) => score(y) - score(x) || (x.rank ?? 1e9) - (y.rank ?? 1e9) || x.id.localeCompare(y.id))
    .slice(0, limit);
}

export { escapeHtml, textHtml, withButtons } from './console.js'; // button names in text live in console.js: the search results use them in the browser too

/** A link to another site says so, inside the link: the other site may show spoilers (same words as <OutsideLink>). */
export const markOutside = (html: string) =>
  html.replace(/(<a href="https?:[^"]*"[^>]*>)(.*?)(<\/a>)/g, '$1$2 <span class="outside__note">(outside site, may contain spoilers)</span>$3');

/** Markdown body to HTML with Astro's own renderer (a dependency of astro, so nothing new ships). */
export async function renderBody(md: string) {
  const { satteri } = await import('@astrojs/markdown-satteri');
  const r = await satteri().createRenderer({ gfm: true, smartypants: true, syntaxHighlight: false });
  return markOutside((await r.render(withButtons(md), { frontmatter: {} })).code);
}

/** Where a record's own page lives: /a/ for none, /<tier>/ otherwise. */
export const pathOf = (a: Pick<AnswerData, 'id' | 'tier'>) => `/${a.tier === 'none' ? 'a' : a.tier}/${a.id}/`;
