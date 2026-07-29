import assert from "node:assert/strict";

import worker from "../public/_worker.js";

const kvReads = [];
const kvWrites = [];

const env = {
  ASSETS: {
    async fetch(request) {
      const path = new URL(request.url).pathname;
      return new Response(path === "/missing" ? "missing" : "ok", {
        status: path === "/missing" ? 404 : 200,
        headers: { "Content-Type": "text/plain" },
      });
    },
  },
  SITE_METRICS: {
    async get(key) {
      kvReads.push(key);
      return null;
    },
    async put(key) {
      kvWrites.push(key);
      throw new Error(`Unexpected SITE_METRICS write: ${key}`);
    },
    async delete() {},
    async list() {
      return { keys: [] };
    },
  },
};

async function dispatch(path, options = {}) {
  const pending = [];
  const request = new Request(`https://example.com${path}`, {
    method: options.method || "GET",
    body: options.body,
    headers: {
      "CF-Connecting-IP": options.ip || "203.0.113.10",
      Origin: "https://example.com",
      "User-Agent": options.userAgent || "Mozilla/5.0 Test Browser",
      ...(options.headers || {}),
    },
  });
  const response = await worker.fetch(request, env, {
    waitUntil(promise) {
      pending.push(Promise.resolve(promise));
    },
  });
  await Promise.all(pending);
  return response;
}

const home = await dispatch("/");
assert.equal(home.status, 200);

const visit = await dispatch("/api/visit", {
  method: "POST",
  body: JSON.stringify({ path: "/", title: "Home" }),
  headers: { "Content-Type": "application/json" },
  ip: "203.0.113.11",
});
assert.equal(visit.status, 204);

const probe = await dispatch("/.env", {
  ip: "203.0.113.12",
  userAgent: "python-requests/2.32.5",
});
assert.ok([403, 404].includes(probe.status));

const missing = await dispatch("/missing", {
  ip: "203.0.113.13",
});
assert.equal(missing.status, 404);

assert.deepEqual(kvWrites, []);
assert.ok(kvReads.length > 0, "Persistent denylist reads should remain enabled.");

console.log(`KV budget verification passed: ${kvReads.length} reads, ${kvWrites.length} writes.`);
