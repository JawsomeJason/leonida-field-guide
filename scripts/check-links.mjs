// Link check. Every internal link in a built page, and every page a search result would open, must be a built file.
// Usage: node scripts/check-links.mjs [distDir=dist]
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pagePath } from '../src/scripts/search-match.js'; // the same function the search page uses to build result links

const walk = (dir) => readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name));
const EXTERNAL = /^([a-z][a-z0-9+.-]*:|\/\/)/i; // https:, mailto:, data:, //host

/** True when the path (already without query or hash) is a built file, or a folder with an index.html. */
function built(dist, path) {
  const file = join(dist, decodeURIComponent(path));
  const isFile = (f) => existsSync(f) && statSync(f).isFile();
  return isFile(file) || isFile(join(file, 'index.html')) || (!extname(path) && isFile(`${file}.html`));
}

export function findBroken(dist) {
  const broken = new Set();
  const check = (from, href) => {
    if (!href || href.startsWith('#') || EXTERNAL.test(href)) return;
    if (!built(dist, new URL(href, `http://x${from}`).pathname)) broken.add(`${from}: ${href}`); // URL resolves relative links, drops query and hash
  };

  for (const file of walk(dist).filter((f) => f.endsWith('.html'))) {
    const page = `/${relative(dist, file).split(sep).join('/')}`.replace(/index\.html$/, '');
    const html = readFileSync(file, 'utf8');
    for (const m of html.matchAll(/\s(?:href|src)=(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/g)) check(page, m[1] ?? m[2] ?? m[3]);
  }

  // Search indexes: the result link the page builds for each row.
  const indexes = [['none', 'search/none.json'], ...['places', 'mild'].map((t) => [t, `h/${t}/search.json`])];
  for (const [tier, path] of indexes) {
    const file = join(dist, path);
    if (!existsSync(file)) continue;
    for (const row of JSON.parse(readFileSync(file, 'utf8'))) check(`/${path}`, pagePath(tier, row.id));
  }
  return [...broken].sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = process.argv[2] ?? 'dist';
  if (!existsSync(dist)) (console.error(`No build at ${dist}. Run npm run build first.`), process.exit(2));
  const broken = findBroken(dist);
  const pages = walk(dist).filter((f) => f.endsWith('.html')).length;
  console.log(`check:links ${pages} pages and the search indexes checked in ${dist}`);
  if (broken.length) (console.error(broken.join('\n')), console.error(`check:links FAILED: ${broken.length} broken link(s)`), process.exit(1));
  console.log('check:links passed: 0 broken links');
}
