const SUBSCRIBER_PREFIX = "subscriber:";
const METRIC_PREFIX = "metric:";

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);

    if (url.pathname === "/api/subscribe") {
      return request.method === "POST"
        ? handleSubscribe(request, env, url)
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

  await env.SUBSCRIBERS.put(
    key,
    JSON.stringify({
      email,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      source: "homepage",
    })
  );

  if (!existing) {
    await bumpMetric(env, "subscribers:total");
  }
  return json({
    ok: true,
    message: existing ? "You are already on the list." : "Subscribed.",
  });
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
  const [views, viewsToday, subscribers] = await Promise.all([
    readMetric(env, "views:all"),
    readMetric(env, `views:day:${today}`),
    readMetric(env, "subscribers:total"),
  ]);

  return json(
    { ok: true, views, viewsToday, subscribers, updatedAt: new Date().toISOString() },
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

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (email.length > 254) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function sanitizePath(value) {
  const path = String(value || "/").trim();
  if (!path.startsWith("/")) return "/";
  return path.slice(0, 160);
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
