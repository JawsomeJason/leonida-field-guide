import { getCollection } from 'astro:content';

// Default search index: `none` tier only, and only these four fields. Never add hidden text here.
export async function GET() {
  const answers = await getCollection('answers', (a) => a.data.tier === 'none');
  return Response.json(
    answers.map(({ data: { id, question, short, topic } }) => ({ id, question, short, topic })),
  );
}
