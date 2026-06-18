# Cloudflare WAF Bot Defense

This site keeps the source-of-truth bot policy in the Pages Worker. Cloudflare WAF should be an earlier, coarse filter only: block obvious crawler classes and probe paths, keep verified search bots, and avoid CAPTCHA or Managed Challenge.

## Recommended Dashboard Settings

- Turn on Cloudflare AI Scrapers and Crawlers blocking if available for the zone.
- Do not enable Bot Fight Mode for this site unless false-positive handling is acceptable; it cannot be skipped with WAF custom rules.
- Keep DDoS protection enabled. It is always-on at Cloudflare and does not need repository changes.

## Custom Rules

Create these in order under Security > WAF > Custom rules.

### 1. Allow Verified Search Bots

Action: Skip remaining custom bot rules

Expression:

```txt
cf.client.bot and cf.verified_bot_category in {"Search Engine Crawler"}
```

Use this first so Googlebot, Bingbot, and other verified search crawlers are not affected by the stricter rules below.

### 2. Block Verified AI/Data Bots

Action: Block

Expression:

```txt
cf.verified_bot_category in {"AI Crawler" "Page Preview" "Search Engine Optimization"}
```

If your Cloudflare plan exposes only `cf.client.bot`, skip this rule and rely on the Worker user-agent groups.

### 3. Block Known Scraper User Agents

Action: Block

Expression:

```txt
lower(http.user_agent) contains "gptbot"
or lower(http.user_agent) contains "claudebot"
or lower(http.user_agent) contains "perplexitybot"
or lower(http.user_agent) contains "bytespider"
or lower(http.user_agent) contains "ahrefsbot"
or lower(http.user_agent) contains "semrushbot"
or lower(http.user_agent) contains "python-requests"
or lower(http.user_agent) contains "curl/"
or lower(http.user_agent) contains "wget/"
```

### 4. Block Probe Paths

Action: Block

Expression:

```txt
http.request.uri.path contains "/.env"
or starts_with(http.request.uri.path, "/.git")
or starts_with(http.request.uri.path, "/wp-")
or http.request.uri.path eq "/wp-login.php"
or http.request.uri.path eq "/xmlrpc.php"
or starts_with(http.request.uri.path, "/phpmyadmin")
or starts_with(http.request.uri.path, "/adminer")
or starts_with(http.request.uri.path, "/__robots-canary-hjh")
```

### 5. Log Or Rate-Limit Low Bot Score

Action: Log first; switch to Block only after observing false positives.

Expression:

```txt
cf.bot_management.score lt 30
and not cf.client.bot
and not cf.bot_management.static_resource
```

Bot Management fields require a compatible Cloudflare plan. If unavailable, keep this rule disabled.

## Rate Limiting Rules

Create under Security > WAF > Rate limiting rules.

- `/search.json`: 20 requests per 10 minutes per IP, action Block for 10 minutes.
- `/rss.xml`, `/sitemap.xml`, `/robots.txt`: 60 requests per 10 minutes per IP, action Block for 10 minutes.
- HTML paths excluding static assets: 300 requests per 10 minutes per IP, action Block for 10 minutes.
- Public APIs `/api/site-stats` and `/api/github-repos`: 60 requests per 5 minutes per IP, action Block for 10 minutes.

## Notes

- The Worker remains authoritative because it can use signed browser proof cookies, D1 audit history, and KV risk state.
- WAF rules should avoid challenges. The site intentionally uses block/log/rate-limit only.
- Cloudflare references used while drafting: verified bot allow rules, Bot Management variables, Ruleset Engine phases, and Bot Fight Mode limitations.
