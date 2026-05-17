---
title: "Astro static-first publishing"
authors:
  - "Tooling thread"
type: "tooling"
status: "used"
year: "2026"
updatedDate: 2026-05-17
thread: "research-infrastructure"
audience: "site maintainers and collaborators"
tags:
  - "Astro"
  - "publishing"
  - "web"
url: "/notes/why-this-site-is-now-astro"
note: "The site architecture that keeps public writing lightweight while leaving room for small dynamic pieces."
whyItMatters: "The publishing stack controls how quickly research notes, project traces, and CV updates can become public without turning the homepage into a maintenance burden."
takeaways:
  - "Astro keeps most pages static while allowing targeted dynamic APIs."
  - "Markdown-first content makes the site easier to maintain from Obsidian."
  - "Static-first deployment lowers operational risk for a personal research site."
relatedNotes:
  - "/notes/why-this-site-is-now-astro"
relatedProjects:
  - "/projects/personal-homepage"
artifacts:
  - label: "Migration note"
    type: "note"
    href: "/notes/why-this-site-is-now-astro"
    description: "Public note about moving the homepage workflow into Astro."
    status: "available"
  - label: "Homepage project"
    type: "project"
    href: "/projects/personal-homepage"
    description: "Implementation trace for the Astro and Cloudflare-backed personal site."
    status: "available"
order: 4
draft: false
---

Astro keeps the site mostly static while allowing the few dynamic parts that are genuinely useful.
