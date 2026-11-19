import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { buildLists } from '../../src/integrations/offline.mjs';

const files = [
  'index.html', 'topics/index.html', 'a/one/index.html', 'checklist/index.html', 'places/index.html',
  'places/two/index.html', 'mild/three/index.html', 'h/places/index.json', 'h/mild/index.json',
  '_astro/app.abc.js', 'favicon.svg', 'sw.js', 'offline-urls.json', '404.html', 'search/none.json',
].map((rel) => ({ rel, hash: 'x' }));

test('the default list holds default pages and assets only', () => {
  const { urls } = buildLists(files);
  assert.deepEqual(urls, ['/', '/_astro/app.abc.js', '/a/one/', '/checklist/', '/favicon.svg', '/search/none.json', '/topics/']);
});

test('each hidden tier gets its own list, and no hidden URL reaches the default list', () => {
  const { urls, tiers } = buildLists(files);
  assert.deepEqual(tiers.places, ['/h/places/index.json', '/places/', '/places/two/']);
  assert.deepEqual(tiers.mild, ['/h/mild/index.json', '/mild/three/']);
  assert.equal(urls.some((u) => /^\/(places|mild|h)\//.test(u)), false);
});

test('the version changes when any file changes, hidden ones included', () => {
  const a = buildLists(files).version;
  const changed = files.map((f) => (f.rel === 'mild/three/index.html' ? { ...f, hash: 'y' } : f));
  assert.notEqual(buildLists(changed).version, a);
});

// Runs against the real build when `npm run check` has built it.
test('the built default list has no hidden URL and the worker has a version', { skip: !existsSync('dist/offline-urls.json') }, () => {
  const { urls, version } = JSON.parse(readFileSync('dist/offline-urls.json', 'utf8'));
  assert.ok(urls.length > 0);
  assert.equal(urls.some((u) => /^\/(places|mild|h)\//.test(u)), false);
  const sw = readFileSync('dist/sw.js', 'utf8');
  assert.ok(sw.includes(`'${version}'`));
  assert.equal(sw.includes('__BUILD__\''), false);
});
