# Security Hardening

This site is static-first, but the Cloudflare Pages Worker exposes lightweight APIs for subscriptions, feedback, contact backups, site stats, and hidden admin exports. The security boundary is the Worker, not the frontend.

## Worker protections

- Runs an early anti-crawler gate before public assets are served:
  - Allows normal browser traffic and known search crawlers when Cloudflare marks them as verified bots.
  - Blocks common AI crawlers, SEO scrapers, data-mining bots, and command-line fetchers by user-agent.
  - Uses Cloudflare Bot Management score when available; very low-score traffic is denied before it reaches content.
  - Rate-limits public HTML routes, `/search.json`, `/rss.xml`, `/sitemap.xml`, `robots.txt`, and public API reads by client fingerprint.
  - Returns generic denial responses so blocked clients do not get tuning details.
- Adds browser security headers to every response: CSP, `X-Frame-Options`, `X-Content-Type-Options`, HSTS on HTTPS, referrer policy, permissions policy, and cross-origin policies.
- Ships a `public/_headers` fallback with the same baseline browser headers for Cloudflare Pages static handling.
- Blocks direct public access to `/content-health.json` and `/content-sync-report.json`; the hidden admin page reads them through protected admin APIs.
- Protects admin APIs with `Authorization: Bearer <ADMIN_TOKEN>` and rate-limits admin attempts.
- Restricts admin APIs to `GET` and rejects unknown write methods before they reach static assets.
- Blocks obvious source/config paths such as `/src/`, `/scripts/`, `/.github/`, `/.env`, `package.json`, and `wrangler.toml` if they are ever accidentally published.
- Rate-limits public mutation endpoints:
  - subscribe
  - unsubscribe
  - contact
  - feedback
  - visit metrics
- Rejects oversized request bodies and unexpected content types before parsing form data.
- Requires same-origin requests for browser-write endpoints.
- Requires same-origin `POST` requests for unsubscribe as well; public `GET` unsubscribe links still work through the token URL.
- Validates Cloudflare Turnstile for subscribe, contact, and feedback writes when `TURNSTILE_SECRET_KEY` is configured.
- Marks hidden admin/API responses and raw machine-readable feeds as `noindex`, `nofollow`, `noarchive`, and `nosnippet`.
- Keeps GitHub metadata behind `/api/github-repos`, which validates repo names, limits requests to the configured GitHub owner, caps requests to 8 repos, and caches responses in KV for 6 hours.

## Content protections

The public search index intentionally avoids full-body export. `/search.json` keeps only titles, descriptions, URLs, tags, date/status/thread metadata, headings, and short snippets. This preserves site search while preventing one-request bulk extraction of Markdown bodies.

`robots.txt` keeps general search indexing open, explicitly disallows known AI/data-mining crawlers, disallows raw internal JSON/API paths, and publishes content preference signals:

```txt
Content-Signal: search=yes, ai-train=no, ai-input=no
```

`npm run validate:content` fails the build if public Markdown contains common XSS vectors:

- raw `<script>` tags
- inline event handlers like `onclick=`
- `javascript:` URLs
- raw `<iframe>` or `<object>` tags
- unsafe frontmatter or Markdown links, including `javascript:`, `data:`, `vbscript:`, non-HTTPS external links, protocol-relative URLs, and invalid relative URLs

This matters because Obsidian content is synced into public Markdown. Keep any embeds as normal Markdown links unless a page intentionally implements a safe embed component.

## Frontend protections

- External links opened in a new tab use `rel="noopener noreferrer"`.
- Dynamic GitHub links are constrained to `https://github.com/...` before they are written into the DOM.
- Search and map UI still use small client-side render helpers, but content is escaped before insertion.

## Operational notes

- Keep `ADMIN_TOKEN` only in Cloudflare Pages environment variables and local `.env.local`.
- Set `PUBLIC_TURNSTILE_SITE_KEY` in Pages build variables and `TURNSTILE_SECRET_KEY` in Pages secrets to make write endpoints require Turnstile in production.
- Rotate `ADMIN_TOKEN` if it is ever pasted into a public page, issue, commit, screenshot, or chat transcript.
- The hidden `/admin` page is `noindex`, blocked in robots, and absent from sitemap, but it is not a login system. Treat the token as the actual secret.
- The subscription endpoint does not return an old unsubscribe token for an address that is already subscribed.
- Enable Cloudflare's AI Scrapers and Crawlers protection. If Bot Management is available, add WAF rules that allow `cf.client.bot` verified search crawlers, block AI crawler categories, and challenge low bot-score traffic outside static assets.
