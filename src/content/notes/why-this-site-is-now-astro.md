---
title: "Why This Site Moved to Astro"
description: "The site needed Markdown notes, RSS, dynamic GitHub data, and clean static deployment without becoming too heavy."
pubDate: 2026-05-16
updatedDate: 2026-05-17
thread: "research-infrastructure"
series: "Site notes"
audience: "site maintainers"
difficulty: "intro"
category: site
tags:
  - website
  - astro
  - notes
---

The first version of this homepage was pure HTML and CSS. That was enough for a personal poster, but not enough for a growing research home.

Astro is a good fit because most pages can stay static, while the site still gets a real content layer: Markdown notes, RSS, paper metadata, and reusable layouts. The dynamic parts - GitHub repositories and contribution activity - can remain small client-side islands.

That keeps the site easy to deploy on GitHub Pages or Cloudflare Pages while making future updates feel like writing notes rather than editing a long HTML file.
