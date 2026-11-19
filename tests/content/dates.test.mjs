import test from 'node:test';
import assert from 'node:assert/strict';
import { dateHits } from '../../scripts/check-dates.mjs';
import { loadRecords } from '../../scripts/check-leak.mjs';

const rec = (short, checked = '2026-11-19') => ({ id: 'x', short, checked });

test('a date on or before the checked date spoken of as the future is flagged (the stale printable-map sentence)', () => {
  const stale = [
    'Rockstar said it would add a free printable poster to its site on 19 November.',
    'The poster is coming on November 19, 2026.',
    'Boxed copies were due at retailers from 12 November.',
    'An update is expected on 2026-11-18.',
  ];
  for (const s of stale) assert.equal(dateHits([rec(s)]).length, 1, s);
});

test('future dates, past tense and cue-free dates are left alone', () => {
  const fine = [
    'Only digital purchases before 20 November 2026 get it, and it will renew in March 2027.',
    'Pre-load opened on 10 November.',
    'Rockstar announced the poster on 3 November.',
    'Redeem it by 31 March 2027 and it will renew.',
  ];
  for (const s of fine) assert.deepEqual(dateHits([rec(s)]), [], s);
});

test('the check reads the details of a record too', () => {
  assert.equal(dateHits([{ ...rec('Fine.'), reveal: [{ tier: 'mild', text: 'It will open on 12 November.' }] }]).length, 1);
});

test('no real record speaks of a past date as still to come', () => {
  assert.deepEqual(dateHits(loadRecords('src/content/answers')), []);
});
