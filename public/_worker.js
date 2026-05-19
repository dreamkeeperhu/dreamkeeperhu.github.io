const SUBSCRIBER_PREFIX = "subscriber:";
const UNSUBSCRIBE_PREFIX = "unsubscribe:";
const CONTACT_PREFIX = "contact:";
const FEEDBACK_PREFIX = "feedback:";
const METRIC_PREFIX = "metric:";
const RATE_LIMIT_PREFIX = "rate:";
const GITHUB_CACHE_PREFIX = "github:repos:";
const MAX_FORM_BYTES = 16 * 1024;
const MAX_ADMIN_BYTES = 2 * 1024;
const GITHUB_CACHE_SECONDS = 6 * 60 * 60;
const GITHUB_ALLOWED_OWNER = "dreamkeeperhu";

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    try {
      const response = await routeRequest(request, env, context, url);
      return withSecurityHeaders(response, request, url);
    } catch {
      return withSecurityHeaders(json({ ok: false, error: "Internal server error." }, 500), request, url);
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
        ? handleSiteStats(env)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/github-repos") {
      return request.method === "GET"
        ? handleGitHubRepos(request, env, url)
        : json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/content-health.json" || url.pathname === "/content-sync-report.json" || isBlockedPublicPath(url.pathname)) {
      return json({ ok: false, error: "Not found." }, 404);
    }

    if (!["GET", "HEAD"].includes(request.method)) {
      return json({ ok: false, error: "Method not allowed" }, 405);
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
  if (env.SITE_METRICS) {
    const cached = await env.SITE_METRICS.get(cacheKey, "json");
    if (cached?.repos?.length) {
      return json({ ...cached, cached: true }, 200, { "Cache-Control": "public, max-age=300" });
    }
  }

  const repos = await Promise.all(requested.map(fetchGitHubRepo));
  const payload = {
    ok: true,
    cached: false,
    fetchedAt: new Date().toISOString(),
    cacheTtlSeconds: GITHUB_CACHE_SECONDS,
    repos,
  };
  if (env.SITE_METRICS) {
    await env.SITE_METRICS.put(cacheKey, JSON.stringify(payload), { expirationTtl: GITHUB_CACHE_SECONDS });
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
  const email = normalizeEmail(data.get("email"));
  const intent = sanitizeText(data.get("intent"), 80);
  const message = sanitizeText(data.get("message"), 2400);
  if (!email || !intent || !message) {
    return json({ ok: false, error: "Please fill in intent, email, and message." }, 400);
  }

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

async function handleSiteStats(env) {
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

  return json(
    { ok: true, views, viewsToday, subscribers, topPaths, githubCache, updatedAt: new Date().toISOString() },
    200,
    { "Cache-Control": "public, max-age=60" }
  );
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
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "local";
  const ua = request.headers.get("user-agent") || "";
  return sha256(`${ip}|${ua.slice(0, 120)}`);
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

function withSecurityHeaders(response, request, url) {
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
      "script-src 'self' 'unsafe-inline' https://plausible.io https://*.plausible.io https://cloud.umami.is",
      "script-src-attr 'none'",
      "connect-src 'self' https://api.github.com https://github-contributions-api.jogruber.de https://plausible.io https://*.plausible.io https://cloud.umami.is",
      "frame-src 'none'",
      "worker-src 'self'",
      "manifest-src 'self'",
      "media-src 'self'",
      "form-action 'self' mailto:",
      "upgrade-insecure-requests",
    ].join("; "));
  }
  if (url.pathname.startsWith("/admin") || url.pathname.startsWith("/api/admin")) {
    headers.set("Cache-Control", "no-store");
    headers.set("X-Robots-Tag", "noindex, nofollow");
  } else if (url.pathname.startsWith("/api/") && !["/api/site-stats", "/api/github-repos"].includes(url.pathname)) {
    headers.set("Cache-Control", "no-store");
  }
  if (request.method === "OPTIONS") {
    headers.set("Allow", "GET, HEAD, POST");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
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
