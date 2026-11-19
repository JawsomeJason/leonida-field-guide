import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { plainWordHits, htmlText, scriptStrings, scan } from '../../scripts/check-plain-words.mjs';
import { jargon } from '../../src/data/jargon.js';

test('planted: every listed term with no plain words in its sentence is flagged, page and sentence named', () => {
  const planted = [
    'Pre-load opens on Monday.',
    'Uninstalling keeps your licence.',
    'Your ticks are synced.',
    'Cross-progression is not confirmed.',
    'The game is Optimized for Series X|S.',
    'Add a Storage Expansion Card.',
    'It must go on the internal SSD.',
    'You need a hard save first.',
    'PSSR is on.',
    'Try a power cycle.',
  ];
  for (const s of planted) {
    const hits = plainWordHits('/planted/', s);
    assert.equal(hits.length, 1, s);
    assert.equal(hits[0].page, '/planted/');
    assert.equal(hits[0].sentence, s);
  }
});

test('passing sample: plain words before the term, or its short definition after it, in the same sentence', () => {
  const fine = [
    'Downloading before launch (pre-load) opens on Monday.',
    'Uninstalling keeps your right to play (your licence).',
    'Your ticks are copied online (synced).',
    'Progress shared between consoles (cross-progression) is not confirmed.',
    'The store label is Optimized for Series X|S.',
    'Add a Storage Expansion Card (a plug-in storage card).',
    'It must go on the console\'s built-in drive (the internal SSD).',
    'You need a manual save (a hard save) first.',
    'A sharpening boost (PSSR) is on.',
    'Switch it fully off and on again (a power cycle).',
    'Nothing listed here at all.',
  ];
  for (const s of fine) assert.deepEqual(plainWordHits('/ok/', s), [], s);
});

test('only the first use on a page needs its plain words', () => {
  assert.deepEqual(plainWordHits('/p/', 'A sharpening boost (PSSR) is on.\nPSSR looks sharp.'), []);
  assert.equal(plainWordHits('/p/', 'PSSR looks sharp.\nIt runs well.\nA sharpening boost (PSSR) is on.').length, 1);
  // The plain words may sit in the very next sentence.
  assert.deepEqual(plainWordHits('/p/', 'PSSR looks sharp.\nIt is a sharpening boost.'), []);
});

test('page text leaves out scripts and a source link\'s own title, and script strings are read', () => {
  const html = '<p>Hello</p><script>const x="PSSR"</script><a class="outside" href="x"><span>Pre-Load FAQ</span></a>';
  assert.deepEqual(plainWordHits('/p/', htmlText(html)), []);
  assert.equal(plainWordHits('src/scripts/x.js', scriptStrings("el.textContent = `Synced at ${t}`;")).length, 1);
});

test('every term is one object with a form, a means and a plain replacement (easy to extend)', () => {
  for (const j of jargon) {
    assert.ok(j.term && j.forms instanceof RegExp && j.means instanceof RegExp && j.plain, j.term);
    assert.ok(j.forms.flags.includes('g'), `${j.term}: forms needs the g flag`);
  }
  for (const t of ['pre-load', 'licence', 'sync', 'cross-progression', 'Optimized for Series X|S', 'Storage Expansion Card', 'internal SSD', 'hard save', 'PSSR', 'power cycle'])
    assert.ok(jargon.some((j) => j.term === t), t);
});

test('the real build, its scripts and every record are clean', { skip: !existsSync('dist') && 'no build' }, () => {
  const { hits, scanned } = scan();
  assert.deepEqual(hits, []);
  assert.ok(scanned > 100, `scanned ${scanned}`);
});

// Fix round 7: "Could not reach the online store (the sync service)" confused three reviewers. None of those words ships anywhere a player reads,
// and the three sync sentences pass the plain-words rule on their own (the sentence after "Not syncing right now." says where the ticks are saved).
test('the words sync service, sync store and online store are used nowhere in the site source, and the three sync sentences are plain', async () => {
  const { readFileSync, readdirSync, statSync } = await import('node:fs');
  const files = (dir) => readdirSync(dir).flatMap((n) => (statSync(`${dir}/${n}`).isDirectory() ? files(`${dir}/${n}`) : [`${dir}/${n}`]));
  const bad = files('src').filter((f) => /\b(sync service|sync store|online store)\b/i.test(readFileSync(f, 'utf8')));
  assert.deepEqual(bad, []);
  const sentences = [
    'Not syncing right now. Your ticks are saved on this device. We will try again.',
    'Syncing is not available here. Your ticks are saved on this device only.',
    "Copied online (synced) at 3:04 PM: your ticks are saved on this device and in this site's private store.",
  ];
  for (const s of sentences) assert.deepEqual(plainWordHits('/checklist/', s), [], s);
  assert.equal(plainWordHits('/planted/', 'Not syncing right now.').length, 1); // the bare word is still flagged
});
