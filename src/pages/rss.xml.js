import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { selectedProjects } from "../data/projects";
import { noteHref, paperHref } from "../utils/content";

export async function GET(context) {
  const notes = (await getCollection("notes"))
    .filter((note) => !note.data.draft)
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
  const papers = (await getCollection("papers"))
    .filter((paper) => !paper.data.draft)
    .sort((a, b) => b.data.year - a.data.year);

  return rss({
    title: "HJH Research & Notes",
    description: "Research updates, notes, and selected project traces by Jianheng Hu.",
    site: context.site,
    items: [
      ...notes.map((note) => ({
        title: note.data.title,
        description: note.data.description,
        pubDate: note.data.pubDate,
        link: noteHref(note),
      })),
      ...papers.map((paper) => ({
        title: `Research: ${paper.data.title}`,
        description: paper.data.abstract,
        pubDate: new Date(`${paper.data.year}-01-01`),
        link: paperHref(paper),
      })),
      ...selectedProjects.map((project) => ({
        title: `Project: ${project.name}`,
        description: project.summary,
        pubDate: new Date("2026-05-17"),
        link: `/projects#${project.slug}`,
      })),
    ],
  });
}
