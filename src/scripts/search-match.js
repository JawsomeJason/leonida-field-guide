// Pure token match, kept apart from the DOM so a test can import it.
// Every query token must appear in the question or the short answer. Question hits rank first.
export function match(records, query) {
  const tokens = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (!tokens.length) return [];
  const hit = (text) => tokens.every((t) => text.includes(t));
  return records
    .map((r) => ({ r, score: hit(r.question.toLowerCase()) ? 2 : hit(`${r.question} ${r.short}`.toLowerCase()) ? 1 : 0 }))
    .filter((x) => x.score)
    .sort((a, b) => b.score - a.score) // Array sort is stable, so index order breaks ties
    .map((x) => x.r);
}
