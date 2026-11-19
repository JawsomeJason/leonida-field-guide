import { getCollection } from 'astro:content';
import { forConsoles } from '../../scripts/search-match.js';
import { lossReveal } from '../../lib/answers';

// Default search index: `none` tier only, and only these fields (keywords and consoles feed the matcher and the console filter). Never add hidden text here.
// `loss` ({ tier, label }) marks a record with a loss warning: the result card shows the generic label as a button that fetches the detail in place. The label is Off-safe words, never the detail.
export async function GET() {
  const answers = await getCollection('answers', (a) => a.data.tier === 'none');
  return Response.json(
    answers.map(({ data }) => {
      const loss = lossReveal(data);
      return { id: data.id, question: data.question, short: data.short, topic: data.topic, keywords: data.keywords, consoles: data.consoles, rank: data.rank, forConsoles: forConsoles(data), loss: loss && { tier: loss.tier, label: loss.label } };
    }),
  );
}
