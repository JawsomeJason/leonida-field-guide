import test from 'node:test';
import assert from 'node:assert/strict';
import { search, asksWhere, asksKnown, answersFor, forConsoles } from '../../src/scripts/search-match.js';
import { loadRecords, hiddenStrings } from '../../scripts/check-leak.mjs';
import { FIXTURE_QUERIES } from './queries.mjs';
import { checkQuestions } from '../../scripts/check-search-questions.mjs';

const index = (dir) => loadRecords(dir).filter((a) => a.tier === 'none');
const ids = (records, query) => search(records, query).found.map((r) => r.id);
const rec = (id, question, extra = {}) => ({ id, question, short: 'Nothing here.', topic: 'good-to-know', ...extra });

const fixtures = index('tests/fixtures/answers');
test('every query from the design owner finds its answer first (fixtures)', () => {
  for (const [query, id] of FIXTURE_QUERIES) assert.equal(ids(fixtures, query)[0], id, query);
});
test('every question in tests/search/questions.json finds its answer first, or none (real content)', () => {
  const { failures, passed, total, pending } = checkQuestions();
  assert.deepEqual(failures, []);
  assert.equal(passed + pending, total);
  assert.ok(total >= 60);
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

test('console and storage words are synonyms, but a console word alone is no answer', () => {
  const ps = [rec('a', 'Does it run on PlayStation?')];
  assert.deepEqual(ids(ps, 'ps5 run'), ['a']);
  assert.deepEqual(ids(ps, 'ps5'), []); // it says what the player owns, not what they ask
  assert.deepEqual(ids([rec('b', 'Does it run on PS5?')], 'run playstaton'), ['b']);
  assert.deepEqual(ids([rec('c', 'Does it fit on the Xbox Series S?')], 'series s fit'), ['c']);
  const space = [rec('d', 'How much space do I need?')];
  for (const q of ['drive', 'disk', 'storage', 'GB', '512gb']) assert.deepEqual(ids(space, q), ['d'], q);
});

test('the topic name counts, and keywords reach words the text does not use', () => {
  const records = [rec('a', 'Where does my cash go?', { topic: 'money' }), rec('b', 'How do I save?', { keywords: ['quicksave'] })];
  assert.deepEqual(ids(records, 'money'), ['a']);
  assert.deepEqual(ids(records, 'quicksave'), ['b']);
  assert.deepEqual(ids([rec('c', 'Anything?', { topic: 'getting-around' })], 'getting around'), ['c']);
});

test('ranking: question beats keywords; short and topic hits are no match', () => {
  const records = [
    rec('short', 'Nothing.', { short: 'You can save here.' }),
    rec('keyword', 'Nothing.', { keywords: ['save'] }),
    rec('question', 'How do I save?'),
  ];
  assert.deepEqual(ids(records, 'save'), ['question', 'keyword']);
  assert.deepEqual(ids([records[0], rec('topic', 'Nothing.', { topic: 'saving' })], 'save cloud'), []); // nothing but weak hits: no answer, and nothing offered
});

test('ranking: a match in the question outranks a match in the short text, even with more words there', () => {
  const records = [rec('body', 'Nothing.', { short: 'Save to the cloud here.' }), rec('title', 'Where do I save?')];
  assert.deepEqual(ids(records, 'save cloud'), ['title']); // body has save and cloud, but only in its short text: never the answer
});

test('a query that is only a topic name lists that topic', () => {
  const records = [rec('a', 'Where does my cash go?', { topic: 'money' }), rec('b', 'How do I save?', { topic: 'saving' })];
  assert.deepEqual(ids(records, 'money'), ['a']);
  assert.deepEqual(ids(records, 'money cash'), ['a']);
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

test('no answer: nothing is offered, not even a weak match', () => {
  const records = [
    rec('a', 'How do I save?', { rank: 3 }),
    rec('b', 'Is there fast travel?', { rank: 1 }),
    rec('c', 'Is there a map?', { rank: 2 }),
    rec('d', 'Is there co-op?'),
  ];
  assert.deepEqual(search(records, 'zzyzx'), { found: [] });
  // Four words, one in each of four answers: half of four is two, so nothing is an answer.
  assert.deepEqual(search(records, 'save travel map cooperate').found, []);
});

test('one word of a longer question is not an answer: the words the guide has never seen count against it', () => {
  const records = [rec('t', 'When does the unlock happen?')];
  assert.deepEqual(ids(records, 'unlock'), ['t']);
  assert.deepEqual(ids(records, 'how do i unlock the secret car'), []); // unlock, secret, car: one of three
  assert.deepEqual(ids(records, 'unlock the car'), ['t']); // one of two is half
});

test('a word in the short text or the topic alone is no match', () => {
  const records = [rec('a', 'Alpha question?', { short: 'Mentions the zebra kiosk here.', topic: 'setup' })];
  assert.deepEqual(ids(records, 'zebra kiosk'), []);
  assert.deepEqual(ids(records, 'setup'), ['a']); // a topic's own name lists it (browse), the one exception
});

test('the floor: filler, short words and words that match nothing never make an answer', () => {
  const records = [rec('a', 'How do I save the game?', { short: 'Press the button to play.' }), rec('b', 'Is there fast travel?')];
  for (const q of ['how do i get a million dollars fast', 'my kid wants to play too', 'fast', 'play', 'game', 'up to']) assert.deepEqual(ids(records, q), [], q);
  assert.deepEqual(ids(records, 'how do i save my game'), ['a']);
});

test('generic words such as mode and change rank an answer but never make one alone', () => {
  const records = [rec('a', 'Is there a 60 fps or performance mode?'), rec('b', 'How do I change my controls?')];
  assert.deepEqual(ids(records, 'is there a battle royale mode'), []);
  assert.deepEqual(ids(records, 'change my username'), []);
  assert.deepEqual(ids(records, 'performance mode'), ['a']);
  assert.deepEqual(ids(records, 'change controls'), ['b']);
});

test('swapped neighbouring letters are one typo, from four letters; other typos need five', () => {
  const records = [rec('a', 'How do I save?'), rec('b', 'Is there a map?')];
  assert.deepEqual(ids(records, 'how do i svae my game'), ['a']);
  assert.deepEqual(ids(records, 'mpa'), []); // three letters: no typo at all
  assert.deepEqual(ids(records, 'sabe'), []); // a wrong letter in a four-letter word is not forgiven
  assert.deepEqual(ids([rec('c', 'How do I use the cash?')], 'crash'), []); // cash is not crash
});

test('asks where: only questions about where something is', () => {
  for (const q of ['where is the gun shop', 'Where can I find a car', 'location of the shop', "where's the nearest bank", 'nearest garage', 'map', 'is there a map']) assert.ok(asksWhere(q), q);
  for (const q of ['how do I save', 'where can I put the game', 'controls']) assert.ok(!asksWhere(q), q);
});

test('a hidden record\'s keywords are hidden strings for the leak check', () => {
  const hidden = hiddenStrings([{ id: 'x', tier: 'places', question: 'q', short: 's', keywords: ['zebra kiosk wallaby', 'ok'] }]);
  assert.ok(hidden.some((h) => h.tier === 'places' && h.text.includes('zebra kiosk wallaby')));
  // A visible record's keywords are not hidden.
  assert.deepEqual(hiddenStrings([{ id: 'y', tier: 'none', question: 'q', short: 's', keywords: ['zebra kiosk wallaby'] }]), []);
});

test('known problems: the listed words, stemmed, and phrases, ask for the known-problems row; other trouble words do not', () => {
  for (const q of ['known bugs', 'is it buggy', 'any problems', 'a glitch', 'glitches', 'any issues at launch', 'is it broken', 'it broke', 'server outage', 'errors', 'is the game down', 'are servers down', "xbox isn't working", 'not working error']) assert.ok(asksKnown(q), q);
  for (const q of ['my game keeps crashing', 'my code does not work', 'how do i turn the volume down', 'download stuck', 'how do i save', 'working hours', '']) assert.ok(!asksKnown(q), q);
});

test('a record speaks to its list, its byConsole text and its source tags', () => {
  assert.deepEqual(forConsoles({ consoles: ['xbox-x'] }).sort(), ['xbox-x']);
  assert.deepEqual(forConsoles({ consoles: 'all', byConsole: { ps5: 'a' }, sources: [{ console: ['xbox-s'] }, { console: 'xbox-x' }, {}] }).sort(), ['ps5', 'xbox-s', 'xbox-x']);
  assert.deepEqual(forConsoles({ consoles: 'all' }), []);
});

const consoleRecords = [
  rec('save', 'How do I save?', { consoles: 'all', rank: 1 }),
  rec('size', 'How big is the install?', { consoles: 'all', byConsole: { 'xbox-x': 'x' }, rank: 2 }),
  rec('ps-only', 'Why is my download slow?', { consoles: ['ps5'], rank: 5 }),
  rec('both', 'How do I free space?', { consoles: ['xbox-x', 'xbox-s'], rank: 9 }),
  rec('s-only', 'Will it fit on the small one?', { consoles: ['xbox-s'] }),
  rec('src', 'Who made it?', { consoles: 'all', sources: [{ console: 'xbox-s' }], rank: 3 }),
];
const listed = (q, owned) => answersFor(consoleRecords, q, owned).map((r) => r.id);

test('a console name alone lists that console\'s answers: tagged first, then byConsole or source text, by rank', () => {
  assert.deepEqual(listed('xbox', 'xbox-x'), ['both', 'size']); // Series X chosen: its answers, not the Series S-only one
  assert.deepEqual(listed('xbox', 'ps5'), ['both', 's-only', 'size', 'src']); // an owner of another console gets both Xboxes
  assert.deepEqual(listed('xbox', ''), ['both', 's-only', 'size', 'src']); // none chosen: any named console works
  assert.deepEqual(listed('series s', 'xbox-x'), ['both', 's-only', 'src']); // another console than the chosen one: the player asked for it
  assert.deepEqual(listed('series x', 'xbox-s'), ['both', 'size']);
  assert.deepEqual(listed('ps5', 'xbox-x'), ['ps-only']);
});

test('every spelling of a console name asks for the same list', () => {
  for (const q of ['ps5', 'PS5', 'playstation', 'PlayStation 5', 'play station', 'ps', 'ps 5', 'playstaton', 'my ps5', 'ps5 games']) assert.deepEqual(listed(q, 'ps5'), ['ps-only'], q);
  for (const q of ['xbox', 'x box', 'xbox series', 'series', 'my xbox', 'xbxo']) assert.deepEqual(listed(q, 'xbox-x'), ['both', 'size'], q);
  for (const q of ['series x', 'xbox series x', 'sx', 'xsx']) assert.deepEqual(listed(q, 'ps5'), ['both', 'size'], q);
  for (const q of ['series s', 'xbox series s', 'ss', 'xss']) assert.deepEqual(listed(q, 'ps5'), ['both', 's-only', 'src'], q);
});

test('a console name with other words is an ordinary search: the console word stays a synonym', () => {
  const records = [rec('u', 'Why is my Xbox update stuck?', { consoles: ['xbox-x'] }), rec('s', 'How do I save?', { consoles: 'all' })];
  assert.deepEqual(answersFor(records, 'xbox update stuck', 'xbox-x').map((r) => r.id), ['u']);
  assert.deepEqual(answersFor(records, 'xbox save', 'xbox-x').map((r) => r.id), ['s']);
  assert.deepEqual(answersFor(records, 'ps5 save', 'ps5').map((r) => r.id), ['s']);
});
