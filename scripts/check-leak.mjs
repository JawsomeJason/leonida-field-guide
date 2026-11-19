// Spoiler-leak check. Every hidden string must appear only in its own tier's explicit-show pages (/<tier>/<id>/show/,
// /<tier>/list/show/), its /h/<tier>/ files (fragments, search index) and nowhere else: never in a gate page
// (/<tier>/, /<tier>/<id>/, /<tier>/list/), attributes and meta tags included. Nothing may prefetch a hidden address.
// Usage: node scripts/check-leak.mjs [distDir=dist] [contentDir=src/content/answers]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml'; // astro's own dependency, hoisted; no new package
import { mapLinks } from '../src/data/outside-maps.js';

const MIN = 12; // shorter strings are not distinctive enough to search for
const HIDDEN = ['places', 'mild'];
const TEXT = /\.(html|json|js|mjs|css|txt|xml|svg|webmanifest|map)$/;

const decode = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, n) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' })[n]);
/** Lower-case words only, so markup, quotes and whitespace cannot hide a copy. */
const norm = (s) => ` ${decode(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;
const mdText = (s) => s.replace(/\]\([^)]*\)/g, ']'); // the url half of a markdown link is not prose

export function loadRecords(dir) {
  return readdirSync(dir, { recursive: true })
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => parse(readFileSync(join(dir, f), 'utf8')));
}

/** [{ tier, text, id }]: each hidden string with the tier whose paths may hold it. */
export function hiddenStrings(records) {
  const out = [];
  for (const a of records) {
    const strings =
      a.tier === 'none'
        ? (a.reveal ?? []).map((r) => [r.tier, r.text])
        : [a.question, a.short, a.body, a.todo, ...Object.values(a.byConsole ?? {}), ...(a.reveal ?? []).map((r) => r.text), ...(a.keywords ?? []), (a.keywords ?? []).join(' ')].map((t) => [a.tier, t]);
    for (const [tier, text] of strings) {
      // {cross}-style button names become markup in the build, so search each piece between them.
      for (const part of String(text ?? '').split(/\{\w+\}/)) {
        const n = norm(mdText(part));
        if (n.trim().length >= MIN) out.push({ tier, id: a.id, text: n });
      }
    }
  }
  return out;
}

const walk = (dir) => readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name));
const jsonStrings = (v) => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(jsonStrings) : []);
// HTML is searched with its attribute values (aria-label, meta content, alt, title) but not its urls: a slug is allowed in a gate page.
const searchable = (file, raw) => {
  if (!file.endsWith('.json')) {
    const noUrls = raw.replace(/\s(?:href|src|action|srcset|poster)=(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, ' ');
    return norm(noUrls.replace(/<[^>]*>/g, (tag) => ` ${[...tag.matchAll(/="([^"]*)"|='([^']*)'|=([^\s>"']+)/g)].map((m) => m[1] ?? m[2] ?? m[3]).join(' ')} `));
  }
  try {
    return norm(jsonStrings(JSON.parse(raw)).join(' '));
  } catch {
    return norm(raw);
  }
};

// Outside map sites (hostname and name, read from the one module so the list cannot drift) are Places-tier content: only the explicit
// places pages and /h/places/ may name them, so no Off page, search index or script bundle does.
const mapNames = mapLinks.flatMap((l) => [new URL(l.href).hostname, l.title]).map((n) => n.toLowerCase());
const mapOwned = (path) => path.startsWith('h/places/') || /^places\/[^/]+\/show\//.test(path);

/** A build path may hold a tier's text when it is that tier's explicit-show page or sits under /h/<tier>/. */
const ownedBy = (path) => HIDDEN.find((t) => path.startsWith(`h/${t}/`) || new RegExp(`^${t}/[^/]+/show/`).test(path));
// A hidden address named in a prefetch-like hint would fetch it ahead of the tap.
const hintsHidden = (html) =>
  /<script[^>]*speculationrules/i.test(html) ||
  [...html.matchAll(/<link\b[^>]*>/gi)].some(([tag]) => /rel=["']?[^>]*(?:prefetch|prerender|preload|modulepreload)/i.test(tag) && /href=["']?\/(?:places|mild|h)\//i.test(tag));

export function findLeaks({ dist, records }) {
  const problems = [];
  const strings = hiddenStrings(records);
  const hiddenIds = records.filter((a) => a.tier !== 'none').map((a) => a.id);

  for (const file of walk(dist).filter((f) => TEXT.test(f))) {
    const path = relative(dist, file).split(sep).join('/');
    const raw = readFileSync(file, 'utf8');
    const hay = searchable(file, raw);
    for (const s of strings) if (ownedBy(path) !== s.tier && hay.includes(s.text)) problems.push(`${path}: contains ${s.tier} text of "${s.id}"`);

    if (!mapOwned(path)) for (const n of mapNames) if (raw.toLowerCase().includes(n)) problems.push(`${path}: names outside map site "${n}"`);

    if (path.endsWith('.html') && hintsHidden(raw)) problems.push(`${path}: prefetches a hidden address or has speculation rules`);

    // The lists a default visit loads or caches must not name a hidden record or path.
    const isList = path === 'search/none.json' || /^offline.*\.json$/.test(path);
    if (isList || path === 'sw.js') {
      for (const id of hiddenIds) if (raw.includes(`/${id}/`) || (isList && jsonStrings(safeJson(raw)).includes(id))) problems.push(`${path}: names hidden record "${id}"`);
    }
    // Whole-path prefixes only: the default page /topics/places/ contains "/places/" but is not a hidden path.
    if (isList) for (const t of HIDDEN) if (jsonStrings(safeJson(raw)).some((u) => u.startsWith(`/${t}/`) || u.startsWith(`/h/${t}/`))) problems.push(`${path}: lists a ${t} path`);
  }
  return problems;
}
const safeJson = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [dist = 'dist', content = 'src/content/answers'] = process.argv.slice(2);
  if (!existsSync(dist)) (console.error(`No build at ${dist}. Run npm run build first.`), process.exit(2));
  const records = existsSync(content) ? loadRecords(content) : [];
  const problems = findLeaks({ dist, records });
  const hidden = records.filter((a) => a.tier !== 'none' || a.reveal?.length).length;
  console.log(`check:leak ${records.length} records, ${hidden} with hidden text, ${hiddenStrings(records).length} strings searched in ${dist}`);
  if (problems.length) (console.error(problems.join('\n')), console.error(`check:leak FAILED: ${problems.length} leak(s)`), process.exit(1));
  console.log('check:leak passed: 0 leaks');
}
