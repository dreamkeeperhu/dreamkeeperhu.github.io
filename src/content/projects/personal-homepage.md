---
title: "dreamkeeperhu.github.io"
summary: "A research-oriented personal website with Astro, Obsidian publishing, Cloudflare Pages, and first-party lightweight APIs."
problem: "A static homepage was not enough to connect CV, research progress, public notes, projects, and deployment automation."
method: "Use Astro for static-first pages, Obsidian/R2 for writing, GitHub Actions for deployment, and Cloudflare KV for subscriptions, contact backups, and pulse metrics."
status: "active"
tags:
  - "Astro"
  - "Cloudflare"
  - "Obsidian"
  - "Personal site"
techStack:
  - "Astro"
  - "TypeScript"
  - "Cloudflare Pages"
  - "KV"
  - "GitHub Actions"
repo: "dreamkeeperhu.github.io"
url: "https://github.com/dreamkeeperhu/dreamkeeperhu.github.io"
links:
  - label: "Live site"
    href: "https://jianhenghu.com"
  - label: "Notes"
    href: "/notes"
relatedNotes:
  - "/notes/why-this-site-is-now-astro"
relatedPapers: []
relatedLibrary:
  - "/library"
evidence:
  - "Obsidian notes can be promoted into public pages without hand-editing the site."
  - "GitHub Actions rebuilds and deploys the site to Cloudflare Pages."
  - "Cloudflare KV stores subscriptions, contact backups, and aggregate site signals."
nextStep: "Keep the homepage focused while making deeper research and writing pages easier to maintain."
featured: true
order: 1
draft: false
---

This project is the public surface for my research direction, writing workflow, and small experiments. The important design constraint is restraint: the site should be useful to a researcher or collaborator without turning into a dashboard.
