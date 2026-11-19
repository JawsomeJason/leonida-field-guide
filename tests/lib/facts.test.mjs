import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { factGaps } from '../../scripts/check-facts.mjs';

const dist = (files) => {
  const dir = mkdtempSync(join(tmpdir(), 'lfg-facts-'));
  for (const [path, html] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), html);
  }
  return dir;
};
const answer = '<div data-outside><a href="https://example.com/x">Source</a></div><time datetime="2026-11-19">19 November 2026</time><p class="trust__now"><strong>Reported, from news sites</strong></p>';
const card = (id, href) => `<ul><li><article class="card" id="${id}"><h2><a href="${href}">Q?</a></h2><p>A fact, 0.99 dollars.</p></article></li></ul>`;

test('a card that links to an answer page with a source, a date and a label passes', () => {
  assert.deepEqual(factGaps(dist({ 'topics/money/index.html': card('c1', '/a/c1/'), 'a/c1/index.html': answer })), []);
});

test('a hidden-tier card is judged by the explicit page its gate address opens', () => {
  assert.deepEqual(factGaps(dist({ 'h/places/a/index.html': card('p1', '/places/p1/'), 'places/p1/index.html': '<p>gate</p>', 'places/p1/show/index.html': answer })), []);
});

test('a planted card that states a fact with no source, date or label on it or its page is named with its page and row', () => {
  const out = factGaps(dist({ 'places/list/show/index.html': card('p2', '/places/p2/'), 'places/p2/show/index.html': '<p>A price and an announcement.</p>' }));
  assert.equal(out.length, 1);
  assert.match(out[0], /^\/places\/list\/show\/: card "p2" .* a source link, the date checked, the confidence label$/);
});

test('a card whose page lacks only the date is caught, and a card with no link at all is caught', () => {
  const noDate = answer.replace(/<time[^>]*>[^<]*<\/time>/, '');
  assert.match(factGaps(dist({ 'topics/x/index.html': card('c3', '/a/c3/'), 'a/c3/index.html': noDate })).join(), /the date checked/);
  assert.equal(factGaps(dist({ 'topics/x/index.html': '<article class="card" id="c4"><p>A fact.</p></article>' })).length, 1);
});
