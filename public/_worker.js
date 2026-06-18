const SUBSCRIBER_PREFIX = "subscriber:";
const UNSUBSCRIBE_PREFIX = "unsubscribe:";
const CONTACT_PREFIX = "contact:";
const FEEDBACK_PREFIX = "feedback:";
const METRIC_PREFIX = "metric:";
const RATE_LIMIT_PREFIX = "rate:";
const GITHUB_CACHE_PREFIX = "github:repos:";
const BOT_DENY_PREFIX = "bot-deny:";
const BOT_PENALTY_PREFIX = "bot-penalty:";
const BOT_AUDIT_SAMPLE_PREFIX = "bot-audit-sample:";
const BOT_ENUM_PREFIX = "bot-enum:";
const BOT_NOT_FOUND_PREFIX = "bot-404:";
const BOT_POLICY_CACHE_KEY = "bot-policy-overrides:active";
const BOT_RISK_PREFIX = "bot-risk:";
const BOT_BROWSER_PROOF_COOKIE = "hjh_bp";
const BOT_CANARY_PATH = "/__robots-canary-hjh";
const MAX_FORM_BYTES = 16 * 1024;
const MAX_ADMIN_BYTES = 2 * 1024;
const MAX_ADMIN_JSON_BYTES = 8 * 1024;
const MAX_LINK_CHECKS = 80;
const GITHUB_CACHE_SECONDS = 6 * 60 * 60;
const GITHUB_ALLOWED_OWNER = "dreamkeeperhu";
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const CONTENT_OPS_DB_ERROR = "Content ops database is not configured.";
const MAX_PUBLIC_URL_LENGTH = 2048;
const PUBLIC_HTML_CACHE_SECONDS = 60;
const PUBLIC_HTML_STALE_SECONDS = 5 * 60;
const PUBLIC_ASSET_CACHE_SECONDS = 7 * 24 * 60 * 60;
const PUBLIC_ASSET_STALE_SECONDS = 24 * 60 * 60;
const IMMUTABLE_ASSET_CACHE_SECONDS = 365 * 24 * 60 * 60;
const BOT_AUDIT_SAMPLE_SECONDS = 120;
const BOT_AUDIT_RETENTION_DAYS = 30;
const BOT_DENY_SHORT_SECONDS = 60 * 60;
const BOT_DENY_LONG_SECONDS = 24 * 60 * 60;
const BOT_ENUM_WINDOW_SECONDS = 10 * 60;
const BOT_NOT_FOUND_WINDOW_SECONDS = 10 * 60;
const BOT_POLICY_CACHE_SECONDS = 120;
const BOT_BROWSER_PROOF_SECONDS = 24 * 60 * 60;
const BOT_RISK_STATE_SECONDS = 24 * 60 * 60;
const SITE_OPS_EVENT_RETENTION_DAYS = 90;

const DEFAULT_GITHUB_REPOS = [
  "dreamkeeperhu/dreamkeeperhu.github.io",
  "dreamkeeperhu/CCHIHH_Final",
  "dreamkeeperhu/CED",
  "dreamkeeperhu/welearn-answer-filler",
];

const TRUSTED_SEARCH_BOT_PATTERNS = [
  /googlebot/i,
  /bingbot/i,
  /duckduckbot/i,
  /applebot/i,
  /slurp/i,
  /yandexbot/i,
  /baiduspider/i,
];

const CRAWLER_UA_GROUPS = [
  {
    group: "ai_crawler",
    reason: "bad_ua",
    patterns: [
      /gptbot/i,
      /chatgpt-user/i,
      /oai-searchbot/i,
      /google-extended/i,
      /applebot-extended/i,
      /duckassistbot/i,
      /claudebot/i,
      /claude-searchbot/i,
      /anthropic-ai/i,
      /claude-web/i,
      /cohere-ai/i,
      /ai2bot/i,
      /ccbot/i,
      /perplexitybot/i,
      /perplexity-user/i,
      /bytespider/i,
      /bytedance/i,
      /amazonbot/i,
      /meta-externalagent/i,
      /facebookexternalhit/i,
    ],
  },
  {
    group: "seo_scraper",
    reason: "bad_ua",
    patterns: [
      /ahrefsbot/i,
      /semrushbot/i,
      /mj12bot/i,
      /dotbot/i,
      /rogerbot/i,
      /serpstatbot/i,
      /dataforseobot/i,
      /barkrowler/i,
      /blexbot/i,
      /megaindex/i,
      /seokicks/i,
      /spbot/i,
      /linkdexbot/i,
      /netestate/i,
      /grapeshot/i,
    ],
  },
  {
    group: "data_mining",
    reason: "bad_ua",
    patterns: [
      /diffbot/i,
      /omgili/i,
      /omgilibot/i,
      /timpibot/i,
      /youbot/i,
      /petalbot/i,
      /seznambot/i,
      /seekportbot/i,
      /sogou/i,
      /exabot/i,
      /qwantify/i,
      /archive\.org_bot/i,
      /facebookbot/i,
    ],
  },
  {
    group: "cli_library",
    reason: "bad_ua",
    patterns: [
      /crawler4j/i,
      /scrapy/i,
      /curl/i,
      /wget/i,
      /python-requests/i,
      /httpclient/i,
      /libwww-perl/i,
      /go-http-client/i,
      /java\/|okhttp/i,
      /aiohttp/i,
      /node-fetch/i,
      /axios/i,
      /httpx/i,
    ],
  },
];

const BAD_CRAWLER_PATTERNS = CRAWLER_UA_GROUPS.flatMap((group) => group.patterns);

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    try {
      const blocked = await guardCrawlerRequest(request, env, context, url);
      if (blocked) {
        return withSecurityHeaders(blocked, request, url, env);
      }
      const response = await routeRequest(request, env, context, url);
      if (isAdminWriteRequest(request, url)) {
        context.waitUntil(recordAdminWriteEvent(request, env, url, response));
      }
      const postRouteBlocked = await guardPostRouteResponse(request, env, context, url, response);
      if (postRouteBlocked) {
        return withSecurityHeaders(postRouteBlocked, request, url, env);
      }
      return withSecurityHeaders(response, request, url, env);
    } catch (error) {
      console.error("worker-error", error?.stack || error?.message || error);
      return withSecurityHeaders(json({ ok: false, error: "Internal server error." }, 500), request, url, env);
    }
  },
};

async function routeRequest(request, env, context, url) {
    if (url.pathname === "/api/subscribe") {
      return request.method === "POST"
        ? handleSubscribe(request, env, url)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/unsubscribe") {
      return ["GET", "POST"].includes(request.method)
        ? handleUnsubscribe(request, env, url)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/subscribers") {
      return request.method === "GET"
        ? handleSubscriberExport(request, env)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/contacts") {
      return request.method === "GET"
        ? handleContactExport(request, env)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/feedback") {
      return request.method === "GET"
        ? handleFeedbackExport(request, env, url)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/newsletter-draft") {
      return request.method === "GET"
        ? handleNewsletterDraft(request, env, url)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/content-health") {
      return request.method === "GET"
        ? handleContentHealth(request, env, url)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/content-sync-report") {
      return request.method === "GET"
        ? handleContentSyncReport(request, env, url)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/site-ops/health") {
      return request.method === "GET"
        ? handleSiteOpsHealth(request, env, url)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/site-ops/events") {
      return request.method === "GET"
        ? handleSiteOpsEvents(request, env, url)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/site-ops/maintenance") {
      return request.method === "POST"
        ? handleSiteOpsMaintenance(request, env, url)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/site-ops/github-cache/action") {
      return request.method === "POST"
        ? handleSiteOpsGitHubCacheAction(request, env, url)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/site-ops/export") {
      return request.method === "GET"
        ? handleSiteOpsExport(request, env, url)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/content-ops/summary") {
      return request.method === "GET"
        ? handleContentOpsSummary(request, env)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/content-ops/refresh") {
      return request.method === "POST"
        ? handleContentOpsRefresh(request, env, url)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/content-ops/issues") {
      return request.method === "GET"
        ? handleContentOpsIssues(request, env, url)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/content-ops/issues/action") {
      return request.method === "POST"
        ? handleContentOpsIssueAction(request, env, url)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/content-ops/check-links") {
      return request.method === "POST"
        ? handleContentOpsCheckLinks(request, env, url)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/content-ops/link-checks") {
      return request.method === "GET"
        ? handleContentOpsLinkChecks(request, env)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/bot-defense/summary") {
      return request.method === "GET"
        ? handleBotDefenseSummary(request, env)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/bot-defense/events") {
      return request.method === "GET"
        ? handleBotDefenseEvents(request, env, url)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/bot-defense/policy") {
      return request.method === "GET"
        ? handleBotDefensePolicy(request, env)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/bot-defense/risk") {
      return request.method === "GET"
        ? handleBotDefenseRisk(request, env)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/bot-defense/denylist/action") {
      return request.method === "POST"
        ? handleBotDefenseDenylistAction(request, env, url)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/bot-defense/replay") {
      return request.method === "POST"
        ? handleBotDefenseReplay(request, env, url)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/bot-defense/export") {
      return request.method === "GET"
        ? handleBotDefenseExport(request, env, url)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/bot-defense/overrides/action") {
      return request.method === "POST"
        ? handleBotDefenseOverrideAction(request, env, url)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/admin/newsletter/issues") {
      return request.method === "GET"
        ? handleNewsletterIssues(request, env)
        : request.method === "POST"
          ? handleNewsletterIssueCreate(request, env, url)
          : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/feedback") {
      return request.method === "POST"
        ? handleFeedback(request, env, url)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/contact") {
      return request.method === "POST"
        ? handleContact(request, env, url)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/visit") {
      if (request.method !== "POST") {
        return json({ ok: false, error: "Method not allowed" }, 405);
      }
      if (!isSameOrigin(request, url)) {
        return json({ ok: false, error: "Invalid origin." }, 403);
      }
      context.waitUntil(recordVisit(request, env));
      return json({ ok: true });
    }

    if (url.pathname === "/api/site-stats") {
      return request.method === "GET"
        ? handleSiteStats(request, env)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/github-repos") {
      return request.method === "GET"
        ? handleGitHubRepos(request, env, url)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/content-health.json" || url.pathname === "/content-sync-report.json" || url.pathname === "/content-inventory.json" || isBlockedPublicPath(url.pathname)) {
      return json({ ok: false, error: "Not found." }, 404);
    }

    if (!["GET", "HEAD"].includes(request.method)) {
      return json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (isEtagedMachineReadablePath(url.pathname)) {
      return fetchEtagedAsset(request, env, url);
    }

    return env.ASSETS.fetch(request);
}

async function handleSubscribe(request, env, url) {
  if (!env.SUBSCRIBERS) {
    return json({ ok: false, error: "Subscription storage is not configured." }, 503);
  }

  const limited = await checkRateLimit(env, request, "subscribe", 5, 600);
  if (limited) return limited;

  const tooLarge = enforceBodyLimit(request, MAX_FORM_BYTES);
  if (tooLarge) return tooLarge;

  const badType = enforceContentType(request, ["application/x-www-form-urlencoded", "multipart/form-data"]);
  if (badType) return badType;

  if (!isSameOrigin(request, url)) {
    return json({ ok: false, error: "Invalid origin." }, 403);
  }

  const data = await readRequestDataSafely(request);
  if (!data) return json({ ok: false, error: "Invalid request body." }, 400);
  const honeypot = String(data.get("website") || "").trim();
  if (honeypot) {
    return json({ ok: true });
  }

  const email = normalizeEmail(data.get("email"));
  if (!email) {
    return json({ ok: false, error: "Please enter a valid email address." }, 400);
  }

  const turnstileDenied = await requireTurnstile(request, env, data);
  if (turnstileDenied) return turnstileDenied;

  const key = `${SUBSCRIBER_PREFIX}${await sha256(email)}`;
  const existing = await env.SUBSCRIBERS.get(key, "json");
  const now = new Date().toISOString();
  const token = existing?.unsubscribeToken || crypto.randomUUID();
  const tokenKey = `${UNSUBSCRIBE_PREFIX}${await sha256(token)}`;

  await env.SUBSCRIBERS.put(
    key,
    JSON.stringify({
      email,
      key,
      unsubscribeToken: token,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      source: "homepage",
    })
  );

  if (!existing) {
    await bumpMetric(env, "subscribers:total");
  }
  await env.SUBSCRIBERS.put(tokenKey, key);
  return json(existing
    ? {
        ok: true,
        message: "If this address is already subscribed, it will keep receiving occasional updates. Use the original unsubscribe link or email me for help.",
      }
    : {
        ok: true,
        message: "Subscribed.",
        unsubscribeUrl: `${url.origin}/api/unsubscribe?token=${encodeURIComponent(token)}`,
      });
}

async function handleUnsubscribe(request, env, url) {
  if (!env.SUBSCRIBERS) {
    return json({ ok: false, error: "Subscription storage is not configured." }, 503);
  }

  const limited = await checkRateLimit(env, request, "unsubscribe", 20, 600);
  if (limited) return limited;

  const tooLarge = request.method === "POST" ? enforceBodyLimit(request, MAX_ADMIN_BYTES) : null;
  if (tooLarge) return tooLarge;

  const badType = request.method === "POST" ? enforceContentType(request, ["application/x-www-form-urlencoded", "multipart/form-data"]) : null;
  if (badType) return badType;

  if (request.method === "POST" && !isSameOrigin(request, url)) {
    return json({ ok: false, error: "Invalid origin." }, 403);
  }

  const data = request.method === "POST" ? await readRequestDataSafely(request) : new URLSearchParams(url.search);
  if (!data) return json({ ok: false, error: "Invalid request body." }, 400);
  const token = String(data.get("token") || "").trim();
  if (!token) {
    return htmlPage("Unsubscribe", "Missing unsubscribe token.", 400);
  }

  const tokenKey = `${UNSUBSCRIBE_PREFIX}${await sha256(token)}`;
  const subscriberKey = await env.SUBSCRIBERS.get(tokenKey);
  if (!subscriberKey) {
    return htmlPage("Unsubscribe", "This unsubscribe link is invalid or already used.", 404);
  }

  await Promise.all([
    env.SUBSCRIBERS.delete(subscriberKey),
    env.SUBSCRIBERS.delete(tokenKey),
    bumpMetric(env, "subscribers:removed"),
    decrementMetric(env, "subscribers:total"),
  ]);

  return request.method === "POST"
    ? json({ ok: true, message: "Unsubscribed." })
    : htmlPage("Unsubscribed", "You have been removed from the notes update list.");
}

async function handleSubscriberExport(request, env) {
  if (!env.SUBSCRIBERS) {
    return json({ ok: false, error: "Subscription storage is not configured." }, 503);
  }
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  const subscribers = await readSubscribers(env);

  return json(
    { ok: true, count: subscribers.length, subscribers },
    200,
    { "Cache-Control": "no-store" }
  );
}

async function handleContactExport(request, env) {
  if (!env.CONTACT_MESSAGES) {
    return json({ ok: false, error: "Contact storage is not configured." }, 503);
  }
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  const contacts = [];
  let cursor;
  do {
    const page = await env.CONTACT_MESSAGES.list({ prefix: CONTACT_PREFIX, cursor });
    cursor = page.list_complete ? undefined : page.cursor;
    for (const key of page.keys) {
      const record = await env.CONTACT_MESSAGES.get(key.name, "json");
      if (record?.email) contacts.push(record);
    }
  } while (cursor);

  contacts.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return json(
    { ok: true, count: contacts.length, contacts },
    200,
    { "Cache-Control": "no-store" }
  );
}

async function handleFeedbackExport(request, env, url) {
  if (!env.CONTACT_MESSAGES) {
    return json({ ok: false, error: "Feedback storage is not configured." }, 503);
  }
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  const feedback = [];
  let cursor;
  do {
    const page = await env.CONTACT_MESSAGES.list({ prefix: FEEDBACK_PREFIX, cursor });
    cursor = page.list_complete ? undefined : page.cursor;
    for (const key of page.keys) {
      const record = await env.CONTACT_MESSAGES.get(key.name, "json");
      if (record?.id) feedback.push(record);
    }
  } while (cursor);

  const type = sanitizeText(url.searchParams.get("type"), 40);
  const targetType = sanitizeText(url.searchParams.get("targetType"), 40);
  const sinceValue = url.searchParams.get("since");
  const since = parseSince(sinceValue);
  const filtered = feedback
    .filter((item) => !type || item.type === type)
    .filter((item) => !targetType || item.targetType === targetType)
    .filter((item) => {
      if (!sinceValue) return true;
      const date = item.createdAt ? new Date(item.createdAt) : null;
      return date && date >= since;
    })
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return json(
    { ok: true, count: filtered.length, feedback: filtered, filters: { type, targetType, since: sinceValue || "" } },
    200,
    { "Cache-Control": "no-store" }
  );
}

async function handleContentHealth(request, env, url) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  const healthRequest = new Request(new URL("/content-health.json", url.origin).toString(), { headers: { Accept: "application/json" } });
  const healthResponse = await env.ASSETS.fetch(healthRequest);
  if (!healthResponse.ok) {
    return json({ ok: false, error: "Content health is not available." }, 503);
  }
  return json(await healthResponse.json(), 200, { "Cache-Control": "no-store" });
}

async function handleContentSyncReport(request, env, url) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  const reportRequest = new Request(new URL("/content-sync-report.json", url.origin).toString(), { headers: { Accept: "application/json" } });
  const reportResponse = await env.ASSETS.fetch(reportRequest);
  if (!reportResponse.ok) {
    return json({ ok: false, error: "Content sync report is not available." }, 503);
  }
  return json(await reportResponse.json(), 200, { "Cache-Control": "no-store" });
}

async function handleSiteOpsHealth(request, env, url) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  const payload = await buildSiteOpsHealthPayload(env, url);
  return json(payload, 200, { "Cache-Control": "no-store" });
}

async function handleSiteOpsEvents(request, env, url) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const dbDenied = requireContentOpsDb(env);
  if (dbDenied) return dbDenied;

  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") || 120)));
  const eventType = sanitizeText(url.searchParams.get("type"), 80);
  const action = sanitizeText(url.searchParams.get("action"), 80);
  const since = sanitizeDateTimeText(url.searchParams.get("since")) || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const clauses = ["event_at >= ?"];
  const values = [since];
  if (eventType) {
    clauses.push("event_type = ?");
    values.push(eventType);
  }
  if (action) {
    clauses.push("action = ?");
    values.push(action);
  }
  values.push(limit);

  const rows = await env.CONTENT_OPS_DB.prepare(
    `SELECT id, event_at, event_type, action, status_code, method, path, fingerprint, user_agent_sample, country, colo, detail_json
     FROM site_ops_events
     WHERE ${clauses.join(" AND ")}
     ORDER BY event_at DESC
     LIMIT ?`
  ).bind(...values).all();
  return json({ ok: true, count: rows.results?.length || 0, filters: { since, eventType, action, limit }, events: rows.results || [] }, 200, { "Cache-Control": "no-store" });
}

async function handleSiteOpsMaintenance(request, env, url) {
  const denied = await requireAdminAction(request, env, url);
  if (denied) return denied;
  const dbDenied = requireContentOpsDb(env);
  if (dbDenied) return dbDenied;

  const data = await readAdminJson(request, true);
  const action = sanitizeText(data?.action, 80) || "snapshot_health";
  const allowed = new Set(["snapshot_health", "cleanup_bot_audit", "cleanup_site_ops"]);
  if (!allowed.has(action)) return json({ ok: false, error: "Invalid maintenance action." }, 400, { "Cache-Control": "no-store" });

  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  await env.CONTENT_OPS_DB.prepare(
    "INSERT INTO site_ops_maintenance_runs (id, run_type, status, started_at, detail_json) VALUES (?, ?, 'running', ?, '{}')"
  ).bind(runId, action, startedAt).run();

  try {
    let detail = {};
    if (action === "snapshot_health") {
      const health = await buildSiteOpsHealthPayload(env, url);
      const snapshotId = crypto.randomUUID();
      await env.CONTENT_OPS_DB.prepare(
        "INSERT INTO site_ops_snapshots (id, snapshot_at, snapshot_type, status, summary_json, detail_json) VALUES (?, ?, 'health', ?, ?, ?)"
      ).bind(snapshotId, startedAt, health.status, stringifyJson(health.summary), stringifyJson(health)).run();
      detail = { snapshotId, status: health.status, summary: health.summary };
    } else if (action === "cleanup_bot_audit") {
      const retentionDays = Math.min(180, Math.max(7, Number(data?.retentionDays || BOT_AUDIT_RETENTION_DAYS)));
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
      const [events, canary, replay] = await Promise.all([
        env.CONTENT_OPS_DB.prepare("DELETE FROM bot_audit_events WHERE event_at < ?").bind(cutoff).run(),
        env.CONTENT_OPS_DB.prepare("DELETE FROM bot_canary_hits WHERE hit_at < ?").bind(cutoff).run().catch(() => ({ meta: { changes: 0 } })),
        env.CONTENT_OPS_DB.prepare("DELETE FROM bot_policy_replay_runs WHERE created_at < ?").bind(cutoff).run().catch(() => ({ meta: { changes: 0 } })),
      ]);
      detail = {
        retentionDays,
        cutoff,
        deleted: {
          botAuditEvents: Number(events?.meta?.changes || 0),
          botCanaryHits: Number(canary?.meta?.changes || 0),
          botPolicyReplayRuns: Number(replay?.meta?.changes || 0),
        },
      };
    } else if (action === "cleanup_site_ops") {
      const retentionDays = Math.min(365, Math.max(14, Number(data?.retentionDays || SITE_OPS_EVENT_RETENTION_DAYS)));
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
      const [events, runs, snapshots] = await Promise.all([
        env.CONTENT_OPS_DB.prepare("DELETE FROM site_ops_events WHERE event_at < ?").bind(cutoff).run(),
        env.CONTENT_OPS_DB.prepare("DELETE FROM site_ops_maintenance_runs WHERE started_at < ?").bind(cutoff).run(),
        env.CONTENT_OPS_DB.prepare("DELETE FROM site_ops_snapshots WHERE snapshot_at < ?").bind(cutoff).run(),
      ]);
      detail = {
        retentionDays,
        cutoff,
        deleted: {
          siteOpsEvents: Number(events?.meta?.changes || 0),
          siteOpsMaintenanceRuns: Number(runs?.meta?.changes || 0),
          siteOpsSnapshots: Number(snapshots?.meta?.changes || 0),
        },
      };
    }

    const finishedAt = new Date().toISOString();
    await env.CONTENT_OPS_DB.prepare(
      "UPDATE site_ops_maintenance_runs SET status = 'ok', finished_at = ?, detail_json = ? WHERE id = ?"
    ).bind(finishedAt, stringifyJson(detail), runId).run();
    return json({ ok: true, runId, action, startedAt, finishedAt, detail }, 200, { "Cache-Control": "no-store" });
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const detail = { error: sanitizeText(error?.message || "Maintenance failed.", 400) };
    await env.CONTENT_OPS_DB.prepare(
      "UPDATE site_ops_maintenance_runs SET status = 'failed', finished_at = ?, detail_json = ? WHERE id = ?"
    ).bind(finishedAt, stringifyJson(detail), runId).run().catch(() => null);
    return json({ ok: false, runId, action, error: detail.error }, 500, { "Cache-Control": "no-store" });
  }
}

async function handleSiteOpsGitHubCacheAction(request, env, url) {
  const denied = await requireAdminAction(request, env, url);
  if (denied) return denied;
  const dbDenied = requireContentOpsDb(env);
  if (dbDenied) return dbDenied;
  if (!env.SITE_METRICS) return json({ ok: false, error: "Site metrics are not configured." }, 503, { "Cache-Control": "no-store" });

  const data = await readAdminJson(request, true);
  const action = sanitizeText(data?.action, 40) || "warm";
  if (!["warm", "clear"].includes(action)) return json({ ok: false, error: "Invalid GitHub cache action." }, 400, { "Cache-Control": "no-store" });

  const repos = await resolveAdminGitHubRepos(data?.repos, env, url);
  if (!repos.length) return json({ ok: false, error: "No valid GitHub repositories found." }, 400, { "Cache-Control": "no-store" });

  if (action === "clear") {
    const deleted = await clearGitHubCache(env, repos);
    return json({ ok: true, action, repos, deleted }, 200, { "Cache-Control": "no-store" });
  }

  const payload = await warmGitHubCache(env, repos);
  return json({ ok: true, action, repos, cache: payload }, 200, { "Cache-Control": "no-store" });
}

async function handleSiteOpsExport(request, env, url) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const dbDenied = requireContentOpsDb(env);
  if (dbDenied) return dbDenied;

  const format = sanitizeText(url.searchParams.get("format"), 12) || "json";
  const target = sanitizeText(url.searchParams.get("target"), 40) || "events";
  const since = sanitizeDateTimeText(url.searchParams.get("since")) || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit") || 500)));
  const rows = await readSiteOpsExportRows(env, { target, since, limit });
  if (format === "csv") {
    return new Response(toCsvRows(rows), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="site-ops-${target}-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }
  return json({ ok: true, target, count: rows.length, filters: { since, limit }, rows }, 200, { "Cache-Control": "no-store" });
}

async function handleContentOpsSummary(request, env) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const dbDenied = requireContentOpsDb(env);
  if (dbDenied) return dbDenied;

  const [items, issueStats, openIssues, linkStats, latestLinks, latestRuns, newsletterRows] = await Promise.all([
    env.CONTENT_OPS_DB.prepare("SELECT COUNT(*) AS count FROM content_items").first(),
    env.CONTENT_OPS_DB.prepare("SELECT status, category, severity, COUNT(*) AS count FROM content_issues GROUP BY status, category, severity ORDER BY status, category, severity").all(),
    env.CONTENT_OPS_DB.prepare("SELECT * FROM content_issues WHERE status = 'open' ORDER BY severity DESC, last_seen_at DESC LIMIT 12").all(),
    env.CONTENT_OPS_DB.prepare("SELECT ok, COUNT(*) AS count FROM link_checks GROUP BY ok").all(),
    env.CONTENT_OPS_DB.prepare("SELECT * FROM link_checks ORDER BY checked_at DESC LIMIT 12").all(),
    env.CONTENT_OPS_DB.prepare("SELECT * FROM content_ops_runs ORDER BY started_at DESC LIMIT 8").all(),
    env.CONTENT_OPS_DB.prepare("SELECT id, subject, item_count, created_at, updated_at FROM newsletter_issues ORDER BY created_at DESC LIMIT 8").all(),
  ]);

  return json({
    ok: true,
    items: Number(items?.count || 0),
    issueStats: issueStats.results || [],
    openIssueCount: sumRows(issueStats.results || [], (row) => row.status === "open"),
    snoozedIssueCount: sumRows(issueStats.results || [], (row) => row.status === "snoozed"),
    openIssues: openIssues.results || [],
    linkStats: linkStats.results || [],
    latestLinks: latestLinks.results || [],
    latestRuns: latestRuns.results || [],
    newsletterIssues: newsletterRows.results || [],
    updatedAt: new Date().toISOString(),
  }, 200, { "Cache-Control": "no-store" });
}

async function handleContentOpsRefresh(request, env, url) {
  const denied = await requireAdminAction(request, env, url);
  if (denied) return denied;
  const dbDenied = requireContentOpsDb(env);
  if (dbDenied) return dbDenied;

  const startedAt = new Date().toISOString();
  const runId = crypto.randomUUID();
  await env.CONTENT_OPS_DB.prepare(
    "INSERT INTO content_ops_runs (id, run_type, status, started_at, detail_json) VALUES (?, 'refresh', 'running', ?, '{}')"
  ).bind(runId, startedAt).run();

  const [inventory, health, syncReport] = await Promise.all([
    readInternalJsonAsset(env, url, "/content-inventory.json"),
    readInternalJsonAsset(env, url, "/content-health.json"),
    readInternalJsonAsset(env, url, "/content-sync-report.json"),
  ]);
  if (!inventory?.items?.length) {
    await finishContentOpsRun(env, runId, "failed", { error: "Content inventory is not available." });
    return json({ ok: false, error: "Content inventory is not available." }, 503);
  }

  const items = inventory.items.map(normalizeInventoryItem);
  await upsertContentItems(env, items, startedAt);
  const issues = await buildContentOpsIssues(env, { items, health, syncReport, now: startedAt });
  await upsertContentIssues(env, issues, startedAt);
  await resolveMissingIssues(env, issues.map((issue) => issue.issueKey), startedAt);

  const summary = {
    items: items.length,
    issuesSeen: issues.length,
    openIssues: issues.filter((issue) => issue.status === "open").length,
    generatedAt: inventory.generatedAt || "",
  };
  await finishContentOpsRun(env, runId, "ok", summary, {
    itemsCount: items.length,
    issuesSeen: issues.length,
    issuesOpened: issues.length,
  });

  return json({ ok: true, runId, ...summary }, 200, { "Cache-Control": "no-store" });
}

async function handleContentOpsIssues(request, env, url) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const dbDenied = requireContentOpsDb(env);
  if (dbDenied) return dbDenied;

  const filters = {
    status: sanitizeText(url.searchParams.get("status"), 40),
    severity: sanitizeText(url.searchParams.get("severity"), 40),
    category: sanitizeText(url.searchParams.get("category"), 80),
    type: sanitizeText(url.searchParams.get("type"), 40),
    thread: sanitizeText(url.searchParams.get("thread"), 100),
  };
  const clauses = [];
  const values = [];
  if (filters.status) {
    clauses.push("status = ?");
    values.push(filters.status);
  }
  if (filters.severity) {
    clauses.push("severity = ?");
    values.push(filters.severity);
  }
  if (filters.category) {
    clauses.push("category = ?");
    values.push(filters.category);
  }
  if (filters.type) {
    clauses.push("content_type = ?");
    values.push(filters.type);
  }
  if (filters.thread) {
    clauses.push("content_url IN (SELECT url FROM content_items WHERE thread = ?)");
    values.push(filters.thread);
  }
  const sql = [
    "SELECT * FROM content_issues",
    clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    "ORDER BY CASE severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, last_seen_at DESC LIMIT 200",
  ].filter(Boolean).join(" ");
  const rows = await env.CONTENT_OPS_DB.prepare(sql).bind(...values).all();
  return json({ ok: true, count: rows.results?.length || 0, filters, issues: rows.results || [] }, 200, { "Cache-Control": "no-store" });
}

async function handleContentOpsIssueAction(request, env, url) {
  const denied = await requireAdminAction(request, env, url);
  if (denied) return denied;
  const dbDenied = requireContentOpsDb(env);
  if (dbDenied) return dbDenied;

  const data = await readAdminJson(request);
  if (!data) return json({ ok: false, error: "Invalid request body." }, 400);
  const id = sanitizeText(data.id, 160);
  const action = sanitizeText(data.action, 40);
  const note = sanitizeText(data.note, 600);
  const snoozeUntil = sanitizeDateText(data.snoozeUntil);
  const allowed = new Set(["resolve", "snooze", "ignore", "reopen"]);
  if (!id || !allowed.has(action)) return json({ ok: false, error: "Invalid issue action." }, 400);

  const existing = await env.CONTENT_OPS_DB.prepare("SELECT * FROM content_issues WHERE id = ?").bind(id).first();
  if (!existing) return json({ ok: false, error: "Issue not found." }, 404);

  const now = new Date().toISOString();
  const next = {
    resolve: { status: "resolved", resolvedAt: now, snoozeUntil: "" },
    snooze: { status: "snoozed", resolvedAt: "", snoozeUntil: snoozeUntil || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) },
    ignore: { status: "ignored", resolvedAt: "", snoozeUntil: "" },
    reopen: { status: "open", resolvedAt: "", snoozeUntil: "" },
  }[action];

  await env.CONTENT_OPS_DB.prepare(
    "UPDATE content_issues SET status = ?, note = ?, snooze_until = ?, resolved_at = ?, updated_at = ? WHERE id = ?"
  ).bind(next.status, note || existing.note || "", next.snoozeUntil, next.resolvedAt, now, id).run();
  const issue = await env.CONTENT_OPS_DB.prepare("SELECT * FROM content_issues WHERE id = ?").bind(id).first();
  return json({ ok: true, issue }, 200, { "Cache-Control": "no-store" });
}

async function handleContentOpsCheckLinks(request, env, url) {
  const denied = await requireAdminAction(request, env, url);
  if (denied) return denied;
  const dbDenied = requireContentOpsDb(env);
  if (dbDenied) return dbDenied;

  const data = await readAdminJson(request, true);
  const limit = Math.min(MAX_LINK_CHECKS, Math.max(1, Number(data?.limit || 40)));
  const startedAt = new Date().toISOString();
  const runId = crypto.randomUUID();
  await env.CONTENT_OPS_DB.prepare(
    "INSERT INTO content_ops_runs (id, run_type, status, started_at, detail_json) VALUES (?, 'link-check', 'running', ?, '{}')"
  ).bind(runId, startedAt).run();

  const inventory = await readInternalJsonAsset(env, url, "/content-inventory.json");
  if (!inventory?.items?.length) {
    await finishContentOpsRun(env, runId, "failed", { error: "Content inventory is not available." });
    return json({ ok: false, error: "Content inventory is not available." }, 503);
  }

  const targets = collectLinkTargets(inventory.items.map(normalizeInventoryItem)).slice(0, limit);
  const checked = [];
  for (const target of targets) {
    const result = await checkLinkTarget(target, env, url);
    checked.push(result);
    await upsertLinkCheck(env, result);
    if (result.ok) {
      await resolveIssueByKey(env, brokenLinkIssueKey(result.contentUrl, result.href), result.checkedAt);
    } else {
      await upsertContentIssues(env, [await makeIssue({
        category: "broken_link",
        severity: result.linkType === "local" ? "high" : "medium",
        contentId: result.contentId,
        contentUrl: result.contentUrl,
        contentType: result.contentType,
        title: result.title,
        message: `Broken ${result.linkType} link: ${result.href}`,
        detail: { href: result.href, linkType: result.linkType, statusCode: result.statusCode, error: result.error },
        issueKey: brokenLinkIssueKey(result.contentUrl, result.href),
      })], result.checkedAt);
    }
  }

  const failed = checked.filter((row) => !row.ok).length;
  await finishContentOpsRun(env, runId, "ok", { checked: checked.length, failed }, { linksChecked: checked.length });
  return json({ ok: true, runId, checked: checked.length, failed, links: checked }, 200, { "Cache-Control": "no-store" });
}

async function handleContentOpsLinkChecks(request, env) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const dbDenied = requireContentOpsDb(env);
  if (dbDenied) return dbDenied;

  const rows = await env.CONTENT_OPS_DB.prepare("SELECT * FROM link_checks ORDER BY checked_at DESC LIMIT 200").all();
  return json({ ok: true, count: rows.results?.length || 0, links: rows.results || [] }, 200, { "Cache-Control": "no-store" });
}

async function handleBotDefenseSummary(request, env) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const dbDenied = requireContentOpsDb(env);
  if (dbDenied) return dbDenied;

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [actions24h, reasons24h, recentEvents, activePolicy, dayRollups] = await Promise.all([
    env.CONTENT_OPS_DB.prepare("SELECT action, status_code, COUNT(*) AS count FROM bot_audit_events WHERE event_at >= ? GROUP BY action, status_code ORDER BY count DESC").bind(since24h).all(),
    env.CONTENT_OPS_DB.prepare("SELECT reason, COUNT(*) AS count FROM bot_audit_events WHERE event_at >= ? GROUP BY reason ORDER BY count DESC LIMIT 12").bind(since24h).all(),
    env.CONTENT_OPS_DB.prepare("SELECT * FROM bot_audit_events ORDER BY event_at DESC LIMIT 20").all(),
    env.CONTENT_OPS_DB.prepare("SELECT id, kind, value, action, note, expires_at, created_at, updated_at FROM bot_policy_overrides WHERE expires_at = '' OR expires_at > ? ORDER BY updated_at DESC LIMIT 80").bind(new Date().toISOString()).all(),
    env.CONTENT_OPS_DB.prepare("SELECT bucket, action, reason, path_group, SUM(event_count) AS count FROM bot_audit_rollups WHERE granularity = 'day' AND bucket >= ? GROUP BY bucket, action, reason, path_group ORDER BY bucket DESC, count DESC LIMIT 80").bind(since7d.slice(0, 10)).all(),
  ]);

  const denylistSamples = await readBotDenylistSamples(env);
  return json({
    ok: true,
    actions24h: actions24h.results || [],
    reasons24h: reasons24h.results || [],
    recentEvents: recentEvents.results || [],
    activePolicy: activePolicy.results || [],
    dayRollups: dayRollups.results || [],
    denylistSamples,
    updatedAt: new Date().toISOString(),
  }, 200, { "Cache-Control": "no-store" });
}

async function handleBotDefenseEvents(request, env, url) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const dbDenied = requireContentOpsDb(env);
  if (dbDenied) return dbDenied;

  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") || 120)));
  const action = sanitizeText(url.searchParams.get("action"), 40);
  const reason = sanitizeText(url.searchParams.get("reason"), 80);
  const since = sanitizeDateTimeText(url.searchParams.get("since")) || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const clauses = ["event_at >= ?"];
  const values = [since];
  if (action) {
    clauses.push("action = ?");
    values.push(action);
  }
  if (reason) {
    clauses.push("reason = ?");
    values.push(reason);
  }
  values.push(limit);
  const rows = await env.CONTENT_OPS_DB.prepare(
    `SELECT * FROM bot_audit_events WHERE ${clauses.join(" AND ")} ORDER BY event_at DESC LIMIT ?`
  ).bind(...values).all();
  return json({ ok: true, count: rows.results?.length || 0, filters: { action, reason, since, limit }, events: rows.results || [] }, 200, { "Cache-Control": "no-store" });
}

async function handleBotDefensePolicy(request, env) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const dbDenied = requireContentOpsDb(env);
  if (dbDenied) return dbDenied;

  const rows = await env.CONTENT_OPS_DB.prepare(
    "SELECT id, kind, value, action, note, expires_at, created_at, updated_at FROM bot_policy_overrides ORDER BY updated_at DESC LIMIT 200"
  ).all();
  return json({ ok: true, count: rows.results?.length || 0, overrides: rows.results || [] }, 200, { "Cache-Control": "no-store" });
}

async function handleBotDefenseRisk(request, env) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const dbDenied = requireContentOpsDb(env);
  if (dbDenied) return dbDenied;

  const rows = await env.CONTENT_OPS_DB.prepare(
    "SELECT * FROM bot_risk_snapshots ORDER BY risk_score DESC, updated_at DESC LIMIT 200"
  ).all();
  const canary = await env.CONTENT_OPS_DB.prepare(
    "SELECT * FROM bot_canary_hits ORDER BY hit_at DESC LIMIT 50"
  ).all();
  return json({
    ok: true,
    count: rows.results?.length || 0,
    risks: rows.results || [],
    canaryHits: canary.results || [],
    denylistSamples: await readBotDenylistSamples(env),
    updatedAt: new Date().toISOString(),
  }, 200, { "Cache-Control": "no-store" });
}

async function handleBotDefenseDenylistAction(request, env, url) {
  const denied = await requireAdminAction(request, env, url);
  if (denied) return denied;
  const dbDenied = requireContentOpsDb(env);
  if (dbDenied) return dbDenied;
  if (!env.SITE_METRICS) return json({ ok: false, error: "Site metrics are not configured." }, 503);

  const data = await readAdminJson(request);
  if (!data) return json({ ok: false, error: "Invalid request body." }, 400);
  const fingerprint = sanitizeHashText(data.fingerprint);
  const action = sanitizeText(data.action, 40);
  const note = sanitizeText(data.note, 400);
  const ttlSeconds = Math.min(BOT_DENY_LONG_SECONDS * 7, Math.max(60, Number(data.ttlSeconds || BOT_DENY_SHORT_SECONDS)));
  if (!fingerprint || !["clear", "extend"].includes(action)) return json({ ok: false, error: "Invalid denylist action." }, 400);

  const key = `${BOT_DENY_PREFIX}${fingerprint}`;
  const now = new Date().toISOString();
  if (action === "clear") {
    await Promise.all([
      env.SITE_METRICS.delete(key),
      env.SITE_METRICS.delete(`${BOT_PENALTY_PREFIX}${fingerprint}`),
      env.SITE_METRICS.delete(`${BOT_RISK_PREFIX}${fingerprint}`),
      env.CONTENT_OPS_DB.prepare("UPDATE bot_risk_snapshots SET deny_until = '', note = ?, updated_at = ? WHERE fingerprint = ?").bind(note || "denylist cleared", now, fingerprint).run(),
    ]);
    return json({ ok: true, action, fingerprint }, 200, { "Cache-Control": "no-store" });
  }

  const until = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  await Promise.all([
    env.SITE_METRICS.put(key, JSON.stringify({ reasons: ["admin_extend"], riskScore: 100, until, note }), { expirationTtl: ttlSeconds }),
    env.CONTENT_OPS_DB.prepare(
      `INSERT INTO bot_risk_snapshots (fingerprint, risk_score, failure_count, last_action, last_status, last_reason, reasons_json, path_groups_json, deny_until, note, updated_at)
       VALUES (?, 100, 0, 'block', 403, 'admin_extend', '["admin_extend"]', '[]', ?, ?, ?)
       ON CONFLICT(fingerprint) DO UPDATE SET
         risk_score = 100,
         last_action = 'block',
         last_status = 403,
         last_reason = 'admin_extend',
         deny_until = excluded.deny_until,
         note = excluded.note,
         updated_at = excluded.updated_at`
    ).bind(fingerprint, until, note, now).run(),
  ]);
  return json({ ok: true, action, fingerprint, until }, 200, { "Cache-Control": "no-store" });
}

async function handleBotDefenseReplay(request, env, url) {
  const denied = await requireAdminAction(request, env, url);
  if (denied) return denied;
  const dbDenied = requireContentOpsDb(env);
  if (dbDenied) return dbDenied;

  const data = await readAdminJson(request, true);
  const since = sanitizeDateTimeText(data?.since) || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const sampleLimit = Math.min(1000, Math.max(10, Number(data?.sampleLimit || 250)));
  const thresholds = {
    rateLimitScore: Math.min(100, Math.max(1, Number(data?.thresholds?.rateLimitScore || 70))),
    blockScore: Math.min(100, Math.max(1, Number(data?.thresholds?.blockScore || 95))),
    denyReasons: Array.isArray(data?.thresholds?.denyReasons) ? data.thresholds.denyReasons.map((reason) => sanitizeText(reason, 80)).filter(Boolean) : ["bad_ua", "robots_canary", "honeytrap", "probe_path"],
  };
  const rows = await env.CONTENT_OPS_DB.prepare(
    "SELECT id, event_at, action, status_code, risk_score, reason, route_group, path_group, fingerprint FROM bot_audit_events WHERE event_at >= ? ORDER BY event_at DESC LIMIT ?"
  ).bind(since, sampleLimit).all();
  const events = rows.results || [];
  const result = events.reduce((acc, event) => {
    const wouldBlock = Number(event.risk_score || 0) >= thresholds.blockScore || thresholds.denyReasons.includes(event.reason);
    const wouldRateLimit = !wouldBlock && Number(event.risk_score || 0) >= thresholds.rateLimitScore;
    if (wouldBlock) acc.wouldBlock += 1;
    else if (wouldRateLimit) acc.wouldRateLimit += 1;
    else acc.wouldAllow += 1;
    acc.byReason[event.reason] = (acc.byReason[event.reason] || 0) + 1;
    return acc;
  }, { sampled: events.length, wouldBlock: 0, wouldRateLimit: 0, wouldAllow: 0, byReason: {} });
  const now = new Date().toISOString();
  const runId = crypto.randomUUID();
  await env.CONTENT_OPS_DB.prepare(
    "INSERT INTO bot_policy_replay_runs (id, created_at, since_at, sample_limit, thresholds_json, result_json) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(runId, now, since, sampleLimit, stringifyJson(thresholds), stringifyJson(result)).run();
  return json({ ok: true, runId, since, sampleLimit, thresholds, result }, 200, { "Cache-Control": "no-store" });
}

async function handleBotDefenseExport(request, env, url) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const dbDenied = requireContentOpsDb(env);
  if (dbDenied) return dbDenied;

  const format = sanitizeText(url.searchParams.get("format"), 12) || "json";
  const since = sanitizeDateTimeText(url.searchParams.get("since")) || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit") || 500)));
  const rows = await env.CONTENT_OPS_DB.prepare(
    "SELECT event_at, action, status_code, risk_score, reason, route_group, path_group, fingerprint, user_agent_sample, country, colo FROM bot_audit_events WHERE event_at >= ? ORDER BY event_at DESC LIMIT ?"
  ).bind(since, limit).all();
  const events = rows.results || [];
  if (format === "csv") {
    return new Response(toCsvRows(events), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="bot-defense-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }
  return json({ ok: true, count: events.length, filters: { since, limit }, events }, 200, { "Cache-Control": "no-store" });
}

async function handleBotDefenseOverrideAction(request, env, url) {
  const denied = await requireAdminAction(request, env, url);
  if (denied) return denied;
  const dbDenied = requireContentOpsDb(env);
  if (dbDenied) return dbDenied;

  const data = await readAdminJson(request);
  if (!data) return json({ ok: false, error: "Invalid request body." }, 400);
  const action = sanitizeText(data.action, 40);
  const id = sanitizeText(data.id, 120);
  const allowedActions = new Set(["allow", "block", "rate_limit", "delete"]);
  if (!allowedActions.has(action)) return json({ ok: false, error: "Invalid bot policy action." }, 400);

  const now = new Date().toISOString();
  if (action === "delete") {
    if (!id) return json({ ok: false, error: "Missing override id." }, 400);
    await env.CONTENT_OPS_DB.prepare("DELETE FROM bot_policy_overrides WHERE id = ?").bind(id).run();
    await refreshBotPolicyCache(env);
    return json({ ok: true, deleted: id }, 200, { "Cache-Control": "no-store" });
  }

  const kind = sanitizeText(data.kind, 40);
  const value = sanitizePolicyValue(kind, data.value);
  const note = sanitizeText(data.note, 400);
  const expiresAt = sanitizeDateTimeText(data.expiresAt) || "";
  const allowedKinds = new Set(["ip_hash", "ua_pattern", "path_prefix", "fingerprint"]);
  if (!allowedKinds.has(kind) || !value) return json({ ok: false, error: "Invalid bot policy override." }, 400);
  if (kind === "ua_pattern" && !isSafeRegex(value)) return json({ ok: false, error: "Invalid UA pattern." }, 400);

  const overrideId = id || `bot-policy:${await sha256(`${kind}:${value}`)}`;
  await env.CONTENT_OPS_DB.prepare(
    `INSERT INTO bot_policy_overrides (id, kind, value, action, note, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       kind = excluded.kind,
       value = excluded.value,
       action = excluded.action,
       note = excluded.note,
       expires_at = excluded.expires_at,
       updated_at = excluded.updated_at`
  ).bind(overrideId, kind, value, action, note, expiresAt, now, now).run();
  await refreshBotPolicyCache(env);
  const override = await env.CONTENT_OPS_DB.prepare("SELECT * FROM bot_policy_overrides WHERE id = ?").bind(overrideId).first();
  return json({ ok: true, override }, 200, { "Cache-Control": "no-store" });
}

async function handleNewsletterIssues(request, env) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const dbDenied = requireContentOpsDb(env);
  if (dbDenied) return dbDenied;

  const rows = await env.CONTENT_OPS_DB.prepare("SELECT id, subject, filters_json, items_json, item_count, created_at, updated_at FROM newsletter_issues ORDER BY created_at DESC LIMIT 80").all();
  return json({ ok: true, count: rows.results?.length || 0, issues: rows.results || [] }, 200, { "Cache-Control": "no-store" });
}

async function handleNewsletterIssueCreate(request, env, url) {
  const denied = await requireAdminAction(request, env, url);
  if (denied) return denied;
  const dbDenied = requireContentOpsDb(env);
  if (dbDenied) return dbDenied;

  const data = await readAdminJson(request);
  if (!data) return json({ ok: false, error: "Invalid request body." }, 400);
  const subject = sanitizeText(data.subject, 180);
  if (!subject) return json({ ok: false, error: "Newsletter subject is required." }, 400);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const items = Array.isArray(data.items) ? data.items.slice(0, 30) : [];
  await env.CONTENT_OPS_DB.prepare(
    "INSERT INTO newsletter_issues (id, subject, markdown, text, filters_json, items_json, item_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    id,
    subject,
    sanitizeLongText(data.markdown, 20000),
    sanitizeLongText(data.text, 20000),
    stringifyJson(data.filters || {}),
    stringifyJson(items),
    items.length,
    now,
    now
  ).run();
  return json({ ok: true, id, subject, itemCount: items.length, createdAt: now }, 200, { "Cache-Control": "no-store" });
}

async function handleNewsletterDraft(request, env, url) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  const since = parseSince(url.searchParams.get("since"));
  const indexRequest = new Request(new URL("/search.json", url.origin).toString(), { headers: { Accept: "application/json" } });
  const indexResponse = await env.ASSETS.fetch(indexRequest);
  if (!indexResponse.ok) {
    return json({ ok: false, error: "Search index is not available." }, 503);
  }

  const allItems = await indexResponse.json();
  const typeFilter = sanitizeText(url.searchParams.get("type"), 40);
  const threadFilter = sanitizeText(url.searchParams.get("thread"), 80);
  const publishTypes = new Set(typeFilter && ["note", "paper", "project"].includes(typeFilter) ? [typeFilter] : ["note", "paper", "project"]);
  const recent = allItems
    .filter((item) => publishTypes.has(item.type))
    .filter((item) => !threadFilter || item.thread === threadFilter || (item.tags || []).includes(threadFilter))
    .filter((item) => {
      const date = parseItemDate(item.date);
      return date && date >= since;
    })
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const items = (recent.length ? recent : allItems.filter((item) => publishTypes.has(item.type))).slice(0, 9);
  const subscribers = env.SUBSCRIBERS ? await readSubscribers(env) : [];
  const today = new Date().toISOString().slice(0, 10);
  const subject = `HJH research update - ${today}`;
  const subjectCandidates = [
    subject,
    `HJH notes: ${items[0]?.title || today}`,
    threadFilter ? `HJH research thread: ${threadFilter}` : `HJH public research notes - ${today}`,
  ];
  const groups = {
    notes: items.filter((item) => item.type === "note"),
    research: items.filter((item) => item.type === "paper"),
    projects: items.filter((item) => item.type === "project"),
  };
  const markdown = [
    `# ${subject}`,
    "",
    "Hi,",
    "",
    "Here are the latest public notes, research entries, and project traces from jianhenghu.com.",
    "",
    ...newsletterSection("Notes", groups.notes, url.origin),
    ...newsletterSection("Research", groups.research, url.origin),
    ...newsletterSection("Projects", groups.projects, url.origin),
    "",
    "Best,",
    "Jianheng Hu",
    "",
    "You can unsubscribe using the link returned when you subscribed, or reply to this email.",
  ].join("\n");
  const text = [
    subject,
    "",
    "Hi,",
    "",
    "Latest public updates from jianhenghu.com:",
    "",
    ...plainNewsletterSection("Notes", groups.notes, url.origin),
    ...plainNewsletterSection("Research", groups.research, url.origin),
    ...plainNewsletterSection("Projects", groups.projects, url.origin),
    "",
    "Best,",
    "Jianheng Hu",
  ].join("\n");

  return json(
    {
      ok: true,
      since: since.toISOString().slice(0, 10),
      subscriberCount: subscribers.length,
      subject,
      subjectCandidates,
      text,
      markdown,
      groups,
      items,
      filters: { type: typeFilter || "all", thread: threadFilter || "" },
    },
    200,
    { "Cache-Control": "no-store" }
  );
}

async function handleGitHubRepos(request, env, url) {
  const limited = await checkRateLimit(env, request, "github", 60, 300);
  if (limited) return limited;

  const requested = String(url.searchParams.get("repos") || "")
    .split(",")
    .map((repo) => repo.trim())
    .filter(Boolean)
    .filter((repo) => /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo))
    .filter((repo) => allowedGitHubRepo(repo))
    .slice(0, 8);
  if (!requested.length) {
    return json({ ok: false, error: "Provide repos=owner/name,owner/name." }, 400);
  }

  const cacheKey = `${GITHUB_CACHE_PREFIX}${await sha256(requested.join(","))}`;
  const staleKey = `${cacheKey}:stale`;
  let stalePayload = null;
  if (env.SITE_METRICS) {
    const cached = await env.SITE_METRICS.get(cacheKey, "json");
    if (cached?.repos?.length) {
      return json({ ...cached, cached: true }, 200, { "Cache-Control": "public, max-age=300" });
    }
    stalePayload = await env.SITE_METRICS.get(staleKey, "json").catch(() => null);
  }

  const repos = await Promise.all(requested.map(fetchGitHubRepo));
  if (stalePayload?.repos?.length && repos.some((repo) => repo?.ok === false)) {
    return json({ ...stalePayload, cached: true, stale: true }, 200, { "Cache-Control": "public, max-age=120" });
  }

  const payload = {
    ok: true,
    cached: false,
    stale: false,
    fetchedAt: new Date().toISOString(),
    cacheTtlSeconds: GITHUB_CACHE_SECONDS,
    repos,
  };
  if (env.SITE_METRICS) {
    await env.SITE_METRICS.put(cacheKey, JSON.stringify(payload), { expirationTtl: GITHUB_CACHE_SECONDS });
    await env.SITE_METRICS.put(staleKey, JSON.stringify(payload));
    await env.SITE_METRICS.put(`${METRIC_PREFIX}github:latest`, JSON.stringify({ fetchedAt: payload.fetchedAt, repos: repos.length }));
  }
  return json(payload, 200, { "Cache-Control": "public, max-age=300" });
}

async function fetchGitHubRepo(fullName) {
  try {
    const response = await fetch(`https://api.github.com/repos/${fullName}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "jianhenghu-homepage",
      },
    });
    if (!response.ok) throw new Error("GitHub API unavailable");
    const repo = await response.json();
    return {
      ok: true,
      source: "github",
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      htmlUrl: repo.html_url,
      language: repo.language,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      updatedAt: repo.updated_at,
      pushedAt: repo.pushed_at,
      archived: repo.archived,
    };
  } catch {
    const name = fullName.split("/").pop();
    return {
      ok: false,
      source: "curated-fallback",
      name,
      fullName,
      description: "Curated project metadata is available on the local project page.",
      htmlUrl: `https://github.com/${fullName}`,
      language: "Code",
      stars: null,
      forks: null,
      updatedAt: null,
      pushedAt: null,
      archived: false,
    };
  }
}

function newsletterSection(title, items, origin) {
  if (!items.length) return [];
  return [
    `## ${title}`,
    "",
    ...items.flatMap((item) => [
      `- **${item.title}**`,
      `  ${origin}${item.url}`,
      `  ${item.description}`,
    ]),
    "",
  ];
}

function plainNewsletterSection(title, items, origin) {
  if (!items.length) return [];
  return [
    `${title}:`,
    ...items.flatMap((item) => [
      `- ${item.title}`,
      `  ${origin}${item.url}`,
      `  ${item.description}`,
    ]),
    "",
  ];
}

async function handleContact(request, env, url) {
  const limited = await checkRateLimit(env, request, "contact", 5, 600);
  if (limited) return limited;

  const tooLarge = enforceBodyLimit(request, MAX_FORM_BYTES);
  if (tooLarge) return tooLarge;

  const badType = enforceContentType(request, ["application/x-www-form-urlencoded", "multipart/form-data"]);
  if (badType) return badType;

  if (!isSameOrigin(request, url)) {
    return json({ ok: false, error: "Invalid origin." }, 403);
  }

  const data = await readRequestDataSafely(request);
  if (!data) return json({ ok: false, error: "Invalid request body." }, 400);
  const honeypot = String(data.get("website") || "").trim();
  if (honeypot) return json({ ok: true, message: "Contact backup saved." });

  const email = normalizeEmail(data.get("email"));
  const intent = sanitizeText(data.get("intent"), 80);
  const message = sanitizeText(data.get("message"), 2400);
  if (!email || !intent || !message) {
    return json({ ok: false, error: "Please fill in intent, email, and message." }, 400);
  }

  const turnstileDenied = await requireTurnstile(request, env, data);
  if (turnstileDenied) return turnstileDenied;

  if (env.CONTACT_MESSAGES) {
    const id = crypto.randomUUID();
    await env.CONTACT_MESSAGES.put(
      `${CONTACT_PREFIX}${id}`,
      JSON.stringify({
        id,
        email,
        intent,
        message,
        createdAt: new Date().toISOString(),
      })
    );
  }

  await bumpMetric(env, "contact:total");
  return json({ ok: true, message: "Contact backup saved." });
}

async function handleFeedback(request, env, url) {
  const limited = await checkRateLimit(env, request, "feedback", 20, 600);
  if (limited) return limited;

  const tooLarge = enforceBodyLimit(request, MAX_FORM_BYTES);
  if (tooLarge) return tooLarge;

  const badType = enforceContentType(request, ["application/x-www-form-urlencoded", "multipart/form-data"]);
  if (badType) return badType;

  if (!isSameOrigin(request, url)) {
    return json({ ok: false, error: "Invalid origin." }, 403);
  }

  const data = await readRequestDataSafely(request);
  if (!data) return json({ ok: false, error: "Invalid request body." }, 400);
  const honeypot = String(data.get("website") || "").trim();
  if (honeypot) return json({ ok: true });

  const allowedTypes = new Set(["useful", "confusing", "question", "collaboration"]);
  const allowedTargetTypes = new Set(["paper", "project", "note", "library"]);
  const type = sanitizeText(data.get("type"), 40);
  const targetType = sanitizeText(data.get("targetType"), 40);
  const targetTitle = sanitizeText(data.get("targetTitle"), 220);
  const targetUrl = sanitizePath(data.get("targetUrl"));
  const message = sanitizeText(data.get("message"), 1200);
  const email = normalizeEmail(data.get("email"));

  if (!allowedTypes.has(type) || !allowedTargetTypes.has(targetType) || !targetTitle || !isPublicContentPath(targetUrl)) {
    return json({ ok: false, error: "Feedback is missing required fields." }, 400);
  }

  const turnstileDenied = await requireTurnstile(request, env, data);
  if (turnstileDenied) return turnstileDenied;

  if (env.CONTACT_MESSAGES) {
    const id = crypto.randomUUID();
    await env.CONTACT_MESSAGES.put(
      `${FEEDBACK_PREFIX}${id}`,
      JSON.stringify({
        id,
        type,
        targetType,
        targetTitle,
        targetUrl,
        message,
        email,
        userAgent: sanitizeText(request.headers.get("user-agent"), 220),
        createdAt: new Date().toISOString(),
      })
    );
  }

  await bumpMetric(env, "feedback:total");
  return json({ ok: true, message: "Feedback saved." });
}

async function readSubscribers(env) {
  const subscribers = [];
  let cursor;
  do {
    const page = await env.SUBSCRIBERS.list({ prefix: SUBSCRIBER_PREFIX, cursor });
    cursor = page.list_complete ? undefined : page.cursor;
    for (const key of page.keys) {
      const record = await env.SUBSCRIBERS.get(key.name, "json");
      if (record?.email) {
        subscribers.push({
          email: record.email,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          source: record.source,
        });
      }
    }
  } while (cursor);
  subscribers.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  return subscribers;
}

async function recordVisit(request, env) {
  if (!env.SITE_METRICS) return;
  const score = botScore(request);
  if (isKnownBadCrawler(request) || (score > 0 && score <= 30)) return;

  const limited = await checkRateLimit(env, request, "visit", 120, 60);
  if (limited) return;

  const tooLarge = enforceBodyLimit(request, 1024);
  if (tooLarge) return;

  const badType = enforceContentType(request, ["application/json", "text/plain"]);
  if (badType) return;

  const data = await readRequestData(request).catch(() => new Map());
  const path = sanitizePath(data.get("path"));
  const today = new Date().toISOString().slice(0, 10);

  await Promise.all([
    bumpMetric(env, "views:all"),
    bumpMetric(env, `views:day:${today}`),
    bumpMetric(env, `views:path:${path}`),
  ]);
}

async function handleSiteStats(request, env) {
  if (!env.SITE_METRICS) {
    return json({ ok: false, error: "Site metrics are not configured." }, 503);
  }

  const today = new Date().toISOString().slice(0, 10);
  const [views, viewsToday, subscribers, topPaths] = await Promise.all([
    readMetric(env, "views:all"),
    readMetric(env, `views:day:${today}`),
    readMetric(env, "subscribers:total"),
    readTopPaths(env),
  ]);
  const githubCache = await env.SITE_METRICS.get(`${METRIC_PREFIX}github:latest`, "json").catch(() => null);
  const payload = { ok: true, views, viewsToday, subscribers, topPaths, githubCache, updatedAt: new Date().toISOString() };
  const etag = `"stats-${await sha256(JSON.stringify({ views, viewsToday, subscribers, topPaths, githubCache }))}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  }

  return json(
    payload,
    200,
    { "Cache-Control": "public, max-age=60, stale-while-revalidate=300", ETag: etag }
  );
}

async function buildSiteOpsHealthPayload(env, url) {
  const now = new Date().toISOString();
  const bindingChecks = [
    siteOpsCheck("binding", "ADMIN_TOKEN", Boolean(env.ADMIN_TOKEN), true),
    siteOpsCheck("binding", "SUBSCRIBERS", Boolean(env.SUBSCRIBERS), true),
    siteOpsCheck("binding", "SITE_METRICS", Boolean(env.SITE_METRICS), true),
    siteOpsCheck("binding", "CONTACT_MESSAGES", Boolean(env.CONTACT_MESSAGES), true),
    siteOpsCheck("binding", "CONTENT_OPS_DB", Boolean(env.CONTENT_OPS_DB), true),
    siteOpsCheck("secret", "BOT_PROOF_SECRET", Boolean(env.BOT_PROOF_SECRET), false),
    siteOpsCheck("secret", "TURNSTILE_SECRET_KEY", Boolean(env.TURNSTILE_SECRET_KEY), false),
  ];
  const assetChecks = await Promise.all([
    checkSiteAsset(env, url, "/search.json", "application/json"),
    checkSiteAsset(env, url, "/rss.xml", "application/rss+xml, application/xml, text/xml"),
    checkSiteAsset(env, url, "/sitemap.xml", "application/xml, text/xml"),
    checkSiteAsset(env, url, "/robots.txt", "text/plain"),
    checkSiteAsset(env, url, "/content-health.json", "application/json"),
    checkSiteAsset(env, url, "/content-sync-report.json", "application/json"),
    checkSiteAsset(env, url, "/content-inventory.json", "application/json"),
  ]);
  const [d1, kv, githubCache] = await Promise.all([
    buildSiteOpsD1Health(env),
    buildSiteOpsKvHealth(env),
    readGitHubCacheSummary(env),
  ]);
  const checks = [...bindingChecks, ...assetChecks, ...d1.checks, ...kv.checks];
  const requiredFailures = checks.filter((check) => check.required && check.status !== "ok");
  const warnings = checks.filter((check) => !check.required && check.status !== "ok");
  const status = requiredFailures.length ? "degraded" : warnings.length ? "warning" : "ok";
  return {
    ok: true,
    status,
    generatedAt: now,
    summary: {
      requiredFailures: requiredFailures.length,
      warnings: warnings.length,
      d1Tables: d1.tables.length,
      kvPrefixes: kv.prefixes.length,
      githubCacheEntries: githubCache.entries.length,
    },
    checks,
    d1,
    kv,
    githubCache,
  };
}

function siteOpsCheck(category, name, ok, required, detail = {}) {
  return {
    category,
    name,
    status: ok ? "ok" : required ? "missing" : "optional_missing",
    required,
    detail,
  };
}

async function checkSiteAsset(env, url, path, accept) {
  try {
    const response = await env.ASSETS.fetch(new Request(new URL(path, url.origin).toString(), { headers: { Accept: accept } }));
    return siteOpsCheck("asset", path, response.ok, true, {
      status: response.status,
      contentType: response.headers.get("content-type") || "",
      cacheControl: response.headers.get("cache-control") || "",
      contentLength: response.headers.get("content-length") || "",
    });
  } catch (error) {
    return siteOpsCheck("asset", path, false, true, { error: sanitizeText(error?.message || "asset check failed", 240) });
  }
}

async function buildSiteOpsD1Health(env) {
  if (!env.CONTENT_OPS_DB) {
    return { configured: false, tables: [], checks: [siteOpsCheck("d1", "CONTENT_OPS_DB", false, true)] };
  }
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const tableSpecs = [
    ["content_items", "SELECT COUNT(*) AS count FROM content_items"],
    ["content_issues_open", "SELECT COUNT(*) AS count FROM content_issues WHERE status = 'open'"],
    ["link_checks", "SELECT COUNT(*) AS count FROM link_checks"],
    ["newsletter_issues", "SELECT COUNT(*) AS count FROM newsletter_issues"],
    ["bot_audit_events_24h", "SELECT COUNT(*) AS count FROM bot_audit_events WHERE event_at >= ?", [since24h]],
    ["bot_risk_snapshots", "SELECT COUNT(*) AS count FROM bot_risk_snapshots"],
    ["site_ops_events_24h", "SELECT COUNT(*) AS count FROM site_ops_events WHERE event_at >= ?", [since24h]],
    ["site_ops_maintenance_runs", "SELECT COUNT(*) AS count FROM site_ops_maintenance_runs"],
    ["site_ops_snapshots", "SELECT COUNT(*) AS count FROM site_ops_snapshots"],
  ];
  const tables = [];
  const checks = [];
  for (const [name, sql, binds = []] of tableSpecs) {
    const result = await safeD1First(env, sql, binds);
    tables.push({ name, count: Number(result.row?.count || 0), ok: result.ok, error: result.error || "" });
    checks.push(siteOpsCheck("d1", name, result.ok, name.startsWith("site_ops_") ? false : true, {
      count: Number(result.row?.count || 0),
      error: result.error || "",
    }));
  }
  return { configured: true, tables, checks };
}

async function buildSiteOpsKvHealth(env) {
  const specs = [
    ["SUBSCRIBERS", env.SUBSCRIBERS, SUBSCRIBER_PREFIX],
    ["CONTACT_MESSAGES:contact", env.CONTACT_MESSAGES, CONTACT_PREFIX],
    ["CONTACT_MESSAGES:feedback", env.CONTACT_MESSAGES, FEEDBACK_PREFIX],
    ["SITE_METRICS:metrics", env.SITE_METRICS, METRIC_PREFIX],
    ["SITE_METRICS:github-cache", env.SITE_METRICS, GITHUB_CACHE_PREFIX],
    ["SITE_METRICS:bot-deny", env.SITE_METRICS, BOT_DENY_PREFIX],
  ];
  const prefixes = [];
  const checks = [];
  for (const [name, binding, prefix] of specs) {
    if (!binding) {
      prefixes.push({ name, prefix, ok: false, sampleCount: 0, error: "binding missing" });
      checks.push(siteOpsCheck("kv", name, false, true));
      continue;
    }
    try {
      const page = await binding.list({ prefix, limit: 20 });
      const sampleCount = page.keys?.length || 0;
      prefixes.push({ name, prefix, ok: true, sampleCount, truncated: page.list_complete === false });
      checks.push(siteOpsCheck("kv", name, true, true, { sampleCount, truncated: page.list_complete === false }));
    } catch (error) {
      const message = sanitizeText(error?.message || "KV list failed", 240);
      prefixes.push({ name, prefix, ok: false, sampleCount: 0, error: message });
      checks.push(siteOpsCheck("kv", name, false, true, { error: message }));
    }
  }
  return { prefixes, checks };
}

async function readGitHubCacheSummary(env) {
  if (!env.SITE_METRICS) return { configured: false, entries: [], latest: null };
  const latest = await env.SITE_METRICS.get(`${METRIC_PREFIX}github:latest`, "json").catch(() => null);
  const page = await env.SITE_METRICS.list({ prefix: GITHUB_CACHE_PREFIX, limit: 30 }).catch(() => ({ keys: [] }));
  const entries = [];
  for (const key of page.keys || []) {
    const payload = await env.SITE_METRICS.get(key.name, "json").catch(() => null);
    entries.push({
      key: key.name.replace(GITHUB_CACHE_PREFIX, ""),
      staleKey: key.name.endsWith(":stale"),
      fetchedAt: payload?.fetchedAt || "",
      repoCount: payload?.repos?.length || 0,
      stale: payload?.stale === true,
    });
  }
  return { configured: true, latest, entries };
}

async function safeD1First(env, sql, binds = []) {
  try {
    const statement = env.CONTENT_OPS_DB.prepare(sql);
    const row = binds.length ? await statement.bind(...binds).first() : await statement.first();
    return { ok: true, row: row || {} };
  } catch (error) {
    return { ok: false, row: {}, error: sanitizeText(error?.message || "D1 query failed", 240) };
  }
}

async function readSiteOpsExportRows(env, { target, since, limit }) {
  if (target === "runs") {
    const rows = await env.CONTENT_OPS_DB.prepare(
      "SELECT id, run_type, status, started_at, finished_at, detail_json FROM site_ops_maintenance_runs WHERE started_at >= ? ORDER BY started_at DESC LIMIT ?"
    ).bind(since, limit).all();
    return rows.results || [];
  }
  if (target === "snapshots") {
    const rows = await env.CONTENT_OPS_DB.prepare(
      "SELECT id, snapshot_at, snapshot_type, status, summary_json FROM site_ops_snapshots WHERE snapshot_at >= ? ORDER BY snapshot_at DESC LIMIT ?"
    ).bind(since, limit).all();
    return rows.results || [];
  }
  const rows = await env.CONTENT_OPS_DB.prepare(
    "SELECT id, event_at, event_type, action, status_code, method, path, fingerprint, user_agent_sample, country, colo, detail_json FROM site_ops_events WHERE event_at >= ? ORDER BY event_at DESC LIMIT ?"
  ).bind(since, limit).all();
  return rows.results || [];
}

async function resolveAdminGitHubRepos(value, env, url) {
  const explicit = normalizeGitHubRepoList(value);
  if (explicit.length) return explicit;
  const inventory = await readInternalJsonAsset(env, url, "/content-inventory.json").catch(() => null);
  const fromInventory = normalizeGitHubRepoList((inventory?.items || []).flatMap((item) => item.links || []));
  return (fromInventory.length ? fromInventory : DEFAULT_GITHUB_REPOS).slice(0, 8);
}

function normalizeGitHubRepoList(value) {
  const values = Array.isArray(value)
    ? value
    : String(value || "").split(",");
  const repos = [];
  for (const raw of values) {
    const text = String(raw || "").trim();
    const match = text.match(/^https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)(?:[/?#].*)?$/i);
    const repo = match ? match[1] : text.includes("/") ? text : `${GITHUB_ALLOWED_OWNER}/${text}`;
    if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) && allowedGitHubRepo(repo) && !repos.includes(repo)) {
      repos.push(repo);
    }
    if (repos.length >= 8) break;
  }
  return repos;
}

async function githubRepoCacheKeys(repos) {
  const key = `${GITHUB_CACHE_PREFIX}${await sha256(repos.join(","))}`;
  return { key, staleKey: `${key}:stale` };
}

async function warmGitHubCache(env, repos) {
  const { key, staleKey } = await githubRepoCacheKeys(repos);
  const payload = {
    ok: true,
    cached: false,
    stale: false,
    fetchedAt: new Date().toISOString(),
    cacheTtlSeconds: GITHUB_CACHE_SECONDS,
    repos: await Promise.all(repos.map(fetchGitHubRepo)),
  };
  await Promise.all([
    env.SITE_METRICS.put(key, JSON.stringify(payload), { expirationTtl: GITHUB_CACHE_SECONDS }),
    env.SITE_METRICS.put(staleKey, JSON.stringify(payload)),
    env.SITE_METRICS.put(`${METRIC_PREFIX}github:latest`, JSON.stringify({ fetchedAt: payload.fetchedAt, repos: payload.repos.length })),
  ]);
  return {
    fetchedAt: payload.fetchedAt,
    repoCount: payload.repos.length,
    failed: payload.repos.filter((repo) => repo?.ok === false).length,
    cacheKeyHash: key.replace(GITHUB_CACHE_PREFIX, ""),
  };
}

async function clearGitHubCache(env, repos) {
  const { key, staleKey } = await githubRepoCacheKeys(repos);
  await Promise.all([
    env.SITE_METRICS.delete(key),
    env.SITE_METRICS.delete(staleKey),
  ]);
  return [key, staleKey].map((item) => item.replace(GITHUB_CACHE_PREFIX, ""));
}

function isAdminWriteRequest(request, url) {
  return url.pathname.startsWith("/api/admin/") && !["GET", "HEAD", "OPTIONS"].includes(request.method);
}

async function recordAdminWriteEvent(request, env, url, response) {
  if (!env.CONTENT_OPS_DB) return;
  await insertSiteOpsEvent(env, request, url, {
    eventType: "admin_write",
    action: url.pathname.replace(/^\/api\/admin\//, ""),
    statusCode: response.status,
    detail: { ok: response.status >= 200 && response.status < 400 },
  });
}

async function insertSiteOpsEvent(env, request, url, { eventType, action, statusCode = 0, detail = {} }) {
  if (!env.CONTENT_OPS_DB) return;
  try {
    const identity = await requestIdentity(request);
    const cf = request.cf || {};
    await env.CONTENT_OPS_DB.prepare(
      `INSERT INTO site_ops_events (
        id, event_at, event_type, action, status_code, method, path,
        ip_hash, ua_hash, fingerprint, user_agent_sample, country, colo, detail_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      new Date().toISOString(),
      sanitizeText(eventType, 80),
      sanitizeText(action, 120),
      Number(statusCode || 0),
      sanitizeText(request.method, 12),
      sanitizePath(`${url.pathname}${url.search}`),
      identity.ipHash,
      identity.uaHash,
      identity.fingerprint,
      identity.userAgentSample,
      sanitizeText(cf.country || "XX", 8) || "XX",
      sanitizeText(cf.colo || "local", 16) || "local",
      stringifyJson(detail)
    ).run();
  } catch (error) {
    console.error("site-ops-event-error", error?.message || error);
  }
}

function requireContentOpsDb(env) {
  return env.CONTENT_OPS_DB ? null : json({ ok: false, error: CONTENT_OPS_DB_ERROR }, 503);
}

async function requireAdminAction(request, env, url) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  if (!isSameOrigin(request, url)) return json({ ok: false, error: "Invalid origin." }, 403);
  const tooLarge = enforceBodyLimit(request, MAX_ADMIN_JSON_BYTES);
  if (tooLarge) return tooLarge;
  const length = Number(request.headers.get("content-length") || "0");
  if (length > 0) {
    const badType = enforceContentType(request, ["application/json"]);
    if (badType) return badType;
  }
  return null;
}

async function readAdminJson(request, allowEmpty = false) {
  try {
    const length = Number(request.headers.get("content-length") || "0");
    if (allowEmpty && !length) return {};
    return await request.json();
  } catch {
    return allowEmpty ? {} : null;
  }
}

async function readInternalJsonAsset(env, url, path) {
  const assetRequest = new Request(new URL(path, url.origin).toString(), {
    headers: { Accept: "application/json" },
  });
  const response = await env.ASSETS.fetch(assetRequest);
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

function normalizeInventoryItem(item) {
  return {
    id: sanitizeText(item.id, 240),
    type: sanitizeText(item.type, 40),
    title: sanitizeText(item.title, 280),
    url: sanitizeContentUrl(item.url),
    thread: sanitizeText(item.thread, 120),
    tags: Array.isArray(item.tags) ? item.tags.map((tag) => sanitizeText(tag, 80)).filter(Boolean) : [],
    status: sanitizeText(item.status, 80),
    statusDetail: sanitizeText(item.statusDetail, 80),
    date: sanitizeDateText(item.date),
    relations: item.relations && typeof item.relations === "object" ? item.relations : {},
    artifacts: Array.isArray(item.artifacts) ? item.artifacts : [],
    links: Array.isArray(item.links) ? item.links.map((link) => String(link || "").trim()).filter(Boolean) : [],
    flags: item.flags && typeof item.flags === "object" ? item.flags : {},
    bodyHash: sanitizeText(item.bodyHash, 96),
    bodyWordCount: Number(item.bodyWordCount || 0),
    artifactCount: Number(item.artifactCount || 0),
    linkCount: Number(item.linkCount || 0),
  };
}

async function upsertContentItems(env, items, now) {
  const statements = items.map((item) => env.CONTENT_OPS_DB.prepare(
    `INSERT INTO content_items (
      id, type, title, url, thread, status, status_detail, item_date,
      tags_json, relations_json, artifacts_json, links_json, flags_json,
      body_hash, body_word_count, first_seen_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      type = excluded.type,
      title = excluded.title,
      url = excluded.url,
      thread = excluded.thread,
      status = excluded.status,
      status_detail = excluded.status_detail,
      item_date = excluded.item_date,
      tags_json = excluded.tags_json,
      relations_json = excluded.relations_json,
      artifacts_json = excluded.artifacts_json,
      links_json = excluded.links_json,
      flags_json = excluded.flags_json,
      body_hash = excluded.body_hash,
      body_word_count = excluded.body_word_count,
      updated_at = excluded.updated_at`
  ).bind(
    item.id,
    item.type,
    item.title,
    item.url,
    item.thread,
    item.status,
    item.statusDetail,
    item.date,
    stringifyJson(item.tags),
    stringifyJson(item.relations),
    stringifyJson(item.artifacts),
    stringifyJson(item.links),
    stringifyJson(item.flags),
    item.bodyHash,
    item.bodyWordCount,
    now,
    now
  ));
  await runD1Batch(env, statements);
}

async function buildContentOpsIssues(env, { items, health, syncReport, now }) {
  const issues = [];
  const byUrl = new Map(items.map((item) => [item.url, item]));
  const add = async (input) => issues.push(await makeIssue(input));

  for (const item of items) {
    const relationCount = countRelations(item.relations);
    if (["paper", "project", "library", "roadmap"].includes(item.type) && !item.thread && !item.tags.length) {
      await add({
        category: "relation_gap",
        severity: "medium",
        item,
        message: `${item.title} has no thread or tags for grouping.`,
        detail: { tags: item.tags, thread: item.thread },
      });
    }
    if (["paper", "project", "library"].includes(item.type) && relationCount === 0 && item.artifactCount === 0) {
      await add({
        category: "relation_gap",
        severity: "low",
        item,
        message: `${item.title} has no outgoing relations or artifacts.`,
        detail: { relations: item.relations, artifactCount: item.artifactCount },
      });
    }
    if (["note", "paper", "project", "library"].includes(item.type) && isStaleIsoDate(item.date)) {
      await add({
        category: "stale_content",
        severity: "low",
        item,
        message: `${item.title} has not been updated for more than 180 days.`,
        detail: { date: item.date },
      });
    }
    if ((item.type === "paper" || item.type === "project") && item.artifactCount === 0) {
      await add({
        category: "missing_artifact",
        severity: "high",
        item,
        message: `${item.title} has no evidence artifacts.`,
        detail: { artifactCount: item.artifactCount },
      });
    }
    if (item.type === "paper" && (!item.flags.hasEvidence || !item.flags.hasContribution)) {
      await add({
        category: "missing_evidence",
        severity: "high",
        item,
        message: `${item.title} is missing paper evidence or contribution metadata.`,
        detail: { flags: item.flags },
      });
    }
    if (item.type === "project" && (!item.flags.hasEvidence || !item.flags.hasOutcome)) {
      await add({
        category: "missing_evidence",
        severity: "medium",
        item,
        message: `${item.title} is missing project evidence or outcome metadata.`,
        detail: { flags: item.flags },
      });
    }
    if (item.type === "library" && (!item.flags.hasWhyItMatters || Number(item.flags.takeawayCount || 0) < 3)) {
      await add({
        category: "metadata_gap",
        severity: "medium",
        item,
        message: `${item.title} is missing library rationale or enough takeaways.`,
        detail: { flags: item.flags },
      });
    }
    if ((item.type === "paper" || item.type === "project") && !item.flags.hasNextStep) {
      await add({
        category: "metadata_gap",
        severity: "low",
        item,
        message: `${item.title} has no next step metadata.`,
        detail: { flags: item.flags },
      });
    }
  }

  for (const missing of health?.missingArtifacts || []) {
    const item = byUrl.get(sanitizePath(missing.url));
    await add({
      category: "missing_artifact",
      severity: "high",
      item,
      contentUrl: sanitizePath(missing.url),
      contentType: sanitizeText(missing.type, 40),
      title: sanitizeText(missing.title, 240),
      message: `${missing.title} has no evidence artifacts.`,
      detail: missing,
    });
  }

  for (const missing of health?.missingEvidence || []) {
    const item = byUrl.get(sanitizePath(missing.url));
    await add({
      category: "missing_evidence",
      severity: "medium",
      item,
      contentUrl: sanitizePath(missing.url),
      contentType: sanitizeText(missing.type, 40),
      title: sanitizeText(missing.title, 240),
      message: `${missing.title} has evidence metadata gap: ${missing.issue || "missing evidence"}.`,
      detail: missing,
    });
  }

  for (const stale of health?.staleContent || []) {
    const item = byUrl.get(sanitizePath(stale.url));
    await add({
      category: "stale_content",
      severity: "low",
      item,
      contentUrl: sanitizePath(stale.url),
      contentType: sanitizeText(stale.type, 40),
      title: sanitizeText(stale.title, 240),
      message: `${stale.title} is stale.`,
      detail: stale,
    });
  }

  if (Number(syncReport?.totals?.missingFolders || 0) > 0) {
    await add({
      category: "sync_gap",
      severity: "medium",
      contentUrl: "",
      contentType: "site",
      title: "Obsidian sync has missing folders",
      message: "The content sync report contains missing source folders.",
      detail: syncReport.totals,
      issueKey: "sync_gap:missing-folders",
    });
  }

  for (const collection of syncReport?.collections || []) {
    if (collection?.missing === true || collection?.status === "missing" || collection?.missingFolder) {
      await add({
        category: "sync_gap",
        severity: "medium",
        contentUrl: "",
        contentType: "site",
        title: `Sync gap: ${collection.label || collection.name || "collection"}`,
        message: `Sync source is missing for ${collection.label || collection.name || "collection"}.`,
        detail: collection,
        issueKey: `sync_gap:${collection.label || collection.name || "collection"}`,
      });
    }
  }

  const failedLinks = await env.CONTENT_OPS_DB.prepare("SELECT * FROM link_checks WHERE ok = 0 ORDER BY checked_at DESC LIMIT 200").all().catch(() => ({ results: [] }));
  for (const link of failedLinks.results || []) {
    const item = byUrl.get(link.content_url);
    await add({
      category: "broken_link",
      severity: link.link_type === "local" ? "high" : "medium",
      item,
      contentUrl: link.content_url,
      title: item?.title || link.content_url || "Broken link",
      message: `Broken ${link.link_type} link: ${link.href}`,
      detail: { href: link.href, linkType: link.link_type, statusCode: link.status_code, error: link.error, checkedAt: link.checked_at },
      issueKey: brokenLinkIssueKey(link.content_url, link.href),
    });
  }

  return dedupeIssues(issues).map((issue) => ({ ...issue, lastSeenAt: now, status: "open" }));
}

async function makeIssue({
  category,
  severity,
  item,
  contentId,
  contentUrl,
  contentType,
  title,
  message,
  detail = {},
  issueKey,
}) {
  const key = issueKey || `${category}:${contentUrl || item?.url || "site"}:${message}`;
  return {
    id: `issue:${await sha256(key)}`,
    issueKey: key,
    contentId: contentId || item?.id || "",
    contentUrl: contentUrl || item?.url || "",
    contentType: contentType || item?.type || "",
    title: title || item?.title || "Site issue",
    category,
    severity,
    status: "open",
    message,
    detail,
    source: "content-ops",
  };
}

async function upsertContentIssues(env, issues, now) {
  const statements = issues.map((issue) => env.CONTENT_OPS_DB.prepare(
    `INSERT INTO content_issues (
      id, issue_key, content_id, content_url, content_type, title, category,
      severity, status, message, detail_json, source, first_seen_at, last_seen_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)
    ON CONFLICT(issue_key) DO UPDATE SET
      content_id = excluded.content_id,
      content_url = excluded.content_url,
      content_type = excluded.content_type,
      title = excluded.title,
      category = excluded.category,
      severity = excluded.severity,
      status = CASE WHEN content_issues.status IN ('ignored', 'snoozed') THEN content_issues.status ELSE 'open' END,
      message = excluded.message,
      detail_json = excluded.detail_json,
      source = excluded.source,
      last_seen_at = excluded.last_seen_at,
      resolved_at = CASE WHEN content_issues.status IN ('ignored', 'snoozed') THEN content_issues.resolved_at ELSE '' END,
      updated_at = excluded.updated_at`
  ).bind(
    issue.id,
    issue.issueKey,
    issue.contentId,
    issue.contentUrl,
    issue.contentType,
    issue.title,
    issue.category,
    issue.severity,
    issue.message,
    stringifyJson(issue.detail),
    issue.source,
    now,
    now,
    now
  ));
  await runD1Batch(env, statements);
}

async function resolveMissingIssues(env, seenIssueKeys, now) {
  const managed = ["stale_content", "missing_artifact", "missing_evidence", "relation_gap", "metadata_gap", "sync_gap", "broken_link"];
  const managedPlaceholders = managed.map(() => "?").join(", ");
  if (!seenIssueKeys.length) {
    await env.CONTENT_OPS_DB.prepare(
      `UPDATE content_issues SET status = 'resolved', resolved_at = ?, updated_at = ?
       WHERE source = 'content-ops' AND status = 'open' AND category IN (${managedPlaceholders})`
    ).bind(now, now, ...managed).run();
    return;
  }
  const seenPlaceholders = seenIssueKeys.map(() => "?").join(", ");
  await env.CONTENT_OPS_DB.prepare(
    `UPDATE content_issues SET status = 'resolved', resolved_at = ?, updated_at = ?
     WHERE source = 'content-ops' AND status = 'open'
       AND category IN (${managedPlaceholders})
       AND issue_key NOT IN (${seenPlaceholders})`
  ).bind(now, now, ...managed, ...seenIssueKeys).run();
}

async function resolveIssueByKey(env, issueKey, now) {
  await env.CONTENT_OPS_DB.prepare(
    "UPDATE content_issues SET status = 'resolved', resolved_at = ?, updated_at = ? WHERE issue_key = ? AND status IN ('open', 'snoozed')"
  ).bind(now, now, issueKey).run();
}

function collectLinkTargets(items) {
  const rows = [];
  const seen = new Set();
  for (const item of items) {
    for (const href of item.links || []) {
      const linkType = classifyLink(href);
      if (!linkType) continue;
      const key = `${item.url}|${href}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        contentId: item.id,
        contentUrl: item.url,
        contentType: item.type,
        title: item.title,
        href,
        linkType,
      });
    }
  }
  return rows.sort((a, b) => a.contentUrl.localeCompare(b.contentUrl) || a.href.localeCompare(b.href));
}

async function checkLinkTarget(target, env, url) {
  const started = Date.now();
  let ok = false;
  let statusCode = 0;
  let error = "";
  try {
    if (target.linkType === "local") {
      const targetUrl = new URL(stripHash(target.href), url.origin);
      const response = await env.ASSETS.fetch(new Request(targetUrl.toString(), { method: "GET" }));
      statusCode = response.status;
      ok = response.ok;
      if (!ok) error = `HTTP ${response.status}`;
    } else {
      const response = await fetchWithFallback(target.href);
      statusCode = response.status;
      ok = response.ok;
      if (!ok) error = `HTTP ${response.status}`;
    }
  } catch (err) {
    error = sanitizeText(err?.message || "Link check failed.", 220);
  }
  return {
    ...target,
    id: `link:${await sha256(`${target.contentUrl}|${target.href}`)}`,
    ok,
    statusCode,
    error,
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
  };
}

async function fetchWithFallback(href) {
  try {
    const head = await fetchWithTimeout(href, "HEAD");
    if (head.ok || ![403, 405, 501].includes(head.status)) return head;
  } catch {
    // Fall through to GET.
  }
  return fetchWithTimeout(href, "GET");
}

async function fetchWithTimeout(href, method) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), 3000);
  try {
    return await fetch(href, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "jianhenghu-content-ops/1.0" },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function upsertLinkCheck(env, result) {
  await env.CONTENT_OPS_DB.prepare(
    `INSERT INTO link_checks (
      id, content_id, content_url, href, link_type, ok, status_code, error, checked_at, duration_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(content_url, href) DO UPDATE SET
      id = excluded.id,
      content_id = excluded.content_id,
      link_type = excluded.link_type,
      ok = excluded.ok,
      status_code = excluded.status_code,
      error = excluded.error,
      checked_at = excluded.checked_at,
      duration_ms = excluded.duration_ms`
  ).bind(
    result.id,
    result.contentId,
    result.contentUrl,
    result.href,
    result.linkType,
    result.ok ? 1 : 0,
    result.statusCode,
    result.error,
    result.checkedAt,
    result.durationMs
  ).run();
}

async function finishContentOpsRun(env, runId, status, detail = {}, counts = {}) {
  await env.CONTENT_OPS_DB.prepare(
    `UPDATE content_ops_runs SET
      status = ?,
      finished_at = ?,
      items_count = ?,
      issues_opened = ?,
      issues_seen = ?,
      links_checked = ?,
      detail_json = ?
    WHERE id = ?`
  ).bind(
    status,
    new Date().toISOString(),
    Number(counts.itemsCount || detail.items || 0),
    Number(counts.issuesOpened || detail.openIssues || 0),
    Number(counts.issuesSeen || detail.issuesSeen || 0),
    Number(counts.linksChecked || detail.checked || 0),
    stringifyJson(detail),
    runId
  ).run();
}

async function runD1Batch(env, statements) {
  const chunkSize = 50;
  for (let i = 0; i < statements.length; i += chunkSize) {
    const chunk = statements.slice(i, i + chunkSize);
    if (chunk.length) await env.CONTENT_OPS_DB.batch(chunk);
  }
}

function classifyLink(href) {
  const value = String(href || "").trim();
  if (!value || value.startsWith("#") || /^mailto:/i.test(value)) return "";
  if (value.startsWith("/") && !value.startsWith("//")) return "local";
  if (/^https:\/\//i.test(value)) return "external";
  return "";
}

function stripHash(href) {
  const [clean] = String(href || "/").split("#");
  return clean || "/";
}

function countRelations(relations) {
  if (!relations || typeof relations !== "object") return 0;
  return Object.values(relations).reduce((sum, value) => {
    if (Array.isArray(value)) return sum + value.filter(Boolean).length;
    return sum + (value ? 1 : 0);
  }, 0);
}

function brokenLinkIssueKey(contentUrl, href) {
  return `broken_link:${contentUrl}:${href}`;
}

function dedupeIssues(issues) {
  const seen = new Set();
  return issues.filter((issue) => {
    if (!issue.issueKey || seen.has(issue.issueKey)) return false;
    seen.add(issue.issueKey);
    return true;
  });
}

function sumRows(rows, predicate) {
  return rows.filter(predicate).reduce((sum, row) => sum + Number(row.count || 0), 0);
}

function stringifyJson(value) {
  return JSON.stringify(value ?? null);
}

function sanitizeDateText(value) {
  const text = sanitizeText(value, 40);
  if (!text) return "";
  if (/^\d{4}(-\d{2})?(-\d{2})?$/.test(text)) return text;
  const date = new Date(text);
  return Number.isNaN(date.valueOf()) ? "" : date.toISOString().slice(0, 10);
}

function sanitizeDateTimeText(value) {
  const text = sanitizeText(value, 80);
  if (!text) return "";
  const date = new Date(text);
  return Number.isNaN(date.valueOf()) ? "" : date.toISOString();
}

function sanitizePolicyValue(kind, value) {
  const raw = String(value || "").trim();
  if (kind === "ip_hash" || kind === "fingerprint") return /^[a-f0-9]{64}$/i.test(raw) ? raw.toLowerCase() : "";
  if (kind === "path_prefix") return raw.startsWith("/") && !raw.startsWith("//") ? sanitizePath(raw).slice(0, 180) : "";
  if (kind === "ua_pattern") return sanitizeText(raw, 180);
  return "";
}

function sanitizeHashText(value) {
  const text = String(value || "").trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(text) ? text : "";
}

function toCsvRows(rows) {
  if (!rows?.length) return "";
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
}

function csvEscape(value) {
  const text = typeof value === "object" ? JSON.stringify(value || "") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function isSafeRegex(value) {
  if (String(value || "").length > 180) return false;
  try {
    new RegExp(value, "i");
    return true;
  } catch {
    return false;
  }
}

async function refreshBotPolicyCache(env) {
  if (!env.SITE_METRICS || !env.CONTENT_OPS_DB) return;
  const now = new Date().toISOString();
  const rows = await env.CONTENT_OPS_DB.prepare(
    "SELECT id, kind, value, action, note, expires_at, created_at, updated_at FROM bot_policy_overrides WHERE expires_at = '' OR expires_at > ? ORDER BY updated_at DESC LIMIT 200"
  ).bind(now).all().catch(() => ({ results: [] }));
  await env.SITE_METRICS.put(BOT_POLICY_CACHE_KEY, JSON.stringify(rows.results || []), { expirationTtl: BOT_POLICY_CACHE_SECONDS });
}

async function readBotDenylistSamples(env) {
  if (!env.SITE_METRICS) return [];
  const page = await env.SITE_METRICS.list({ prefix: BOT_DENY_PREFIX, limit: 20 }).catch(() => ({ keys: [] }));
  return Promise.all((page.keys || []).map(async (key) => {
    const record = await env.SITE_METRICS.get(key.name, "json").catch(() => null);
    return {
      fingerprint: key.name.replace(BOT_DENY_PREFIX, ""),
      reasons: record?.reasons || [],
      riskScore: record?.riskScore || 0,
      until: record?.until || "",
    };
  }));
}

function isStaleIsoDate(value) {
  const text = sanitizeDateText(value);
  if (!text || !/^\d{4}/.test(text)) return false;
  const date = new Date(text.length === 4 ? `${text}-01-01` : text.length === 7 ? `${text}-01` : text);
  return !Number.isNaN(date.valueOf()) && Date.now() - date.valueOf() > 180 * 24 * 60 * 60 * 1000;
}

function sanitizeLongText(value, limit) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .slice(0, limit);
}

async function readRequestData(request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await request.json();
    return new Map(Object.entries(body || {}));
  }
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return new URLSearchParams(await request.text());
  }
  if (contentType.includes("multipart/form-data")) {
    return await request.formData();
  }
  return new URLSearchParams(await request.text());
}

async function readRequestDataSafely(request) {
  try {
    return await readRequestData(request);
  } catch {
    return null;
  }
}

async function bumpMetric(env, name) {
  if (!env.SITE_METRICS) return 0;
  const key = `${METRIC_PREFIX}${name}`;
  const current = Number((await env.SITE_METRICS.get(key)) || "0");
  const next = current + 1;
  await env.SITE_METRICS.put(key, String(next));
  return next;
}

async function readMetric(env, name) {
  return Number((await env.SITE_METRICS.get(`${METRIC_PREFIX}${name}`)) || "0");
}

async function decrementMetric(env, name) {
  if (!env.SITE_METRICS) return 0;
  const key = `${METRIC_PREFIX}${name}`;
  const current = Number((await env.SITE_METRICS.get(key)) || "0");
  const next = Math.max(0, current - 1);
  await env.SITE_METRICS.put(key, String(next));
  return next;
}

async function readTopPaths(env) {
  if (!env.SITE_METRICS) return [];
  const prefix = `${METRIC_PREFIX}views:path:`;
  const page = await env.SITE_METRICS.list({ prefix, limit: 100 });
  const rows = await Promise.all(
    page.keys.map(async (key) => ({
      path: key.name.replace(prefix, ""),
      views: Number((await env.SITE_METRICS.get(key.name)) || "0"),
    }))
  );
  return rows
    .filter((row) => row.path && !row.path.startsWith("/api/"))
    .sort((a, b) => b.views - a.views || a.path.localeCompare(b.path))
    .slice(0, 5);
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (email.length > 254) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

async function requireAdmin(request, env) {
  const limited = await checkRateLimit(env, request, "admin", 40, 300);
  if (limited) return limited;

  const auth = request.headers.get("authorization") || "";
  const expected = env.ADMIN_TOKEN ? `Bearer ${env.ADMIN_TOKEN}` : "";
  if (!expected || !safeEqual(auth, expected)) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }
  return null;
}

async function requireTurnstile(request, env, data) {
  if (!env.TURNSTILE_SECRET_KEY) return null;
  const token = String(data.get("cf-turnstile-response") || "").trim();
  if (!token) {
    return json({ ok: false, error: "Forbidden." }, 403);
  }

  const body = new FormData();
  body.set("secret", env.TURNSTILE_SECRET_KEY);
  body.set("response", token);
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) body.set("remoteip", ip);

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body,
    });
    const result = await response.json();
    if (response.ok && result?.success === true) return null;
  } catch {
    return json({ ok: false, error: "Forbidden." }, 403);
  }

  return json({ ok: false, error: "Forbidden." }, 403);
}

async function checkRateLimit(env, request, scope, limit, windowSeconds) {
  if (!env.SITE_METRICS) return null;
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const identity = await clientFingerprint(request);
  const key = `${RATE_LIMIT_PREFIX}${scope}:${bucket}:${identity}`;
  const current = Number((await env.SITE_METRICS.get(key)) || "0");
  if (current >= limit) {
    return json(
      { ok: false, error: "Too many requests. Please try again later." },
      429,
      { "Retry-After": String(windowSeconds) }
    );
  }
  await env.SITE_METRICS.put(key, String(current + 1), { expirationTtl: windowSeconds * 2 });
  return null;
}

async function clientFingerprint(request) {
  const identity = await requestIdentity(request);
  return identity.fingerprint;
}

async function requestIdentity(request) {
  const rawIp = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")?.[0]?.trim() || "local";
  const ua = request.headers.get("user-agent") || "";
  const botManagement = request.cf?.botManagement || {};
  const ja4 = sanitizeText(botManagement.ja4 || "", 96);
  const detectionIds = Array.isArray(botManagement.detectionIds) ? botManagement.detectionIds.map((id) => sanitizeText(id, 40)).filter(Boolean).sort() : [];
  const verifiedBot = botManagement.verifiedBot === true || request.cf?.clientBot === true;
  const staticResource = botManagement.staticResource === true;
  const signedAgent = botManagement.signedAgent === true;
  const ipHash = await sha256(rawIp);
  const uaHash = await sha256(ua.slice(0, 512));
  const cfSignalHash = await sha256([ja4, detectionIds.join(","), verifiedBot ? "verified" : "", staticResource ? "static" : "", signedAgent ? "signed" : ""].join("|"));
  const fingerprint = await sha256(`${ipHash}|${uaHash}|${cfSignalHash}`);
  const proofSubject = await sha256(`${ipHash}|${uaHash}|${ja4}`);
  return {
    ipHash,
    uaHash,
    cfSignalHash,
    fingerprint,
    proofSubject,
    userAgent: ua,
    userAgentSample: sanitizeText(ua, 160),
    ja4,
    detectionIds,
    verifiedBot,
    staticResource,
    signedAgent,
  };
}

async function buildBotRequestProfile(request, url, env) {
  const identity = await requestIdentity(request);
  const score = botScore(request);
  const uaGroup = knownCrawlerUaGroup(request);
  const trustedSearchBot = isTrustedSearchBot(request);
  const looksLikeSearchBot = TRUSTED_SEARCH_BOT_PATTERNS.some((pattern) => pattern.test(identity.userAgent));
  const browserProof = await verifyBrowserProof(request, env, identity);
  const cf = request.cf || {};
  return {
    ...identity,
    score,
    uaGroup,
    trustedSearchBot,
    looksLikeSearchBot,
    fakeVerifiedBot: looksLikeSearchBot && !trustedSearchBot,
    country: sanitizeText(cf.country || "XX", 8) || "XX",
    colo: sanitizeText(cf.colo || "local", 16) || "local",
    verifiedBotCategory: sanitizeText(cf.verifiedBotCategory || "", 80),
    clientBot: cf.clientBot === true,
    hasBrowserProof: browserProof.ok,
    browserProofReason: browserProof.reason,
    routeGroup: routeGroupForPath(url.pathname),
    pathGroup: pathGroupForAudit(url.pathname),
    suspicious: false,
    reasons: [],
  };
}

async function guardCrawlerRequest(request, env, context, url) {
  const profile = await buildBotRequestProfile(request, url, env);
  const decision = await classifyBotRequest(request, env, url, profile);
  if (decision.action !== "allow") {
    await updateBotRiskState(env, profile, decision);
    await applyBotPenalty(env, profile, decision);
    auditBotDecision(env, context, request, url, profile, decision);
    return botDecisionResponse(decision);
  }

  if (!isPublicCrawlSurface(request, url)) return null;

  if (!profile.trustedSearchBot && isHtmlLikePath(url.pathname)) {
    const enumerationDecision = await checkEnumerationPattern(env, profile, url, decision.suspicious);
    if (enumerationDecision) {
      await updateBotRiskState(env, profile, enumerationDecision);
      await applyBotPenalty(env, profile, enumerationDecision);
      auditBotDecision(env, context, request, url, profile, enumerationDecision);
      return botDecisionResponse(enumerationDecision);
    }
  }

  const policy = publicRatePolicy(url, { trustedSearchBot: profile.trustedSearchBot, suspicious: decision.suspicious, hasBrowserProof: profile.hasBrowserProof });
  const limited = await enforcePublicRatePolicy(env, request, profile, policy);
  if (limited) {
    await updateBotRiskState(env, profile, limited);
    auditBotDecision(env, context, request, url, profile, limited);
    return botDecisionResponse(limited);
  }

  return null;
}

async function guardPostRouteResponse(request, env, context, url, response) {
  if (request.method === "OPTIONS" || response.status !== 404 || !isPublicCrawlSurface(request, url)) return null;
  const profile = await buildBotRequestProfile(request, url, env);
  if (profile.trustedSearchBot) return null;
  const decision = await checkNotFoundScan(env, profile, url);
  if (!decision) return null;
  await updateBotRiskState(env, profile, decision);
  await applyBotPenalty(env, profile, decision);
  auditBotDecision(env, context, request, url, profile, decision);
  return null;
}

async function classifyBotRequest(request, env, url, profile) {
  if (request.method === "OPTIONS") return allowDecision(profile);

  const override = await findBotPolicyOverride(env, profile, url);
  if (override?.action === "allow") {
    return allowDecision(profile, ["policy_allow"]);
  }
  if (override?.action === "block") {
    return botDecision("block", 403, 100, ["policy_block"], profile);
  }

  const denied = await readDenylist(env, profile);
  if (denied) {
    return botDecision("block", 403, 100, ["denylisted"], profile);
  }

  const unsupportedMethod = unsupportedPublicMethod(request, url);
  if (unsupportedMethod) {
    return botDecision("block", 405, 70, ["unsupported_method"], profile);
  }

  const normalized = urlAnomalyReason(url);
  if (normalized) {
    return botDecision(normalized === "url_too_long" ? "block" : "not_found", normalized === "url_too_long" ? 414 : 404, 90, [normalized], profile);
  }

  if (url.pathname === BOT_CANARY_PATH || url.pathname.startsWith(`${BOT_CANARY_PATH}/`)) {
    return botDecision("not_found", 404, 100, ["robots_canary"], profile);
  }

  if (isHoneytrapPath(url.pathname)) {
    return botDecision("not_found", 404, 100, ["honeytrap"], profile);
  }

  if (isSuspiciousProbePath(url.pathname)) {
    return botDecision("not_found", 404, 95, ["probe_path"], profile);
  }

  if (profile.fakeVerifiedBot) {
    return botDecision("block", 403, 95, ["fake_verified_bot"], profile);
  }

  if (profile.uaGroup && !profile.trustedSearchBot) {
    return botDecision("block", 403, 95, [profile.uaGroup.reason], profile, { uaGroup: profile.uaGroup.group });
  }

  if (!profile.trustedSearchBot && profile.score > 0 && profile.score <= 10) {
    return botDecision("block", 403, 90, ["low_bot_score"], profile);
  }

  if (!profile.trustedSearchBot && isScrapeTrapRequest(request, url)) {
    return botDecision("not_found", 404, 95, [scrapeTrapReason(url)], profile);
  }

  const riskState = await readBotRiskState(env, profile);
  if (!profile.trustedSearchBot && (riskState?.riskScore >= 95 || (riskState?.riskScore >= 85 && !profile.hasBrowserProof))) {
    return botDecision("rate_limit", 429, 80, ["elevated_risk"], profile, {
      retryAfter: 600,
      riskState,
      scope: "bot-risk-state",
    });
  }

  const headerReasons = suspiciousRequestReasons(request, url, profile.score);
  const adjustedReasons = profile.hasBrowserProof ? discountBrowserProofReasons(headerReasons) : headerReasons;
  const overrideRateLimited = override?.action === "rate_limit";
  if (adjustedReasons.length || overrideRateLimited) {
    return allowDecision(profile, overrideRateLimited ? ["policy_rate_limit", ...adjustedReasons] : adjustedReasons, true);
  }

  return allowDecision(profile);
}

async function enforcePublicRatePolicy(env, request, profile, policy) {
  if (!env.SITE_METRICS) return null;
  for (const window of policy.windows || [policy]) {
    const limited = await checkPublicRateWindow(env, request, profile, window);
    if (limited) return limited;
  }
  return null;
}

async function checkPublicRateWindow(env, request, profile, { scope, limit, windowSeconds }) {
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const geo = `${profile.country}:${profile.colo}`;
  const checks = [
    { dimension: "fp", key: `${RATE_LIMIT_PREFIX}${scope}:fp:${bucket}:${profile.fingerprint}:${geo}`, limit },
    { dimension: "ip", key: `${RATE_LIMIT_PREFIX}${scope}:ip:${bucket}:${profile.ipHash}:${geo}`, limit: Math.max(limit * 3, limit + 20) },
    { dimension: "ua", key: `${RATE_LIMIT_PREFIX}${scope}:ua:${bucket}:${profile.uaHash}`, limit: Math.max(limit * 8, 120) },
  ];
  for (const item of checks) {
    const current = Number((await env.SITE_METRICS.get(item.key)) || "0");
    if (current >= item.limit) {
      return botDecision("rate_limit", 429, 85, ["rate_limited"], profile, {
        scope,
        dimension: item.dimension,
        retryAfter: windowSeconds,
      });
    }
    await env.SITE_METRICS.put(item.key, String(current + 1), { expirationTtl: windowSeconds * 2 });
  }
  return null;
}

function isPublicCrawlSurface(request, url) {
  if (!["GET", "HEAD"].includes(request.method)) return false;
  if (url.pathname.startsWith("/api/")) return true;
  if (["/search.json", "/rss.xml", "/sitemap.xml", "/robots.txt"].includes(url.pathname)) return true;
  if (url.pathname === "/" || url.pathname.endsWith(".html")) return true;
  if (!url.pathname.includes(".")) return true;
  return false;
}

function publicRatePolicy(url, { trustedSearchBot, suspicious, hasBrowserProof }) {
  if (trustedSearchBot) {
    return { windows: [{ scope: "public-trusted", limit: 240, windowSeconds: 60 }] };
  }
  if (url.pathname === "/search.json") {
    return { windows: [{ scope: "public-search-index", limit: hasBrowserProof ? 40 : suspicious ? 10 : 24, windowSeconds: 600 }] };
  }
  if (["/rss.xml", "/sitemap.xml", "/robots.txt"].includes(url.pathname)) {
    return { windows: [{ scope: "public-machine-readable", limit: suspicious ? 18 : 45, windowSeconds: 300 }] };
  }
  if (url.pathname === "/api/github-repos") {
    return { windows: [{ scope: "public-api-github-repos", limit: hasBrowserProof ? 60 : suspicious ? 12 : 36, windowSeconds: 300 }] };
  }
  if (url.pathname === "/api/site-stats") {
    return { windows: [{ scope: "public-api-site-stats", limit: hasBrowserProof ? 90 : suspicious ? 24 : 60, windowSeconds: 300 }] };
  }
  if (url.pathname.startsWith("/api/")) {
    return { windows: [{ scope: "public-api", limit: hasBrowserProof ? 36 : suspicious ? 10 : 24, windowSeconds: 300 }] };
  }
  if (isHtmlLikePath(url.pathname)) {
    return {
      windows: [
        { scope: suspicious ? "public-html-suspicious-short" : "public-html-short", limit: suspicious ? 18 : 90, windowSeconds: 60 },
        { scope: suspicious ? "public-html-suspicious-medium" : "public-html-medium", limit: suspicious ? 70 : 260, windowSeconds: 600 },
        { scope: suspicious ? "public-html-suspicious-day" : "public-html-day", limit: suspicious ? 260 : 1200, windowSeconds: 86400 },
      ],
    };
  }
  if (suspicious) {
    return { windows: [{ scope: "public-suspicious", limit: 18, windowSeconds: 300 }] };
  }
  return { windows: [{ scope: "public", limit: 90, windowSeconds: 60 }] };
}

function isSuspiciousProbePath(path) {
  const lower = String(path || "").toLowerCase();
  const probePrefixes = [
    "/.git",
    "/.svn",
    "/.hg",
    "/.env",
    "/.aws/",
    "/.azure/",
    "/.circleci/",
    "/.docker/",
    "/.idea/",
    "/.vscode/",
    "/.well-known/security.txt/",
    "/wp-",
    "/wordpress",
    "/wp-json",
    "/wp-admin",
    "/wp-content",
    "/wp-includes",
    "/xmlrpc.php",
    "/phpmyadmin",
    "/pma",
    "/mysql",
    "/adminer",
    "/server-status",
    "/server-info",
    "/actuator",
    "/api/v1",
    "/api/v2",
    "/graphql",
    "/graphiql",
    "/vendor/",
    "/node_modules/",
    "/cgi-bin/",
    "/boaform/",
    "/hudson",
    "/jenkins",
    "/solr/",
    "/laravel",
    "/storage/",
    "/uploads/",
    "/upload/",
    "/files/",
    "/backup",
    "/backups",
    "/db/",
    "/database/",
    "/dump",
    "/private/",
    "/secrets/",
    "/config/",
    "/owa/",
    "/autodiscover/",
    "/ecp/",
  ];
  const probeFiles = new Set([
    "/__bot-trap",
    "/admin.php",
    "/login.php",
    "/wp-login.php",
    "/config.php",
    "/config.json",
    "/debug",
    "/debug/default/view",
    "/env",
    "/.aws/credentials",
    "/.docker/config.json",
    "/docker-compose.yml",
    "/docker-compose.yaml",
    "/composer.json",
    "/composer.lock",
    "/package-lock.json",
    "/yarn.lock",
    "/pnpm-lock.yaml",
    "/.npmrc",
    "/.pypirc",
    "/requirements.txt",
    "/pipfile",
    "/pipfile.lock",
    "/go.mod",
    "/cargo.toml",
    "/gemfile",
    "/id_rsa",
    "/id_dsa",
    "/backup.zip",
    "/backup.sql",
    "/database.sql",
    "/dump.sql",
  ]);
  return probeFiles.has(lower) || probePrefixes.some((needle) => lower === needle || lower.startsWith(needle));
}

function isSuspiciousRequest(request, url, score) {
  return suspiciousRequestReasons(request, url, score).length > 0;
}

function suspiciousRequestReasons(request, url, score) {
  const reasons = [];
  const ua = request.headers.get("user-agent") || "";
  if (!ua.trim()) reasons.push("empty_ua");
  if (score > 0 && score <= 30) reasons.push("low_bot_score");
  if (url.pathname === "/search.json") reasons.push("machine_readable");
  const accept = request.headers.get("accept") || "";
  if (["GET", "HEAD"].includes(request.method) && !accept) reasons.push("missing_accept");
  const acceptLanguage = request.headers.get("accept-language") || "";
  if (isHtmlLikePath(url.pathname) && !acceptLanguage && !isLikelyBrowserNavigation(request)) reasons.push("missing_accept_language");
  if (isHtmlLikePath(url.pathname) && accept && !accept.includes("text/html") && !accept.includes("*/*")) reasons.push("accept_mismatch");
  if ((isHtmlLikePath(url.pathname) || isRawMachineReadablePath(url.pathname)) && request.headers.has("range")) reasons.push("range_on_text");
  if (url.search.length > 240 && !isStaticAssetPath(url.pathname)) reasons.push("long_query");
  const secFetchSite = request.headers.get("sec-fetch-site") || "";
  const secFetchMode = request.headers.get("sec-fetch-mode") || "";
  if (isHtmlLikePath(url.pathname) && secFetchSite && secFetchMode && secFetchMode !== "navigate" && secFetchSite !== "same-origin") reasons.push("sec_fetch_mismatch");
  const referer = request.headers.get("referer") || "";
  if (referer && /(?:^|\/\/)(?:localhost|127\.0\.0\.1|0\.0\.0\.0|10\.|172\.(?:1[6-9]|2\d|3[0-1])\.|192\.168\.)/i.test(referer)) reasons.push("odd_referer");
  return [...new Set(reasons)];
}

function discountBrowserProofReasons(reasons) {
  const discounted = new Set([
    "machine_readable",
    "missing_accept_language",
    "missing_accept",
    "sec_fetch_mismatch",
  ]);
  return reasons.filter((reason) => !discounted.has(reason));
}

function isScrapeTrapRequest(request, url) {
  if (!["GET", "HEAD"].includes(request.method)) return false;
  const path = url.pathname.toLowerCase();
  if (/\.(bak|backup|old|orig|save|swp|sql|sqlite|db|dump|zip|tar|tgz|gz|7z|rar|pem|key|crt|log|conf|config|ini|yml|yaml)$/i.test(path)) {
    return true;
  }
  if (path === "/search.json" && ["body", "raw", "full", "markdown", "md", "dump", "export"].some((key) => url.searchParams.has(key))) {
    return true;
  }
  if (url.search.length > 800 && !isStaticAssetPath(path)) {
    return true;
  }
  if (path.includes("/../") || path.includes("%2e%2e") || path.includes("%00")) {
    return true;
  }
  return false;
}

function scrapeTrapReason(url) {
  const path = url.pathname.toLowerCase();
  if (path === "/search.json") return "search_dump_param";
  if (url.search.length > 800) return "long_query";
  if (path.includes("/../") || path.includes("%2e%2e") || path.includes("%00")) return "path_traversal";
  return "probe_path";
}

function isHoneytrapPath(path) {
  const lower = String(path || "").toLowerCase();
  return lower === "/__bot-trap" ||
    lower.startsWith("/__bot-trap/") ||
    lower.startsWith("/wp-admin/") ||
    lower.startsWith("/.env") ||
    lower.startsWith("/.git/");
}

function urlAnomalyReason(url) {
  const raw = `${url.pathname}${url.search}`;
  if (raw.length > MAX_PUBLIC_URL_LENGTH) return "url_too_long";
  if (/[\u0000-\u001f\u007f]/.test(raw)) return "url_control_char";
  if (raw.includes("\\") || raw.includes("%5c") || raw.includes("%5C")) return "url_backslash";
  if (raw.includes("%00")) return "url_null_byte";
  if (raw.includes("/../") || raw.includes("..%2f") || raw.includes("%2e%2e")) return "path_traversal";
  if (/%25(?:2e|2f|5c)/i.test(raw)) return "double_encoded_path";
  return "";
}

function unsupportedPublicMethod(request, url) {
  if (["GET", "HEAD", "POST", "OPTIONS"].includes(request.method)) return false;
  return isPublicCrawlSurface(request, url) || !url.pathname.startsWith("/api/admin");
}

function botDecision(action, status, riskScore, reasons, profile, extra = {}) {
  return {
    action,
    status,
    riskScore,
    reasons: [...new Set(reasons.filter(Boolean))],
    routeGroup: profile.routeGroup,
    pathGroup: profile.pathGroup,
    suspicious: riskScore >= 50 || reasons.length > 0,
    ...extra,
  };
}

function allowDecision(profile, reasons = [], suspicious = false) {
  return {
    action: "allow",
    status: 200,
    riskScore: suspicious ? 45 : 0,
    reasons: [...new Set(reasons.filter(Boolean))],
    routeGroup: profile.routeGroup,
    pathGroup: profile.pathGroup,
    suspicious,
  };
}

function botDecisionResponse(decision) {
  const headers = { "Cache-Control": "no-store" };
  if (decision.status === 429) {
    headers["Retry-After"] = String(decision.retryAfter || 300);
    return plain("Too many requests.", 429, headers);
  }
  if (decision.status === 405) return plain("Method not allowed.", 405, { ...headers, Allow: "GET, HEAD, POST" });
  if (decision.status === 414) return plain("URI too long.", 414, headers);
  if (decision.action === "not_found" || decision.status === 404) return plain("Not found.", 404, headers);
  return plain("Forbidden.", 403, headers);
}

function routeGroupForPath(path) {
  if (path.startsWith("/api/admin")) return "admin-api";
  if (path.startsWith("/api/")) return "public-api";
  if (path === "/search.json") return "search-index";
  if (path === "/rss.xml" || path === "/sitemap.xml" || path === "/robots.txt") return "machine-readable";
  if (path.startsWith("/_astro/") || isStaticAssetPath(path)) return "static";
  if (isHtmlLikePath(path)) return "html";
  return "other";
}

function pathGroupForAudit(path) {
  if (path === "/") return "/";
  if (path.startsWith("/notes/")) return "/notes/*";
  if (path.startsWith("/research/")) return "/research/*";
  if (path.startsWith("/projects/")) return "/projects/*";
  if (path.startsWith("/library/")) return "/library/*";
  if (path.startsWith("/api/admin")) return "/api/admin/*";
  if (path.startsWith("/api/")) return "/api/*";
  if (path.startsWith("/_astro/")) return "/_astro/*";
  if (path.startsWith("/assets/")) return "/assets/*";
  return path.slice(0, 120) || "/";
}

async function findBotPolicyOverride(env, profile, url) {
  const overrides = await readActiveBotPolicyOverrides(env);
  const now = Date.now();
  for (const override of overrides) {
    const expiresAt = override.expires_at || override.expiresAt || "";
    if (expiresAt && !Number.isNaN(new Date(expiresAt).valueOf()) && new Date(expiresAt).valueOf() <= now) continue;
    const kind = override.kind;
    const value = String(override.value || "");
    if (!value) continue;
    if (kind === "ip_hash" && value === profile.ipHash) return override;
    if (kind === "fingerprint" && value === profile.fingerprint) return override;
    if (kind === "ua_pattern" && safePatternTest(value, profile.userAgent)) return override;
    if (kind === "path_prefix" && url.pathname.startsWith(value)) return override;
  }
  return null;
}

async function readActiveBotPolicyOverrides(env) {
  if (env.SITE_METRICS) {
    const cached = await env.SITE_METRICS.get(BOT_POLICY_CACHE_KEY, "json").catch(() => null);
    if (Array.isArray(cached)) return cached;
  }
  if (!env.CONTENT_OPS_DB) return [];
  const now = new Date().toISOString();
  const rows = await env.CONTENT_OPS_DB.prepare(
    "SELECT id, kind, value, action, note, expires_at, created_at, updated_at FROM bot_policy_overrides WHERE expires_at = '' OR expires_at > ? ORDER BY updated_at DESC LIMIT 200"
  ).bind(now).all().catch(() => ({ results: [] }));
  const overrides = rows.results || [];
  if (env.SITE_METRICS) {
    await env.SITE_METRICS.put(BOT_POLICY_CACHE_KEY, JSON.stringify(overrides), { expirationTtl: BOT_POLICY_CACHE_SECONDS });
  }
  return overrides;
}

function safePatternTest(patternText, value) {
  try {
    return new RegExp(patternText, "i").test(value);
  } catch {
    return String(value || "").toLowerCase().includes(String(patternText || "").toLowerCase());
  }
}

async function readDenylist(env, profile) {
  if (!env.SITE_METRICS) return null;
  return env.SITE_METRICS.get(`${BOT_DENY_PREFIX}${profile.fingerprint}`, "json").catch(() => null);
}

async function readBotRiskState(env, profile) {
  if (!env.SITE_METRICS) return null;
  return env.SITE_METRICS.get(`${BOT_RISK_PREFIX}${profile.fingerprint}`, "json").catch(() => null);
}

async function updateBotRiskState(env, profile, decision) {
  if (!env.SITE_METRICS || decision.action === "allow") return null;
  const key = `${BOT_RISK_PREFIX}${profile.fingerprint}`;
  const existing = await env.SITE_METRICS.get(key, "json").catch(() => null) || {};
  const failureCount = Number(existing.failureCount || 0) + (decision.action === "rate_limit" ? 0.5 : 1);
  const riskScore = Math.max(Number(existing.riskScore || 0) * 0.7, Number(decision.riskScore || 0));
  const state = {
    fingerprint: profile.fingerprint,
    ipHash: profile.ipHash,
    uaHash: profile.uaHash,
    riskScore: Math.round(riskScore),
    failureCount,
    lastAction: decision.action,
    lastStatus: decision.status,
    lastReason: decision.reasons?.[0] || "unknown",
    reasons: [...new Set([...(existing.reasons || []), ...(decision.reasons || [])])].slice(-12),
    pathGroups: [...new Set([...(existing.pathGroups || []), decision.pathGroup || profile.pathGroup])].slice(-12),
    userAgentSample: profile.userAgentSample,
    country: profile.country,
    colo: profile.colo,
    denyUntil: existing.denyUntil || "",
    updatedAt: new Date().toISOString(),
  };
  await env.SITE_METRICS.put(key, JSON.stringify(state), { expirationTtl: BOT_RISK_STATE_SECONDS });
  return state;
}

async function applyBotPenalty(env, profile, decision) {
  if (!env.SITE_METRICS || !["block", "not_found"].includes(decision.action) || decision.riskScore < 90) return;
  const strikeKey = `${BOT_PENALTY_PREFIX}${profile.fingerprint}`;
  const strikes = Number((await env.SITE_METRICS.get(strikeKey)) || "0") + 1;
  await env.SITE_METRICS.put(strikeKey, String(strikes), { expirationTtl: BOT_DENY_LONG_SECONDS });
  if (strikes < 3) return;
  const ttl = strikes >= 4 ? BOT_DENY_LONG_SECONDS : BOT_DENY_SHORT_SECONDS;
  const until = new Date(Date.now() + ttl * 1000).toISOString();
  await env.SITE_METRICS.put(
    `${BOT_DENY_PREFIX}${profile.fingerprint}`,
    JSON.stringify({ reasons: decision.reasons, riskScore: decision.riskScore, until }),
    { expirationTtl: ttl }
  );
  const state = await readBotRiskState(env, profile);
  if (state) {
    await env.SITE_METRICS.put(`${BOT_RISK_PREFIX}${profile.fingerprint}`, JSON.stringify({ ...state, denyUntil: until }), { expirationTtl: BOT_RISK_STATE_SECONDS });
  }
}

async function checkEnumerationPattern(env, profile, url, suspicious) {
  if (!env.SITE_METRICS || !isPublicContentPath(url.pathname)) return null;
  const bucket = Math.floor(Date.now() / (BOT_ENUM_WINDOW_SECONDS * 1000));
  const key = `${BOT_ENUM_PREFIX}${bucket}:${profile.fingerprint}`;
  const state = await env.SITE_METRICS.get(key, "json").catch(() => null) || { paths: [] };
  const pathHash = await sha256(url.pathname);
  const paths = Array.isArray(state.paths) ? state.paths : [];
  if (!paths.includes(pathHash)) paths.push(pathHash);
  const threshold = suspicious ? 24 : 60;
  await env.SITE_METRICS.put(key, JSON.stringify({ paths: paths.slice(-100), updatedAt: new Date().toISOString() }), { expirationTtl: BOT_ENUM_WINDOW_SECONDS * 2 });
  if (paths.length >= threshold) {
    return botDecision(paths.length >= threshold * 2 ? "block" : "rate_limit", paths.length >= threshold * 2 ? 403 : 429, 90, ["enumeration"], profile, {
      retryAfter: BOT_ENUM_WINDOW_SECONDS,
      scope: "public-html-enumeration",
    });
  }
  return null;
}

async function checkNotFoundScan(env, profile, url) {
  if (!env.SITE_METRICS) return null;
  const bucket = Math.floor(Date.now() / (BOT_NOT_FOUND_WINDOW_SECONDS * 1000));
  const key = `${BOT_NOT_FOUND_PREFIX}${bucket}:${profile.fingerprint}`;
  const count = Number((await env.SITE_METRICS.get(key)) || "0") + 1;
  await env.SITE_METRICS.put(key, String(count), { expirationTtl: BOT_NOT_FOUND_WINDOW_SECONDS * 2 });
  if (count >= 18) {
    return botDecision("block", 403, 90, ["not_found_scan"], profile, { pathGroup: pathGroupForAudit(url.pathname) });
  }
  if (count >= 10) {
    return botDecision("rate_limit", 429, 80, ["not_found_scan"], profile, {
      retryAfter: BOT_NOT_FOUND_WINDOW_SECONDS,
      pathGroup: pathGroupForAudit(url.pathname),
    });
  }
  return null;
}

function auditBotDecision(env, context, request, url, profile, decision) {
  if (!env.CONTENT_OPS_DB || !context?.waitUntil || decision.action === "allow") return;
  context.waitUntil(writeBotAuditEvent(env, request, url, profile, decision).catch((error) => {
    console.error("bot-audit-error", error?.message || error);
  }));
}

async function writeBotAuditEvent(env, request, url, profile, decision) {
  const shouldSample = await shouldWriteBotAuditSample(env, profile, decision);
  const now = new Date().toISOString();
  await maybePruneBotAuditEvents(env, now);
  const hour = now.slice(0, 13);
  const day = now.slice(0, 10);
  const primaryReason = decision.reasons?.[0] || "unknown";
  const pathGroup = decision.pathGroup || profile.pathGroup;
  const detail = {
    reasons: decision.reasons || [],
    uaGroup: decision.uaGroup || profile.uaGroup?.group || "",
    scope: decision.scope || "",
    dimension: decision.dimension || "",
    method: request.method,
    queryLength: url.search.length,
  };
  const rollups = [
    botAuditRollupStatement(env, "hour", hour, decision, primaryReason, pathGroup, now),
    botAuditRollupStatement(env, "day", day, decision, primaryReason, pathGroup, now),
    botRiskSnapshotStatement(env, profile, decision, now),
  ];
  if (primaryReason === "robots_canary") {
    rollups.push(botCanaryHitStatement(env, url, profile, now));
  }
  if (!shouldSample) {
    await runD1Batch(env, rollups);
    return;
  }
  const eventId = crypto.randomUUID();
  const event = env.CONTENT_OPS_DB.prepare(
    `INSERT INTO bot_audit_events (
      id, event_at, action, status_code, risk_score, reason, reasons_json,
      route_group, path_group, method, ip_hash, ua_hash, fingerprint,
      user_agent_sample, country, colo, cf_client_bot, cf_verified_bot_category,
      bot_score, detail_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    eventId,
    now,
    decision.action,
    decision.status,
    decision.riskScore,
    primaryReason,
    stringifyJson(decision.reasons || []),
    decision.routeGroup || profile.routeGroup,
    pathGroup,
    request.method,
    profile.ipHash,
    profile.uaHash,
    profile.fingerprint,
    profile.userAgentSample,
    profile.country,
    profile.colo,
    profile.clientBot ? 1 : 0,
    profile.verifiedBotCategory,
    profile.score,
    stringifyJson(detail)
  );
  await runD1Batch(env, [event, ...rollups]);
}

async function maybePruneBotAuditEvents(env, now) {
  if (!env.SITE_METRICS) return;
  const key = `${BOT_AUDIT_SAMPLE_PREFIX}prune:${now.slice(0, 10)}`;
  const seen = await env.SITE_METRICS.get(key);
  if (seen) return;
  await env.SITE_METRICS.put(key, "1", { expirationTtl: 24 * 60 * 60 });
  const cutoff = new Date(Date.now() - BOT_AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await env.CONTENT_OPS_DB.prepare("DELETE FROM bot_audit_events WHERE event_at < ?").bind(cutoff).run();
}

function botAuditRollupStatement(env, granularity, bucket, decision, reason, pathGroup, now) {
  const id = `${granularity}:${bucket}:${decision.action}:${decision.status}:${reason}:${pathGroup}`;
  return env.CONTENT_OPS_DB.prepare(
    `INSERT INTO bot_audit_rollups (
      id, bucket, granularity, action, status_code, reason, route_group, path_group, event_count, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    ON CONFLICT(id) DO UPDATE SET
      event_count = bot_audit_rollups.event_count + 1,
      updated_at = excluded.updated_at`
  ).bind(id, bucket, granularity, decision.action, decision.status, reason, decision.routeGroup || "", pathGroup, now);
}

function botRiskSnapshotStatement(env, profile, decision, now) {
  return env.CONTENT_OPS_DB.prepare(
    `INSERT INTO bot_risk_snapshots (
      fingerprint, ip_hash, ua_hash, risk_score, failure_count, last_action,
      last_status, last_reason, reasons_json, path_groups_json, user_agent_sample,
      country, colo, deny_until, updated_at
    ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, '', ?)
    ON CONFLICT(fingerprint) DO UPDATE SET
      ip_hash = excluded.ip_hash,
      ua_hash = excluded.ua_hash,
      risk_score = MAX(bot_risk_snapshots.risk_score, excluded.risk_score),
      failure_count = bot_risk_snapshots.failure_count + 1,
      last_action = excluded.last_action,
      last_status = excluded.last_status,
      last_reason = excluded.last_reason,
      reasons_json = excluded.reasons_json,
      path_groups_json = excluded.path_groups_json,
      user_agent_sample = excluded.user_agent_sample,
      country = excluded.country,
      colo = excluded.colo,
      updated_at = excluded.updated_at`
  ).bind(
    profile.fingerprint,
    profile.ipHash,
    profile.uaHash,
    Number(decision.riskScore || 0),
    decision.action,
    Number(decision.status || 0),
    decision.reasons?.[0] || "unknown",
    stringifyJson(decision.reasons || []),
    stringifyJson([decision.pathGroup || profile.pathGroup].filter(Boolean)),
    profile.userAgentSample,
    profile.country,
    profile.colo,
    now
  );
}

function botCanaryHitStatement(env, url, profile, now) {
  return env.CONTENT_OPS_DB.prepare(
    `INSERT INTO bot_canary_hits (
      id, hit_at, path, fingerprint, ip_hash, ua_hash, user_agent_sample, country, colo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), now, url.pathname, profile.fingerprint, profile.ipHash, profile.uaHash, profile.userAgentSample, profile.country, profile.colo);
}

async function shouldWriteBotAuditSample(env, profile, decision) {
  if (!env.SITE_METRICS) return true;
  const reason = decision.reasons?.[0] || "unknown";
  const key = `${BOT_AUDIT_SAMPLE_PREFIX}${profile.fingerprint}:${decision.action}:${decision.status}:${reason}:${decision.pathGroup || profile.pathGroup}`;
  const seen = await env.SITE_METRICS.get(key);
  if (seen) return false;
  await env.SITE_METRICS.put(key, "1", { expirationTtl: BOT_AUDIT_SAMPLE_SECONDS });
  return true;
}

function isHtmlLikePath(path) {
  return path === "/" || path.endsWith(".html") || (!path.includes(".") && !path.startsWith("/api/"));
}

function isLikelyBrowserNavigation(request) {
  const secFetchMode = request.headers.get("sec-fetch-mode") || "";
  const secFetchDest = request.headers.get("sec-fetch-dest") || "";
  if (secFetchMode === "navigate" || secFetchDest === "document") return true;
  const ua = request.headers.get("user-agent") || "";
  return /mozilla|safari|chrome|firefox|edg\//i.test(ua);
}

function isStaticAssetPath(path) {
  return path.startsWith("/_astro/") ||
    path.startsWith("/assets/") ||
    path.startsWith("/fonts/") ||
    /\.(?:avif|webp|png|jpe?g|gif|svg|ico|css|js|mjs|woff2?|ttf|otf|pdf|mp4|webm|mp3|wav)$/i.test(path);
}

function isKnownBadCrawler(request) {
  return Boolean(knownCrawlerUaGroup(request));
}

function knownCrawlerUaGroup(request) {
  const ua = request.headers.get("user-agent") || "";
  for (const group of CRAWLER_UA_GROUPS) {
    if (group.patterns.some((pattern) => pattern.test(ua))) return group;
  }
  return null;
}

function isTrustedSearchBot(request) {
  const ua = request.headers.get("user-agent") || "";
  const cf = request.cf || {};
  const verified = cf.clientBot === true || cf.verifiedBotCategory === "Search Engine Crawler";
  const blockedDataUseBot = BAD_CRAWLER_PATTERNS.some((pattern) => pattern.test(ua));
  return verified && !blockedDataUseBot && TRUSTED_SEARCH_BOT_PATTERNS.some((pattern) => pattern.test(ua));
}

function botScore(request) {
  const value = request.cf?.botManagement?.score;
  return typeof value === "number" ? value : 0;
}

function enforceBodyLimit(request, maxBytes) {
  const lengthHeader = request.headers.get("content-length");
  const length = Number(lengthHeader || "0");
  if (!Number.isFinite(length) || length < 0 || (length && length > maxBytes)) {
    return json({ ok: false, error: "Request body is too large." }, 413);
  }
  return null;
}

function enforceContentType(request, allowedTypes) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType || !allowedTypes.some((type) => contentType.includes(type))) {
    return json({ ok: false, error: "Unsupported content type." }, 415);
  }
  return null;
}

function parseSince(value) {
  const text = String(value || "").trim();
  const fallback = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (!text) return fallback;
  const date = new Date(text);
  return Number.isNaN(date.valueOf()) ? fallback : date;
}

function parseItemDate(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}(-\d{2})?(-\d{2})?$/.test(text)) return null;
  const normalized = text.length === 4 ? `${text}-01-01` : text.length === 7 ? `${text}-01` : text;
  const date = new Date(normalized);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function sanitizePath(value) {
  const raw = String(value || "/").trim();
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  try {
    const url = new URL(raw, "https://jianhenghu.local");
    const path = `${url.pathname}${url.search}`;
    return path.replace(/[^\w\-./?=&%#\u4e00-\u9fa5]/g, "").slice(0, 180) || "/";
  } catch {
    return "/";
  }
}

function sanitizeContentUrl(value) {
  const raw = String(value || "/").trim();
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  try {
    const url = new URL(raw, "https://jianhenghu.local");
    const path = `${url.pathname}${url.search}${url.hash}`;
    return path.replace(/[^\w\-./?=&%#\u4e00-\u9fa5]/g, "").slice(0, 220) || "/";
  } catch {
    return "/";
  }
}

function sanitizeText(value, limit) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, limit);
}

function isSameOrigin(request, url) {
  const origin = request.headers.get("origin");
  if (!origin) return request.method === "GET" || request.method === "HEAD";
  try {
    const parsed = new URL(origin);
    return parsed.protocol === url.protocol && parsed.host === url.host;
  } catch {
    return false;
  }
}

function isPublicContentPath(path) {
  return (
    path === "/" ||
    path.startsWith("/notes/") ||
    path.startsWith("/research/") ||
    path.startsWith("/projects/") ||
    path.startsWith("/library/")
  ) && !path.startsWith("/api/") && !path.startsWith("/admin") && path !== "/content-health.json" && path !== "/content-sync-report.json";
}

function allowedGitHubRepo(fullName) {
  const [owner] = String(fullName || "").split("/");
  return owner.toLowerCase() === GITHUB_ALLOWED_OWNER;
}

function isBlockedPublicPath(path) {
  const blockedPrefixes = [
    "/.git",
    "/.github",
    "/.env",
    "/src/",
    "/scripts/",
    "/docs/",
    "/node_modules/",
  ];
  const blockedFiles = new Set([
    "/package.json",
    "/package-lock.json",
    "/pnpm-lock.yaml",
    "/yarn.lock",
    "/wrangler.toml",
    "/astro.config.mjs",
    "/tsconfig.json",
    "/_headers",
    "/_redirects",
  ]);
  return blockedFiles.has(path) || blockedPrefixes.some((prefix) => path === prefix.replace(/\/$/, "") || path.startsWith(prefix));
}

function safeEqual(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

function plain(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...headers,
    },
  });
}

async function maybeMakeBrowserProofCookie(request, url, response, env, { isHtml }) {
  if (!env?.BOT_PROOF_SECRET || request.method !== "GET" || response.status !== 200 || !isHtml || !isHtmlLikePath(url.pathname)) return "";
  if (isKnownBadCrawler(request) || isSuspiciousProbePath(url.pathname) || isHoneytrapPath(url.pathname)) return "";
  const accept = request.headers.get("accept") || "";
  if (accept && !accept.includes("text/html") && !accept.includes("*/*")) return "";
  const identity = await requestIdentity(request);
  const expiresAt = Math.floor(Date.now() / 1000) + BOT_BROWSER_PROOF_SECONDS;
  const payload = `${expiresAt}.${identity.proofSubject}`;
  const signature = await hmacSha256(env.BOT_PROOF_SECRET, payload);
  return `${BOT_BROWSER_PROOF_COOKIE}=${payload}.${signature}; Max-Age=${BOT_BROWSER_PROOF_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

async function verifyBrowserProof(request, env, identity) {
  if (!env?.BOT_PROOF_SECRET) return { ok: false, reason: "disabled" };
  const value = parseCookie(request.headers.get("cookie") || "")[BOT_BROWSER_PROOF_COOKIE];
  if (!value) return { ok: false, reason: "missing" };
  const parts = value.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [expiresAtText, subject, signature] = parts;
  const expiresAt = Number(expiresAtText);
  if (!Number.isFinite(expiresAt) || expiresAt * 1000 <= Date.now()) return { ok: false, reason: "expired" };
  if (subject !== identity.proofSubject) return { ok: false, reason: "subject_mismatch" };
  const expected = await hmacSha256(env.BOT_PROOF_SECRET, `${expiresAtText}.${subject}`);
  return safeEqual(signature, expected) ? { ok: true, reason: "valid" } : { ok: false, reason: "bad_signature" };
}

function parseCookie(header) {
  return String(header || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const index = part.indexOf("=");
      if (index > 0) acc[part.slice(0, index)] = part.slice(index + 1);
      return acc;
    }, {});
}

async function hmacSha256(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function fetchEtagedAsset(request, env, url) {
  const response = await env.ASSETS.fetch(request);
  if (!response.ok) return response;
  const text = request.method === "HEAD" ? "" : await response.clone().text();
  const source = text || `${url.pathname}:${response.headers.get("content-length") || ""}:${response.headers.get("last-modified") || ""}`;
  const etag = `"${url.pathname.replace(/[^\w-]+/g, "-")}-${await sha256(source)}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": response.headers.get("Cache-Control") || "public, max-age=600, stale-while-revalidate=3600",
      },
    });
  }
  const headers = new Headers(response.headers);
  headers.set("ETag", etag);
  return new Response(request.method === "HEAD" ? null : text, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function withSecurityHeaders(response, request, url, env) {
  const headers = new Headers(response.headers);
  const isHtml = (headers.get("content-type") || "").includes("text/html");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), accelerometer=(), gyroscope=()");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Origin-Agent-Cluster", "?1");
  headers.set("X-Permitted-Cross-Domain-Policies", "none");
  headers.set("X-DNS-Prefetch-Control", "off");
  headers.set("X-Download-Options", "noopen");
  if (url.protocol === "https:") {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  if (isHtml) {
    headers.set("Content-Security-Policy", [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' https://plausible.io https://*.plausible.io https://cloud.umami.is https://challenges.cloudflare.com",
      "script-src-attr 'none'",
      "connect-src 'self' https://api.github.com https://github-contributions-api.jogruber.de https://plausible.io https://*.plausible.io https://cloud.umami.is https://challenges.cloudflare.com",
      "frame-src https://challenges.cloudflare.com",
      "worker-src 'self'",
      "manifest-src 'self'",
      "media-src 'self'",
      "form-action 'self' mailto:",
      "upgrade-insecure-requests",
    ].join("; "));
  }
  if (url.pathname.startsWith("/admin") || url.pathname.startsWith("/api/admin")) {
    headers.set("Cache-Control", "no-store");
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  } else if (isRawMachineReadablePath(url.pathname)) {
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  } else if (url.pathname.startsWith("/api/") && !["/api/site-stats", "/api/github-repos"].includes(url.pathname)) {
    headers.set("Cache-Control", "no-store");
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  } else if (url.pathname.startsWith("/api/")) {
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  }
  if (request.method === "OPTIONS") {
    headers.set("Allow", "GET, HEAD, POST");
  }
  applyCacheHeaders(headers, url, { isHtml });
  const proofCookie = await maybeMakeBrowserProofCookie(request, url, response, env, { isHtml });
  if (proofCookie) headers.append("Set-Cookie", proofCookie);
  return new Response(request.method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function applyCacheHeaders(headers, url, { isHtml }) {
  const existingCache = headers.get("Cache-Control") || "";
  if (/no-store|private/i.test(existingCache)) return;
  const canOverrideDefaultCache = !existingCache || existingCache === "public, max-age=0, must-revalidate";
  if (!canOverrideDefaultCache) return;
  const path = url.pathname;
  if (path.startsWith("/admin") || path.startsWith("/api/")) return;
  if (path === "/content-health.json" || path === "/content-sync-report.json" || path === "/content-inventory.json") {
    headers.set("Cache-Control", "no-store");
    return;
  }
  if (path.startsWith("/_astro/")) {
    headers.set("Cache-Control", `public, max-age=${IMMUTABLE_ASSET_CACHE_SECONDS}, immutable`);
    return;
  }
  if (isStaticAssetPath(path)) {
    headers.set("Cache-Control", `public, max-age=${PUBLIC_ASSET_CACHE_SECONDS}, stale-while-revalidate=${PUBLIC_ASSET_STALE_SECONDS}`);
    return;
  }
  if (path === "/search.json") {
    headers.set("Cache-Control", "public, max-age=600, stale-while-revalidate=3600");
    return;
  }
  if (path === "/sitemap.xml" || path === "/robots.txt" || path === "/rss.xml") {
    headers.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    return;
  }
  if (isHtml || isHtmlLikePath(path)) {
    headers.set("Cache-Control", `public, max-age=${PUBLIC_HTML_CACHE_SECONDS}, stale-while-revalidate=${PUBLIC_HTML_STALE_SECONDS}`);
  }
}

function isRawMachineReadablePath(path) {
  return path === "/search.json" ||
    path === "/rss.xml" ||
    path === "/content-health.json" ||
    path === "/content-sync-report.json" ||
    path === "/content-inventory.json";
}

function isEtagedMachineReadablePath(path) {
  return path === "/search.json" || path === "/rss.xml" || path === "/sitemap.xml";
}

function htmlPage(title, message, status = 200) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><style>body{font-family:system-ui,sans-serif;margin:0;padding:48px;background:#faf7f2;color:#050505}main{max-width:720px;margin:auto}a{color:inherit;font-weight:800}</style></head><body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><p><a href="/">Return home</a></p></main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}
