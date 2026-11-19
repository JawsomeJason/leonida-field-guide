import { getCollection } from 'astro:content';
import { forConsoles } from '../../scripts/search-match.js';

// Default search index: `none` tier only, and only these fields (keywords and consoles feed the matcher and the console filter). Never add hidden text here.
export async function GET() {
  const answers = await getCollection('answers', (a) => a.data.tier === 'none');
  return Response.json(
    answers.map(({ data }) => ({ id: data.id, question: data.question, short: data.short, topic: data.topic, keywords: data.keywords, consoles: data.consoles, rank: data.rank, forConsoles: forConsoles(data) })),
  );
}
