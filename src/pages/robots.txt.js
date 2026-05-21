export function GET({ site }) {
  const blockedBots = [
    "GPTBot",
    "ChatGPT-User",
    "OAI-SearchBot",
    "Google-Extended",
    "Applebot-Extended",
    "DuckAssistBot",
    "ClaudeBot",
    "Claude-SearchBot",
    "anthropic-ai",
    "cohere-ai",
    "AI2Bot",
    "CCBot",
    "PerplexityBot",
    "Bytespider",
    "Amazonbot",
    "FacebookBot",
    "Meta-ExternalAgent",
    "Diffbot",
    "AhrefsBot",
    "SemrushBot",
    "MJ12bot",
    "DotBot",
    "PetalBot",
  ];

  const body = [
    ...blockedBots.flatMap((bot) => [
      `User-agent: ${bot}`,
      "Disallow: /",
      "",
    ]),
    "User-agent: *",
    "Disallow: /admin",
    "Disallow: /api/",
    "Disallow: /search.json",
    "Disallow: /content-health.json",
    "Disallow: /content-sync-report.json",
    "Allow: /",
    `Sitemap: ${new URL("/sitemap.xml", site).toString()}`,
    "Content-Signal: search=yes, ai-train=no, ai-input=no",
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
