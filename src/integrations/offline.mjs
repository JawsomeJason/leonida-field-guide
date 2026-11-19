// Build hook for the service worker (public/sw.js). After the build it walks the output and writes the
// cache lists the worker reads. Default-tier URLs and hidden-tier URLs never share a file, so the default
// list names nothing under /places/, /mild/ or /h/. It also writes the build version into the worker and into every page's
// inline script (the page stores itself under the worker's cache name before the worker controls anything).
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';

const TIERS = ['places', 'mild'];
const SKIP = /^(sw\.js|offline-urls\.json|404\.html)$|\.map$/;
const tierOf = (url) => TIERS.find((t) => url.startsWith(`/${t}/`) || url.startsWith(`/h/${t}/`));
// What the worker's install fetches: the scripts every page shares and the app files. The rest of the default list is filled in later.
const SHELL = /^\/(_astro\/|favicon\.svg$|manifest\.webmanifest$)/;
const isHidden = (url) => Boolean(tierOf(url)) || url.startsWith('/h/');

// files: [{ rel, hash }] with rel relative to the output folder, forward slashes.
export function buildLists(files) {
  const entries = files
    .filter(({ rel }) => !SKIP.test(rel))
    .map(({ rel, hash }) => ({ url: '/' + rel.replace(/(^|\/)index\.html$/, '$1'), hash }))
    .sort((a, b) => a.url.localeCompare(b.url));
  const version = createHash('sha256').update(entries.map((e) => e.url + e.hash).join('\n')).digest('hex').slice(0, 12);
  const tiers = Object.fromEntries(TIERS.map((t) => [t, entries.filter((e) => tierOf(e.url) === t).map((e) => e.url)]));
  const urls = entries.filter((e) => !isHidden(e.url)).map((e) => e.url);
  return { version, shell: urls.filter((u) => SHELL.test(u)), urls, tiers };
}

async function walk(dir, base = dir) {
  const out = [];
  for (const d of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, d.name);
    if (d.isDirectory()) out.push(...(await walk(path, base)));
    else out.push({ rel: relative(base, path).split(sep).join('/'), path });
  }
  return out;
}

export default function offline() {
  return {
    name: 'lfg-offline',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const out = fileURLToPath(dir);
        const files = await Promise.all(
          (await walk(out)).map(async (f) => {
            const body = await readFile(f.path);
            return { ...f, hash: createHash('sha1').update(body).digest('hex'), redirect: f.rel.endsWith('.html') && body.includes('http-equiv="refresh"') };
          }),
        );
        // A redirect page (the old address of a hidden record) is never cached: the default list names no hidden record.
        const { version, shell, urls, tiers } = buildLists(files.filter((f) => !f.redirect));
        await writeFile(join(out, 'offline-urls.json'), JSON.stringify({ version, urls }));
        for (const t of TIERS) {
          await mkdir(join(out, 'h', t), { recursive: true });
          await writeFile(join(out, 'h', t, 'offline-urls.json'), JSON.stringify({ urls: tiers[t] }));
        }
        for (const f of files.filter((f) => f.rel === 'sw.js' || f.rel.endsWith('.html'))) {
          const text = await readFile(f.path, 'utf8');
          if (text.includes("'__BUILD__'")) await writeFile(f.path, text.replaceAll("'__BUILD__'", `'${version}'`).replace("['__SHELL__']", JSON.stringify(shell)));
        }
      },
    },
  };
}
