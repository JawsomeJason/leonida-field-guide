// A local Lighthouse runner for the speed target (docs/spec.md "Speed"): serves a built dist, runs Lighthouse mobile
// (the default simulated slow 4G and 4x CPU slowdown) several times per page and prints the median LCP, the LCP element
// and the render-blocking requests. Absolute numbers differ from the live site (the gate adds time to the first byte there),
// so compare screens with each other and one commit with another: build an older commit into its own folder and pass it as --dist.
//
//   node scripts/measure-lcp.mjs [--dist dir] [--runs 5] [--content dir] [path ...]
//
// With no --dist it builds the site into .lcp-dist first (the real content, or --content). Paths default to /, /checklist/, /topics/
// and /a/keep-your-cash/. Lighthouse and chrome-launcher are not dependencies of the site: LHTOOL names a folder whose
// node_modules holds them (default: the shared tool folder), or `npm i lighthouse chrome-launcher` anywhere and point LHTOOL at it.
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { brotliCompressSync } from 'node:zlib';
import { extname, join, normalize, resolve } from 'node:path';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(`--${name}`) ? args.splice(args.indexOf(`--${name}`), 2)[1] : fallback);
const runs = Number(opt('runs', 5));
const content = opt('content', process.env.LFG_CONTENT_DIR);
let dist = opt('dist', '');
const paths = args.length ? args : ['/', '/checklist/', '/topics/', '/a/keep-your-cash/'];

if (!dist) {
  dist = '.lcp-dist';
  execFileSync('npx', ['astro', 'build', '--outDir', dist], { stdio: 'inherit', env: { ...process.env, ...(content ? { LFG_CONTENT_DIR: content } : {}) } });
}
dist = resolve(dist);

// The realistic headers: brotli for text (so the transfer size is what a phone downloads), an immutable hashed bundle,
// pages that revalidate. The middleware is not here, so no first-byte delay.
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const packed = new Map();
const server = createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (path.endsWith('/') || path.endsWith('\\')) path = join(path, 'index.html');
  const file = join(dist, path);
  if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) return res.writeHead(404).end('not found');
  const type = types[extname(file)] ?? 'application/octet-stream';
  const headers = { 'content-type': type, 'cache-control': path.startsWith('/_astro/') ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate' };
  if (/text|json|svg/.test(type) && /\bbr\b/.test(req.headers['accept-encoding'] ?? '')) {
    if (!packed.has(file)) packed.set(file, brotliCompressSync(await readFile(file)));
    return res.writeHead(200, { ...headers, 'content-encoding': 'br', vary: 'accept-encoding' }).end(packed.get(file));
  }
  res.writeHead(200, headers);
  createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;

const lhtool = process.env.LHTOOL ?? '/private/tmp/claude-501/-Users-jason-orca-workspaces-leonida-field-guide-build/f0eb50ff-a6a2-40f7-bf62-da323afc7b89/scratchpad/lhtool';
const need = createRequire(join(lhtool, 'x.js'));
const { default: lighthouse } = await import(need.resolve('lighthouse'));
const chromeLauncher = await import(need.resolve('chrome-launcher'));
const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new'] });

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
try {
  for (const path of paths) {
    const lcps = [];
    let element = '';
    let blocking = [];
    let bytes = 0;
    for (let i = 0; i < runs; i++) {
      const { lhr } = await lighthouse(base + path, { port: chrome.port, output: 'json', onlyCategories: ['performance'], formFactor: 'mobile' });
      lcps.push(Math.round(lhr.audits['largest-contentful-paint'].numericValue));
      const node = lhr.audits['lcp-breakdown-insight'].details?.items?.find((x) => x.type === 'node');
      element = node ? `${node.selector} "${node.nodeLabel?.slice(0, 40)}"` : element;
      blocking = (lhr.audits['render-blocking-insight'].details?.items ?? []).map((r) => `${r.url} ${r.totalBytes}B`);
      bytes = lhr.audits['total-byte-weight'].numericValue;
    }
    console.log(`${path}  median LCP ${median(lcps)} ms  (runs ${lcps.join(', ')})  page weight ${Math.round(bytes)} B`);
    console.log(`   LCP element: ${element.replace(/\s+/g, ' ').slice(0, 120)}`);
    console.log(`   render-blocking: ${blocking.length ? blocking.join('; ') : 'none'}`);
  }
} finally {
  await chrome.kill();
  server.close();
}
