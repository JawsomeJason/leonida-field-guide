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

test('install size: each console line says first what it means for that console, then the figures, then where to check free space; IGN\'s usable-space figure is attributed and labels the answer reported', () => {
  const a = get('install-size-and-preload');
  assert.equal(a.confidence, 'reported');
  assert.match(a.byConsole['xbox-s'], /IGN reports about 364 GB is usable/);
  assert.doesNotMatch([a.short, a.byConsole.ps5, a.byConsole['xbox-x'], a.body].join(' '), /364|IGN/, 'only the Series S line carries the reported figure');
  assert.ok(a.sources.some((s) => s.url.includes('ign.com')), 'IGN is cited');
  assert.ok(a.sources.filter((s) => !/(^|\.)(rockstargames|playstation|xbox)\.com$/.test(new URL(s.url).hostname)).every((s) => s.url.includes('ign.com')), 'the only outside source is IGN');
  assert.match(a.body, /\]\(\/a\/series-s-space\/\)/);
  assert.match(a.body.split('\n')[0], /less free than 212 GB, clear the difference/i, 'the clearing line is in the first body line');
  for (const line of [a.short, ...Object.values(a.byConsole)]) {
    assert.ok(line.length <= 240, line);
    assert.match(line, /\b\d+ GB\b/, 'a GB figure');
  }
  const first = (c) => a.byConsole[c].split(/(?<=[.:])\s/)[0];
  assert.match(first('ps5'), /^It fits on any PS5/);
  assert.match(first('xbox-x'), /^It fits on a Series X/);
  assert.match(first('xbox-s'), /^A 512 GB Series S should fit it, but not by much/);
  for (const c of ['ps5', 'xbox-x', 'xbox-s']) assert.match(a.byConsole[c], /Rockstar says to plan for up to 212 GB/, c);
  assert.match(a.byConsole.ps5, /825 GB of storage[\s\S]*Settings, then Storage/);
  assert.match(a.byConsole['xbox-x'], /1 TB or more of storage[\s\S]*Storage devices/);
  assert.match(a.byConsole['xbox-s'], /Storage devices/);
  // Order: meaning, then the figures, then where to look. The clearing line sits in the headline when it fits (240 limit), else only in the body.
  for (const c of ['ps5', 'xbox-x']) assert.match(a.byConsole[c], /212 GB[\s\S]*Settings[\s\S]*less free than 212 GB, clear the difference/, c);
  assert.ok(a.byConsole['xbox-s'].indexOf('212 GB') < a.byConsole['xbox-s'].indexOf('Storage devices'));
  const s = get('series-s-space');
  assert.equal(s.confidence, 'reported');
  assert.match(s.short, /^It should fit, but not by much/);
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

test('round 4 jargon (power cycle, pre-load, cross-progression, Optimized for Series X|S) comes second in every record, detail and to-do', () => {
  // Round 5 adds licence, sync, region-locked and cloud saves. Only the first use in a text needs its plain words.
  const terms = [/power[- ]?cycl\w*/gi, /pre-?load\w*/gi, /cross-progression/gi, /Optimized for Series X\|S/g, /licen[cs]e\w*/gi, /\bsync\w*/gi, /region-locked/gi, /cloud saves?/gi];
  const seen = (a) => [a.question, a.short, ...Object.values(a.byConsole ?? {}), a.body, a.todo, ...(a.reveal ?? []).map((r) => r.text)].filter(Boolean);
  const first = (text) => terms.flatMap((re) => [...text.matchAll(re)].slice(0, 1)).filter((m) => {
    const before = text.slice(Math.max(0, m.index - 70), m.index);
    return !(before.lastIndexOf('(') > before.lastIndexOf(')') || /called $/.test(before));
  }).map((m) => m[0]);
  assert.deepEqual(records.flatMap((a) => seen(a).flatMap(first).map((w) => `${a.id}: ${w}`)), []);
  // planted: the term first fails, the plain phrase first passes
  assert.deepEqual(first('Power cycle the console.'), ['Power cycle']);
  assert.deepEqual(first('Pre-load opens early.'), ['Pre-load']);
  assert.deepEqual(first('Progress shared between consoles (cross-progression) is not announced.'), []);
  assert.deepEqual(first('Switch it fully off and on again (a power cycle).'), []);
  assert.deepEqual(first('Your licence is kept.'), ['licence']);
  assert.deepEqual(first('Saves sync online.'), ['sync']);
  assert.deepEqual(first('Codes are region-locked.'), ['region-locked']);
  assert.deepEqual(first('Xbox keeps your right to play (your licence) and copies saves online (synced); it syncs while you are connected.'), []);
});

test('a record whose source title says pre-load says in its own words what that is', () => {
  for (const a of records.filter((r) => r.sources.some((s) => /pre-?load/i.test(s.title))))
    assert.match(all(a), /downloading (the game )?before launch \(pre-load\)/i, `${a.id} cites a page titled pre-load without saying what it means`);
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

test('the reported unlock-time answer names the disagreement and which source says which; the official one makes no claim from a news site and links it', () => {
  const official = all(get('unlock-time'));
  const zones = all(get('unlock-time-us-zones'));
  assert.match(zones, /Rockstar[^.]*midnight local/i);
  assert.match(zones, /Forbes[^.]*(earlier|evening)/i);
  assert.match(zones, /do not match|disagree/i);
  // Round 5: the official card carried Forbes's claim with no citation. It now says only that a news report differs and links the card that cites it.
  assert.doesNotMatch(official, /Forbes|Eastern|evening of 18/i);
  assert.match(official, /news report[^\n]*\]\(\/a\/unlock-time-us-zones\/\)/);
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

test('Will I lose anything? is the one place for uninstalling, saves and cash, says what is not known, and its headline claims no more than its weakest source', () => {
  const a = get('will-i-lose-anything');
  assert.equal(a.tier, 'none');
  assert.equal(a.confidence, 'reported');
  assert.ok(a.rank <= 8, 'it is in the first Most asked rows');
  assert.match(a.body, /What we do not know/);
  // Round 5: Off says only that money can be lost; the rule and how to avoid it is the Mild detail (tests/content/loss.test.mjs holds the whole rule).
  assert.doesNotMatch([a.short, a.body, ...Object.values(a.byConsole)].join(' '), /ATM|deposit|bank|carried cash/i);
  const headlines = [a.short, ...Object.values(a.byConsole)];
  for (const h of headlines) {
    // A reported record's headline never reads as certain that saves come back: round 4 found "Uninstalling loses nothing ... saved data comes back".
    assert.doesNotMatch(h, /loses nothing|comes? (right )?back|will be (kept|safe)|nothing (is|will be) lost/i, h);
    assert.match(h, /not confirmed|does not say/, `a headline says saves are unconfirmed: ${h}`);
    assert.match(h, /before you (delete|uninstall)|check first|upload (it|them) first|stay signed in/i, `a headline says what to do first: ${h}`);
    assert.match(h, /You can lose in-game money\.$/, h);
  }
  for (const c of ['ps5', 'xbox-x', 'xbox-s']) assert.ok(a.byConsole[c].length <= 240, c);
  assert.match(a.byConsole.ps5, /Settings, Saved Data and Game\/App Settings/, 'PlayStation steps for checking, from its own support page');
  assert.match(a.byConsole['xbox-x'], /stay (signed in and )?online|synced/i, 'Xbox says its saves sync online');
  assert.ok(a.sources.some((s) => s.console === 'ps5') && a.sources.some((s) => Array.isArray(s.console)));
  for (const id of ['free-space-xbox', 'free-space-ps5', 'cloud-saves-and-backup', 'keep-your-cash'])
    assert.match(all(get(id)), /\]\(\/a\/will-i-lose-anything\/\)/, `${id} points to it with a link`);
});

test('keep your cash: Off says only that money can be lost, and the rule, with how to avoid it, is the Mild detail', () => {
  const a = get('keep-your-cash');
  assert.equal(a.tier, 'none');
  assert.equal(a.short, 'You can lose in-game money.');
  assert.doesNotMatch([a.short, a.body].join(' '), /ATM|deposit|bank|die/i);
  assert.match(a.reveal[0].text, /ATM/);
  assert.match(a.reveal[0].text, /deposit after a big score, before you take risks/i);
});

test('Xbox control schemes: the face buttons are said to be unconfirmed, never translated from PlayStation names', () => {
  const a = get('control-schemes');
  for (const c of ['xbox-x', 'xbox-s']) {
    assert.match(a.byConsole[c], /face buttons \(A, B, X, Y\) are unconfirmed/, c);
    assert.doesNotMatch(a.byConsole[c], /\{(cross|circle|square|triangle)\}/, `${c} must not translate a face button`);
  }
});

test('the checklist step "Free up 212 GB" opens the answer that carries the figure and its official sources, and links how to make room for each console', () => {
  const a = get('install-size-and-preload');
  assert.match(a.todo, /212 GB/);
  assert.match(a.short, /212 GB/);
  assert.ok(a.sources.some((s) => s.url.includes('support.rockstargames.com')), 'the 212 GB figure has its Rockstar source');
  assert.match(a.body, /data-only="ps5">[^<]*\]\(\/a\/free-space-ps5\/\)/);
  assert.match(a.body, /data-only="xbox-x xbox-s">[^<]*\]\(\/a\/free-space-xbox\/\)/);
  assert.doesNotMatch(all(a), /Make room card/);
});

test('a to-do that states a size opens an answer that states the same size', () => {
  for (const a of records.filter((r) => /\d+ ?GB/.test(r.todo ?? ''))) assert.ok(all({ ...a, todo: '' }).includes(a.todo.match(/\d+ ?GB/)[0]), `${a.id}: the figure in the step is not in its answer`);
});

test('avoid-spoilers names its source for each claim about an outside site and gives the date', () => {
  const a = get('avoid-spoilers');
  assert.match(a.body, /GTA Intel \(checked 19 November\)/);
  for (const site of ['X', 'YouTube', 'Reddit']) assert.match(a.body, new RegExp(`${site}:[^\\n]*GTA Intel`), `${site} is attributed`);
  assert.doesNotMatch(a.body, /: its keyword filtering is weak|It does not hide direct searches/);
});

test('the printable map answer says where in the cited post the announcement sits', () => {
  assert.match(all(get('printable-map-and-poster')), /last paragraphs/);
});
