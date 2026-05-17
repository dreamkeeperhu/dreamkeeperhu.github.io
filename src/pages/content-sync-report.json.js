import fs from "node:fs";
import path from "node:path";

const reportPath = path.join(process.cwd(), ".cache", "content-sync-report.json");

export async function GET() {
  let report = {
    ok: true,
    source: "none",
    generatedAt: new Date().toISOString(),
    totals: { scanned: 0, published: 0, private: 0, missingFolders: 0 },
    collections: [],
  };

  if (fs.existsSync(reportPath)) {
    report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  }

  return new Response(JSON.stringify(report), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=600",
    },
  });
}
