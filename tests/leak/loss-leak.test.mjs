// Round 5: the rule behind a loss warning (the Mild detail) is in no Off page and no Off search data of the real build, and the money and cash
// search rows say only the generic line. `npm run check` builds before the unit tests run.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { loadRecords } from '../../scripts/check-leak.mjs';
import { GENERIC, rulesIn } from '../content/loss-rules.mjs';

const skip = !existsSync('dist') && 'no build at dist';
const records = loadRecords('src/content/answers');
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
const hiddenPath = (p) => /^(mild|places|h)\//.test(p) || /^(mild|places)\b/.test(p);
const flat = (html) => html.replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
const sentences = (t) => t.split(/(?<=[.!?])\s+/).filter((s) => s.length > 25);

test('no sentence of a Mild safe-keeping detail is in any Off page or Off search file', { skip }, () => {
  const details = records.filter((a) => a.reveal?.some((r) => r.label)).flatMap((a) => a.reveal.map((r) => ({ id: a.id, ss: sentences(r.text) })));
  assert.ok(details.length >= 2, 'the records with the safe-keeping detail are found');
  const offFiles = walk('dist').filter((f) => !hiddenPath(relative('dist', f)) && /\.(html|json|js|txt)$/.test(f));
  assert.ok(offFiles.length > 50);
  for (const f of offFiles) {
    const text = f.endsWith('.html') ? flat(readFileSync(f, 'utf8')) : readFileSync(f, 'utf8');
    for (const d of details) for (const s of d.ss) assert.equal(text.includes(s), false, `${f} holds a sentence of the detail of ${d.id}: ${s.slice(0, 50)}`);
  }
});

test('the Off search data holds only the generic line for money loss and no game-rule word in any Off row', { skip }, () => {
  const rows = JSON.parse(readFileSync('dist/search/none.json', 'utf8'));
  for (const id of ['keep-your-cash', 'will-i-lose-anything']) {
    const row = rows.find((r) => r.id === id);
    assert.ok(row, id);
    assert.ok(row.short.endsWith(GENERIC), `${id}: ${row.short}`);
  }
  assert.deepEqual(rows.flatMap((r) => rulesIn([r.question, r.short]).map((m) => `${r.id}: ${m}`)), []);
});

test('Off answer, topic and Ask pages show no game-rule word', { skip }, () => {
  const pages = walk('dist').filter((f) => /\.html$/.test(f) && !hiddenPath(relative('dist', f)) && /^(a|topics)\/|^index\.html$/.test(relative('dist', f)));
  assert.ok(pages.length > 40);
  assert.deepEqual(pages.flatMap((f) => rulesIn(sentences(flat(readFileSync(f, 'utf8')))).map((m) => `${f}: ${m}`)), []);
});
