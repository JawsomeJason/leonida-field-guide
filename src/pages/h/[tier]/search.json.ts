import type { GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';

// Hidden-tier search indexes. Hidden text lives only under /h/<tier>/, same four fields as the default index.
export const getStaticPaths = (() => [{ params: { tier: 'places' } }, { params: { tier: 'mild' } }]) satisfies GetStaticPaths;

export async function GET({ params }: { params: { tier: string } }) {
  const answers = await getCollection('answers', (a) => a.data.tier === params.tier);
  return Response.json(
    answers.map(({ data: { id, question, short, topic } }) => ({ id, question, short, topic })),
  );
}
