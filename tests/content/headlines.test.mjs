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

// A player wants the plain answer first, not an outlet's name: no headline's FIRST sentence opens with one. Extend the list as sources are added.
const OUTLETS = ['PC Gamer', 'IGN', 'GameSpot', 'Notebookcheck', 'Cultured Vultures', 'Digital Foundry', 'Forbes', 'GTA Intel', 'Insider Gaming', 'KeenGamer', 'Vice Atlas', 'Crime Net Gazette', 'Xbox Wire', 'MakeTechEasier', 'GTABoom', 'IGGM', 'Eurogamer', 'Polygon', 'Kotaku', 'VGC', 'GamesRadar', 'Reuters', 'Bloomberg'];
const OUTLET_FIRST = new RegExp(`^(?:(?:according to|reported by|per)\\s+)?(?:the\\s+|a\\s+)?(?:${OUTLETS.join('|')})\\b`, 'i');

/** [{ id, where, sentence }] for each headline (any tier, any confidence) whose first sentence begins with an outlet. */
const outletFirst = (records) =>
  records.flatMap((a) =>
    [['short', a.short], ...Object.entries(a.byConsole ?? {})]
      .map(([where, text]) => ({ id: a.id, where, sentence: text.split(/(?<=[.!?])\s+/)[0] }))
      .filter((h) => OUTLET_FIRST.test(h.sentence)),
  );

test('planted: a headline that opens with an outlet name is caught, in short and a console line, also as "According to" and a possessive', () => {
  const bad = { id: 'x', short: 'PC Gamer says you save from the menu.', byConsole: { ps5: "KeenGamer's guide: turn it off.", 'xbox-x': 'According to IGN, it fits.', 'xbox-s': 'Digital Foundry found no 60 fps mode.' } };
  assert.deepEqual(outletFirst([bad]).map((h) => h.where), ['short', 'ps5', 'xbox-x', 'xbox-s']);
});

test('planted: the outlet later in the first sentence, or in a later sentence, passes', () => {
  const ok = { id: 'x', short: 'Save from the menu, PC Gamer says.', byConsole: { ps5: 'Turn it off. KeenGamer lists the steps.', 'xbox-x': 'It fits on any Series X, IGN reports.' } };
  assert.deepEqual(outletFirst([ok]), []);
  assert.deepEqual(outletFirst([{ id: 'y', short: 'Signs of a fake: pcgamer.com is not involved.' }]), []);
});

test('real records: no headline, at any tier, opens with an outlet name', () => {
  assert.deepEqual(outletFirst(loadRecords('src/content/answers')), []);
});

test('save answer: leads with the plain answer, names the outlet later in the line and in the body, and says the slot count is unconfirmed', () => {
  const a = loadRecords('src/content/answers').find((r) => r.id === 'how-to-save');
  assert.match(a.short, /^Save by hand from the main menu/);
  assert.match(a.short, /PC Gamer[^.]*reports 15 manual slots/);
  assert.match(a.short, /no Rockstar page confirms/);
  assert.match(a.body, /PC Gamer/);
  assert.ok(a.sources.some((x) => x.title.includes('PC Gamer')));
});
