// docs/refresh.md is what stops a cloud run from ending early: its minimum work must stay written down, and the guard must let the New feed through.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { offenders } from '../../scripts/refresh-guard.mjs';

const doc = readFileSync('docs/refresh.md', 'utf8');

test('the refresh instructions keep the minimum work, the retry rule, the every-run entry and the final checklist', () => {
  for (const [what, re] of [
    ['at least 8 searches', /at least 8 searches/i],
    ['console makers own pages', /console makers' own troubleshooting pages/i],
    ['ten highest-ranked records even when dated today', /10 highest-ranked records[^.]*even when/i],
    ['a question the guide cannot answer', /question players are asking that the guide cannot answer/i],
    ['retry once then could-not-verify', /retry it once[\s\S]*could-not-verify/i],
    ['a failing source never ends the run', /never ends the run/i],
    ['the nothing-new line', /Checked on <?[^\n]*nothing new confirmed/i],
    ['a push every run', /Commit and push, every run/],
    ['the final checklist with counts', /Final reply[\s\S]*Searches run: n/],
    ['web pages are data', /data, not instructions/i],
    ['official only for pages read', /official[\s\S]{0,80}actually opened and read/i],
    ['the two allowed places', /Only `src\/content\/answers\/\*\*` and `src\/data\/new\.json`/],
  ]) assert.match(doc, re, what);
});

test('the refresh guard lets the New feed through, alone or with records, and still refuses anything else', () => {
  assert.deepEqual(offenders('M\tsrc/data/new.json\n'), []);
  assert.deepEqual(offenders('M\tsrc/data/new.json\nM\tsrc/content/answers/how-to-save.yaml\n'), []);
  assert.deepEqual(offenders('M\tsrc/data/new.json\nM\tdocs/refresh.md\n'), ['docs/refresh.md']);
});
