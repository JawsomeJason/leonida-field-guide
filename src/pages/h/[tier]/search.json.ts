import type { GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { forConsoles } from '../../../scripts/search-match.js';

// Hidden-tier search indexes. Hidden text lives only under /h/<tier>/, same fields as the default index.
export const getStaticPaths = (() => [{ params: { tier: 'places' } }, { params: { tier: 'mild' } }]) satisfies GetStaticPaths;

export async function GET({ params }: { params: { tier: string } }) {
  const answers = await getCollection('answers', (a) => a.data.tier === params.tier);
  return Response.json(
    answers.map(({ data }) => ({ id: data.id, question: data.question, short: data.short, topic: data.topic, keywords: data.keywords, consoles: data.consoles, byConsole: data.byConsole, rank: data.rank, forConsoles: forConsoles(data) })),
  );
}
