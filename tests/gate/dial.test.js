// The spoiler-dial rule: pure, no network. The cookie holds the level word; the marker opens one item.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dialRule } from '../../src/lib/gate.js';

const rule = (path, cookie, extra = {}) => dialRule({ path, cookie, ...extra });
const allowed = (path, cookie, extra) => rule(path, cookie, extra).action === 'allow';
const goes = (path, cookie, to, extra) => assert.deepEqual(rule(path, cookie, extra), { action: 'redirect', location: to });

const explicit = ['/places/x/show/', '/places/list/show/', '/mild/x/show/'];
const fragments = ['/h/places/a/x/', '/h/mild/a/x/'];
const lists = ['/h/places/search.json', '/h/mild/search.json', '/h/places/a/', '/h/mild/a/', '/h/places/offline-urls.json', '/h/mild/offline-urls.json'];
const gates = ['/places/', '/places/x/', '/places/list/', '/mild/', '/mild/x/'];

test('no cookie counts as Off: every hidden address is refused, gate pages and default pages are not', () => {
  for (const p of [...explicit, ...fragments, ...lists]) assert.equal(allowed(p, null), false, p);
  for (const p of [...gates, '/', '/a/x/', '/search/none.json', '/topics/places/', '/api/progress']) assert.equal(allowed(p, null), true, p);
});

test('refused requests go to that item\'s gate page, indexes and lists to the tier\'s', () => {
  goes('/places/x/show/', 'lfg_dial=off', '/places/x/');
  goes('/places/list/show/', 'lfg_dial=off', '/places/list/');
  goes('/mild/x/show/', 'lfg_dial=off', '/mild/x/');
  goes('/h/places/a/x/', 'lfg_dial=off', '/places/x/');
  goes('/h/mild/a/x/', 'lfg_dial=off', '/mild/x/');
  goes('/h/places/search.json', 'lfg_dial=off', '/places/');
  goes('/h/mild/search.json', 'lfg_dial=off', '/mild/');
  goes('/h/places/a/', 'lfg_dial=off', '/places/');
  goes('/h/mild/offline-urls.json', 'lfg_dial=off', '/mild/');
});

test('Places allows places and refuses mild; Mild allows both', () => {
  for (const p of [...explicit.slice(0, 2), '/h/places/a/x/', '/h/places/search.json', '/h/places/offline-urls.json']) assert.equal(allowed(p, 'lfg_dial=places'), true, p);
  for (const p of [explicit[2], '/h/mild/a/x/', '/h/mild/search.json', '/h/mild/offline-urls.json']) assert.equal(allowed(p, 'lfg_dial=places'), false, p);
  for (const p of [...explicit, ...fragments, ...lists]) assert.equal(allowed(p, 'a=1; lfg_dial=mild; b=2'), true, p);
});

test('an unknown or empty cookie value counts as Off', () => {
  for (const c of ['lfg_dial=', 'lfg_dial=story', 'lfg_dial=MILD', 'lfg_dial=mild2', 'x_lfg_dial=mild', 'lfg_dial']) assert.equal(allowed('/mild/x/show/', c), false, c);
});

test('the reveal marker opens one item below its tier: header or query, never an index or list', () => {
  for (const extra of [{ revealHeader: '1' }, { search: '?reveal=1' }, { search: '?a=1&reveal=1' }]) {
    for (const p of [...explicit, ...fragments]) assert.equal(allowed(p, 'lfg_dial=off', extra), true, p);
    for (const p of lists) assert.equal(allowed(p, 'lfg_dial=off', extra), false, p);
  }
  for (const extra of [{ revealHeader: '0' }, { revealHeader: 'true' }, { search: '?reveal=0' }, { search: '?reveal' }, { search: '?x=reveal=1' }]) {
    assert.equal(allowed('/mild/x/show/', null, extra), false, JSON.stringify(extra));
  }
});

test('dot segments, encoded dots, slashes, backslashes and case cannot get round the rule', () => {
  for (const p of [
    '/places/../places/x/show/', '/a/../h/mild/search.json', '/places/./x/show/', '/%70laces/x/show/', '/places/%2e%2e/places/x/show/', '/places/x/%2e/show/',
    '/places%2fx%2fshow/', '/places\\x\\show\\', '/PLACES/x/SHOW/', '/H/Mild/Search.json', '//places//x//show//', '/places/x/show/index.html', '/h/mild/a/index.html',
    '/places/x/%73how/', '/h/%6dild/search.json', '/places/x/show/%00',
  ]) assert.equal(allowed(p, 'lfg_dial=off'), false, p);
  assert.equal(allowed('/places/x/%E0%A4%A/', 'lfg_dial=off'), false); // a malformed escape is kept as written, and anything deeper than a gate page is refused
  // A path that only resolves to a gate page or a default page is not hidden.
  assert.equal(allowed('/a/../mild/x/', null), true);
});
