import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRecords } from '../../scripts/check-leak.mjs';

// A headline (`short`, and each byConsole line that replaces it) may claim only what its weakest source supports.
// Mechanical backstop for the re-read in docs/spec.md ("First content", Headlines): in a record that is not
// official, a sentence with a bare certainty cue needs an attribution cue in the same sentence.
const CERTAIN = /\b(is|are|will|does|always|never|fully|guaranteed|definitely|certainly)\b/i;
const LOSS_POINTER = 'There is a simple way to keep it safe.';
const ATTRIBUTED = /\b(says?|said|reports?|reported|reportedly|according to|not confirmed|unconfirmed|expected|listed|lists|advises|found|guide)\b/i;

/** [{ id, where, sentence }] for each unattributed certain sentence in a record not labelled official. */
const headlineHits = (records) =>
  records
    .filter((a) => a.confidence !== 'official')
    .flatMap((a) =>
      [['short', a.short], ...Object.entries(a.byConsole ?? {})].flatMap(([where, text]) =>
        text
          .split(/(?<=[.!?])\s+/)
          .filter((s) => CERTAIN.test(s.replace(/"[^"]*"/g, '')) && !ATTRIBUTED.test(s)) // a quoted card title is not a claim
          .filter((s) => s !== LOSS_POINTER) // the loss warning's second sentence only points at the button under it (docs/spec.md, the loss-warning rule)
          .map((sentence) => ({ id: a.id, where, sentence })),
      ),
    );

test('planted: a bare certain claim in a reported record is caught, in short and in a console line', () => {
  const bad = { id: 'x', confidence: 'reported', short: 'The game will run at 60 fps on every console.', byConsole: { ps5: 'It never crashes.' } };
  assert.deepEqual(headlineHits([bad]).map((h) => h.where), ['short', 'ps5']);
  assert.equal(headlineHits([{ ...bad, confidence: 'community' }]).length, 2);
});

test('planted: attributing the claim, or an official label, passes', () => {
  const said = { id: 'x', confidence: 'reported', short: 'Notebookcheck reports the game will run at 60 fps.', byConsole: { ps5: 'It is not confirmed that it always runs well.' } };
  assert.deepEqual(headlineHits([said]), []);
  assert.deepEqual(headlineHits([{ id: 'y', confidence: 'official', short: 'It will always run at 60 fps.' }]), []);
});

test('planted: the attribution must sit in the same sentence', () => {
  const split = { id: 'x', confidence: 'reported', short: 'The game is free. Notebookcheck reports a price.' };
  assert.deepEqual(headlineHits([split]).map((h) => h.sentence), ['The game is free.']);
});

test('real records: no headline that is not official reads as certain without saying who says it', () => {
  assert.deepEqual(headlineHits(loadRecords('src/content/answers')), []);
});
