// Stale-tense check. A record that speaks of a date on or before its own `checked` date as still to come ("would add ... on 19 November",
// checked 19 November) is out of date the day it ships. Usage: node scripts/check-dates.mjs [contentDir=src/content/answers]
import { fileURLToPath } from 'node:url';
import { loadRecords } from './check-leak.mjs';

const MONTHS = 'january february march april may june july august september october november december'.split(' ');
const M = `(${MONTHS.join('|')})`;
// ISO, "19 November (2026)", "November 19(, 2026)". Months are written in full, as the guide does.
const DATE = new RegExp(`(\\d{4})-(\\d{2})-(\\d{2})|\\b(\\d{1,2})(?:st|nd|rd|th)? ${M}(?:,? (\\d{4}))?\\b|\\b${M} (\\d{1,2})(?:st|nd|rd|th)?(?:,? (\\d{4}))?\\b`, 'gi');
export const FUTURE_CUE = /\b(will|would|upcoming|arrives?|launches|launching|coming|expected|due|soon|scheduled|planned|begins|going to)\b/i;

const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
/** ISO dates found in a sentence; a date with no year takes the year of `checked`. */
function datesIn(sentence, year) {
  return [...sentence.matchAll(DATE)].map((m) => {
    if (m[1]) return iso(m[1], m[2], m[3]);
    if (m[4]) return iso(m[6] ?? year, MONTHS.indexOf(m[5].toLowerCase()) + 1, m[4]);
    return iso(m[9] ?? year, MONTHS.indexOf(m[7].toLowerCase()) + 1, m[8]);
  });
}

const texts = (a) => [a.question, a.short, ...Object.values(a.byConsole ?? {}), a.body, a.todo, ...(a.reveal ?? []).map((r) => r.text)].filter(Boolean);

/** [{ id, date, sentence }]: sentences with a future cue and a date that is not after the record's `checked` date. */
export function dateHits(records) {
  const hits = [];
  for (const a of records) {
    const checked = String(a.checked).slice(0, 10);
    for (const text of texts(a))
      for (const sentence of text.split(/(?<=[.!?])\s+|\n+/))
        if (FUTURE_CUE.test(sentence))
          for (const date of datesIn(sentence, checked.slice(0, 4))) if (date <= checked) hits.push({ id: a.id, date, sentence: sentence.trim() });
  }
  return hits;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const hits = dateHits(loadRecords(process.argv[2] ?? 'src/content/answers'));
  for (const h of hits) console.error(`${h.id}: ${h.date} is not in the future: "${h.sentence.slice(0, 120)}"`);
  if (hits.length) process.exit(1);
  console.log('dates: clean');
}
