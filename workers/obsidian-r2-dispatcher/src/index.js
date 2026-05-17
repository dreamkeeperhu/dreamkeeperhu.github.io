const DEFAULT_PREFIXES = [
  "Homepage/Notes/",
  "Homepage/Papers/",
  "Homepage/Projects/",
  "Homepage/Library/",
  "Homepage/Timeline/",
  "Homepage/Roadmap/",
];
const DEFAULT_SUFFIXES = [".md", ".mdx"];

export default {
  async fetch(request, env) {
    if (request.method === "GET") {
      return Response.json({
        ok: true,
        service: "obsidian-r2-dispatcher",
        eventType: env.GITHUB_EVENT_TYPE || "obsidian-updated",
      });
    }

    if (request.method === "POST" && env.MANUAL_TRIGGER_SECRET) {
      const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
      if (token !== env.MANUAL_TRIGGER_SECRET) {
        return new Response("Unauthorized", { status: 401 });
      }

      await triggerRepositoryDispatch(env, {
        reason: "manual-worker-trigger",
        keys: [],
      });

      return Response.json({ ok: true, dispatched: true });
    }

    return new Response("Not found", { status: 404 });
  },

  async queue(batch, env) {
    const events = batch.messages
      .map((message) => normalizeR2Event(message.body))
      .filter((event) => event && shouldDeployForKey(event.key, env));

    if (events.length === 0) {
      return;
    }

    await triggerRepositoryDispatch(env, {
      reason: "r2-object-change",
      keys: unique(events.map((event) => event.key)),
      events: events.slice(0, 10),
    });
  },
};

function normalizeR2Event(body) {
  const event = typeof body === "string" ? safeJson(body) : body;
  if (!event || typeof event !== "object") return null;

  const key =
    event.object?.key ||
    event.payload?.object?.key ||
    event.payload?.key ||
    event.objectKey;

  if (!key || typeof key !== "string") return null;

  return {
    action: event.action || event.type || event.payload?.action || "unknown",
    bucket: event.bucket || event.payload?.bucket || event.payload?.bucketName || "unknown",
    key,
    eventTime: event.eventTime || event.metadata?.eventTimestamp || new Date().toISOString(),
  };
}

function shouldDeployForKey(key, env) {
  const prefixes = splitList(env.OBSIDIAN_EVENT_PREFIXES, DEFAULT_PREFIXES);
  const suffixes = splitList(env.OBSIDIAN_EVENT_SUFFIXES, DEFAULT_SUFFIXES);
  return prefixes.some((prefix) => key.startsWith(prefix)) && suffixes.some((suffix) => key.endsWith(suffix));
}

async function triggerRepositoryDispatch(env, payload) {
  const owner = requireEnv(env, "GITHUB_OWNER");
  const repo = requireEnv(env, "GITHUB_REPO");
  const token = requireEnv(env, "GITHUB_DISPATCH_TOKEN");
  const eventType = env.GITHUB_EVENT_TYPE || "obsidian-updated";

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "obsidian-r2-dispatcher",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      event_type: eventType,
      client_payload: {
        source: "cloudflare-r2",
        ...payload,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub repository_dispatch failed: ${response.status} ${text}`);
  }
}

function requireEnv(env, key) {
  const value = env[key];
  if (!value) throw new Error(`Missing Worker secret or variable: ${key}`);
  return value;
}

function splitList(value, fallback) {
  if (!value) return fallback;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(items) {
  return [...new Set(items)];
}

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
