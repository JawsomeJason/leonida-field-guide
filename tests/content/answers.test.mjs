import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRecords } from '../../scripts/check-leak.mjs';
import { consoleHits } from '../../scripts/check-console-text.mjs';

const records = loadRecords('src/content/answers');
const get = (id) => records.find((a) => a.id === id);
const shown = (a) => [a.question, a.short, a.body, a.todo, ...Object.values(a.byConsole ?? {}), ...(a.reveal ?? []).map((r) => r.text)].filter(Boolean).join('\n');
const host = (u) => new URL(u).hostname;
const FORUMS = /(^|\.)(reddit\.com|discord\.com|resetera\.com|neogaf\.com|steamcommunity\.com)$/;

test('no console sees another console\'s name or buttons', () => {
  assert.deepEqual(consoleHits(records), []);
});

test('sizes are in GB, never bytes or GiB', () => {
  for (const a of records) assert.doesNotMatch(shown(a), /\bbytes?\b|\bGiB\b|\bMiB\b/i, a.id);
});

test('install size: one plain answer per console, with the 512 GB Series S and how to check space', () => {
  const size = get('install-size-and-preload');
  assert.ok(size.rank <= 2 && size.confidence === 'reported');
  for (const c of ['ps5', 'xbox-x', 'xbox-s']) assert.match(size.byConsole[c], /212 GB/, c);
  assert.match(size.byConsole['xbox-s'], /512 GB/);
  assert.match(get('series-s-space').short, /512 GB/);
  assert.deepEqual(get('series-s-space').consoles, ['xbox-s']);
  assert.match(get('free-space-ps5').short, /Settings, then Storage/);
  assert.match(get('free-space-xbox').short, /Storage devices/);
  assert.deepEqual(get('free-space-ps5').consoles, ['ps5']);
  assert.deepEqual(get('free-space-xbox').consoles, ['xbox-x', 'xbox-s']);
});

test('crashes: steps and a way to report, per console, from the console makers\' own pages', () => {
  const hostsOf = (a) => a.sources.map((s) => host(s.url));
  const ps = get('crash-steps-ps5');
  const xb = get('crash-steps-xbox');
  assert.deepEqual([ps.consoles, xb.consoles], [['ps5'], ['xbox-x', 'xbox-s']]);
  assert.ok(hostsOf(ps).some((h) => h.endsWith('playstation.com')) && hostsOf(xb).some((h) => h.endsWith('support.xbox.com')));
  for (const a of [ps, xb]) assert.match(a.body, /support\.rockstargames\.com\/request/, `${a.id} says where to report`);
  assert.match(ps.body, /Rebuild Database/);
  assert.match(xb.body, /power cycle/i);
  assert.ok(get('crashes-and-launch-problems').rank <= 8, 'the crash question is in Most asked');
});

test('a failed boxed-copy code says where to go next, with a Rockstar link', () => {
  for (const id of ['boxed-copy-redeem', 'missing-or-rejected-code']) {
    assert.match(get(id).body, /\]\(https:\/\/support\.rockstargames\.com\/articles\/5gwDh0peG05GQhMej2ukbY\//, id);
    assert.match(get(id).body, /\]\(https:\/\/support\.rockstargames\.com\/request\)/, id);
  }
});

test('online tonight leads with one short plain sentence', () => {
  const first = get('online-or-co-op').short.split('. ')[0];
  assert.match(first, /^No online or co-op mode/);
  assert.ok(first.split(' ').length <= 15);
});

test('jargon is put in plain words where it appears', () => {
  for (const a of records) {
    const text = shown(a);
    if (/pre-?load/i.test(text)) assert.match(text, /before launch|downloaded early/i, `${a.id}: pre-load`);
    if (/Safe Mode/.test(text)) assert.match(text, /start-up menu/, `${a.id}: Safe Mode`);
  }
});

test('labels: community only for forums; official needs an allowed host; reported otherwise', () => {
  for (const a of records) {
    if (a.confidence === 'community') assert.ok(a.sources.every((s) => FORUMS.test(host(s.url))), `${a.id} is community but cites a site that is not a forum`);
    if (a.confidence === 'official') assert.ok(a.sources.some((s) => /(^|\.)(rockstargames|take2games|playstation|xbox)\.com$/.test(host(s.url))), a.id);
  }
});

test('keep-your-cash: Off holds only the generic line; the rule, how to avoid the loss, and which source says what, are in the Mild detail', () => {
  const a = get('keep-your-cash');
  assert.equal(a.short, 'You can lose in-game money.');
  assert.doesNotMatch([a.short, a.body].join(' '), /ATM|deposit|bank|die/i);
  const hidden = a.reveal.map((r) => r.text).join(' ');
  assert.match(hidden, /Vice Atlas.*ATM/);
  assert.match(hidden, /GameSpot.*cash on hand/);
  assert.match(hidden, /rests on Vice Atlas alone/);
  assert.equal(a.sources.length, 2);
});

test('frame rate: no claim that a page we could not read backs a menu claim', () => {
  const a = get('frame-rate-modes');
  assert.doesNotMatch(shown(a), /menu has no/i);
  assert.ok(a.sources.length >= 2 && a.confidence === 'reported');
});

test('a none answer never says in its default text what its hidden details say', () => {
  const sentences = (t) => t.split(/(?<=[.!?])\s+/).map((s) => s.trim().toLowerCase()).filter((s) => s.length > 20);
  for (const a of records.filter((r) => r.reveal)) {
    const open = [a.short, a.body, ...Object.values(a.byConsole ?? {})].join(' ').toLowerCase();
    for (const r of a.reveal) for (const s of sentences(r.text)) assert.ok(!open.includes(s), `${a.id}: "${s}" is in the default text`);
  }
  assert.doesNotMatch(get('stolen-cars').short, /damage|wreck/i);
});

test('every record was checked on a real date and the old per-console storage card is gone', () => {
  for (const a of records) assert.match(a.checked, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(get('storage-options'), undefined);
});

test('the fast travel, stolen cars, police and core stats answers are Mild whole, with no rank or checklist step at Off', () => {
  for (const id of ['fast-travel', 'stolen-cars', 'wanted-and-police', 'core-stats']) {
    const a = get(id);
    assert.equal(a.tier, 'mild', id);
    assert.equal(a.rank, undefined, `${id} cannot be in Most asked at Off`);
  }
});

test('ranks 1 to 20 are each used once', () => {
  const ranks = records.map((a) => a.rank).filter(Boolean).sort((a, b) => a - b);
  assert.deepEqual(ranks, Array.from({ length: 20 }, (_, i) => i + 1));
});
