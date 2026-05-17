import { getCollection } from "astro:content";
import { libraryHref, noteHref, paperHref, projectHref } from "../utils/content";

export async function GET() {
  const [notes, papers, projects, library, timeline, roadmap] = await Promise.all([
    getCollection("notes"),
    getCollection("papers"),
    getCollection("projects"),
    getCollection("library"),
    getCollection("timeline"),
    getCollection("roadmap"),
  ]);
  const collections = { notes, papers, projects, library, timeline, roadmap };
  const counts = Object.fromEntries(
    Object.entries(collections).map(([name, entries]) => [
      name,
      {
        total: entries.length,
        public: entries.filter((entry) => !entry.data.draft).length,
        draft: entries.filter((entry) => entry.data.draft).length,
      },
    ])
  );
  const missingArtifacts = [
    ...papers.filter((paper) => !paper.data.draft && paper.data.artifacts.length === 0).map((paper) => ({
      type: "paper",
      title: paper.data.title,
      url: paperHref(paper),
    })),
    ...projects.filter((project) => !project.data.draft && project.data.artifacts.length === 0).map((project) => ({
      type: "project",
      title: project.data.title,
      url: projectHref(project),
    })),
  ];
  const latestPublic = [
    ...notes.filter((entry) => !entry.data.draft).map((entry) => ({ type: "note", title: entry.data.title, url: noteHref(entry), date: entry.data.updatedDate || entry.data.pubDate })),
    ...papers.filter((entry) => !entry.data.draft).map((entry) => ({ type: "paper", title: entry.data.title, url: paperHref(entry), date: entry.data.updatedDate || `${entry.data.year}-01-01` })),
    ...projects.filter((entry) => !entry.data.draft).map((entry) => ({ type: "project", title: entry.data.title, url: projectHref(entry), date: entry.data.updatedDate || "2026-01-01" })),
    ...library.filter((entry) => !entry.data.draft).map((entry) => ({ type: "library", title: entry.data.title, url: libraryHref(entry), date: entry.data.updatedDate || entry.data.year })),
  ]
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .slice(0, 10);

  return new Response(JSON.stringify({
    ok: true,
    generatedAt: new Date().toISOString(),
    counts,
    missingArtifacts,
    latestPublic,
  }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=600",
    },
  });
}
