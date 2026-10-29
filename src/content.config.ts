import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const writeups = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writeups' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    platform: z.string(),
    difficulty: z.enum(['easy', 'medium', 'hard', 'insane']),
    tags: z.array(z.string()).default([]),
    locked: z.boolean().default(false),
    unlockDate: z.coerce.date().optional(),
  }),
});

const cv = defineCollection({
  loader: glob({ pattern: 'cv.md', base: './src/content/cv' }),
  schema: z.object({
    title: z.string(),
    role: z.string(),
    location: z.string(),
  }),
});

export const collections = { writeups, cv };
