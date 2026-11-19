// Answer-link check (docs/spec.md "First content", Pointers). Two rules, both about a player who is told to go somewhere and has no link:
//  (a) text that points at another answer ("see the Make room card", "the X answer", another record's whole question) links it;
//  (c) `short` and `byConsole` never say "below" or "above" (nothing there is a link), and a screen named in words ("the What's new screen", "the Checklist page") is a link to it.
//  (b) a record with a `todo` either holds numbered or bulleted steps, or links the record that does (tests/content/todo-howto.json names
//      the how-to records for a step whose own bullets are facts, not steps).
// `short` and `byConsole` are plain text and cannot hold a link, so a pointer there always fails: move it into the body.
// Usage: node scripts/check-answer-links.mjs [contentDir=src/content/answers]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadRecords } from './check-leak.mjs';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const ALLOW = read('../tests/content/answer-links.allow.json');
const HOWTO = read('../tests/content/todo-howto.json');

// A link to an answer, in markdown or HTML. Its text counts as linked, so it is cut out before the scan.
const LINK = /\[[^\]]*\]\(\/a\/[a-z0-9-]+\/?\)|<a\s[^>]*href="\/a\/[^"]*"[^>]*>.*?<\/a>/gi;
// "see the Make room card", `the "crashes or freezes" card in Fixes`, `see "Will I lose anything?" answer`.
const POINTER = /(?:\bthe\s+|\bsee\s+)(“[^”]*”|"[^"]*"|[^.;:!?()[\]"“”<>]{1,40}?)\s+(?:card|answer)s?\b/gi;

const texts = (a) => [a.short, ...Object.values(a.byConsole ?? {}), a.body, ...(a.reveal ?? []).map((r) => r.text)].filter(Boolean);
const idsLinked = (a) => texts(a).flatMap((t) => [...t.matchAll(/\/a\/([a-z0-9-]+)\//g)].map((m) => m[1]));
const steps = (a) => (a.body?.match(/^\s*(?:\d+\.|[-*])\s/gm) ?? []).length >= 2;

/** [{ id, phrase }]: a pointer to another answer that is not a link. */
export function unlinkedMentions(records, allow = ALLOW.phrases) {
  const hits = [];
  for (const a of records) {
    const others = records.filter((b) => b.id !== a.id);
    for (const t of texts(a)) {
      const bare = t.replace(LINK, '');
      const found = [...bare.matchAll(POINTER)].map((m) => m[0]);
      for (const b of others) {
        const q = b.question.replace(/\?$/, '');
        if (q.split(/\s+/).length >= 3 && bare.toLowerCase().includes(q.toLowerCase())) found.push(q);
      }
      for (const phrase of found) if (!allow.includes(phrase)) hits.push({ id: a.id, phrase });
    }
  }
  return hits;
}

// A screen named in words is a link to it. Markdown links are cut out first, so a linked name passes.
const SCREEN = /\b(?:what['’]s new|checklist|topics|about|places)\s+(?:screen|page)\b/i;
const MD_LINK = /\[[^\]]*\]\([^)]*\)/g;

/** [{ id, phrase }]: a "below"/"above" in text that holds no link, or a screen named in words with no link. */
export function pointerGaps(records) {
  const hits = [];
  for (const a of records) {
    for (const t of [a.short, ...Object.values(a.byConsole ?? {})].filter(Boolean)) {
      const m = t.match(/\b(?:below|above(?!\s+\d))\b/i) // "above 48 fps" is a figure, not a place;
      if (m) hits.push({ id: a.id, phrase: m[0] });
    }
    for (const t of [a.body, ...(a.reveal ?? []).map((r) => r.text)].filter(Boolean)) {
      const m = t.replace(MD_LINK, '').match(SCREEN);
      if (m) hits.push({ id: a.id, phrase: m[0] });
    }
  }
  return hits;
}

/** [{ id, why }]: a to-do whose answer neither holds steps nor links a record that does. */
export function todoGaps(records, howto = HOWTO.howto) {
  const by = new Map(records.map((a) => [a.id, a]));
  const gaps = [];
  for (const a of records.filter((r) => r.todo)) {
    const linked = idsLinked(a);
    const named = howto[a.id];
    if (named) {
      for (const id of named) {
        if (!by.get(id)) gaps.push({ id: a.id, why: `how-to record ${id} does not exist` });
        else if (!steps(by.get(id))) gaps.push({ id: a.id, why: `${id} is named as the how-to but holds no steps` });
        if (!linked.includes(id)) gaps.push({ id: a.id, why: `its answer does not link ${id}` });
      }
    } else if (!steps(a) && !linked.some((id) => by.get(id) && steps(by.get(id)))) gaps.push({ id: a.id, why: 'no steps and no link to a record with steps' });
  }
  return gaps;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const records = loadRecords(process.argv[2] ?? 'src/content/answers');
  const bad = [...unlinkedMentions(records).map((h) => `${h.id}: points at "${h.phrase}" without a link`), ...pointerGaps(records).map((h) => `${h.id}: "${h.phrase}" points at nothing a tap can reach`), ...todoGaps(records).map((g) => `${g.id}: ${g.why}`)];
  for (const b of bad) console.error(b);
  if (bad.length) process.exit(1);
  console.log('answer links: clean');
}
