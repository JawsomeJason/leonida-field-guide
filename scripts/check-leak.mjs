// Spoiler-leak check. Every hidden string must appear only under its own tier's paths in the build.
// Usage: node scripts/check-leak.mjs [distDir=dist] [contentDir=src/content/answers]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml'; // astro's own dependency, hoisted; no new package

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
        : [a.question, a.short, a.body, a.todo, ...Object.values(a.byConsole ?? {}), ...(a.reveal ?? []).map((r) => r.text)].map((t) => [a.tier, t]);
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
const searchable = (file, raw) => {
  if (!file.endsWith('.json')) return norm(raw.replace(/<[^>]*>/g, ' '));
  try {
    return norm(jsonStrings(JSON.parse(raw)).join(' '));
  } catch {
    return norm(raw);
  }
};

/** A build path belongs to a tier when it sits under /<tier>/ or /h/<tier>/. */
const ownedBy = (path) => HIDDEN.find((t) => path.startsWith(`${t}/`) || path.startsWith(`h/${t}/`));

export function findLeaks({ dist, records }) {
  const problems = [];
  const strings = hiddenStrings(records);
  const hiddenIds = records.filter((a) => a.tier !== 'none').map((a) => a.id);

  for (const file of walk(dist).filter((f) => TEXT.test(f))) {
    const path = relative(dist, file).split(sep).join('/');
    const raw = readFileSync(file, 'utf8');
    const hay = searchable(file, raw);
    for (const s of strings) if (ownedBy(path) !== s.tier && hay.includes(s.text)) problems.push(`${path}: contains ${s.tier} text of "${s.id}"`);

    // The lists a default visit loads or caches must not name a hidden record or path.
    const isList = path === 'search/none.json' || /^offline.*\.json$/.test(path);
    if (isList || path === 'sw.js') {
      for (const id of hiddenIds) if (raw.includes(`/${id}/`) || (isList && jsonStrings(safeJson(raw)).includes(id))) problems.push(`${path}: names hidden record "${id}"`);
    }
    if (isList) for (const t of HIDDEN) if (raw.includes(`/${t}/`) || raw.includes(`/h/${t}/`)) problems.push(`${path}: lists a ${t} path`);
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
