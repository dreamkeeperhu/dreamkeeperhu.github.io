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
thread: "sim-to-real"
series: "Research papers"
audience: "research collaborators"
abstract: "One paragraph abstract."
problem: "What problem does this work address?"
method: "What is the method?"
contribution:
  - "Main contribution."
limitations:
  - "Known limitation or boundary."
reviewNote: "How readers should interpret the current status."
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
thread: "research-infrastructure"
series: "Project traces"
audience: "collaborators"
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
outcome: "What is usable or learned now."
lessons:
  - "What this project taught you."
maturityNote: "usable / prototype / research trace / archived, with context."
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
thread: "sim-to-real"
series: "Reading shelf"
audience: "research readers"
tags: ["sim-to-real"]
url: "https://example.com"
note: "Why this matters to my current research."
whyItMatters: "A direct explanation of how this item connects to your current research."
takeaways:
  - "Takeaway 1."
  - "Takeaway 2."
  - "Takeaway 3."
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
thread: "sim-to-real"
series: "Research notes"
audience: "robotics readers"
difficulty: "working"
category: "research"
tags: ["robotics"]
draft: false
---
```

## Roadmap

```yaml
---
title: "Sim-to-real Generalization"
question: "What is the open question?"
now: "What you are doing now."
next: "The next public update or experiment."
links:
  - label: "Related note"
    href: "/notes/example"
tags: ["sim-to-real", "robotics"]
relatedProjects: []
relatedNotes: []
order: 1
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
