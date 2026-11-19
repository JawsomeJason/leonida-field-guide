import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { findBroken } from '../../scripts/check-links.mjs';

function site(files) {
  const dist = mkdtempSync(join(tmpdir(), 'links-'));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dist, path)), { recursive: true });
    writeFileSync(join(dist, path), body);
  }
  return dist;
}

test('good links pass: slash or not, query and hash, relative, external, anchors', () => {
  const dist = site({
    'index.html': '<a href="/a/real/?x=1#y">a</a><a href="/topics">t</a><a href="https://example.com/nope">o</a><a href="#top">h</a><link href="/app.css"><img src="/i.svg">',
    'a/real/index.html': '<a href="../../">home</a><a href="/a/real/">self</a>',
    'topics/index.html': '',
    'app.css': '', 'i.svg': '',
    'search/none.json': JSON.stringify([{ id: 'real' }]),
    'h/places/search.json': JSON.stringify([{ id: 'spot' }]),
    'places/spot/index.html': '',
  });
  assert.deepEqual(findBroken(dist), []);
});

test('a planted broken link in a page is reported with its page', () => {
  const dist = site({ 'index.html': '<a href="/nope/">x</a><img src="/missing.png">', 'a/real/index.html': '<a href="./gone/">x</a>' });
  assert.deepEqual(findBroken(dist), ['/: /missing.png', '/: /nope/', '/a/real/: ./gone/']);
});

test('a search result that would open a missing page is reported (every tier)', () => {
  const dist = site({
    'search/none.json': JSON.stringify([{ id: 'ghost' }]),
    'h/places/search.json': JSON.stringify([{ id: 'spot' }]),
    'h/mild/search.json': JSON.stringify([{ id: 'bit' }]),
    'places/a/spot/index.html': '', // the old wrong shape: not where a result links
    'mild/bit/index.html': '',
  });
  assert.deepEqual(findBroken(dist), ['/h/places/search.json: /places/spot/', '/search/none.json: /a/ghost/']);
});
