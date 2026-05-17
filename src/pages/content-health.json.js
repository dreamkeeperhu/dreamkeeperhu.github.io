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
  const staleContent = latestPublicEntries({ notes, papers, projects, library })
    .filter((entry) => isStale(entry.date))
    .map(({ type, title, url, date }) => ({ type, title, url, date }));
  const missingEvidence = [
    ...papers.filter((paper) => !paper.data.draft && (!paper.data.evidence.length || !paper.data.contribution.length)).map((paper) => ({
      type: "paper",
      title: paper.data.title,
      url: paperHref(paper),
      issue: !paper.data.contribution.length ? "missing contribution" : "missing evidence",
    })),
    ...projects.filter((project) => !project.data.draft && (!project.data.evidence.length || !project.data.outcome)).map((project) => ({
      type: "project",
      title: project.data.title,
      url: projectHref(project),
      issue: !project.data.outcome ? "missing outcome" : "missing evidence",
    })),
    ...library.filter((item) => !item.data.draft && (!item.data.takeaways.length || !item.data.whyItMatters)).map((item) => ({
      type: "library",
      title: item.data.title,
      url: libraryHref(item),
      issue: !item.data.whyItMatters ? "missing whyItMatters" : "missing takeaways",
    })),
  ];
  const latestPublic = [
    ...notes.filter((entry) => !entry.data.draft).map((entry) => ({ type: "note", title: entry.data.title, url: noteHref(entry), date: entry.data.updatedDate || entry.data.pubDate, thread: entry.data.thread || "" })),
    ...papers.filter((entry) => !entry.data.draft).map((entry) => ({ type: "paper", title: entry.data.title, url: paperHref(entry), date: entry.data.updatedDate || `${entry.data.year}-01-01`, thread: entry.data.thread || "" })),
    ...projects.filter((entry) => !entry.data.draft).map((entry) => ({ type: "project", title: entry.data.title, url: projectHref(entry), date: entry.data.updatedDate || "2026-01-01", thread: entry.data.thread || "" })),
    ...library.filter((entry) => !entry.data.draft).map((entry) => ({ type: "library", title: entry.data.title, url: libraryHref(entry), date: entry.data.updatedDate || entry.data.year, thread: entry.data.thread || "" })),
  ]
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .slice(0, 10);

  return new Response(JSON.stringify({
    ok: true,
    generatedAt: new Date().toISOString(),
    counts,
    missingArtifacts,
    latestPublic,
    staleContent,
    missingEvidence,
    quality: {
      missingArtifacts: missingArtifacts.length,
      missingEvidence: missingEvidence.length,
      staleContent: staleContent.length,
    },
  }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=600",
    },
  });
}

function latestPublicEntries({ notes, papers, projects, library }) {
  return [
    ...notes.filter((entry) => !entry.data.draft).map((entry) => ({ type: "note", title: entry.data.title, url: noteHref(entry), date: entry.data.updatedDate || entry.data.pubDate, thread: entry.data.thread || "" })),
    ...papers.filter((entry) => !entry.data.draft).map((entry) => ({ type: "paper", title: entry.data.title, url: paperHref(entry), date: entry.data.updatedDate || `${entry.data.year}-01-01`, thread: entry.data.thread || "" })),
    ...projects.filter((entry) => !entry.data.draft).map((entry) => ({ type: "project", title: entry.data.title, url: projectHref(entry), date: entry.data.updatedDate || "2026-01-01", thread: entry.data.thread || "" })),
    ...library.filter((entry) => !entry.data.draft).map((entry) => ({ type: "library", title: entry.data.title, url: libraryHref(entry), date: entry.data.updatedDate || entry.data.year, thread: entry.data.thread || "" })),
  ];
}

function isStale(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return false;
  return Date.now() - date.valueOf() > 180 * 24 * 60 * 60 * 1000;
}
