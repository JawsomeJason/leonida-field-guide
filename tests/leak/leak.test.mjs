import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { findLeaks, loadRecords } from '../../scripts/check-leak.mjs';

const records = loadRecords('tests/fixtures/answers');
const place = 'The quokka marker sits beside the sample fountain.';

function dist(files) {
  const dir = mkdtempSync(join(tmpdir(), 'lfg-leak-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}

test('a hidden string in its own explicit-show page and /h/ files is fine', () => {
  const d = dist({ 'places/place-01/show/index.html': `<p>${place}</p>`, 'places/list/show/index.html': `<p>${place}</p>`, 'h/places/search.json': JSON.stringify([{ short: place }]), 'index.html': '<p>Nothing here.</p>' });
  assert.deepEqual(findLeaks({ dist: d, records }), []);
});

test('a planted places string in a default page is caught, even re-wrapped in markup', () => {
  const d = dist({ 'index.html': '<p>The <b>quokka</b> marker sits&nbsp;beside the “sample” fountain.</p>' });
  assert.match(findLeaks({ dist: d, records }).join('\n'), /index\.html: contains places text of "place-01"/);
});

test('a places string under the mild paths is caught', () => {
  const d = dist({ 'mild/mild-01/show/index.html': `<p>${place}</p>` });
  assert.equal(findLeaks({ dist: d, records }).length, 1);
});

test('a planted hidden string in a gate page is caught, in text, title, meta and aria-label alike', () => {
  for (const gate of ['places/place-01/index.html', 'places/list/index.html', 'places/index.html', 'mild/index.html', 'mild/mild-01/index.html']) {
    for (const html of [`<p>${place}</p>`, `<title>${place}</title>`, `<meta name="description" content="${place}">`, `<a aria-label="${place}" href="/">x</a>`]) {
      const out = findLeaks({ dist: dist({ [gate]: html }), records }).join('\n');
      assert.match(out, new RegExp(`${gate.replace(/\./g, '\\.')}: contains places text of "place-01"`), `${gate} ${html}`);
    }
  }
});

test('the slug in a gate page link is not a leak', () => {
  const d = dist({ 'places/place-01/index.html': '<h1>Hidden page</h1><a href="/places/place-01/show/?reveal=1">Show this page</a>' });
  assert.deepEqual(findLeaks({ dist: d, records }), []);
});

test('a page that prefetches, prerenders or preloads a hidden address, or has speculation rules, is caught', () => {
  for (const html of [
    '<link rel="prefetch" href="/places/place-01/show/">',
    '<link rel=preload href=/h/mild/a/sample-02/ as=fetch>',
    '<link href="/mild/mild-01/show/" rel="modulepreload">',
    '<script type="speculationrules">{"prerender":[{"urls":["/a/x/"]}]}</script>',
  ]) assert.match(findLeaks({ dist: dist({ 'index.html': html }), records }).join('\n'), /index\.html: prefetches a hidden address/, html);
  assert.deepEqual(findLeaks({ dist: dist({ 'index.html': '<link rel="preload" href="/_astro/app.js" as="script"><link rel="prefetch" href="/topics/">' }), records }), []);
});

test('a planted reveal text in a script bundle is caught', () => {
  const d = dist({ '_astro/app.js': 'const t="Wombat note one for the mild reveal of sample two.";' });
  assert.match(findLeaks({ dist: d, records }).join('\n'), /_astro\/app\.js: contains mild text of "sample-02"/);
});

test('the default search index and the offline list may not name a hidden record', () => {
  const d = dist({
    'search/none.json': JSON.stringify([{ id: 'place-01', question: 'x' }]),
    'offline-urls.json': JSON.stringify(['/', '/mild/mild-01/']),
  });
  const out = findLeaks({ dist: d, records }).join('\n');
  assert.match(out, /search\/none\.json: names hidden record "place-01"/);
  assert.match(out, /offline-urls\.json: names hidden record "mild-01"/);
  assert.match(out, /offline-urls\.json: lists a mild path/);
});
