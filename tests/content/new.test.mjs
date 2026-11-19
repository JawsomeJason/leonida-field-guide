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
  assert.equal(DEVELOPER_WORDS.test('Fixed an answer that sounded too sure.'), false);
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
