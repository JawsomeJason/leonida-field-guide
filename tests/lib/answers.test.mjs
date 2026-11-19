import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tiersFor, hiddenText, pageIds, related, textHtml, revealTiers, todosOf, markOutside, renderBody } from '../../src/lib/answers.ts';
import { applies, onlyOf } from '../../src/lib/console.js';

const base = { stage: 'before', consoles: 'all', confidence: 'reported', sources: [{ url: 'https://example.com', title: 't' }], checked: '2026-01-01' };
const rec = (o) => ({ ...base, question: `q-${o.id}`, short: `s-${o.id}`, topic: 'setup', tier: 'none', ...o });

const plain = rec({ id: 'plain' });
const withDetail = rec({ id: 'detail', reveal: [{ tier: 'mild', text: 'mild-secret' }, { tier: 'places', text: 'places-secret' }] });
const place = rec({ id: 'place', tier: 'places', topic: 'places', body: 'places-body', byConsole: { ps5: 'ps5-text' } });
const mild = rec({ id: 'mild-one', tier: 'mild', todo: 'mild-todo' });
const all = [plain, withDetail, place, mild];

test('the dial lets through the right tiers', () => {
  assert.deepEqual(tiersFor('off'), ['none']);
  assert.deepEqual(tiersFor('places'), ['none', 'places']);
  assert.deepEqual(tiersFor('mild'), ['none', 'places', 'mild']);
});

test('hidden text: every string of a hidden record, only the details of a none answer', () => {
  assert.deepEqual(hiddenText(plain), []);
  assert.deepEqual(hiddenText(withDetail), ['mild-secret', 'places-secret']);
  assert.deepEqual(hiddenText(place).sort(), ['places-body', 'ps5-text', 'q-place', 's-place']);
  assert.ok(hiddenText(mild).includes('mild-todo'));
});

test('page ids: none gets only its records; a hidden tier gets its records and the none answers with details', () => {
  assert.deepEqual(pageIds(all, 'none').map((p) => p.id), ['plain', 'detail']);
  assert.deepEqual(pageIds(all, 'mild'), [{ id: 'mild-one', detail: false }, { id: 'detail', detail: true }]);
  assert.deepEqual(revealTiers(withDetail), ['places', 'mild']);
});

test('related never rises above the page tier', () => {
  assert.deepEqual(related(plain, all).map((a) => a.id), ['detail']);
  assert.deepEqual(related(mild, all).map((a) => a.id).sort(), ['detail', 'place', 'plain']);
});

test('button names switch by console and text is escaped', () => {
  assert.match(textHtml('Press {cross} <b>'), /<kbd><span class="ps">✕<\/span><span class="xb">A<\/span><\/kbd> &#60;b&#62;/);
  assert.equal(textHtml('{nope}'), '{nope}');
});

test('to-dos come in one order: ranked first, then by id, none tier only', () => {
  const t = (o) => rec({ todo: `t-${o.id}`, ...o });
  const list = [t({ id: 'b' }), t({ id: 'a' }), t({ id: 'z', rank: 2 }), t({ id: 'y', rank: 1 }), t({ id: 'm', tier: 'mild' }), plain];
  assert.deepEqual(todosOf(list).map((a) => a.id), ['y', 'z', 'a', 'b']);
});

test('console rule: every-console records always show; a console-only record shows for that console alone', () => {
  assert.equal(onlyOf('all'), undefined);
  assert.equal(onlyOf(['xbox-x', 'xbox-s']), 'xbox-x xbox-s');
  for (const c of ['', 'ps5', 'xbox-x', 'xbox-s']) assert.equal(applies(onlyOf('all'), c), true);
  assert.deepEqual(['', 'ps5', 'xbox-x', 'xbox-s'].map((c) => applies('ps5', c)), [false, true, false, false]);
  assert.deepEqual(['', 'ps5', 'xbox-x', 'xbox-s'].map((c) => applies('xbox-x xbox-s', c)), [false, false, true, true]);
});

test('a link in a body to another site says it is an outside site that may contain spoilers; a path on this site does not', async () => {
  const html = await renderBody('See [a page](https://example.com/x) and [another answer](/a/other/).');
  assert.match(html, /<a href="https:\/\/example.com\/x">a page <span class="outside__note">\(outside site, may contain spoilers\)<\/span><\/a>/);
  assert.match(html, /<a href="\/a\/other\/">another answer<\/a>/);
  assert.equal(markOutside('<p>no links</p>'), '<p>no links</p>');
});
