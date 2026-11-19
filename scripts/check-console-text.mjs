// Console-text check. For each console, read the records a player on it would see and fail on another console's name or button.
// Usage: node scripts/check-console-text.mjs [contentDir=src/content/answers]
import { fileURLToPath } from 'node:url';
import { loadRecords } from './check-leak.mjs';

const CONSOLES = ['ps5', 'xbox-x', 'xbox-s'];

// Words that name a console or its buttons. {cross}-style tokens are not here: the build shows each console its own label.
const PLAYSTATION = [/\bPS ?5\b/i, /PlayStation/i, /DualSense/i, /\bSony\b/i, /\bPSSR\b/, /[✕○□△]/, /\b[LR][123]\b/, /\b(?:Options|Create|triangle|cross|circle|square) button\b/i];
const XBOX = [/\bXbox\b/i, /\bSeries [XS]\b/, /\bMicrosoft\b/i, /\b(?:LB|RB|LT|RT)\b/, /\b(?:Menu|View) button\b/i];
const BANNED = {
  ps5: XBOX,
  'xbox-x': [...PLAYSTATION, /\bSeries S\b/],
  'xbox-s': [...PLAYSTATION, /\bSeries X\b/],
};
const FAMILY = /Series X(?:\|S| or S| and (?:Series )?S)/gi; // Rockstar's name for both Xbox consoles; both Xbox players own it

/** The strings a player on this console reads: the answer text (their override replaces `short`), body, to-do and details. */
// A body line for one console sits in <span data-only="ps5">: the other consoles never see it (console.css), so it is cut out of what they read.
const forConsole = (t, c) => t.replace(/<span data-only="([^"]*)">([\s\S]*?)<\/span>/g, (_, only, inner) => (only.split(' ').includes(c) ? inner : ''));
const seen = (a, c) => [a.question, a.byConsole?.[c] ?? a.short, a.body, a.todo, ...(a.reveal ?? []).map((r) => r.text)].filter(Boolean).map((t) => forConsole(t, c));

/** [{ id, console, word }] for every banned word in what each console shows. Records limited to other consoles are folded away. */
export function consoleHits(records) {
  const hits = [];
  for (const c of CONSOLES) {
    for (const a of records) {
      if (a.consoles !== 'all' && !a.consoles.includes(c)) continue;
      for (const text of seen(a, c)) {
        const t = text.replace(FAMILY, c === 'ps5' ? 'Series X|S' : '');
        for (const re of BANNED[c]) {
          const m = t.match(re);
          if (m) hits.push({ id: a.id, console: c, word: m[0] });
        }
      }
    }
  }
  return hits;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const hits = consoleHits(loadRecords(process.argv[2] ?? 'src/content/answers'));
  for (const h of hits) console.error(`${h.id} (${h.console}): "${h.word}"`);
  if (hits.length) process.exit(1);
  console.log('console text: clean');
}
