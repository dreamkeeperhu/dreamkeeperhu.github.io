# Obsidian Publishing Workflow

The website only reads selected public folders from the local vault:

- Vault: `/Users/hu/Documents/Obsidian Vault`
- Public notes: `Homepage/Notes`
- Public papers: `Homepage/Papers`

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

- `under review`
- `preprint`
- `published`
- `in preparation`

Drafts are skipped unless `OBSIDIAN_SYNC_DRAFTS=true`.
