import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consoleHits } from '../../scripts/check-console-text.mjs';

const rec = (o) => ({ id: 'r', question: 'q', short: 's', consoles: 'all', ...o });
const words = (records) => consoleHits(records).map((h) => `${h.id}:${h.console}:${h.word}`);

test('a neutral record may not name a console in its body, for the other consoles', () => {
  const hits = words([rec({ id: 'a', body: 'Open the PS5 menu.' })]);
  assert.deepEqual(hits, ['a:xbox-x:PS5', 'a:xbox-s:PS5']);
});

test('byConsole text replaces the short for that console, so the others never see it', () => {
  assert.deepEqual(words([rec({ short: 'Plain.', byConsole: { ps5: 'On PS5 press Options.' } })]), []);
  assert.deepEqual(words([rec({ short: 'Plain.', byConsole: { ps5: 'On Xbox press Menu.' } })]), ['r:ps5:Xbox']);
});

test('a record limited to one console is folded away for the others and may use its own words', () => {
  assert.deepEqual(words([rec({ consoles: ['ps5'], body: 'Use the PlayStation Store.' })]), []);
  assert.deepEqual(words([rec({ consoles: ['xbox-x', 'xbox-s'], body: 'Use the Xbox button, then Menu button.' })]), []);
  assert.deepEqual(words([rec({ consoles: ['xbox-x', 'xbox-s'], body: 'Use the DualSense.' })]), ['r:xbox-x:DualSense', 'r:xbox-s:DualSense']);
});

test('button tokens are fine everywhere; literal PlayStation glyphs and names are not for Xbox', () => {
  assert.deepEqual(words([rec({ body: 'Press {cross}, then {l1}, then {options}.' })]), []);
  assert.deepEqual(words([rec({ consoles: ['xbox-x'], body: 'Press ✕ then R1.' })]), ['r:xbox-x:✕', 'r:xbox-x:R1']);
});

test('the family name Series X|S is Xbox-only text, but each Xbox console may not name the other', () => {
  assert.deepEqual(words([rec({ consoles: ['xbox-x', 'xbox-s'], body: 'Made for Series X|S.' })]), []);
  assert.deepEqual(words([rec({ consoles: ['xbox-x', 'xbox-s'], body: 'Series S only.' })]), ['r:xbox-x:Series S']);
  assert.deepEqual(words([rec({ consoles: ['xbox-x', 'xbox-s'], body: 'Series X only.' })]), ['r:xbox-s:Series X']);
});

test('question, to-do and hidden details count as shown text', () => {
  const hits = words([rec({ consoles: ['xbox-s'], question: 'On PS5?', todo: 'Sony step', reveal: [{ tier: 'mild', text: 'PlayStation tip' }] })]);
  assert.deepEqual(hits, ['r:xbox-s:PS5', 'r:xbox-s:Sony', 'r:xbox-s:PlayStation']);
});
