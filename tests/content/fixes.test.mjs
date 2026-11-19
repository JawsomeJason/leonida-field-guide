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

test('install size: the Series S usable-space figure, its source, a link to the space answer, and the next step', () => {
  const a = get('install-size-and-preload');
  assert.match(a.byConsole['xbox-s'], /364 GB usable/);
  assert.match(a.byConsole['xbox-s'], /IGN/);
  assert.match(a.body, /\]\(\/a\/series-s-space\/\)/);
  assert.match(a.body, /check your free space, then clear the difference/i);
  assert.ok(a.sources.some((s) => s.url.includes('ign.com')));
  assert.doesNotMatch(all(a), /See the 512 GB card/);
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
    assert.doesNotMatch(all(a), /Forbes|Notebookcheck/);
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
