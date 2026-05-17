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
