const SUBSCRIBER_PREFIX = "subscriber:";
const UNSUBSCRIBE_PREFIX = "unsubscribe:";
const CONTACT_PREFIX = "contact:";
const METRIC_PREFIX = "metric:";

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);

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
      return handleSubscriberExport(request, env);
    }

    if (url.pathname === "/api/admin/contacts") {
      return handleContactExport(request, env);
    }

    if (url.pathname === "/api/admin/newsletter-draft") {
      return handleNewsletterDraft(request, env, url);
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
      context.waitUntil(recordVisit(request, env));
      return json({ ok: true });
    }

    if (url.pathname === "/api/site-stats") {
      return handleSiteStats(env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleSubscribe(request, env, url) {
  if (!env.SUBSCRIBERS) {
    return json({ ok: false, error: "Subscription storage is not configured." }, 503);
  }

  if (!isSameOrigin(request, url)) {
    return json({ ok: false, error: "Invalid origin." }, 403);
  }

  const data = await readRequestData(request);
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
  return json({
    ok: true,
    message: existing ? "You are already on the list." : "Subscribed.",
    unsubscribeUrl: `${url.origin}/api/unsubscribe?token=${encodeURIComponent(token)}`,
  });
}

async function handleUnsubscribe(request, env, url) {
  if (!env.SUBSCRIBERS) {
    return json({ ok: false, error: "Subscription storage is not configured." }, 503);
  }

  const data = request.method === "POST" ? await readRequestData(request) : new URLSearchParams(url.search);
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
  const denied = requireAdmin(request, env);
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
  const denied = requireAdmin(request, env);
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

async function handleNewsletterDraft(request, env, url) {
  const denied = requireAdmin(request, env);
  if (denied) return denied;

  const since = parseSince(url.searchParams.get("since"));
  const indexRequest = new Request(new URL("/search.json", url.origin).toString(), { headers: { Accept: "application/json" } });
  const indexResponse = await env.ASSETS.fetch(indexRequest);
  if (!indexResponse.ok) {
    return json({ ok: false, error: "Search index is not available." }, 503);
  }

  const allItems = await indexResponse.json();
  const publishTypes = new Set(["note", "paper", "project"]);
  const recent = allItems
    .filter((item) => publishTypes.has(item.type))
    .filter((item) => {
      const date = parseItemDate(item.date);
      return date && date >= since;
    })
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const items = (recent.length ? recent : allItems.filter((item) => publishTypes.has(item.type))).slice(0, 8);
  const subscribers = env.SUBSCRIBERS ? await readSubscribers(env) : [];
  const today = new Date().toISOString().slice(0, 10);
  const subject = `HJH research update - ${today}`;
  const markdown = [
    `# ${subject}`,
    "",
    "Hi,",
    "",
    "Here are the latest public notes, research entries, and project traces from jianhenghu.com.",
    "",
    ...items.flatMap((item) => [
      `- ${item.title}`,
      `  ${url.origin}${item.url}`,
      `  ${item.description}`,
    ]),
    "",
    "Best,",
    "Jianheng Hu",
    "",
    "You can unsubscribe using the link returned when you subscribed, or reply to this email.",
  ].join("\n");

  return json(
    {
      ok: true,
      since: since.toISOString().slice(0, 10),
      subscriberCount: subscribers.length,
      subject,
      text: markdown,
      markdown,
      items,
    },
    200,
    { "Cache-Control": "no-store" }
  );
}

async function handleContact(request, env, url) {
  if (!isSameOrigin(request, url)) {
    return json({ ok: false, error: "Invalid origin." }, 403);
  }

  const data = await readRequestData(request);
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

  return json(
    { ok: true, views, viewsToday, subscribers, topPaths, updatedAt: new Date().toISOString() },
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

function requireAdmin(request, env) {
  const auth = request.headers.get("authorization") || "";
  const expected = env.ADMIN_TOKEN ? `Bearer ${env.ADMIN_TOKEN}` : "";
  if (!expected || auth !== expected) {
    return json({ ok: false, error: "Unauthorized." }, 401);
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
  const path = String(value || "/").trim();
  if (!path.startsWith("/")) return "/";
  return path.slice(0, 160);
}

function sanitizeText(value, limit) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, limit);
}

function isSameOrigin(request, url) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === url.host;
  } catch {
    return false;
  }
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
