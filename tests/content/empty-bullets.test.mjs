import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium } from '@playwright/test';

// No answer page shows an empty bullet, whatever console is chosen (or none): a bullet that holds only a line for other consoles has to go with that line.
// Runs the real build (dist, so after `npm run build`) in a real browser over a local server; nothing leaves this machine.
const DIST = 'dist';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

test('no built answer page shows an empty bullet for any console, or for none', { skip: !existsSync(DIST) && 'run npm run build first' }, async () => {
  const pages = readdirSync(join(DIST, 'a'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => `/a/${e.name}/`);
  assert.ok(pages.length > 30);
  const server = createServer((req, res) => {
    const path = new URL(req.url, 'http://x').pathname;
    try {
      res.writeHead(200, { 'content-type': types[extname(path)] ?? 'text/html' }).end(readFileSync(join(DIST, path.endsWith('/') ? `${path}index.html` : path)));
    } catch {
      res.writeHead(404).end();
    }
  }).listen(0, '127.0.0.1');
  await new Promise((ok) => server.once('listening', ok));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ serviceWorkers: 'block' });
    await page.route('**/api/**', (route) => route.fulfill({ json: {} })); // the sync call never leaves this machine
    const empty = [];
    for (const path of pages) {
      await page.goto(`http://127.0.0.1:${server.address().port}${path}`, { waitUntil: 'networkidle' });
      for (const console of [null, 'ps5', 'xbox-x', 'xbox-s']) {
        const bad = await page.evaluate((c) => {
          if (c) document.documentElement.dataset.console = c;
          else delete document.documentElement.dataset.console;
          return [...document.querySelectorAll('li')].filter((li) => li.getClientRects().length && !li.closest('details:not([open])') && !li.innerText.trim() && !li.querySelector('img,svg,input')).map((li) => li.outerHTML.slice(0, 80));
        }, console);
        empty.push(...bad.map((b) => `${path} (${console ?? 'no console'}): ${b}`));
      }
    }
    assert.deepEqual(empty, []);
  } finally {
    await browser.close();
    server.close();
  }
});
