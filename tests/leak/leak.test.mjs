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

test('a hidden string under its own tier paths is fine', () => {
  const d = dist({ 'places/place-01/index.html': `<p>${place}</p>`, 'h/places/search.json': JSON.stringify([{ short: place }]), 'index.html': '<p>Nothing here.</p>' });
  assert.deepEqual(findLeaks({ dist: d, records }), []);
});

test('a planted places string in a default page is caught, even re-wrapped in markup', () => {
  const d = dist({ 'index.html': '<p>The <b>quokka</b> marker sits&nbsp;beside the “sample” fountain.</p>' });
  assert.match(findLeaks({ dist: d, records }).join('\n'), /index\.html: contains places text of "place-01"/);
});

test('a places string under the mild paths is caught', () => {
  const d = dist({ 'mild/mild-01/index.html': `<p>${place}</p>` });
  assert.equal(findLeaks({ dist: d, records }).length, 1);
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
