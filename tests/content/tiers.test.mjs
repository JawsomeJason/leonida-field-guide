// The Off/Mild line, made testable (docs/spec.md "The spoiler dial").
//   Off    = what the game itself teaches every player: its menus, tutorials and the publisher's launch material.
//   Places = adds where things are.
//   Mild   = adds things you would rather find out by playing: what unlocks later, tricks, effects the game does not explain up front.
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

/** Every string a player reads on a default (Off) page for a tier-none record. Keywords are never shown. */
const shown = (a) => [a.question, a.short, ...Object.values(a.byConsole ?? {}), a.body, a.todo, ...a.sources.map((s) => s.title)].filter(Boolean);
export const signalsIn = (a) => shown(a).flatMap((t) => MILD_SIGNALS.filter((re) => re.test(t)).map((re) => `${a.id}: ${re} in "${t.slice(0, 60)}"`));

test('default text holds no Mild signal word', () => {
  assert.deepEqual(records.filter((a) => a.tier === 'none').flatMap(signalsIn), []);
});

test('the signal check catches a planted Mild sentence in a default record', () => {
  const plant = (body) => signalsIn({ id: 'p', question: 'q', short: 's', body, sources: [{ title: 'x' }] });
  for (const body of ['Use this trick to skip the wait.', 'The bonus unlocks later in the game.', 'Switch on cheats first.', 'It is a hidden item.'])
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
