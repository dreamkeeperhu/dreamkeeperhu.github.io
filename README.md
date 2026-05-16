# HJH Personal Homepage

Astro-powered personal homepage for Jianheng Hu (HJH): About, CV, research, notes, Now, friends, dynamic GitHub data, RSS, dark mode, and privacy-friendly analytics hooks.

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

- Notes: `src/content/notes/*.md`
- Papers: `src/content/papers/*.md`
- Pages: `src/pages/`
- Shared layout: `src/layouts/BaseLayout.astro`
- Public CV PDF: `public/cv/jianheng-hu-cv.pdf`
- Paper PDFs: `public/papers/`

This is Obsidian + Git friendly: write Markdown in `src/content/notes`, commit, and the site renders list pages, single pages, and RSS automatically.

## Dynamic Features

- GitHub repositories: fetched client-side from the GitHub REST API.
- GitHub contribution graph: fetched client-side from a public contribution API.
- Article search: client-side filtering on `/notes`.
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
