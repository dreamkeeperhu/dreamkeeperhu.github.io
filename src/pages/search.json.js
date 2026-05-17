import { getCollection } from "astro:content";
import { libraryItems } from "../data/library";
import { selectedProjects } from "../data/projects";
import { milestones } from "../data/timeline";
import { noteHref, paperHref } from "../utils/content";

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
      url: paperHref(paper),
      tags: paper.data.tags,
      date: String(paper.data.year),
      status: paper.data.status,
      source: paper.data.source || "markdown",
    })),
    ...selectedProjects.map((project) => ({
      type: "project",
      title: project.name,
      description: project.summary,
      url: `/projects#${project.slug}`,
      tags: project.tags,
      date: project.status,
      status: project.status,
      source: "project",
    })),
    ...libraryItems.map((item) => ({
      type: "library",
      title: item.title,
      description: item.note,
      url: item.url,
      tags: item.tags,
      date: item.year,
      status: item.status,
      source: "library",
    })),
    ...milestones.map((item) => ({
      type: "timeline",
      title: item.title,
      description: item.summary,
      url: item.link,
      tags: [item.type],
      date: item.date,
      status: item.type,
      source: "timeline",
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
    {
      type: "page",
      title: "Contact",
      description: "Reach out for robotics, research, project feedback, or general conversation.",
      url: "/contact",
      tags: ["contact", "email"],
      date: "2026-05-17",
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
