// Per-claim labels (docs/spec.md "First content", Labels): a record that mixes sources of different standing says per claim which is which.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRecords } from '../../scripts/check-leak.mjs';
import { basisProblems, onOfficialHost, weakest } from '../../src/data/confidence.js';

const records = loadRecords('src/content/answers');
// Mixed sources, but no claim in the answer rests on the official one alone: one line each on why a single label is true.
const SINGLE_LABEL = {
  'ps5-trigger-and-haptics': 'every setting named comes from a guide; the only official source is the game\'s store listing',
};
const src = (url) => ({ url, title: 't' });
const rec = (basis, sources, confidence = 'reported') => ({ basis, sources, confidence });

test('basis: an unknown claim label is refused by the schema, and an official claim needs an official-host source', () => {
  assert.deepEqual(basisProblems(rec([{ claim: 'a', confidence: 'official' }, { claim: 'b', confidence: 'reported' }], [src('https://support.rockstargames.com/x'), src('https://www.ign.com/x')])), []);
  // official claim, only a news source
  assert.equal(basisProblems(rec([{ claim: 'a', confidence: 'official' }, { claim: 'b', confidence: 'reported' }], [src('https://www.ign.com/x')])).length, 1);
  // reported claim, only an official source
  assert.equal(basisProblems(rec([{ claim: 'a', confidence: 'official' }, { claim: 'b', confidence: 'reported' }], [src('https://www.xbox.com/x')])).length, 1);
  // the record's own label must be the weakest claim's
  assert.equal(basisProblems(rec([{ claim: 'a', confidence: 'official' }, { claim: 'b', confidence: 'reported' }], [src('https://www.xbox.com/x'), src('https://www.ign.com/x')], 'official')).length, 1);
  assert.deepEqual(basisProblems({ confidence: 'reported', sources: [src('https://www.ign.com/x')] }), []);
  assert.equal(weakest([{ confidence: 'official' }, { confidence: 'community' }, { confidence: 'reported' }]), 'community');
});

test('basis: the schema (src/content.config.ts) enforces the same rule and the record has an optional field only', async () => {
  const text = (await import('node:fs')).readFileSync('src/content.config.ts', 'utf8');
  assert.match(text, /basis: z\.array\(z\.strictObject\(\{ claim: .*confidence: z\.enum\(\['official', 'reported', 'community'\]\) \}\)\)\.min\(2\)\.optional\(\)/);
  assert.match(text, /basisProblems\(a\)/);
});

test('every record that has a basis passes the rule', () => {
  for (const a of records.filter((r) => r.basis)) assert.deepEqual(basisProblems(a), [], a.id);
});

test('a record whose sources mix official and other hosts says per claim which is which, or says why one label is true', () => {
  const mixed = records.filter((a) => a.sources.some((s) => onOfficialHost(s.url)) && a.sources.some((s) => !onOfficialHost(s.url)));
  assert.ok(mixed.length >= 5, 'the mixed records are still found');
  for (const a of mixed) assert.ok(a.basis || SINGLE_LABEL[a.id], `${a.id} mixes sources: add basis, or list it in SINGLE_LABEL with the reason`);
  for (const id of Object.keys(SINGLE_LABEL)) assert.ok(!records.find((a) => a.id === id)?.basis, `${id} has a basis now: drop it from SINGLE_LABEL`);
});

test('the install-size answer names the publisher claim and the news claim separately', () => {
  const a = records.find((r) => r.id === 'install-size-and-preload');
  assert.deepEqual(a.basis.map((b) => b.confidence), ['official', 'reported']);
  assert.equal(a.confidence, 'reported');
});

// The build stops at the first bad record, so each case gets its own build.
for (const [name, second, host, message] of [
  ['an unknown claim label', 'certain', 'www.ign.com', /Invalid option/],
  ['an official claim with no official-host source', 'reported', 'www.ign.com', /no official-host source backs it/],
]) {
  test(`the real build refuses ${name}`, async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { spawnSync } = await import('node:child_process');
    const dir = mkdtempSync(`${tmpdir()}/basis-`);
    const claim = (c) => `  - claim: a\n    confidence: ${c}\n`;
    writeFileSync(`${dir}/bad.yaml`, `id: bad\nquestion: q\nshort: s\ntopic: setup\nstage: before\ntier: none\nconsoles: all\nconfidence: reported\nchecked: "2026-11-19"\nbasis:\n${claim('official')}${claim(second)}sources:\n  - url: https://${host}/x\n    title: t\n`);
    const out = spawnSync('npx', ['astro', 'build', '--outDir', `${dir}/out`], { encoding: 'utf8', env: { ...process.env, LFG_CONTENT_DIR: dir } });
    rmSync(dir, { recursive: true, force: true });
    assert.notEqual(out.status, 0, 'the build fails');
    assert.match(out.stdout + out.stderr, message);
  });
}
