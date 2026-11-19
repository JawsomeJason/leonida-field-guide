// A card that states a record's facts must show, or plainly link to, a page that carries a source link, the date checked and the
// confidence label. Reads the build. Usage: node scripts/check-facts.mjs [distDir=dist]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const walk = (dir) => readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith('.html')).map((e) => join(e.parentPath, e.name));

/** What a page or card carries: [] when it has all three, else the names of what is missing. */
export const missing = (html) =>
  [
    ['a source link', /data-outside[\s\S]*?<a\b[^>]*\shref="https?:/],
    ['the date checked', /<time datetime="\d{4}-\d\d-\d\d"/],
    ['the confidence label', /class="trust__now"><strong>(?:Official|Reported|Community)\b/],
  ].filter(([, re]) => !re.test(html)).map(([name]) => name);

/** One line per card whose facts have no source, date or label on it or on the page it links to. */
export function factGaps(dist) {
  const out = [];
  for (const file of walk(dist)) {
    const page = `/${relative(dist, file).split(sep).join('/')}`.replace(/index\.html$/, '');
    for (const [card, id] of readFileSync(file, 'utf8').matchAll(/<article class="card"[^>]*?\sid="([^"]+)"[\s\S]*?<\/article>/g).map((m) => [m[0], m[1]])) {
      const own = missing(card);
      if (!own.length) continue;
      const targets = [...card.matchAll(/<a\b[^>]*\shref="(\/[^"#?]*)/g)].map((m) => m[1].replace(/^(\/(?:places|mild)\/[^/]+\/)$/, '$1show/')); // a gate address opens its explicit page
      const lacks = targets.map((t) => (existsSync(join(dist, t, 'index.html')) ? missing(readFileSync(join(dist, t, 'index.html'), 'utf8')) : ['a page']));
      if (!lacks.some((l) => !l.length)) out.push(`${page}: card "${id}" states facts but has no link to a page with ${(lacks[0] ?? own).join(', ')}`);
    }
  }
  return out.sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = process.argv[2] ?? 'dist';
  if (!existsSync(dist)) (console.error(`No build at ${dist}. Run npm run build first.`), process.exit(2));
  const gaps = factGaps(dist);
  console.log(`check:facts ${walk(dist).length} pages checked in ${dist}`);
  if (gaps.length) (console.error(gaps.join('\n')), console.error(`check:facts FAILED: ${gaps.length} card(s)`), process.exit(1));
  console.log('check:facts passed: every card links to its source, date and label');
}
