import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRecords } from '../../scripts/check-leak.mjs';

// A PlayStation page without a language in its path opened in French for a reviewer: every link to www.playstation.com names en-us.
test('every link to playstation.com carries the en-us path (sources and support pages)', () => {
  const bad = [];
  for (const r of loadRecords('src/content/answers')) {
    const urls = [...(r.sources ?? []).map((s) => s.url), ...(r.support ?? []).map((s) => s.url), ...JSON.stringify(r).match(/https:\/\/www\.playstation\.com\/[^"\s)\\]*/g) ?? []];
    for (const u of urls) if (/^https:\/\/www\.playstation\.com\//.test(u) && !u.startsWith('https://www.playstation.com/en-us/')) bad.push(`${r.id}: ${u}`);
  }
  assert.deepEqual(bad, []);
});

test('About says a shown detail stays on the device until the level is lowered or the site data is cleared; the checklist says "up to 212 GB"', async () => {
  const { readFileSync } = await import('node:fs');
  assert.match(readFileSync('src/pages/about.astro', 'utf8'), /A detail you chose to show stays saved on this device for offline use until you lower the level or clear this site's data\./);
  assert.match(loadRecords('src/content/answers').find((r) => r.id === 'install-size-and-preload').todo, /up to 212 GB/);
});
