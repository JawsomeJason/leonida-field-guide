import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRecords } from '../../scripts/check-leak.mjs';

const records = loadRecords('src/content/answers');
const get = (id) => records.find((r) => r.id === id);

test('known problems are findable: each crash answer links "Known problems and what changed" (/new/) in the first lines of its body', () => {
  for (const id of ['crashes-and-launch-problems', 'crash-steps-ps5', 'crash-steps-xbox']) {
    const firstLines = get(id).body.split('\n').slice(0, 2).join('\n');
    assert.match(firstLines, /\[Known problems and what changed\]\(\/new\/\)/, id);
  }
});

// What each console maker's own page says about saved data for games in general, and what is confirmed for this game.
test('Will I lose anything: saved-data backup is stated per console, each tied to its own source, with this game still "not confirmed"', () => {
  const a = get('will-i-lose-anything');
  const hosts = (c) => a.sources.filter((s) => !s.console || [].concat(s.console).includes(c)).map((s) => new URL(s.url).hostname);
  // PlayStation: PlayStation Plus can upload saved data (the PlayStation cloud-storage page); this game's backup is not confirmed.
  assert.match(a.byConsole.ps5, /PlayStation Plus members can upload saved data online/);
  assert.match(a.byConsole.ps5, /Backup for this game is not confirmed/);
  assert.ok(hosts('ps5').includes('www.playstation.com'));
  assert.match(a.body, /<span data-only="ps5">PlayStation's own pages say PlayStation Plus members can upload saved data[^<]*for this game, backup is not confirmed\./);
  // Xbox: its support page says saved games are copied online when you sign in; one outlet reports this game supports it; no official confirmation.
  for (const c of ['xbox-x', 'xbox-s']) {
    assert.match(a.byConsole[c], /Xbox says saved games are copied online \(synced\) when you sign in/);
    assert.match(a.byConsole[c], /Cultured Vultures reports this game supports it; not confirmed by Xbox/);
    assert.ok(hosts(c).includes('support.xbox.com') && hosts(c).includes('culturedvultures.com'));
  }
  assert.match(a.body, /<span data-only="xbox-x xbox-s">Xbox's own page says saved games are copied online \(synced\)[^<]*Cultured Vultures reports[^<]*for this game it is not confirmed\./);
  // No console is told the flat "not confirmed for every console" any more, and PlayStation's line never mentions Xbox's source.
  assert.doesNotMatch(a.body, /on every console/);
  assert.doesNotMatch(a.byConsole.ps5, /Xbox|Cultured/);
  assert.doesNotMatch(a.byConsole['xbox-x'], /PlayStation/);
  // The Off wording of the loss warning stays exact.
  for (const line of [a.short, ...Object.values(a.byConsole)]) assert.match(line, /You can lose in-game money\.$/);
});
