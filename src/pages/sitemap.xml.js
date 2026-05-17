import { getCollection } from "astro:content";
import { libraryHref, noteHref, paperHref, projectHref } from "../utils/content";

const staticPages = ["/", "/about", "/cv", "/research", "/research/map", "/projects", "/library", "/timeline", "/contact", "/notes", "/now", "/friends", "/search", "/tags", "/writing"];

export async function GET({ site }) {
  const notes = (await getCollection("notes")).filter((note) => !note.data.draft);
  const papers = (await getCollection("papers")).filter((paper) => !paper.data.draft);
  const projects = (await getCollection("projects")).filter((project) => !project.data.draft);
  const library = (await getCollection("library")).filter((item) => !item.data.draft);
  const urls = [
    ...staticPages,
    ...notes.map((note) => noteHref(note)),
    ...papers.map((paper) => paperHref(paper)),
    ...projects.map((project) => projectHref(project)),
    ...library.map((item) => libraryHref(item)),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((url) => `  <url><loc>${new URL(url, site).toString()}</loc></url>`)
    .join("\n")}\n</urlset>`;

  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
