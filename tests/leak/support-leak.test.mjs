// Support quotes (docs/spec.md, "Support quotes") are for the facts check only: a quote that is not also part of the text a record shows
// is in no built file. `npm run check` builds before the unit tests run.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadRecords } from '../../scripts/check-leak.mjs';

const skip = !existsSync('dist') && 'no build at dist';
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
const ws = (s) => s.replace(/\s+/g, ' ');

test('no support quote, and no support field, is in any built file', { skip }, () => {
  const records = loadRecords('src/content/answers');
  // A quote that is also a sentence some record shows (a short phrase two answers both say) is allowed to be on a page.
  const shown = ws(records.flatMap((a) => [a.question, a.short, a.body, ...Object.values(a.byConsole ?? {}), ...(a.reveal ?? []).map((r) => r.text)]).filter(Boolean).join(' '));
  const quotes = records.flatMap((a) => (a.support ?? []).filter((e) => !shown.includes(ws(e.quote))).map((e) => ({ id: a.id, quote: ws(e.quote) })));
  assert.ok(quotes.length > 100, 'most quotes are not shown text');
  const files = walk('dist').filter((f) => /\.(html|json|js|txt|xml)$/.test(f));
  for (const f of files) {
    const text = ws(readFileSync(f, 'utf8'));
    assert.equal(/"support"\s*:/.test(text), false, `${f} carries a support field`);
    for (const q of quotes) assert.equal(text.includes(q.quote), false, `${f} carries a support quote of ${q.id}`);
  }
});
