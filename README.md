# HJH Personal Homepage

Astro-powered personal homepage for Jianheng Hu (HJH): About, CV, research, notes, Now, friends, Notion-backed publishing, dynamic GitHub data, RSS, dark mode, and privacy-friendly analytics hooks.

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

- Notes: `src/content/notes/*.md`, or synced from Notion into `src/content/notes/notion/`
- Papers: `src/content/papers/*.md`, or synced from Notion into `src/content/papers/notion/`
- Pages: `src/pages/`
- Shared layout: `src/layouts/BaseLayout.astro`
- Public CV PDF: `public/cv/jianheng-hu-cv.pdf`
- Paper PDFs: `public/papers/`

Notion is the default writing source. You can still write Markdown directly in `src/content/notes`, and Obsidian remains available as a local fallback.

## Notion Sync

Create `.env.local` from `.env.example`:

```bash
NOTION_API_KEY=secret_xxx
NOTION_NOTES_DATA_SOURCE_ID=your_notes_data_source_id
NOTION_PAPERS_DATA_SOURCE_ID=your_papers_data_source_id
NOTION_SYNC_DRAFTS=false
```

You can also use `NOTION_NOTES_DATABASE_ID` and `NOTION_PAPERS_DATABASE_ID`; the script will retrieve the first data source under each database.

Then run:

```bash
npm run notion:sync
```

Builds run Notion sync automatically before Astro:

```bash
npm run build
```

Suggested Notes database properties:

```text
Name / Title: title
Description / Summary: text
Date / Published: date
Tags: multi-select
Status: status or select
Draft: checkbox
Slug: text, optional
```

Suggested Papers database properties: `Name`, `Authors`, `Status`, `Year`, `Venue`, `Abstract`, `PDF`, `Code`, and `Tags`.

Draft notes are skipped unless `NOTION_SYNC_DRAFTS=true`.

## Obsidian Sync

Obsidian is optional now. Use it when you prefer a private local vault.

Create `.env.local` from `.env.example`:

```bash
OBSIDIAN_VAULT_PATH=/absolute/path/to/your/vault
OBSIDIAN_NOTES_DIR=Notes
OBSIDIAN_PAPERS_DIR=Papers
OBSIDIAN_SYNC_DRAFTS=false
```

Then run:

```bash
npm run obsidian:sync
```

The script copies public notes into:

- `src/content/notes/obsidian/`
- `src/content/papers/obsidian/`

Supported frontmatter:

```yaml
---
title: My note
description: One sentence summary
date: 2026-05-16
tags: [robotics, sim-to-real]
draft: false
---
```

For papers, also use `status`, `authors`, `year`, `venue`, `abstract`, `pdf`, and `code`.

Draft notes are skipped unless `OBSIDIAN_SYNC_DRAFTS=true`.

## Dynamic Features

- GitHub repositories: fetched client-side from the GitHub REST API.
- GitHub contribution graph: fetched client-side from a public contribution API.
- Notion publishing: fetched server-side at build time from the Notion API.
- Article search: client-side filtering on `/notes`.
- Global search: generated at `/search.json` and used by `/search`.
- Tags: generated from note frontmatter at `/tags`.
- Email subscription: set `PUBLIC_SUBSCRIBE_ACTION` to a provider endpoint. Without it, the form falls back to a mailto subscription request.
- Analytics: set either Plausible or Umami environment variables:
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

GitHub Pages:

- `.github/workflows/deploy.yml` builds the Astro site and deploys `dist`.
