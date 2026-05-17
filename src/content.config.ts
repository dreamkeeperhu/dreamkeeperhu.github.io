import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const notes = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/notes" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    source: z.string().optional(),
    obsidianPath: z.string().optional(),
  }),
});

const papers = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/papers" }),
  schema: z.object({
    title: z.string(),
    authors: z.array(z.string()),
    status: z.enum(["idea", "draft", "under review", "published", "archived", "preprint", "in preparation"]),
    venue: z.string().optional(),
    year: z.number(),
    abstract: z.string(),
    pdf: z.string().optional(),
    code: z.string().optional(),
    relatedNotes: z.array(z.string()).default([]),
    bibtex: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    source: z.string().optional(),
    obsidianPath: z.string().optional(),
  }),
});

export const collections = { notes, papers };
