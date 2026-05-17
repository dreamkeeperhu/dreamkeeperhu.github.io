# Obsidian Homepage Templates

Only notes with `draft: false`, `publish: true`, or `public: true` are published. Keep private drafts unmarked.

## Paper

```yaml
---
title: "Paper title"
authors: ["Jianheng Hu"]
status: "under review"
venue: "Target venue"
year: 2026
updatedDate: 2026-05-17
abstract: "One paragraph abstract."
problem: "What problem does this work address?"
method: "What is the method?"
evidence:
  - "Experiment or proof signal."
nextStep: "What changes next?"
pdf: "/papers/example.pdf"
code: "https://github.com/dreamkeeperhu/example"
relatedProjects: ["/projects/example"]
relatedNotes: ["/notes/example"]
relatedLibrary: ["/library/example"]
artifacts:
  - label: "Paper PDF"
    type: "pdf"
    href: "/papers/example.pdf"
    description: "Current public manuscript."
    status: "available"
tags: ["robotics"]
draft: false
---
```

## Project

```yaml
---
title: "Project name"
summary: "One sentence project summary."
problem: "What problem does this project touch?"
method: "How is it built?"
status: "active"
statusDetail: "prototype"
updatedDate: 2026-05-17
tags: ["robotics", "tooling"]
techStack: ["Astro", "Cloudflare"]
repo: "repo-name"
url: "https://github.com/dreamkeeperhu/repo-name"
relatedPapers: []
relatedNotes: []
relatedLibrary: []
artifacts:
  - label: "GitHub repository"
    type: "code"
    href: "https://github.com/dreamkeeperhu/repo-name"
    description: "Source code and experiment trace."
    status: "available"
featured: true
order: 1
draft: false
---
```

## Library

```yaml
---
title: "Reading item"
authors: ["Author"]
type: "paper cluster"
status: "reading"
year: "ongoing"
updatedDate: 2026-05-17
tags: ["sim-to-real"]
url: "https://example.com"
note: "Why this matters to my current research."
relatedNotes: []
relatedPapers: []
relatedProjects: []
artifacts:
  - label: "Primary source"
    type: "link"
    href: "https://example.com"
    description: "Useful source for this reading item."
    status: "available"
featured: false
order: 99
draft: false
---
```

## Note

```yaml
---
title: "Note title"
description: "One sentence description."
pubDate: 2026-05-17
updatedDate: 2026-05-17
category: "research"
tags: ["robotics"]
draft: false
---
```

## Timeline

```yaml
---
title: "Milestone"
date: 2026-05-17
type: "research"
summary: "What changed?"
link: "/research"
featured: true
order: 1
draft: false
---
```
