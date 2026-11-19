import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { topicIds } from './data/topics';
import { stageIds } from './data/stages';

const OFFICIAL_HOSTS = ['rockstargames.com', 'take2games.com', 'playstation.com', 'xbox.com'];
const onOfficialHost = (url: string) => {
  const host = new URL(url).hostname;
  return OFFICIAL_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
};

const consoleId = z.enum(['ps5', 'xbox-x', 'xbox-s']);

const answers = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/answers' }),
  schema: z
    .strictObject({
      id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
      question: z.string().min(1),
      short: z.string().min(1).max(240),
      body: z.string().min(1).optional(),
      topic: z.enum(topicIds),
      stage: z.enum(stageIds),
      tier: z.enum(['none', 'places', 'mild']),
      consoles: z.union([z.literal('all'), z.array(consoleId).min(1)]),
      byConsole: z.partialRecord(consoleId, z.string().min(1)).optional(),
      confidence: z.enum(['official', 'reported', 'community']),
      sources: z.array(z.strictObject({ url: z.url(), title: z.string().min(1) })).min(1),
      checked: z.iso.date(),
      rank: z.number().int().positive().optional(),
      todo: z.string().min(1).optional(),
      reveal: z
        .array(z.strictObject({ tier: z.enum(['places', 'mild']), text: z.string().min(1) }))
        .optional(),
    })
    .refine((a) => a.topic !== 'places' || a.tier === 'places', {
      message: "topic 'places' requires tier 'places'",
      path: ['tier'],
    })
    .refine((a) => a.confidence !== 'official' || a.sources.some((s) => onOfficialHost(s.url)), {
      message: "'official' needs a source on an official host",
      path: ['confidence'],
    })
    .refine((a) => !a.reveal || a.tier === 'none', {
      message: "'reveal' is only for records with tier 'none'",
      path: ['reveal'],
    }),
});

export const collections = { answers };
