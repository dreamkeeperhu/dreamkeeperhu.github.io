import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

export async function GET(context) {
  const notes = (await getCollection("notes"))
    .filter((note) => !note.data.draft)
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  return rss({
    title: "HJH Notes",
    description: "Notes on robotics, sim-to-real, tools, and research by Jianheng Hu.",
    site: context.site,
    items: notes.map((note) => ({
      title: note.data.title,
      description: note.data.description,
      pubDate: note.data.pubDate,
      link: `/notes/${note.id}`,
    })),
  });
}
