// Source consoles (docs/spec.md "Data shape", Source console): a source made for one console family says so, and an official record
// still has an official source for every console it is shown to.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRecords } from '../../scripts/check-leak.mjs';

const ALL = ['ps5', 'xbox-x', 'xbox-s'];
const OFFICIAL = /(^|\.)(rockstargames|take2games|playstation|xbox)\.com$/;
const hostOf = (s) => new URL(s.url).hostname;
const appliesTo = (s) => (s.console === undefined ? ALL : [].concat(s.console));
const consolesOf = (a) => (a.consoles === 'all' ? ALL : a.consoles);

/** What is wrong with the source consoles of these records. */
export const problems = (records) =>
  records.flatMap((a) => [
    ...a.sources.flatMap((s) => {
      const host = hostOf(s);
      const c = s.console === undefined ? [] : [].concat(s.console);
      if (/(^|\.)playstation\.com$/.test(host) && c.join() !== 'ps5') return [`${a.id}: a playstation.com source is ps5 only: ${s.url}`];
      if (/(^|\.)xbox\.com$/.test(host) && !(c.length && c.every((x) => x.startsWith('xbox')))) return [`${a.id}: an xbox.com source is xbox-x and/or xbox-s: ${s.url}`];
      if (!/(^|\.)(playstation|xbox)\.com$/.test(host) && c.length) return [`${a.id}: only a PlayStation or Xbox page carries a console: ${s.url}`];
      return [];
    }),
    ...(a.confidence !== 'official' ? [] : consolesOf(a).filter((c) => !a.sources.some((s) => OFFICIAL.test(hostOf(s)) && appliesTo(s).includes(c))).map((c) => `${a.id}: official, but no official source applies to ${c}`)),
  ]);

test('every source made for one console family is tagged, on the right host, and every official record has a source for each console', () => {
  assert.deepEqual(problems(loadRecords('src/content/answers')), []);
});

test('the check catches a wrong tag, an untagged console page and an official record with only the other console\'s source', () => {
  const rec = (sources, extra = {}) => ({ id: 'p', consoles: 'all', confidence: 'reported', sources, ...extra });
  const src = (url, console) => ({ url, title: 't', ...(console ? { console } : {}) });
  assert.equal(problems([rec([src('https://www.playstation.com/x', 'xbox-x')])]).length, 1);
  assert.equal(problems([rec([src('https://support.xbox.com/x')])]).length, 1);
  assert.equal(problems([rec([src('https://example.com/x', 'ps5')])]).length, 1);
  assert.equal(problems([rec([src('https://www.playstation.com/x', 'ps5')], { confidence: 'official', consoles: ['xbox-x'] })]).length >= 1, true);
  assert.equal(problems([rec([src('https://www.playstation.com/x', 'ps5'), src('https://support.rockstargames.com/x')], { confidence: 'official' })]).length, 0);
});
