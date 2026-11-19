import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { oldAddresses } from '../../src/lib/redirects.js';
import { loadRecords } from '../../scripts/check-leak.mjs';

test('every record that is not default tier gets /a/<id>/ to its gate address, never the explicit one', () => {
  const map = oldAddresses([{ id: 'a', tier: 'none' }, { id: 'b', tier: 'mild' }, { id: 'c', tier: 'places' }]);
  assert.deepEqual(map, { '/a/b/': '/mild/b/', '/a/c/': '/places/c/' });
});

// Against the real content and the real build (npm run check builds first).
test('the build has a redirect page for each real hidden-tier record, pointing at the gate and holding none of its text', { skip: !existsSync('dist') && 'no build at dist' }, () => {
  const records = loadRecords('src/content/answers');
  const hidden = records.filter((a) => a.tier !== 'none');
  assert.ok(hidden.length >= 4, 'the four records that moved to Mild are among them');
  for (const a of hidden) {
    const html = readFileSync(`dist/a/${a.id}/index.html`, 'utf8');
    assert.ok(html.includes(`url=/${a.tier}/${a.id}/`), `${a.id} redirects to its gate`);
    assert.ok(!html.includes('/show/'), `${a.id} does not point at the explicit address`);
    for (const t of [a.question, a.short, a.body, ...(a.keywords ?? [])].filter(Boolean)) assert.ok(!html.includes(t), `${a.id} redirect holds hidden text`);
  }
  for (const id of ['fast-travel', 'stolen-cars', 'wanted-and-police', 'core-stats']) assert.ok(existsSync(`dist/a/${id}/index.html`), `${id} old address`);
});
