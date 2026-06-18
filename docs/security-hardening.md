# Security Hardening

This site is static-first, but the Cloudflare Pages Worker exposes lightweight APIs for subscriptions, feedback, contact backups, site stats, and hidden admin exports. The security boundary is the Worker, not the frontend.

## Worker protections

- Runs an early anti-crawler gate before public assets are served:
  - Allows normal browser traffic and known search crawlers when Cloudflare marks them as verified bots.
  - Blocks common AI crawlers, SEO scrapers, data-mining bots, and command-line fetchers by user-agent.
  - Uses Cloudflare Bot Management score when available; very low-score traffic is denied before it reaches content.
  - Drops obvious probe/trap paths such as WordPress, config, backup, dump, dependency, and traversal URLs with generic 404s.
  - Classifies each public request into allow, block, not-found, or rate-limit decisions with stable reason codes.
  - Rate-limits public HTML routes, `/search.json`, `/rss.xml`, `/sitemap.xml`, `robots.txt`, and public API reads by route-specific client fingerprints, IP hashes, UA hashes, country, and Cloudflare colo.
  - Applies stricter buckets to machine-readable surfaces and suspicious request shapes without showing a CAPTCHA or challenge to humans.
  - Tracks multi-window HTML browsing, route enumeration, and repeated 404 scans in KV; high-risk repeats are temporarily denylisted.
  - Issues an optional signed `hjh_bp` browser proof cookie when `BOT_PROOF_SECRET` is configured; the cookie lowers risk for normal same-browser reads but cannot bypass bad user agents, canaries, or probe paths.
  - Records dynamic fingerprint risk state in KV and D1 so suspicious clients move through observe, rate-limit, and deny stages instead of being over-blocked on the first weak signal.
  - Writes sampled bot-defense audit events and hourly/daily rollups into `CONTENT_OPS_DB` without storing raw IP addresses.
  - Supports hidden admin allow/block/rate-limit overrides for hashed identities, UA patterns, and path prefixes.
  - Returns generic denial responses so blocked clients do not get tuning details.
- Adds browser security headers to every response: CSP, `X-Frame-Options`, `X-Content-Type-Options`, HSTS on HTTPS, referrer policy, permissions policy, and cross-origin policies.
- Ships a `public/_headers` fallback with the same baseline browser headers for Cloudflare Pages static handling.
- Adds cache headers for static build assets, public images/fonts, HTML, search index, RSS, sitemap, and robots responses to reduce Worker/asset pressure while keeping admin and internal JSON uncached.
- Blocks direct public access to `/content-health.json`, `/content-sync-report.json`, and `/content-inventory.json`; the hidden admin page reads them through protected admin APIs.
- Protects admin APIs with `Authorization: Bearer <ADMIN_TOKEN>` and rate-limits admin attempts.
- Records hashed admin write audit events for `/api/admin/*` POST actions in `CONTENT_OPS_DB`; request bodies are not stored.
- Protects content operations APIs with the same admin token and same-origin POST checks before they write to D1.
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
- Returns stale GitHub repo metadata from KV if the live GitHub API fetch fails, reducing noisy fallback behavior and upstream retry pressure.

## Bot defense operations

The hidden admin page includes a `bot-defense` panel backed by D1 tables:

- `bot_audit_events`: sampled blocked, not-found, and rate-limited request events with hashed IP/UA/fingerprint fields.
- `bot_audit_rollups`: hourly and daily grouped counts for trend checks.
- `bot_policy_overrides`: short-lived allow, block, or rate-limit overrides.
- `bot_risk_snapshots`: latest high-risk fingerprints for denylist clearing/extending.
- `bot_canary_hits`: direct hits to robots-disallowed canary paths.
- `bot_policy_replay_runs`: replay results for testing threshold changes against recent audit samples.

This is a no-CAPTCHA defense layer. It should increase crawler cost while keeping normal page reading and verified search crawlers usable. If a legitimate client is blocked, add a temporary allow override by fingerprint or UA pattern from `/admin`.

Cloudflare WAF rules are documented in `docs/cloudflare-waf-bot-defense.md`; the repository also includes a JSON generator script that prints proposed custom/rate-limit rules without applying them.

## Site Operations

The hidden admin page includes a `site-ops` panel backed by D1 tables:

- `site_ops_events`: hashed admin write audit events and maintenance actions.
- `site_ops_maintenance_runs`: maintenance run status for health snapshots and cleanup jobs.
- `site_ops_snapshots`: point-in-time backend health snapshots.

The admin APIs under `/api/admin/site-ops/*` provide health checks, event export, old audit cleanup, and GitHub metadata cache warm/clear actions. POST actions require the same admin token and same-origin checks as the rest of the hidden admin surface.

## Content protections

The public search index intentionally avoids full-body export. `/search.json` keeps only titles, descriptions, URLs, tags, date/status/thread metadata, headings, and short snippets. This preserves site search while preventing one-request bulk extraction of Markdown bodies.

`/content-inventory.json` is generated at build time for the hidden content-ops admin APIs. The Worker blocks public access to it; it contains public content metadata, relation/link lists, artifact metadata, body hashes, and word counts, but not full Markdown bodies.

`robots.txt` keeps general search indexing open, explicitly disallows known AI/data-mining crawlers, disallows raw internal JSON/API paths, asks generic crawlers to slow down, and publishes content preference signals:

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
- Set `BOT_PROOF_SECRET` in Pages secrets to enable signed browser proof cookies for read traffic. If it is missing, the site keeps working and simply disables that proof signal.
- Rotate `ADMIN_TOKEN` if it is ever pasted into a public page, issue, commit, screenshot, or chat transcript.
- The hidden `/admin` page is `noindex`, blocked in robots, and absent from sitemap, but it is not a login system. Treat the token as the actual secret.
- The subscription endpoint does not return an old unsubscribe token for an address that is already subscribed.
- Enable Cloudflare's AI Scrapers and Crawlers protection. If Bot Management is available, add WAF rules that allow `cf.client.bot` verified search crawlers, block AI crawler categories, and log or rate-limit low bot-score traffic outside static assets. Do not use CAPTCHA or Managed Challenge for this site.
