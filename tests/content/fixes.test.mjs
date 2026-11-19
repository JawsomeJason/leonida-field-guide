// Content fixes from the second round of player reviews, each asserted on the real records.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRecords } from '../../scripts/check-leak.mjs';
import { todosOf } from '../../src/lib/answers.ts';

const records = loadRecords('src/content/answers');
const get = (id) => records.find((a) => a.id === id);
const all = (a) => [a.question, a.short, ...Object.values(a.byConsole ?? {}), a.body, a.todo, ...(a.reveal ?? []).map((r) => r.text)].filter(Boolean).join('\n');

test('"Before you start" lists steps by what depends on what: redeem, then room, then the download, then the countdown', () => {
  const ids = todosOf(records).filter((a) => a.stage === 'before').map((a) => a.id);
  const at = (id) => ids.indexOf(id);
  assert.ok(at('boxed-copy-redeem') >= 0, 'redeem is a step');
  const chain = ['boxed-copy-redeem', 'install-size-and-preload', 'auto-preload-settings', 'unlock-time'];
  assert.deepEqual(ids.filter((id) => chain.includes(id)), chain);
  assert.ok(at('ps5-system-update') < at('install-size-and-preload') && at('xbox-system-update') < at('install-size-and-preload'), 'update the console before the download');
});

test('install size: the official answer rests on official pages; the Series S usable-space figure lives in its own reported answer', () => {
  const a = get('install-size-and-preload');
  assert.equal(a.confidence, 'official');
  assert.doesNotMatch(all(a), /364|IGN/);
  assert.ok(a.sources.every((s) => /(^|\.)(rockstargames|playstation|xbox)\.com$/.test(new URL(s.url).hostname)), 'every source of the official answer is on an official host');
  assert.match(a.body, /\]\(\/a\/series-s-space\/\)/);
  assert.match(a.body, /check your free space, then clear the difference/i);
  assert.match(a.byConsole['xbox-s'], /part of the drive is reserved/);
  const s = get('series-s-space');
  assert.equal(s.confidence, 'reported');
  assert.match(s.short, /364 GB/);
  assert.ok(s.sources.some((x) => x.url.includes('ign.com')));
});

test('an official record that cites a news site says so in its text', () => {
  const official = /(^|\.)(rockstargames|take2games|playstation|xbox)\.com$/;
  for (const a of records.filter((r) => r.confidence === 'official'))
    for (const s of a.sources.filter((s) => !official.test(new URL(s.url).hostname))) {
      const outlet = s.title.match(/\(([^)]+)\)$/)?.[1] ?? s.title;
      assert.ok(new RegExp(`${outlet}[^.]*reported`, 'i').test(all(a)), `${a.id} leans on ${outlet} without saying it is a report`);
    }
});

test('unlock time and missing code: the official card holds official sources only; the news claim has its own reported card', () => {
  for (const id of ['unlock-time', 'missing-or-rejected-code']) {
    const a = get(id);
    assert.equal(a.confidence, 'official');
    assert.ok(a.sources.every((s) => /rockstargames|playstation|xbox/.test(s.url)), `${id} cites a news site`);
    assert.doesNotMatch(all(a), /Notebookcheck/);
  }
  assert.equal(get('unlock-time-us-zones').confidence, 'reported');
  assert.equal(get('boxed-copy-no-code').confidence, 'reported');
});

test('frame rate: the measured dips and the input lag are stated, with the source named', () => {
  const a = get('frame-rate-modes');
  assert.match(a.byConsole.ps5, /24/);
  assert.match(a.byConsole.ps5, /low 20s/);
  assert.match(a.byConsole['xbox-s'], /about 20/);
  assert.match(a.body, /about 180 ms/);
  assert.match(all(a), /Digital Foundry/);
});

test('jargon comes second: a plain phrase first, the term after it in brackets or "called"', () => {
  const terms = ['PSSR', 'Optimized for Series X|S', 'ray tracing', 'ray-traced', 'temporal upscaling', 'FSR 4', 'infostealers', 'reticle', 'haptic feedback'];
  for (const a of records)
    for (const text of [a.short, ...Object.values(a.byConsole ?? {}), a.body].filter(Boolean))
      for (const t of terms)
        for (const m of text.matchAll(new RegExp(t.replace(/[|]/g, '\\|'), 'g'))) {
          const before = text.slice(Math.max(0, m.index - 60), m.index);
          const inBrackets = before.lastIndexOf('(') > before.lastIndexOf(')');
          assert.ok(inBrackets || /called $/.test(before) || /\($/.test(before), `${a.id}: "${t}" comes before its plain words`);
        }
});

test('the printable map answer does not speak of a date that has passed as still to come', () => {
  assert.doesNotMatch(all(get('printable-map-and-poster')), /\bwould add\b/);
});

test('the two unlock-time answers name their disagreement, and each says which source says which', () => {
  const official = all(get('unlock-time'));
  const zones = all(get('unlock-time-us-zones'));
  for (const text of [official, zones]) {
    assert.match(text, /Rockstar[^.]*midnight local/i);
    assert.match(text, /Forbes[^.]*(earlier|evening)/i);
    assert.match(text, /do not match|disagree/i);
  }
  assert.match(get('unlock-time-us-zones').short, /disagree/);
  assert.equal(get('unlock-time').confidence, 'official');
  assert.ok(get('unlock-time').sources.every((s) => !s.url.includes('forbes.com')), 'the official card never cites Forbes');
});

test('the early-unlock answer says only what its source says: reportedly warned, not a flat claim that it breaks the terms', () => {
  const a = get('early-unlock-trick');
  assert.doesNotMatch([a.short, a.body].join(' '), /\bbreaks? the (platform's )?terms\b/i);
  assert.match(a.short, /Notebookcheck reports/);
  assert.match(a.body, /allegedly|reportedly/i);
});

test('Remote Play is said to be supported by Rockstar, with the PlayStation page for PS5', () => {
  const a = get('cloud-gaming-remote-play');
  assert.doesNotMatch(a.short, /fully supported on your console/);
  assert.match(a.short, /^Rockstar says/);
  assert.ok(a.sources.some((s) => s.url.includes('playstation.com') && s.console === 'ps5'));
});

test('launch day has come: no step or question speaks of the launch as still to wait for', () => {
  assert.equal(get('unlock-time').todo, 'Check the game is ready to play on your console');
  assert.doesNotMatch(get('unlock-time').short, /Check your console's countdown/);
  assert.doesNotMatch(get('auto-preload-settings').question, /before launch/);
  assert.doesNotMatch(get('ps5-system-update').short, /before midnight/);
  assert.match(get('ps5-system-update').short, /Launch day has come/);
});

test('Will I lose anything? is the one place for uninstalling, saves and cash, and says what is not known', () => {
  const a = get('will-i-lose-anything');
  assert.equal(a.tier, 'none');
  assert.ok(a.rank <= 8, 'it is in the first Most asked rows');
  assert.match(a.body, /What we do not know/);
  assert.doesNotMatch([a.short, a.body, ...Object.values(a.byConsole)].join(' '), /ATM|bank|deposit/i);
  for (const c of ['ps5', 'xbox-x', 'xbox-s']) assert.ok(a.byConsole[c].length <= 240 && /Carried cash can be lost/.test(a.byConsole[c]), c);
  assert.ok(a.sources.some((s) => s.console === 'ps5') && a.sources.some((s) => Array.isArray(s.console)));
  for (const id of ['free-space-xbox', 'free-space-ps5', 'cloud-saves-and-backup', 'keep-your-cash'])
    assert.match(all(get(id)), /\]\(\/a\/will-i-lose-anything\/\)|\"Will I lose anything\?\" answer/, `${id} points to it`);
});

test('the printable map answer says where in the cited post the announcement sits', () => {
  assert.match(all(get('printable-map-and-poster')), /last paragraphs/);
});
