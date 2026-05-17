import type { CollectionEntry } from "astro:content";
import { libraryHref, noteHref, paperHref, projectHref } from "./content";

type Backlink = {
  title: string;
  type: "paper" | "project" | "note" | "library";
  href: string;
  reason?: string;
};

type RelationCollections = {
  papers?: CollectionEntry<"papers">[];
  projects?: CollectionEntry<"projects">[];
  notes?: CollectionEntry<"notes">[];
  library?: CollectionEntry<"library">[];
};

export function collectBacklinks(targetHref: string, collections: RelationCollections): Backlink[] {
  const rows: Backlink[] = [];
  for (const paper of collections.papers || []) {
    addIfLinked(rows, targetHref, paperHref(paper), paper.data.title, "paper", [
      ...paper.data.relatedProjects,
      ...paper.data.relatedNotes,
      ...paper.data.relatedLibrary,
      ...paper.data.artifacts.map((artifact) => artifact.href),
    ]);
  }
  for (const project of collections.projects || []) {
    addIfLinked(rows, targetHref, projectHref(project), project.data.title, "project", [
      ...project.data.relatedPapers,
      ...project.data.relatedNotes,
      ...project.data.relatedLibrary,
      ...project.data.artifacts.map((artifact) => artifact.href),
    ]);
  }
  for (const item of collections.library || []) {
    addIfLinked(rows, targetHref, libraryHref(item), item.data.title, "library", [
      ...item.data.relatedPapers,
      ...item.data.relatedProjects,
      ...item.data.relatedNotes,
      ...item.data.artifacts.map((artifact) => artifact.href),
    ]);
  }
  for (const note of collections.notes || []) {
    addIfLinked(rows, targetHref, noteHref(note), note.data.title, "note", []);
  }
  return dedupe(rows).slice(0, 8);
}

export function collectRelationGroups(
  targetHref: string,
  outgoing: string[],
  tags: string[],
  collections: RelationCollections
) {
  const rows = collectRows(collections);
  const byHref = new Map(rows.map((row) => [normalize(row.href), row]));
  const upstream = dedupe(
    outgoing
      .map((href) => byHref.get(normalize(href)) || localFallback(href))
      .filter(Boolean)
      .map((row) => ({ ...row, reason: "direct link from this page" }))
  ).slice(0, 8);
  const downstream = collectBacklinks(targetHref, collections).map((row) => ({ ...row, reason: "links back to this page" }));
  const tagSet = new Set((tags || []).map((tag) => tag.toLowerCase()));
  const siblings = rows
    .filter((row) => normalize(row.href) !== normalize(targetHref))
    .filter((row) => row.tags.some((tag) => tagSet.has(tag.toLowerCase())))
    .filter((row) => !upstream.some((item) => item.href === row.href) && !downstream.some((item) => item.href === row.href))
    .map((row) => ({ ...row, reason: "shares research tags" }))
    .slice(0, 6);
  return { upstream, downstream, siblings };
}

function addIfLinked(rows: Backlink[], targetHref: string, href: string, title: string, type: Backlink["type"], links: string[]) {
  if (href === targetHref) return;
  if (links.some((link) => normalize(link) === normalize(targetHref))) rows.push({ title, type, href });
}

function normalize(href: string) {
  return String(href || "").replace(/\/$/, "");
}

function dedupe(rows: Backlink[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.href)) return false;
    seen.add(row.href);
    return true;
  });
}

function collectRows(collections: RelationCollections) {
  return [
    ...(collections.papers || []).map((paper) => ({ title: paper.data.title, type: "paper" as const, href: paperHref(paper), tags: paper.data.tags || [] })),
    ...(collections.projects || []).map((project) => ({ title: project.data.title, type: "project" as const, href: projectHref(project), tags: project.data.tags || [] })),
    ...(collections.notes || []).map((note) => ({ title: note.data.title, type: "note" as const, href: noteHref(note), tags: note.data.tags || [] })),
    ...(collections.library || []).map((item) => ({ title: item.data.title, type: "library" as const, href: libraryHref(item), tags: item.data.tags || [] })),
  ];
}

function localFallback(href: string) {
  if (!href?.startsWith("/")) return null;
  const parts = href.split("/").filter(Boolean);
  const type = parts[0] === "research" ? "paper" : parts[0]?.replace(/s$/, "");
  if (!["paper", "project", "note", "library"].includes(type)) return null;
  return {
    title: parts.at(-1)?.replace(/-/g, " ") || href,
    type: type as Backlink["type"],
    href,
    tags: [],
  };
}
