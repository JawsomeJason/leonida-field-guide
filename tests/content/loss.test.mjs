// Round 5, the loss-warning rule (docs/spec.md "The spoiler dial"). At Off a loss warning says only that a loss is possible, in generic words
// that state no game rule, and one control shows the rule (a Mild reveal). Real-world losses (saves, progress, purchases through console
// actions) are setup, not a game rule: they stay fully visible and carry their warning in the same line.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRecords } from '../../scripts/check-leak.mjs';
import { GENERIC, LABEL, rulesIn } from './loss-rules.mjs';

const records = loadRecords('src/content/answers');
const off = records.filter((a) => a.tier === 'none');

const clean = (t) => t.replace(/^[-\s]+/, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
/** The lines a player reads at Off, one per body line. Source titles are the pages' own and are read for rule words too. */
const lines = (a) => [a.short, ...Object.values(a.byConsole ?? {}), a.todo, ...(a.body ?? '').split('\n')].filter(Boolean);
const readable = (a) => [a.question, ...lines(a), ...a.sources.map((s) => s.title)];

const sentences = (t) => t.replace(/\[[^\]]*\]\([^)]*\)/g, '').split(/\n|(?<=[.!?])\s+/).map(clean).filter(Boolean); // a pointer's link text is not a statement
const MONEY_LOSS = /\b(lose|loses|lost)\b[^.]*\b(money|cash)\b|\b(money|cash)\b[^.]*\b(lose|lost)\b/i;

test('no Off record shows a game rule: not carried cash, the bank, ATMs, dying, loot, deposits or drops', () => {
  assert.deepEqual(off.flatMap((a) => rulesIn(readable(a)).map((m) => `${a.id}: ${m}`)), []);
});

test('the rule check catches planted rule sentences and passes the generic line and a frame-rate drop', () => {
  for (const t of ['Carried cash can be lost if you die.', 'Bank it before you take risks.', 'Deposit it at an ATM.', 'You lose your loot bags.', 'Cash drops where you die.', 'Money you carry is lost.'])
    assert.ok(rulesIn([t]).length > 0, t);
  for (const t of [GENERIC, 'It reports PS5 Pro holds 30 fps, with brief drops to 24 in heavy explosions.', 'Pull the HUD inward if your TV cuts off the money counter.']) assert.deepEqual(rulesIn([t]), [], t);
});

test('no sentence of any Mild or Places detail appears in an Off record', () => {
  const offText = off.flatMap(readable).map(clean).join('\n');
  for (const a of records)
    for (const r of a.reveal ?? [])
      for (const s of sentences(r.text).filter((x) => x.length > 25)) assert.equal(offText.includes(s), false, `${a.id}: the detail sentence "${s.slice(0, 60)}" is in an Off record`);
});

test('where an Off record says money can be lost, the sentence is exactly the generic line, and the record has the one-tap Mild detail', () => {
  const mentions = off.filter((a) => lines(a).some((l) => sentences(l).some((s) => MONEY_LOSS.test(s))));
  assert.deepEqual(mentions.map((a) => a.id).sort(), ['keep-your-cash', 'will-i-lose-anything']);
  for (const a of mentions) {
    for (const l of lines(a)) for (const s of sentences(l).filter((x) => MONEY_LOSS.test(x))) assert.equal(s, GENERIC, `${a.id}: "${s}"`);
    const r = a.reveal?.find((x) => x.label === LABEL);
    assert.ok(r, `${a.id} has no reveal labelled "${LABEL}"`);
    assert.equal(r.tier, 'mild');
    assert.match(r.text, /ATM/, 'the detail holds the rule');
    assert.match(r.text, /deposit/i, 'and how to avoid the loss');
    // what replaces `short` for a console says it too
    for (const l of [a.short, ...Object.values(a.byConsole ?? {})]) assert.ok(l.endsWith(GENERIC) || l === GENERIC, `${a.id}: a headline lacks the generic line: ${l}`);
  }
});

test('a Mild detail with the safe-keeping label belongs to a record that shows the generic line', () => {
  for (const a of records.filter((r) => r.reveal?.some((x) => x.label)))
    assert.ok(lines(a).some((l) => l.includes(GENERIC)), `${a.id} has the label and no generic line`);
});

// Real-world losses stay visible and carry their own warning: a line that tells a player to delete, uninstall or reinstall also says
// something about saves (or links the answer that does) in the same line.
const ACTION = /\b(delete[sd]?|deleting|uninstall\w*|reinstall\w*)\b/i;
const SAVE_WARNING = /\b(saves?|saved (data|games?)|progress|backed up|back up|backup|upload\w*|sync\w*)\b|\]\(\/a\/will-i-lose-anything\/\)/i;
export const deleteWithoutWarning = (ls) => ls.filter((l) => ACTION.test(l) && !SAVE_WARNING.test(l));

test('a line that says to delete, uninstall or reinstall also carries the save warning or links Will I lose anything?', () => {
  assert.deepEqual(off.flatMap((a) => deleteWithoutWarning(lines(a)).map((l) => `${a.id}: ${l.slice(0, 90)}`)), []);
  assert.equal(deleteWithoutWarning(['To make room, uninstall games you are not playing.', '3. Delete the game and download it again.']).length, 2);
  assert.deepEqual(deleteWithoutWarning(['Uninstall ones you are not playing: check your saved games have synced first.', 'Delete it; see [Will I lose anything?](/a/will-i-lose-anything/)']), []);
});
