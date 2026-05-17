# Obsidian Publishing Workflow

The website only reads selected public folders from the local vault:

- Vault: `/Users/hu/Documents/Obsidian Vault`
- Public notes: `Homepage/Notes`
- Public papers: `Homepage/Papers`
- Public projects: `Homepage/Projects`
- Public library items: `Homepage/Library`
- Public timeline entries: `Homepage/Timeline`
- Public roadmap threads: `Homepage/Roadmap`

Private folders such as `Journal` are intentionally not connected to the website.

## Publish A Note

Create a Markdown note in `Homepage/Notes` with this frontmatter:

```yaml
---
title: My note title
description: One sentence summary for list pages and search
date: 2026-05-16
tags: [robotics, sim-to-real]
draft: false
---
```

Then run:

```bash
npm run obsidian:sync
npm run build
```

## Publish A Paper

Create a Markdown note in `Homepage/Papers` with this frontmatter:

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

Status must be one of:

- `idea`
- `draft`
- `under review`
- `preprint`
- `published`
- `in preparation`
- `archived`

## Publish A Project

Create a Markdown note in `Homepage/Projects`:

```yaml
---
title: Project name
summary: One sentence summary
problem: What problem this project addresses
method: How it works
status: active
tags: [robotics, tooling]
techStack: [Astro, Cloudflare]
repo: dreamkeeperhu.github.io
url: https://github.com/dreamkeeperhu/dreamkeeperhu.github.io
links:
  - label: Live site
    href: https://jianhenghu.com
featured: true
order: 1
draft: false
---
```

Project status must be one of `idea`, `active`, `research`, `utility`, `paused`, or `archived`.

## Publish Library, Timeline, Or Roadmap Entries

Use `Homepage/Library`, `Homepage/Timeline`, and `Homepage/Roadmap` with explicit `draft: false`.

Library status must be one of `planned`, `reading`, `read`, `used`, or `collecting`.

Timeline type must be one of `research`, `project`, `writing`, `site`, `education`, or `background`.

Drafts are skipped unless `OBSIDIAN_SYNC_DRAFTS=true`.

Notes are private by default. A file is published only when its frontmatter explicitly contains `draft: false`, `publish: true`, `public: true`, or `status: public`.
