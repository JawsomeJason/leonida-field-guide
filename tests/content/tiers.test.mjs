// The Off/Mild line, made testable (docs/spec.md "The spoiler dial").
//   Off    = the basics: setup, install, account and bonus codes, settings, controls, saving, performance, fixes, what is and is not
//            in the game at launch, and one plain line of warning where a player could lose something. A game system gets one sentence: it exists.
//   Places = adds where things are.
//   Mild   = adds how the game's systems work in play: named in-game apps and services, prices and fees, how selling or stealing works,
//            how police respond, how stats rise, and what a press guide learned by playing rather than Rockstar stating it before launch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadRecords } from '../../scripts/check-leak.mjs';

const records = loadRecords('src/content/answers');
const rubric = JSON.parse(readFileSync(new URL('./tier-rubric.json', import.meta.url), 'utf8'));

// Signal words of Mild content. Default (tier none) text must not hold one; such a sentence belongs in a `reveal` or in a mild record.
export const MILD_SIGNALS = [
  /\bunlock(s|ed|ing)? (later|after|as you|once you|when you)\b/i,
  /\blater in (the|your) (game|story|playthrough)\b/i,
  /\bas you progress\b/i,
  /\bbecomes? available (later|as|after|once)\b/i,
  /\bafter you (finish|complete|reach|beat|unlock|clear)\b/i,
  /\bsecrets?\b/i,
  /\bhidden (trick|item|area|bonus|collectible)s?\b/i,
  /\bcheat(s|ing|ed)?\b/i,
  /\beaster eggs?\b/i,
  /\b(glitch(es)?|exploit(s|ed|ing)?|work-?arounds?|tricks?)\b/i,
  /\b(evade|evading|shake (the )?police|lose the police|clear(ing)? (the |your )?wanted)\b/i,
];

// Game-system specifics (fix round 3). A default record names no in-game app or service, price or fee, police response or stat rise.
export const SYSTEM_SIGNALS = [
  /\b(ride-?hail|phone app|app (lists|shows|tells|lets)|RydeMe|WAiNK|Pay n' Spray)\b/i, // named or described in-game apps and services
  /\bATMs?\b|\bfences?\b|\bstash bags?\b|\bloot bags?\b/i, // how selling, stealing and depositing work
  /\b(fees?|fares?)\b|[$£€]\s?\d|\bcosts? (you )?(about |around |roughly )?\d/i, // prices and fees (real-world store prices are not stated at Off either)
  /\b(wanted (level|star)s?|(police|cops)\b.{0,12}\b(remember|respond|search|chase|memory|can see)|search (area|radius)|heat (level|indicator)s?)\b/i, // how police respond
  /\bstamina\b|\b(raise[sd]?|boosts?|train(s|ing)?) (your )?(health|stamina|focus)\b|\bstats? (rise|raise|grow|fade|level)/i, // how stats rise
];
export const ALL_SIGNALS = [...MILD_SIGNALS, ...SYSTEM_SIGNALS];

// An answer that ends on a tease gives the hidden part away by hinting at it.
export const TEASES = [/\bthere('s| is| are) (a |an )?(clever|smart|neat|easy|quick|cheap|better|secret|hidden|trick)/i, /\bbut there('s| is) more\b|\bwait (until|and see)\b|\bmore on that\b|\byou('ll| will) (never|not) (guess|believe)\b/i];

// Hosts whose pages record what a writer learned by playing or in a hands-on preview, not what Rockstar said before launch.
export const PLAYED_PRESS = ['gamespot.com', 'iggm.com', 'crimenetgazette.com', 'vice-atlas.com'];
const onHost = (url, hosts) => hosts.some((h) => new URL(url).hostname.replace(/^www\./, '') === h);
export const HOLDS = ['setup', 'install', 'codes', 'settings', 'controls', 'saving', 'performance', 'fix', 'launch-fact', 'warning', 'account'];

/** Every string a player reads on a default (Off) page for a tier-none record. Keywords are never shown. */
const shown = (a) => [a.question, a.short, ...Object.values(a.byConsole ?? {}), a.body, a.todo, ...a.sources.map((s) => s.title)].filter(Boolean);
export const signalsIn = (a) => shown(a).flatMap((t) => ALL_SIGNALS.filter((re) => re.test(t)).map((re) => `${a.id}: ${re} in "${t.slice(0, 60)}"`));

test('default text holds no Mild signal word and no game-system specific', () => {
  assert.deepEqual(records.filter((a) => a.tier === 'none').flatMap(signalsIn), []);
});

test('the signal check catches a planted Mild sentence in a default record', () => {
  const plant = (body) => signalsIn({ id: 'p', question: 'q', short: 's', body, sources: [{ title: 'x' }] });
  for (const body of [
    'Use this trick to skip the wait.', 'The bonus unlocks later in the game.', 'Switch on cheats first.', 'It is a hidden item.',
    // the sentences a spoiler-averse reviewer found at Off in round 3
    'A ride-hail phone app gets you there for a fee.', 'About $100 extra skips the ride.', 'A phone app lists what buyers want and each car\'s security.',
    'Police now remember what they saw, such as your face.', 'A solid white star means they can see you; wanted levels widen the search.',
    'Running and biking raise Stamina.', 'Training raises Health, Stamina and Focus.', 'Deposit it at an ATM before you take risks.',
  ])
    assert.equal(plant(body).length > 0, true, body);
  assert.deepEqual(plant('The game unlocks at midnight local time.'), []);
});

test('every record is in the rubric with its tier and a reason, and nothing else is', () => {
  const byId = new Map(rubric.records.map((r) => [r.id, r]));
  assert.equal(byId.size, rubric.records.length, 'an id is listed twice');
  assert.deepEqual([...byId.keys()].sort(), records.map((a) => a.id).sort());
  for (const a of records) {
    const r = byId.get(a.id);
    assert.equal(a.tier, r.tier, `${a.id} is ${a.tier} but the rubric says ${r.tier}: ${r.reason}`);
    assert.ok(r.reason.length > 10, `${a.id} needs a reason`);
  }
});

test('every reveal is in the rubric as a Mild or Places detail with a reason, and nothing else is', () => {
  const have = records.flatMap((a) => (a.reveal ?? []).map((r) => `${a.id}:${r.tier}`)).sort();
  const listed = rubric.reveals.map((r) => `${r.id}:${r.tier}`).sort();
  assert.deepEqual(have, listed);
  for (const r of rubric.reveals) assert.ok(r.reason.length > 10, `${r.id} needs a reason`);
});

test('the tease check catches a planted teaser and passes a plain pointer', () => {
  const tease = (t) => TEASES.some((re) => re.test(t));
  for (const t of ['There is a clever way around this.', 'There\'s a trick for that.', 'But there is more.', 'Wait until you see it.']) assert.equal(tease(t), true, t);
  for (const t of ['Its details sit behind the Mild setting.', 'Carried cash can be lost if you die.']) assert.equal(tease(t), false, t);
});

test('an Off answer does not end on a tease', () => {
  for (const a of records.filter((r) => r.tier === 'none'))
    for (const t of [a.short, a.body, ...Object.values(a.byConsole ?? {})].filter(Boolean)) {
      const last = t.trim().split(/(?<=[.!?])\s+/).pop();
      assert.equal(TEASES.some((re) => re.test(last)), false, `${a.id} ends on a tease: "${last}"`);
    }
});

test('every Off record says which part of the Off list it holds', () => {
  const by = new Map(rubric.records.map((r) => [r.id, r]));
  for (const a of records) {
    const r = by.get(a.id);
    if (a.tier === 'none') assert.ok(HOLDS.includes(r.holds), `${a.id}: holds must be one of ${HOLDS.join(', ')}`);
    else assert.equal(r.holds, undefined, `${a.id} is hidden, so it has no Off category`);
  }
});

test('an Off record that cites a play-guide source says in the rubric why that is fine, and the rubric has no stale excuse', () => {
  const by = new Map(rubric.records.map((r) => [r.id, r]));
  for (const a of records.filter((r) => r.tier === 'none')) {
    const cites = a.sources.some((s) => onHost(s.url, PLAYED_PRESS));
    assert.equal(Boolean(by.get(a.id).pressGuide), cites, cites ? `${a.id} cites a play guide: add pressGuide to the rubric, or move the claim to Mild` : `${a.id} has a pressGuide excuse but cites no play guide`);
  }
});

test('Most asked holds Off records only: ranks 1 to 20, none on a hidden record', () => {
  assert.deepEqual(records.filter((a) => a.rank && a.tier !== 'none').map((a) => a.id), []);
});
