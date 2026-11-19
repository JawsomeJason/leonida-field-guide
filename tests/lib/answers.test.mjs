import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tiersFor, hiddenText, pageIds, related, textHtml, revealTiers } from '../../src/lib/answers.ts';

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
