// Builds the site from tests/fixtures/answers into .e2e-dist, then serves it. `astro preview` 404s non-slash files.
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { emptyTicks } from '../../src/lib/merge.js';

export const DIST = '.e2e-dist';
execFileSync('npx', ['astro', 'build', '--outDir', DIST], { stdio: 'inherit', env: { ...process.env, LFG_CONTENT_DIR: 'tests/fixtures/answers' } });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
createServer(async (req, res) => {
  try {
    let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    if (path.endsWith('/')) path += 'index.html';
    // The real /api/progress is a Vercel Function; here a stand-in that stores nothing, so pages sync without a 404.
    if (path === '/api/progress') return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(emptyTicks()));
    const body = await readFile(join(DIST, path)); // read first: a missing file must still be able to answer 404
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(Number(process.env.LFG_PORT ?? 4399), '127.0.0.1', () => console.log('serving', DIST, 'on', process.env.LFG_PORT ?? 4399));
