// The New screen's list of changes is read by players: plain words, nothing from how the site is built.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FUTURE_CUE, dateHits } from '../../scripts/check-dates.mjs';

const entries = JSON.parse(readFileSync('src/data/new.json', 'utf8'));
export const DEVELOPER_WORDS = /\b(schema|records?|refresh(es|ed)?|branch|content|sources checked|keywords?|frontmatter|json|yaml|commit|pull request|pipeline|build|deploy(ed|ment)?|repo|markdown|tier-?\w*|rubric|cache)\b/i;

test('no entry on the New screen contains a developer word', () => {
  assert.deepEqual(entries.flatMap((e) => [...e.changed, ...e.problems.flatMap((p) => [p.text, p.fix])]).filter((t) => DEVELOPER_WORDS.test(t)), []);
});

test('the word list catches the phrasing the reviewers found', () => {
  for (const t of ['Added a schema field.', 'Updated 12 records.', 'Merged the refresh branch.', 'Moved content behind Mild.', 'Sources checked again.', 'New keywords for search.'])
    assert.equal(DEVELOPER_WORDS.test(t), true, t);
  assert.equal(DEVELOPER_WORDS.test('Corrected: check before you delete a game.'), false);
});

// Round 5: the screen reads like a player's notice, not the owner's notes. At most three lines per date, each one of three plain forms, and
// nothing about the site's own fixes. Dates run newest first and the screen shows only the latest three.
export const SITE_FIX_WORDS = /\b(fix(ed|es)?|bugs?|buttons?|wording|reworded|tests?|layouts?|colou?rs?|design(ed)?|the site|plain words|links? (to|now))\b/i;
export const LINE_FORM = /^(New answer: .+|Corrected: .+|Checked on \d{1,2} [A-Z][a-z]+ \d{4}: nothing new confirmed\. We opened \d+ sources\.)$/;

test('at most three lines per date, each a new answer, a correction or a dated check, with no word about the site\'s own fixes', () => {
  for (const e of entries) {
    assert.ok(e.changed.length <= 3, `${e.date} has ${e.changed.length} lines`);
    for (const c of e.changed) {
      assert.match(c, LINE_FORM, c);
      assert.doesNotMatch(c, SITE_FIX_WORDS, c);
    }
  }
  assert.deepEqual(entries.map((e) => e.date), [...entries.map((e) => e.date)].sort().reverse(), 'newest first');
});

test('the line check catches the owner-notes phrasing the reviewers found and passes the three plain forms', () => {
  for (const t of ['Fixed an answer that sounded too sure.', 'Corrected: the button now says Pick console.', 'Plain words now come before the technical term.', 'Reworded the unlock answer.', 'Each answer now shows the links that match your console first.'])
    assert.equal(LINE_FORM.test(t) && !SITE_FIX_WORDS.test(t), false, t);
  for (const t of ['New answer: how big the game is.', 'Corrected: check before you delete a game.', 'Checked on 20 November 2026: nothing new confirmed. We opened 23 sources.'])
    assert.equal(LINE_FORM.test(t) && !SITE_FIX_WORDS.test(t), true, t);
});

test('every entry has a date and says what changed in a full sentence', () => {
  for (const e of entries) {
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/);
    for (const c of e.changed) assert.match(c, /[.!?"]$/, c);
  }
});

// docs/refresh.md tells every run to write this line when nothing changed: it must pass every check the New screen and the date check apply.
test("the 'nothing new confirmed' entry passes the word, sentence and tense checks", () => {
  const line = 'Checked on 20 November 2026: nothing new confirmed. We opened 23 sources.';
  assert.equal(DEVELOPER_WORDS.test(line), false);
  assert.match(line, /[.!?"]$/);
  assert.equal(FUTURE_CUE.test(line), false);
  // The date check reads answer records; a record that quotes this kind of line about its own checked date is not a future claim.
  assert.deepEqual(dateHits([{ id: 'x', checked: '2026-11-20', question: 'q', short: line }]), []);
});
