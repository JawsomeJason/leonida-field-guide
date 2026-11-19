import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { factGaps, supportGaps } from '../../scripts/check-facts.mjs';
import { loadRecords } from '../../scripts/check-leak.mjs';

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

// Official claims need a dated support quote from an official source of the record (docs/spec.md, "Support quotes").
const rec = (extra) => ({ id: 'x', confidence: 'official', sources: [{ url: 'https://support.xbox.com/a' }, { url: 'https://news.example/b' }], ...extra });
const quote = { claim: 'it works', url: 'https://support.xbox.com/a', quote: 'The page says it works.', checked: '2026-11-19' };

test('an official answer with a dated support quote passes; a reported one needs none', () => {
  assert.deepEqual(supportGaps([rec({ support: [quote] }), rec({ confidence: 'reported' })]), []);
});

test('planted: an official answer with no support entry, an empty quote or no date is named', () => {
  assert.match(supportGaps([rec()]).join(), /^x: official claim the answer has no support quote with a date$/);
  assert.match(supportGaps([rec({ support: [{ ...quote, quote: '  ' }] })]).join(), /an empty quote/);
  assert.match(supportGaps([rec({ support: [{ ...quote, checked: undefined }] })]).join(), /no date/);
  assert.match(supportGaps([rec({ support: [{ ...quote, quote: 'x'.repeat(201) }] })]).join(), /over 200 characters/);
});

test('planted: a quote from a page that is not an official source of the record does not count', () => {
  assert.match(supportGaps([rec({ support: [{ ...quote, url: 'https://news.example/b' }] })]).join(), /not one of its official sources/);
  assert.match(supportGaps([rec({ support: [{ ...quote, url: 'https://support.xbox.com/other' }] })]).join(), /not one of its official sources/);
});

test('planted: each official line of a per-console answer needs a quote naming its console', () => {
  const a = rec({ byConsole: { ps5: 'a', 'xbox-x': 'b' }, support: [{ ...quote, console: 'ps5' }] });
  assert.deepEqual(supportGaps([a]), ['x: official line for xbox-x has no support quote naming xbox-x']);
  assert.deepEqual(supportGaps([{ ...a, support: [{ ...quote, console: 'ps5' }, { ...quote, console: ['xbox-x', 'xbox-s'] }] }]), []);
});

test('planted: each official claim of a mixed answer needs its own quote; a reported claim needs none', () => {
  const basis = [{ claim: 'the space', confidence: 'official' }, { claim: 'the usable part', confidence: 'reported' }];
  const a = rec({ confidence: 'reported', basis });
  assert.match(supportGaps([a]).join(), /official claim "the space" has no support quote/);
  assert.deepEqual(supportGaps([{ ...a, support: [{ ...quote, claim: 'the space' }] }]), []);
  assert.match(supportGaps([{ ...a, support: [{ ...quote, claim: 'something else' }] }]).join(), /"the space" has no support quote/);
});

test('real records: every official claim has a dated support quote, and the schema keeps the field shape', () => {
  const records = loadRecords('src/content/answers');
  assert.deepEqual(supportGaps(records), []);
  assert.ok(records.filter((a) => a.confidence === 'official').every((a) => a.support?.length), 'each official answer carries quotes');
});
