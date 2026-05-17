import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const linkSchema = z.object({
  label: z.string(),
  href: z.string(),
});

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
    problem: z.string().optional(),
    method: z.string().optional(),
    evidence: z.array(z.string()).default([]),
    nextStep: z.string().optional(),
    pdf: z.string().optional(),
    code: z.string().optional(),
    relatedProjects: z.array(z.string()).default([]),
    relatedNotes: z.array(z.string()).default([]),
    relatedLibrary: z.array(z.string()).default([]),
    bibtex: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    source: z.string().optional(),
    obsidianPath: z.string().optional(),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    problem: z.string(),
    method: z.string(),
    status: z.enum(["idea", "active", "research", "utility", "paused", "archived"]).default("active"),
    tags: z.array(z.string()).default([]),
    techStack: z.array(z.string()).default([]),
    repo: z.string().optional(),
    url: z.string().optional(),
    links: z.array(linkSchema).default([]),
    relatedNotes: z.array(z.string()).default([]),
    relatedPapers: z.array(z.string()).default([]),
    relatedLibrary: z.array(z.string()).default([]),
    evidence: z.array(z.string()).default([]),
    nextStep: z.string().optional(),
    featured: z.boolean().default(false),
    order: z.number().default(99),
    draft: z.boolean().default(false),
    source: z.string().optional(),
    obsidianPath: z.string().optional(),
  }),
});

const library = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/library" }),
  schema: z.object({
    title: z.string(),
    authors: z.array(z.string()).default([]),
    type: z.string().default("resource"),
    status: z.enum(["planned", "reading", "read", "used", "collecting"]).default("reading"),
    year: z.string().default("ongoing"),
    tags: z.array(z.string()).default([]),
    url: z.string().optional(),
    note: z.string(),
    relatedNotes: z.array(z.string()).default([]),
    relatedPapers: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    order: z.number().default(99),
    draft: z.boolean().default(false),
    source: z.string().optional(),
    obsidianPath: z.string().optional(),
  }),
});

const timeline = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/timeline" }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    type: z.enum(["research", "project", "writing", "site", "education", "background"]).default("project"),
    summary: z.string(),
    link: z.string().default("/"),
    featured: z.boolean().default(false),
    order: z.number().default(99),
    draft: z.boolean().default(false),
    source: z.string().optional(),
    obsidianPath: z.string().optional(),
  }),
});

const roadmap = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/roadmap" }),
  schema: z.object({
    title: z.string(),
    question: z.string(),
    now: z.string(),
    next: z.string(),
    links: z.array(linkSchema).default([]),
    tags: z.array(z.string()).default([]),
    relatedProjects: z.array(z.string()).default([]),
    relatedNotes: z.array(z.string()).default([]),
    order: z.number().default(99),
    draft: z.boolean().default(false),
    source: z.string().optional(),
    obsidianPath: z.string().optional(),
  }),
});

export const collections = { notes, papers, projects, library, timeline, roadmap };
