# HJH Personal Homepage

Astro-powered personal homepage for Jianheng Hu (HJH): About, CV, research detail pages, projects, public notes, library, timeline, contact, RSS, dark mode, and privacy-friendly first-party analytics.

## Local Development

```bash
npm install
npm run dev
```

Build static output:

```bash
npm run build
```

The generated site is in `dist/`.

## Content

- Notes: `src/content/notes/*.md`, or synced from Obsidian into `src/content/notes/obsidian/`
- Papers: `src/content/papers/*.md`, or synced from Obsidian into `src/content/papers/obsidian/`
- Pages: `src/pages/`
- Structured data: `src/data/projects.ts`, `src/data/roadmap.ts`, `src/data/timeline.ts`, `src/data/library.ts`
- Shared layout: `src/layouts/BaseLayout.astro`
- Public CV PDF: `public/cv/jianheng-hu-cv.pdf`
- Paper PDFs: `public/papers/`

## Obsidian Sync

Obsidian is the default private writing source. Keep personal journal folders out of the publish folders; only export selected notes that should appear on the public website.

Create `.env.local` from `.env.example`:

```bash
OBSIDIAN_VAULT_PATH=/absolute/path/to/your/vault
OBSIDIAN_NOTES_DIR=Homepage/Notes
OBSIDIAN_PAPERS_DIR=Homepage/Papers
OBSIDIAN_SYNC_DRAFTS=false
```

Then run:

```bash
npm run obsidian:sync
```

Builds run Obsidian sync automatically before Astro:

```bash
npm run build
```

The script copies public notes into:

- `src/content/notes/obsidian/`
- `src/content/papers/obsidian/`

Supported note frontmatter:

```yaml
---
title: My note
description: One sentence summary
date: 2026-05-16
tags: [robotics, sim-to-real]
draft: false
---
```

Supported paper frontmatter:

```yaml
---
title: Paper title
authors: [Jianheng Hu]
status: under review
year: 2026
abstract: One paragraph abstract
pdf: /papers/example.pdf
tags: [robotics]
draft: false
---
```

Draft notes are skipped unless `OBSIDIAN_SYNC_DRAFTS=true`. Obsidian notes are private by default; a file is published only when its frontmatter explicitly contains `draft: false`, `publish: true`, `public: true`, or `status: public`.

This machine is configured to use `/Users/hu/Documents/Obsidian Vault/Homepage/Notes` and `/Users/hu/Documents/Obsidian Vault/Homepage/Papers`. See `docs/obsidian-publishing.md` for the exact local workflow.

## Dynamic Features

- GitHub repositories: fetched client-side from the GitHub REST API.
- GitHub contribution graph: fetched client-side from a public contribution API.
- Article search: client-side filtering on `/notes`.
- Global fuzzy search: generated at `/search.json`, used by `/search`, and opened with `Cmd/Ctrl + K`.
- Tags: generated from note frontmatter at `/tags`.
- Email subscription: stored by the Cloudflare Pages Function at `/api/subscribe` in the `SUBSCRIBERS` KV namespace.
- Unsubscribe: `/api/unsubscribe?token=...` removes a subscriber.
- Contact intent form: `/contact` opens a mail draft and backs up submissions in `CONTACT_MESSAGES`.
- Admin subscriber export: `/api/admin/subscribers` requires `Authorization: Bearer <ADMIN_TOKEN>`.
- First-party analytics: `/api/visit` records anonymous aggregate page counts in the `SITE_METRICS` KV namespace, and `/api/site-stats` exposes totals for the homepage pulse.
- Optional third-party analytics: set either Plausible or Umami environment variables:
  - `PUBLIC_PLAUSIBLE_DOMAIN`
  - `PUBLIC_PLAUSIBLE_SRC`
  - `PUBLIC_UMAMI_WEBSITE_ID`
  - `PUBLIC_UMAMI_SRC`
- Image CDN/R2: set `PUBLIC_ASSET_CDN` to prefix image paths while keeping local fallback assets.

## Deployment

Cloudflare Pages:

- Build command: `npm run build`
- Output directory: `dist`
- `wrangler.toml` also declares `pages_build_output_dir = "dist"`.

## Automatic Deployment

GitHub Actions deploys the site to Cloudflare Pages on push, manually, by repository dispatch, and every 12 hours. During CI, the build pulls public Obsidian Markdown from R2 before rendering Astro. See `docs/auto-deploy.md`.
