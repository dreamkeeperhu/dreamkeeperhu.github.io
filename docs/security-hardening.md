# Security Hardening

This site is static-first, but the Cloudflare Pages Worker exposes lightweight APIs for subscriptions, feedback, contact backups, site stats, and hidden admin exports. The security boundary is the Worker, not the frontend.

## Worker protections

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
- Marks hidden admin/API responses as `no-store` and `noindex`.
- Keeps GitHub metadata behind `/api/github-repos`, which validates repo names, limits requests to the configured GitHub owner, caps requests to 8 repos, and caches responses in KV for 6 hours.

## Content protections

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
- Rotate `ADMIN_TOKEN` if it is ever pasted into a public page, issue, commit, screenshot, or chat transcript.
- The hidden `/admin` page is `noindex`, blocked in robots, and absent from sitemap, but it is not a login system. Treat the token as the actual secret.
- The subscription endpoint does not return an old unsubscribe token for an address that is already subscribed.
- Cloudflare WAF / Turnstile can be added later if spam grows, but the current setup avoids extra services.
