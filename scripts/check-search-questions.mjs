// Runs the questions players type (tests/search/questions.json) through the real matcher over the real answers, filtered by console the way the page does.
// Each row: { q, first: id | [ids any of which may come first] | "NONE" (the guide has no confident answer) | "/new/" (the known-problems row leads), console?: ps5 (default), xbox-x, xbox-s, dial?: off (default), places, mild, pending?: why it must fail today }.
// The dial decides which tiers the page loads: off none, places adds places, mild adds both.
// A pending row is expected to fail until its content lands; it fails the run when it starts passing, so the flag cannot go stale.
// Usage: node scripts/check-search-questions.mjs [contentDir=src/content/answers]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadRecords } from './check-leak.mjs';
import { answersFor, asksKnown } from '../src/scripts/search-match.js';

const KNOWN_ROW = '/new/'; // a `first` of '/new/': the page's first link is the known-problems list
const QUESTIONS = new URL('../tests/search/questions.json', import.meta.url);

/** { total, passed, pending, failures: ['"q" (console): wanted X, got Y'] } */
export function checkQuestions(dir = 'src/content/answers', rows = JSON.parse(readFileSync(QUESTIONS, 'utf8'))) {
  const all = loadRecords(dir);
  const tiers = { off: ['none'], places: ['none', 'places'], mild: ['none', 'places', 'mild'] };
  const failures = [];
  let passed = 0;
  let pending = 0;
  for (const { q, first, console: owned = 'ps5', dial = 'off', pending: why } of rows) {
    const found = answersFor(all.filter((r) => tiers[dial].includes(r.tier)), q, owned);
    const got = found.length ? found[0].id : 'NONE';
    const want = [first].flat();
    const ok = want.includes(got) || (want.includes(KNOWN_ROW) && asksKnown(q)); // the known-problems row goes ahead of every answer
    if (why) {
      pending++;
      if (ok) failures.push(`"${q}" (${owned}, ${dial}) passes now: remove its pending flag (${why})`);
    } else if (ok) passed++;
    else failures.push(`"${q}" (${owned}, ${dial}): wanted ${want.join(' or ')}, got ${got}${found.length > 1 ? ` (then ${found.slice(1, 3).map((r) => r.id).join(', ')})` : ''}`);
  }
  return { total: rows.length, passed, pending, failures };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { total, passed, pending, failures } = checkQuestions(process.argv[2]);
  console.log(`search questions: ${passed} of ${total - pending} pass${pending ? `, ${pending} pending content` : ''}`);
  if (failures.length) {
    console.error(failures.map((f) => `  ${f}`).join('\n'));
    process.exit(1);
  }
}
