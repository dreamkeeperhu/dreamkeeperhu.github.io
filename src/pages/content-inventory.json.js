import { createHash } from "node:crypto";
import { getCollection } from "astro:content";
import { libraryHref, noteHref, paperHref, projectHref, timelineSortValue } from "../utils/content";

export async function GET() {
  const [notes, papers, projects, library, timeline, roadmap] = await Promise.all([
    getCollection("notes"),
    getCollection("papers"),
    getCollection("projects"),
    getCollection("library"),
    getCollection("timeline"),
    getCollection("roadmap"),
  ]);

  const items = [
    ...notes.filter(isPublic).map((entry) => contentItem({
      id: entry.id,
      type: "note",
      title: entry.data.title,
      url: noteHref(entry),
      status: entry.data.category,
      date: isoDate(entry.data.updatedDate || entry.data.pubDate),
      thread: entry.data.thread || "",
      tags: entry.data.tags,
      body: entry.body,
      relations: {
        series: entry.data.series || "",
      },
      links: extractLinks(entry.body),
    })),
    ...papers.filter(isPublic).map((entry) => contentItem({
      id: entry.id,
      type: "paper",
      title: entry.data.title,
      url: paperHref(entry),
      status: entry.data.status,
      date: isoDate(entry.data.updatedDate) || String(entry.data.year),
      thread: entry.data.thread || "",
      tags: entry.data.tags,
      body: [
        entry.body,
        entry.data.abstract,
        entry.data.problem,
        entry.data.method,
        entry.data.reviewNote,
        entry.data.nextStep,
        ...(entry.data.contribution || []),
        ...(entry.data.limitations || []),
        ...(entry.data.evidence || []),
      ].filter(Boolean).join("\n"),
      relations: {
        relatedProjects: entry.data.relatedProjects,
        relatedNotes: entry.data.relatedNotes,
        relatedLibrary: entry.data.relatedLibrary,
        series: entry.data.series || "",
      },
      artifacts: entry.data.artifacts,
      links: [
        entry.data.pdf,
        entry.data.code,
        ...entry.data.relatedProjects,
        ...entry.data.relatedNotes,
        ...entry.data.relatedLibrary,
        ...entry.data.artifacts.map((artifact) => artifact.href),
        ...extractLinks(entry.body),
      ],
      flags: {
        hasEvidence: Boolean(entry.data.evidence?.length),
        hasContribution: Boolean(entry.data.contribution?.length),
        hasNextStep: Boolean(entry.data.nextStep),
      },
    })),
    ...projects.filter(isPublic).map((entry) => contentItem({
      id: entry.id,
      type: "project",
      title: entry.data.title,
      url: projectHref(entry),
      status: entry.data.status,
      statusDetail: entry.data.statusDetail,
      date: isoDate(entry.data.updatedDate) || "",
      thread: entry.data.thread || "",
      tags: entry.data.tags,
      body: [
        entry.body,
        entry.data.summary,
        entry.data.problem,
        entry.data.method,
        entry.data.outcome,
        entry.data.nextStep,
        entry.data.maturityNote,
        ...(entry.data.evidence || []),
        ...(entry.data.lessons || []),
        ...(entry.data.techStack || []),
      ].filter(Boolean).join("\n"),
      relations: {
        relatedPapers: entry.data.relatedPapers,
        relatedNotes: entry.data.relatedNotes,
        relatedLibrary: entry.data.relatedLibrary,
        series: entry.data.series || "",
      },
      artifacts: entry.data.artifacts,
      links: [
        entry.data.repo ? `https://github.com/dreamkeeperhu/${entry.data.repo}` : "",
        entry.data.url,
        ...entry.data.links.map((link) => link.href),
        ...entry.data.relatedPapers,
        ...entry.data.relatedNotes,
        ...entry.data.relatedLibrary,
        ...entry.data.artifacts.map((artifact) => artifact.href),
        ...extractLinks(entry.body),
      ],
      flags: {
        hasEvidence: Boolean(entry.data.evidence?.length),
        hasOutcome: Boolean(entry.data.outcome),
        hasNextStep: Boolean(entry.data.nextStep),
      },
    })),
    ...library.filter(isPublic).map((entry) => contentItem({
      id: entry.id,
      type: "library",
      title: entry.data.title,
      url: libraryHref(entry),
      status: entry.data.status,
      date: isoDate(entry.data.updatedDate) || entry.data.year,
      thread: entry.data.thread || "",
      tags: entry.data.tags,
      body: [
        entry.body,
        entry.data.note,
        entry.data.whyItMatters,
        ...(entry.data.takeaways || []),
        ...(entry.data.authors || []),
      ].filter(Boolean).join("\n"),
      relations: {
        relatedPapers: entry.data.relatedPapers,
        relatedProjects: entry.data.relatedProjects,
        relatedNotes: entry.data.relatedNotes,
        series: entry.data.series || "",
      },
      artifacts: entry.data.artifacts,
      links: [
        entry.data.url,
        ...entry.data.relatedPapers,
        ...entry.data.relatedProjects,
        ...entry.data.relatedNotes,
        ...entry.data.artifacts.map((artifact) => artifact.href),
        ...extractLinks(entry.body),
      ],
      flags: {
        hasWhyItMatters: Boolean(entry.data.whyItMatters),
        takeawayCount: entry.data.takeaways?.length || 0,
      },
    })),
    ...timeline.filter(isPublic).map((entry) => contentItem({
      id: entry.id,
      type: "timeline",
      title: entry.data.title,
      url: entry.data.link,
      status: entry.data.type,
      date: timelineSortValue(entry.data.date),
      thread: "",
      tags: [entry.data.type],
      body: [entry.body, entry.data.summary].filter(Boolean).join("\n"),
      links: [entry.data.link, ...extractLinks(entry.body)],
    })),
    ...roadmap.filter(isPublic).map((entry) => contentItem({
      id: entry.id,
      type: "roadmap",
      title: entry.data.title,
      url: `/research#${entry.id.replace(/^obsidian\//, "").replace(/\.(md|mdx)$/i, "")}`,
      status: "roadmap",
      date: "",
      thread: entry.id.replace(/^obsidian\//, "").replace(/\.(md|mdx)$/i, ""),
      tags: entry.data.tags,
      body: [entry.body, entry.data.question, entry.data.now, entry.data.next].filter(Boolean).join("\n"),
      relations: {
        relatedProjects: entry.data.relatedProjects,
        relatedNotes: entry.data.relatedNotes,
      },
      links: [
        ...entry.data.links.map((link) => link.href),
        ...entry.data.relatedProjects,
        ...entry.data.relatedNotes,
        ...extractLinks(entry.body),
      ],
    })),
  ];

  return new Response(JSON.stringify({
    ok: true,
    generatedAt: new Date().toISOString(),
    count: items.length,
    items: items.sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))),
  }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=600",
    },
  });
}

function contentItem({
  id,
  type,
  title,
  url,
  status,
  statusDetail = "",
  date,
  thread,
  tags = [],
  body = "",
  relations = {},
  artifacts = [],
  links = [],
  flags = {},
}) {
  const cleanLinks = [...new Set(links.filter(Boolean).map((link) => String(link).trim()).filter(Boolean))];
  return {
    id,
    type,
    title,
    url,
    thread,
    tags,
    status,
    statusDetail,
    date,
    relations,
    artifacts,
    links: cleanLinks,
    linkCount: cleanLinks.length,
    artifactCount: artifacts.length,
    bodyHash: hashText(body),
    bodyWordCount: wordCount(body),
    flags,
  };
}

function isPublic(entry) {
  return entry.data.draft !== true;
}

function isoDate(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? String(value) : parsed.toISOString().slice(0, 10);
}

function extractLinks(value) {
  return [...String(value || "").matchAll(/\[[^\]]+]\(([^)]+)\)/g)].map((match) => match[1]);
}

function hashText(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

function wordCount(value) {
  const text = String(value || "").replace(/```[\s\S]*?```/g, " ");
  const latin = text.match(/[A-Za-z0-9_]+/g)?.length || 0;
  const cjk = text.match(/[\u4e00-\u9fa5]/g)?.length || 0;
  return latin + cjk;
}
