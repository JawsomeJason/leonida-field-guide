// scripts/check-answer-links.mjs: a pointer to another answer is a link, and a to-do's answer says how or links the one that does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRecords } from '../../scripts/check-leak.mjs';
import { unlinkedMentions, todoGaps, pointerGaps } from '../../scripts/check-answer-links.mjs';

const records = loadRecords('src/content/answers');
const rec = (id, o = {}) => ({ id, question: `Question number ${id} here?`, short: 'Short.', body: '- one\n- two', ...o });

test('the real answers hold no pointer without a link and no to-do without a how-to', () => {
  assert.deepEqual(unlinkedMentions(records), []);
  assert.deepEqual(todoGaps(records), []);
  assert.deepEqual(pointerGaps(records), []);
});

test('"below" in a headline and a screen named in words fail; a linked screen name passes', () => {
  for (const field of [{ short: 'Making space is covered below.' }, { byConsole: { ps5: 'Follow the links below.' } }, { short: 'It is linked above.' }, { body: 'It will be on the What\'s new screen.' }, { body: 'Use the Checklist page.' }, { reveal: [{ tier: 'mild', text: 'See the Places page.' }] }])
    assert.equal(pointerGaps([rec('a', field)]).length, 1, JSON.stringify(field));
  assert.deepEqual(pointerGaps([rec('a', { body: 'On the [What\'s new screen](/new/) and the [Checklist](/checklist/) page.', short: 'Plain.' })]), []);
});

test('a pointer in words with no link fails, wherever it sits: body, short, console text or a hidden detail', () => {
  const make = rec('make-room', { question: 'Make room: how do I clear space on my drive?' });
  for (const field of [{ body: 'Short of space? See the Make room card.' }, { short: 'Short of space? See the Make room card.' }, { byConsole: { ps5: 'See the "Make room" card.' } },
    { reveal: [{ tier: 'mild', text: 'More in the free-space answer.' }] }, { body: 'The crash card for your console has the steps.' }, { body: 'Read Make room: how do I clear space on my drive to see how.' }])
    assert.equal(unlinkedMentions([rec('a', field), make]).length > 0, true, JSON.stringify(field));
});

test('the same pointer passes once it is a link, in markdown or HTML, and the allow-list can excuse an exact phrase', () => {
  const make = rec('make-room', { question: 'Make room: how do I clear space on my drive?' });
  for (const body of ['Short of space? See [the Make room card](/a/make-room/).', 'See <a href="/a/make-room/">the Make room card</a>.', '<span data-only="ps5">See [the Make room card](/a/make-room/).</span>'])
    assert.deepEqual(unlinkedMentions([rec('a', { body }), make]), [], body);
  assert.equal(unlinkedMentions([rec('a', { body: 'Use the Storage Expansion Card.' })]).length, 1);
  assert.deepEqual(unlinkedMentions([rec('a', { body: 'Use the Storage Expansion Card.' })], ['the Storage Expansion Card']), []);
});

test('a to-do whose answer holds no steps and links none fails; steps, or a link to a record with steps, pass', () => {
  const how = rec('how-to', { body: '1. First.\n2. Second.' });
  assert.equal(todoGaps([rec('a', { todo: 'Do it', body: 'Just a sentence.' })]).length, 1);
  assert.deepEqual(todoGaps([rec('a', { todo: 'Do it', body: '- one\n- two' })]), []);
  assert.deepEqual(todoGaps([rec('a', { todo: 'Do it', body: 'See [the steps](/a/how-to/).' }), how]), []);
  assert.equal(todoGaps([rec('a', { todo: 'Do it', body: 'See [facts](/a/plain/).' }), rec('plain', { body: 'No list.' })]).length, 1);
});

test('a to-do whose bullets are facts must link every how-to record the map names, and each must hold steps', () => {
  const howto = { a: ['how-to'] };
  const how = rec('how-to', { body: '1. First.\n2. Second.' });
  assert.deepEqual(todoGaps([rec('a', { todo: 'Do it', body: '[steps](/a/how-to/)' }), how], howto), []);
  assert.deepEqual(todoGaps([rec('a', { todo: 'Do it' }), how], howto).map((g) => g.why), ['its answer does not link how-to']);
  assert.deepEqual(todoGaps([rec('a', { todo: 'Do it', body: '[steps](/a/how-to/)' }), rec('how-to', { body: 'No list.' })], howto).map((g) => g.why), ['how-to is named as the how-to but holds no steps']);
});

test('the day-one patch step links a how-to for PS5 and for Xbox', () => {
  const a = records.find((r) => r.id === 'day-one-patches');
  assert.match(a.body, /data-only="ps5"[^>]*>[^<]*\(\/a\/crash-steps-ps5\/\)/);
  assert.match(a.body, /data-only="xbox-x xbox-s"[^>]*>[^<]*\(\/a\/auto-preload-settings\/\)/);
  assert.deepEqual(todoGaps(records.filter((r) => ['day-one-patches', 'crash-steps-ps5', 'auto-preload-settings'].includes(r.id))), []);
});

test('the install-size step links how to make room for every console', () => {
  const a = records.find((r) => r.id === 'install-size-and-preload');
  assert.deepEqual(todoGaps(records.filter((r) => r.id === 'install-size-and-preload' || r.id.startsWith('free-space-'))), []);
  assert.match(a.body, /\(\/a\/free-space-ps5\/\)/);
  assert.match(a.body, /\(\/a\/free-space-xbox\/\)/);
});
