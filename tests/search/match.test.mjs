import test from 'node:test';
import assert from 'node:assert/strict';
import { search, asksWhere } from '../../src/scripts/search-match.js';
import { loadRecords, hiddenStrings } from '../../scripts/check-leak.mjs';
import { FIXTURE_QUERIES, REAL_QUERIES } from './queries.mjs';

const index = (dir) => loadRecords(dir).filter((a) => a.tier === 'none');
const ids = (records, query) => search(records, query).found.map((r) => r.id);
const rec = (id, question, extra = {}) => ({ id, question, short: 'Nothing here.', topic: 'good-to-know', ...extra });

const fixtures = index('tests/fixtures/answers');
test('every query from the design owner finds its answer first (fixtures)', () => {
  for (const [query, id] of FIXTURE_QUERIES) assert.equal(ids(fixtures, query)[0], id, query);
});
test('every query from the design owner finds its answer first (real content)', () => {
  const real = index('src/content/answers');
  for (const [query, id] of REAL_QUERIES) assert.equal(ids(real, query)[0], id, query);
});

test('empty, punctuation-only and filler-only queries match nothing', () => {
  const records = [rec('a', 'How do I do the thing?')];
  for (const q of ['', ' ?! ', 'how do i', 'what is the']) assert.deepEqual(ids(records, q), [], q);
});

test('filler words do not match, and do not block a match', () => {
  const records = [rec('a', 'How do I save the game?'), rec('b', 'Why does it stutter?')];
  assert.deepEqual(ids(records, 'how do i'), []);
  assert.deepEqual(ids(records, 'how do i save'), ['a']);
});

test('plurals and word endings meet', () => {
  const records = [rec('a', 'Which control scheme should I use?'), rec('b', 'Can I turn off saving?')];
  assert.deepEqual(ids(records, 'controls'), ['a']);
  assert.deepEqual(ids(records, 'schemes'), ['a']);
  assert.deepEqual(ids(records, 'saves'), ['b']);
  assert.deepEqual(ids(records, 'saved'), ['b']);
});

test('one typo is forgiven in words of five letters or more, two are not', () => {
  const records = [rec('a', 'Which control scheme should I use?')];
  assert.deepEqual(ids(records, 'contrl'), ['a']); // one letter missing
  assert.deepEqual(ids(records, 'contorl'), ['a']); // two letters swapped
  assert.deepEqual(ids(records, 'kontrl'), []); // two edits
  const four = [rec('b', 'Where do I save?')];
  assert.deepEqual(ids(four, 'sabe'), []); // four letters: no typo allowed
});

test('console and storage words are synonyms', () => {
  const ps = [rec('a', 'Does it run on PlayStation?')];
  assert.deepEqual(ids(ps, 'ps5'), ['a']);
  assert.deepEqual(ids([rec('b', 'Does it run on PS5?')], 'playstaton'), ['b']);
  assert.deepEqual(ids([rec('c', 'Is it on the Xbox Series S?')], 'series s'), ['c']);
  const space = [rec('d', 'How much space do I need?')];
  for (const q of ['drive', 'disk', 'storage', 'GB', '512gb']) assert.deepEqual(ids(space, q), ['d'], q);
});

test('the topic name counts, and keywords reach words the text does not use', () => {
  const records = [rec('a', 'Where does my cash go?', { topic: 'money' }), rec('b', 'How do I save?', { keywords: ['quicksave'] })];
  assert.deepEqual(ids(records, 'money'), ['a']);
  assert.deepEqual(ids(records, 'quicksave'), ['b']);
  assert.deepEqual(ids([rec('c', 'Anything?', { topic: 'getting-around' })], 'getting around'), ['c']);
});

test('ranking: question beats keywords beats short beats topic', () => {
  const records = [
    rec('topic', 'Nothing.', { topic: 'saving' }),
    rec('short', 'Nothing.', { short: 'You can save here.' }),
    rec('keyword', 'Nothing.', { keywords: ['save'] }),
    rec('question', 'How do I save?'),
  ];
  assert.deepEqual(ids(records, 'save'), ['question', 'keyword', 'short', 'topic']);
});

test('ranking: more of the words matched ranks higher', () => {
  const records = [rec('one', 'How do I save?'), rec('two', 'How do I save to the cloud?'), rec('none', 'Why does it stutter?')];
  assert.deepEqual(ids(records, 'save cloud'), ['two', 'one']);
});

test('ranking: a rare word outweighs a common one', () => {
  const records = [rec('a', 'Is the game online?'), rec('b', 'Is the game fast?'), rec('c', 'How do I save the game?')];
  assert.equal(ids(records, 'save my game')[0], 'c');
});

test('words the guide has never seen do not count against a match', () => {
  assert.deepEqual(ids([rec('a', 'How do I save?')], 'save zzyzx'), ['a']);
});

test('an unfinished last word still matches', () => {
  const records = [rec('a', 'Which control scheme should I use?')];
  assert.deepEqual(ids(records, 'sche'), ['a']);
  assert.deepEqual(ids(records, 'sche control'), ['a']);
});

test('no match: three closest answers, else the most asked', () => {
  const records = [
    rec('a', 'How do I save?', { rank: 3 }),
    rec('b', 'Is there fast travel?', { rank: 1 }),
    rec('c', 'Is there a map?', { rank: 2 }),
    rec('d', 'Is there co-op?'),
  ];
  const none = search(records, 'zzyzx');
  assert.deepEqual(none.found, []);
  assert.deepEqual(none.closest.map((r) => r.id), ['b', 'c', 'a']); // most asked first
  // Two words, one in each of two answers: half of two is one, so both are found. Four words need two.
  const part = search(records, 'save fast travel co-op');
  assert.deepEqual(part.found, []);
  assert.deepEqual(part.closest.map((r) => r.id)[0], 'b'); // fast + travel
  assert.equal(part.closest.length, 3);
});

test('asks where: only questions about where something is', () => {
  for (const q of ['where is the gun shop', 'Where can I find a car', 'location of the shop', "where's the nearest bank", 'nearest garage']) assert.ok(asksWhere(q), q);
  for (const q of ['how do I save', 'where can I put the game', 'controls']) assert.ok(!asksWhere(q), q);
});

test('a hidden record\'s keywords are hidden strings for the leak check', () => {
  const hidden = hiddenStrings([{ id: 'x', tier: 'places', question: 'q', short: 's', keywords: ['zebra kiosk wallaby', 'ok'] }]);
  assert.ok(hidden.some((h) => h.tier === 'places' && h.text.includes('zebra kiosk wallaby')));
  // A visible record's keywords are not hidden.
  assert.deepEqual(hiddenStrings([{ id: 'y', tier: 'none', question: 'q', short: 's', keywords: ['zebra kiosk wallaby'] }]), []);
});
