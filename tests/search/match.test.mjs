import test from 'node:test';
import assert from 'node:assert/strict';
import { match } from '../../src/scripts/search-match.js';

const records = [
  { id: 'a', question: 'How do I save?', short: 'Open the pause menu.' },
  { id: 'b', question: 'Where is the pause menu?', short: 'Press options to save.' },
  { id: 'c', question: 'Why does it stutter?', short: 'Restart the game.' },
];

test('empty or punctuation-only query matches nothing', () => {
  assert.deepEqual(match(records, ''), []);
  assert.deepEqual(match(records, ' ?! '), []);
});

test('every token must match, in any order, any case', () => {
  assert.deepEqual(match(records, 'MENU pause').map((r) => r.id), ['b', 'a']);
  assert.deepEqual(match(records, 'save restart'), []);
});

test('question hits rank above short-only hits', () => {
  assert.deepEqual(match(records, 'save').map((r) => r.id), ['a', 'b']);
});
