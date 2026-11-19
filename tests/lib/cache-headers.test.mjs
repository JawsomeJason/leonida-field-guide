import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Any response that carries hidden-tier text is private and never stored: not a shared cache, not the browser's own. The service worker's storing of a
// revealed detail is the Cache API and is not governed by this header. Production headers come from vercel.json; this test applies its rules to every
// hidden-tier address of the build (show addresses, /h/ fragments, the Places and Mild search data).
const rules = JSON.parse(readFileSync('vercel.json', 'utf8')).headers.map((h) => ({ re: new RegExp(`^${h.source}$`), value: h.headers.find((x) => x.key.toLowerCase() === 'cache-control')?.value ?? '' }));
export const cacheControlFor = (path) => rules.filter((r) => r.re.test(path)).map((r) => r.value).at(-1) ?? 'public';
const isPrivate = (v) => /\bprivate\b/.test(v) && /\bno-store\b/.test(v);

const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
const urlOf = (f) => `/${f.replace(/^dist\//, '').replace(/index\.html$/, '')}`;

test('one of each kind of hidden-tier address answers private, no-store', () => {
  for (const path of ['/mild/keep-your-cash/show/', '/places/list/show/', '/h/mild/a/keep-your-cash/', '/h/places/maps/', '/h/places/search.json', '/h/mild/search.json']) assert.ok(isPrivate(cacheControlFor(path)), `${path}: ${cacheControlFor(path)}`);
  assert.ok(!isPrivate(cacheControlFor('/a/how-to-save/')), 'the default pages stay public');
});

test('every hidden-tier file of the build is covered (the build is checked when it exists)', () => {
  if (!existsSync('dist/h')) return;
  const bad = [];
  for (const dir of ['dist/places', 'dist/mild', 'dist/h']) for (const f of walk(dir)) if (!isPrivate(cacheControlFor(urlOf(f)))) bad.push(urlOf(f));
  assert.deepEqual(bad, []);
});

test('a rule that is missing is caught', () => {
  assert.ok(!isPrivate('public, max-age=0, must-revalidate'));
});
