// Plain-words check. On every page of the build, every string a script renders and every record, a listed jargon term
// (src/data/jargon.js) is either absent or has its plain words in the same sentence or the next one the first time it appears.
// Usage: node scripts/check-plain-words.mjs [distDir=dist] [contentDir=src/content/answers] [scriptsDir=src/scripts]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRecords } from './check-leak.mjs';
import { jargon } from '../src/data/jargon.js';

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#x27': "'" };
const decode = (s) => s.replace(/&(amp|lt|gt|quot|apos|nbsp|#39|#x27);/g, (_, n) => ENT[n]);
const SENTENCES = /(?<=[.!?])\s+|\n+/;

/** Visible text of a built page: blocks end a line, an outside link's text (a source's own title) and scripts are left out. */
export function htmlText(html) {
  return decode(
    html
      .replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<a class="outside"[\s\S]*?<\/a>/g, ' ')
      .replace(/<(?:br|\/(?:p|li|h[1-6]|div|dd|dt|summary|details|section|tr|td|th|ul|ol|label|button|a|nav|header|footer|main|title))\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  );
}

/** Quoted strings of a script (the text it renders is in them). */
export const scriptStrings = (js) => [...js.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map((m) => m[1] ?? m[2] ?? m[3]).join('\n');

/** [{ page, term, sentence }]: the first use of each term in `text` that has no plain words in its sentence. */
export function plainWordHits(page, text) {
  const hits = [];
  const sentences = text.split(SENTENCES);
  for (const { term, forms, means } of jargon) {
    const at = sentences.findIndex((s) => (forms.lastIndex = 0, forms.test(s)));
    const first = sentences[at];
    // The plain words may sit in the same sentence or the one right after it ("Not syncing right now. Your ticks are saved on this device.").
    if (first && !means.test(first) && !means.test(sentences[at + 1] ?? '')) hits.push({ page, term, sentence: first.trim().slice(0, 160) });
  }
  return hits;
}

const recordTexts = (a) => [a.question, a.short, ...Object.values(a.byConsole ?? {}), a.body, a.todo, ...(a.reveal ?? []).map((r) => r.text)].filter(Boolean);
const files = (dir, ext) => (existsSync(dir) ? readdirSync(dir, { recursive: true }).filter((f) => f.endsWith(ext)).map((f) => join(dir, f)) : []);

/** Every page, script and record text, each read on its own. Returns { hits, scanned }. */
export function scan({ dist = 'dist', content = 'src/content/answers', scripts = 'src/scripts' } = {}) {
  const hits = [];
  let scanned = 0;
  const read = (page, text) => (scanned++, hits.push(...plainWordHits(page, text)));
  for (const f of files(dist, '.html')) read(f.slice(dist.length), htmlText(readFileSync(f, 'utf8')));
  for (const f of files(scripts, '.js')) read(f, scriptStrings(readFileSync(f, 'utf8')));
  // A record's texts are read one by one: a search card or a per-console line shows one of them alone.
  for (const a of loadRecords(content)) for (const t of recordTexts(a)) read(`record ${a.id}`, t.replace(/\]\([^)]*\)/g, ']').replace(/<[^>]+>/g, ''));
  return { hits, scanned };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [dist, content, scripts] = process.argv.slice(2);
  const { hits, scanned } = scan({ dist, content, scripts });
  for (const h of hits) console.error(`${h.page}: "${h.term}" has no plain words beside it: "${h.sentence}"`);
  if (hits.length) process.exit(1);
  console.log(`plain words: clean (${jargon.length} terms, ${scanned} texts)`);
}
