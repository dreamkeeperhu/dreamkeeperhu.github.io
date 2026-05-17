import type { CollectionEntry } from "astro:content";
import { libraryHref, noteHref, paperHref, projectHref } from "./content";

type Backlink = {
  title: string;
  type: "paper" | "project" | "note" | "library";
  href: string;
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
