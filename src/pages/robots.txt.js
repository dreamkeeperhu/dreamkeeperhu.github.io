export function GET({ site }) {
  const body = [
    "User-agent: *",
    "Disallow: /admin",
    "Allow: /",
    `Sitemap: ${new URL("/sitemap.xml", site).toString()}`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
