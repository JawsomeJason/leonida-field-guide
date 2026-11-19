// Builds the site from tests/fixtures/answers into .e2e-dist, then serves it. `astro preview` 404s non-slash files.
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

export const DIST = '.e2e-dist';
execFileSync('npx', ['astro', 'build', '--outDir', DIST], { stdio: 'inherit', env: { ...process.env, LFG_CONTENT_DIR: 'tests/fixtures/answers' } });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  if (path.endsWith('/')) path += 'index.html';
  try {
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' }).end(await readFile(join(DIST, path)));
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(4399, '127.0.0.1', () => console.log('serving', DIST, 'on 4399'));
