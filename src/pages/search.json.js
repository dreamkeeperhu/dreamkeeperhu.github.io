import { getCollection } from "astro:content";
import { noteHref } from "../utils/content";

export async function GET() {
  const notes = (await getCollection("notes")).filter((note) => !note.data.draft);
  const papers = (await getCollection("papers")).filter((paper) => !paper.data.draft);

  const items = [
    ...notes.map((note) => ({
      type: "note",
      title: note.data.title,
      description: note.data.description,
      url: noteHref(note),
      tags: note.data.tags,
      date: note.data.pubDate.toISOString().slice(0, 10),
      source: note.data.source || "markdown",
    })),
    ...papers.map((paper) => ({
      type: "paper",
      title: paper.data.title,
      description: paper.data.abstract,
      url: "/research",
      tags: paper.data.tags,
      date: String(paper.data.year),
      source: paper.data.source || "markdown",
    })),
    {
      type: "page",
      title: "CV",
      description: "Public resume PDF and online preview.",
      url: "/cv",
      tags: ["cv", "resume"],
      date: "2026-05-16",
      source: "site",
    },
  ];

  return new Response(JSON.stringify(items), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=600",
    },
  });
}
