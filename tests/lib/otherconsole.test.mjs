import test from 'node:test';
import assert from 'node:assert/strict';
import { counterpart, others, forWhom } from '../../src/lib/otherconsole.js';

const rec = (id, question, consoles, extra = {}) => ({ id, question, consoles, topic: 'setup', tier: 'none', ...extra });
const all = [
  rec('ps5-update', 'How do I update my PS5 system software?', ['ps5']),
  rec('xbox-update', 'How do I update my Xbox system software?', ['xbox-x', 'xbox-s']),
  rec('xbox-storage', 'How do I free up space on my Xbox?', ['xbox-x', 'xbox-s']),
  rec('neutral', 'How do I update the game?', 'all'),
  rec('hidden-xbox', 'How do I update my Xbox in secret?', ['xbox-x'], { tier: 'places' }),
  rec('other-topic', 'How do I update my Xbox settings?', ['xbox-x'], { topic: 'settings' }),
];

test('the matching page for the other console shares the topic and the most words', () => {
  assert.deepEqual(counterpart(all[0], all, 'xbox-s'), { href: '/a/xbox-update/', title: 'How do I update my Xbox system software?' });
  assert.equal(counterpart(all[1], all, 'ps5').href, '/a/ps5-update/');
});

test('without a page in common, the topic cheat sheet is the link', () => {
  assert.deepEqual(counterpart(all[2], all, 'ps5'), { href: '/topics/setup/', title: null }); // nothing for PS5 shares a word
  assert.equal(counterpart(rec('x', 'Totally different words', ['ps5']), all, 'xbox-x').href, '/topics/setup/');
});

test('neutral pages, hidden tiers and other topics are never the match', () => {
  const links = ['xbox-x', 'xbox-s', 'ps5'].map((c) => counterpart(all[0], all, c).href);
  assert.ok(!links.some((h) => /neutral|hidden-xbox|other-topic/.test(h)));
});

test('only a single-console page has other consoles', () => {
  assert.deepEqual(others(all[3], all), []);
  assert.deepEqual(others(all[0], all).map((o) => o.console), ['xbox-x', 'xbox-s']);
  assert.deepEqual(others(all[1], all).map((o) => o.console), ['ps5']);
});

test('forWhom names the consoles a page is for', () => {
  assert.equal(forWhom(['ps5']), 'PS5');
  assert.equal(forWhom(['xbox-x', 'xbox-s']), 'Xbox');
  assert.equal(forWhom(['xbox-x']), 'Xbox Series X');
  assert.equal(forWhom(['ps5', 'xbox-s']), 'PS5 and Xbox Series S');
});
