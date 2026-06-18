#!/usr/bin/env node

const zoneId = process.env.CF_ZONE_ID || "";

const customRules = [
  {
    ref: "hjh_allow_verified_search_bots",
    description: "HJH: skip later bot rules for verified search crawlers",
    action: "skip",
    expression: 'cf.client.bot and cf.verified_bot_category in {"Search Engine Crawler"}',
    action_parameters: { ruleset: "current" },
  },
  {
    ref: "hjh_block_verified_ai_bots",
    description: "HJH: block verified AI, preview, and SEO crawler categories",
    action: "block",
    expression: 'cf.verified_bot_category in {"AI Crawler" "Page Preview" "Search Engine Optimization"}',
  },
  {
    ref: "hjh_block_scraper_user_agents",
    description: "HJH: block common AI, SEO, and CLI scraper user agents",
    action: "block",
    expression: [
      'lower(http.user_agent) contains "gptbot"',
      'lower(http.user_agent) contains "claudebot"',
      'lower(http.user_agent) contains "perplexitybot"',
      'lower(http.user_agent) contains "bytespider"',
      'lower(http.user_agent) contains "ahrefsbot"',
      'lower(http.user_agent) contains "semrushbot"',
      'lower(http.user_agent) contains "python-requests"',
      'lower(http.user_agent) contains "curl/"',
      'lower(http.user_agent) contains "wget/"',
    ].join(" or "),
  },
  {
    ref: "hjh_block_probe_paths",
    description: "HJH: block common probe and canary paths",
    action: "block",
    expression: [
      'http.request.uri.path contains "/.env"',
      'starts_with(http.request.uri.path, "/.git")',
      'starts_with(http.request.uri.path, "/wp-")',
      'http.request.uri.path eq "/wp-login.php"',
      'http.request.uri.path eq "/xmlrpc.php"',
      'starts_with(http.request.uri.path, "/phpmyadmin")',
      'starts_with(http.request.uri.path, "/adminer")',
      'starts_with(http.request.uri.path, "/__robots-canary-hjh")',
    ].join(" or "),
  },
  {
    ref: "hjh_log_low_bot_score",
    description: "HJH: log low bot score non-static traffic before deciding whether to block",
    action: "log",
    expression: "cf.bot_management.score lt 30 and not cf.client.bot and not cf.bot_management.static_resource",
  },
];

const rateLimitRules = [
  {
    ref: "hjh_rl_search_json",
    description: "HJH: rate limit search index reads",
    expression: 'http.request.uri.path eq "/search.json"',
    requests_per_period: 20,
    period: 600,
    mitigation_timeout: 600,
    action: "block",
  },
  {
    ref: "hjh_rl_machine_feeds",
    description: "HJH: rate limit robots, sitemap, and RSS reads",
    expression: 'http.request.uri.path in {"/rss.xml" "/sitemap.xml" "/robots.txt"}',
    requests_per_period: 60,
    period: 600,
    mitigation_timeout: 600,
    action: "block",
  },
  {
    ref: "hjh_rl_public_apis",
    description: "HJH: rate limit public API reads",
    expression: 'http.request.uri.path in {"/api/site-stats" "/api/github-repos"}',
    requests_per_period: 60,
    period: 300,
    mitigation_timeout: 600,
    action: "block",
  },
];

const payload = {
  zone_id: zoneId || "<set CF_ZONE_ID to fill this>",
  custom_ruleset: {
    name: "HJH bot defense custom rules",
    kind: "zone",
    phase: "http_request_firewall_custom",
    rules: customRules,
  },
  rate_limit_ruleset: {
    name: "HJH bot defense rate limits",
    kind: "zone",
    phase: "http_ratelimit",
    rules: rateLimitRules.map((rule) => ({
      ref: rule.ref,
      description: rule.description,
      expression: rule.expression,
      action: rule.action,
      ratelimit: {
        characteristics: ["ip.src", "cf.colo.id"],
        period: rule.period,
        requests_per_period: rule.requests_per_period,
        mitigation_timeout: rule.mitigation_timeout,
      },
    })),
  },
  notes: [
    "This script prints JSON only; it does not call the Cloudflare API.",
    "Review expressions against your plan/features before applying in the dashboard or API.",
    "Do not use Managed Challenge or CAPTCHA for this site.",
  ],
};

process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
