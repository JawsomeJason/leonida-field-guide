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

// A player wants the plain answer first, not an outlet's name: no outlet is named in the FIRST sentence of any headline (`short` and each
// per-console line), at any tier and any confidence. The outlet goes in a later sentence, the body and the sources. Extend the list as sources are added.
const OUTLETS = ['PC Gamer', 'IGN', 'GameSpot', 'Notebookcheck', 'Cultured Vultures', 'Digital Foundry', 'Forbes', 'GTA Intel', 'Insider Gaming', 'KeenGamer', 'Vice Atlas', 'Crime Net Gazette', 'Xbox Wire', 'MakeTechEasier', 'GTABoom', 'IGGM', 'Eurogamer', 'Polygon', 'Kotaku', 'VGC', 'GamesRadar', 'Reuters', 'Bloomberg', 'Windows Central'];
const OUTLET = new RegExp(`\\b(?:${OUTLETS.join('|')})\\b`, 'i');
const firstSentence = (text) => text.split(/(?<=[.!?])\s+/)[0];

/** [{ id, where, sentence }] for each headline (any tier, any confidence) whose first sentence names an outlet. */
const outletFirst = (records) =>
  records.flatMap((a) =>
    [['short', a.short], ...Object.entries(a.byConsole ?? {})]
      .map(([where, text]) => ({ id: a.id, where, sentence: firstSentence(text) }))
      .filter((h) => OUTLET.test(h.sentence)),
  );

test('planted: an outlet named anywhere in the first sentence is caught, in short and in each console line, also as "According to" and a possessive', () => {
  const bad = { id: 'x', short: 'PC Gamer says you save from the menu.', byConsole: { ps5: "KeenGamer's guide: turn it off.", 'xbox-x': 'According to IGN, it fits.', 'xbox-s': 'It should fit, but IGN reports 364 GB is usable.' } };
  assert.deepEqual(outletFirst([bad]).map((h) => h.where), ['short', 'ps5', 'xbox-x', 'xbox-s']);
  assert.deepEqual(outletFirst([{ id: 'y', short: 'Save from the menu, PC Gamer says.' }]).map((h) => h.where), ['short']);
});

test('planted: the outlet in a later sentence, or only as a web address, passes', () => {
  const ok = { id: 'x', short: 'Save from the menu. PC Gamer says so.', byConsole: { ps5: 'Turn it off. KeenGamer lists the steps.', 'xbox-x': 'It fits on any Series X. IGN reports 364 GB is usable.' } };
  assert.deepEqual(outletFirst([ok]), []);
  assert.deepEqual(outletFirst([{ id: 'y', short: 'Signs of a fake: pcgamer.com is not involved.' }]), []);
});

test('real records: no headline, at any tier, names an outlet in its first sentence', () => {
  assert.deepEqual(outletFirst(loadRecords('src/content/answers')), []);
});

test('online answer: leads with a plain No for each console and names which store page says single-player', () => {
  const a = loadRecords('src/content/answers').find((r) => r.id === 'online-or-co-op');
  assert.match(a.short, /^No\./);
  assert.match(a.byConsole.ps5, /^No\. The PlayStation Store page calls the game a single-player experience/);
  for (const c of ['xbox-x', 'xbox-s']) assert.match(a.byConsole[c], /^No\. The Xbox store page calls the game a single-player experience/);
  assert.ok(a.support.some((e) => e.console === 'ps5' && /single-player experience/.test(e.quote)), 'the PlayStation page quote is recorded');
});

test('lose-anything answer: leads with the plain verdict for each console, outlets only later', () => {
  const a = loadRecords('src/content/answers').find((r) => r.id === 'will-i-lose-anything');
  assert.match(a.short, /^Deleting a game keeps what you bought/);
  for (const c of ['ps5', 'xbox-x', 'xbox-s']) assert.match(a.byConsole[c], /^Deleting a game keeps what you bought\./);
  assert.match(a.body, /Cultured Vultures reports/);
});

test('save answer: leads with the plain answer; the slot count is in no console line and the all-consoles line says it is a PC Gamer report, unconfirmed on console', () => {
  const a = loadRecords('src/content/answers').find((r) => r.id === 'how-to-save');
  assert.match(a.short, /^Save by hand from the main menu/);
  assert.match(a.short, /15-slot figure is from a PC Gamer report and is unconfirmed on console/);
  for (const c of ['ps5', 'xbox-x', 'xbox-s']) {
    assert.match(a.byConsole[c], /^Save by hand from the main menu/);
    assert.doesNotMatch(a.byConsole[c], /\b15\b|slots? of|PC Gamer/, `${c} line carries no slot count`);
  }
  assert.match(a.body, /PC Gamer/);
  assert.ok(a.sources.some((x) => x.title.includes('PC Gamer')));
});
