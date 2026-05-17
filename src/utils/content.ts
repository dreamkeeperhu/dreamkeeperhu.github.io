import type { CollectionEntry } from "astro:content";

export function noteSlug(note: CollectionEntry<"notes">) {
  return note.id.replace(/^obsidian\//, "");
}

export function noteHref(note: CollectionEntry<"notes">) {
  return `/notes/${noteSlug(note)}`;
}

export function paperSlug(paper: CollectionEntry<"papers">) {
  return paper.id.replace(/^obsidian\//, "").replace(/\.(md|mdx)$/i, "");
}

export function paperHref(paper: CollectionEntry<"papers">) {
  return `/research/${paperSlug(paper)}`;
}

export function projectSlug(project: CollectionEntry<"projects">) {
  return entrySlug(project.id);
}

export function projectHref(project: CollectionEntry<"projects">) {
  return `/projects/${projectSlug(project)}`;
}

export function librarySlug(item: CollectionEntry<"library">) {
  return entrySlug(item.id);
}

export function libraryHref(item: CollectionEntry<"library">) {
  return `/library/${librarySlug(item)}`;
}

export function timelineYear(date: string) {
  const match = String(date).match(/^\d{4}/);
  return match ? match[0] : "Other";
}

export function timelineSortValue(date: string) {
  const text = String(date || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}-\d{2}$/.test(text)) return `${text}-01`;
  if (/^\d{4}$/.test(text)) return `${text}-01-01`;
  return "0000-01-01";
}

export function entryUpdatedValue(entry: { data: Record<string, unknown> }) {
  const data = entry.data;
  const value = data.updatedDate || data.pubDate || data.year || data.date || "";
  if (value instanceof Date) return value.valueOf();
  const text = String(value || "");
  if (/^\d{4}$/.test(text)) return new Date(`${text}-01-01`).valueOf();
  if (/^\d{4}-\d{2}$/.test(text)) return new Date(`${text}-01`).valueOf();
  const parsed = new Date(text).valueOf();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sortFeaturedEntries<T extends { data: Record<string, unknown> }>(entries: T[]) {
  return [...entries].sort((a, b) => {
    const featuredDelta = Number(Boolean(b.data.featured)) - Number(Boolean(a.data.featured));
    if (featuredDelta) return featuredDelta;
    const orderDelta = Number(a.data.order ?? 99) - Number(b.data.order ?? 99);
    if (orderDelta) return orderDelta;
    const evidenceDelta = evidenceCount(b) - evidenceCount(a);
    if (evidenceDelta) return evidenceDelta;
    return entryUpdatedValue(b) - entryUpdatedValue(a);
  });
}

export function sortSelectedWork<T extends { data: Record<string, unknown> }>(entries: T[]) {
  return [...entries].sort((a, b) => {
    const featuredDelta = Number(Boolean(b.data.featured)) - Number(Boolean(a.data.featured));
    if (featuredDelta) return featuredDelta;
    const orderDelta = Number(a.data.order ?? 99) - Number(b.data.order ?? 99);
    if (orderDelta) return orderDelta;
    const updatedDelta = entryUpdatedValue(b) - entryUpdatedValue(a);
    if (updatedDelta) return updatedDelta;
    return evidenceCount(b) - evidenceCount(a);
  });
}

export function evidenceCount(entry: { data: Record<string, unknown> }) {
  const artifacts = Array.isArray(entry.data.artifacts) ? entry.data.artifacts.length : 0;
  const evidence = Array.isArray(entry.data.evidence) ? entry.data.evidence.length : 0;
  return artifacts + evidence;
}

export function entrySlug(id: string) {
  return id.replace(/^obsidian\//, "").replace(/\.(md|mdx)$/i, "");
}

export function tagSlug(tag: string) {
  return tag
    .normalize("NFKD")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function tagCounts(notes: CollectionEntry<"notes">[]) {
  const counts = new Map<string, number>();
  for (const note of notes) {
    for (const tag of note.data.tags) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
