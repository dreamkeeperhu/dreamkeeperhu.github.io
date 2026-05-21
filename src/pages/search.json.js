import { getCollection } from "astro:content";
import { libraryHref, noteHref, paperHref, projectHref, timelineSortValue } from "../utils/content";

export async function GET() {
  const notes = (await getCollection("notes")).filter((note) => !note.data.draft);
  const papers = (await getCollection("papers")).filter((paper) => !paper.data.draft);
  const projects = (await getCollection("projects")).filter((project) => !project.data.draft);
  const library = (await getCollection("library")).filter((item) => !item.data.draft);
  const timeline = (await getCollection("timeline")).filter((item) => !item.data.draft);
  const roadmap = (await getCollection("roadmap")).filter((item) => !item.data.draft);

  const items = [
    ...notes.map((note) => ({
      type: "note",
      title: note.data.title,
      description: note.data.description,
      url: noteHref(note),
      tags: note.data.tags,
      date: (note.data.updatedDate || note.data.pubDate).toISOString().slice(0, 10),
      status: note.data.category,
      category: note.data.category,
      thread: note.data.thread || inferThread(note.data.tags),
      headings: headings(note.body),
      snippets: snippets(note.body),
    })),
    ...papers.map((paper) => ({
      type: "paper",
      title: paper.data.title,
      description: paper.data.abstract,
      url: paperHref(paper),
      tags: paper.data.tags,
      date: paper.data.updatedDate ? paper.data.updatedDate.toISOString().slice(0, 10) : String(paper.data.year),
      status: paper.data.status,
      thread: paper.data.thread || inferThread(paper.data.tags),
      headings: headings(paper.body),
      snippets: snippets([
        paper.body,
        paper.data.problem,
        paper.data.method,
        ...(paper.data.contribution || []),
        ...(paper.data.limitations || []),
        paper.data.reviewNote,
        paper.data.nextStep,
      ].filter(Boolean).join(" ")),
    })),
    ...projects.map((project) => ({
      type: "project",
      title: project.data.title,
      description: project.data.summary,
      url: projectHref(project),
      tags: project.data.tags,
      date: project.data.updatedDate ? project.data.updatedDate.toISOString().slice(0, 10) : project.data.status,
      status: project.data.status,
      statusDetail: project.data.statusDetail,
      thread: project.data.thread || inferThread(project.data.tags),
      headings: headings(project.body),
      snippets: snippets([
        project.body,
        project.data.problem,
        project.data.method,
        project.data.nextStep,
        project.data.outcome,
        project.data.maturityNote,
        ...(project.data.lessons || []),
        ...(project.data.techStack || []),
      ].filter(Boolean).join(" ")),
    })),
    ...library.map((item) => ({
      type: "library",
      title: item.data.title,
      description: item.data.note,
      url: libraryHref(item),
      tags: item.data.tags,
      date: item.data.updatedDate ? item.data.updatedDate.toISOString().slice(0, 10) : item.data.year,
      status: item.data.status,
      thread: item.data.thread || inferThread(item.data.tags),
      headings: headings(item.body),
      snippets: snippets([
        item.body,
        item.data.type,
        item.data.whyItMatters,
        ...(item.data.takeaways || []),
        ...(item.data.authors || []),
      ].filter(Boolean).join(" ")),
    })),
    ...timeline
      .sort((a, b) => timelineSortValue(b.data.date).localeCompare(timelineSortValue(a.data.date)))
      .map((item) => ({
        type: "timeline",
        title: item.data.title,
        description: item.data.summary,
        url: item.data.link,
        tags: [item.data.type],
        date: item.data.date,
        status: item.data.type,
        thread: inferThread([item.data.type, item.data.summary]),
        headings: headings(item.body),
        snippets: snippets(item.body),
      })),
    ...roadmap.map((item) => ({
      type: "page",
      title: item.data.title,
      description: item.data.question,
      url: `/research#${item.id.replace(/^obsidian\//, "").replace(/\.(md|mdx)$/i, "")}`,
      tags: item.data.tags,
      date: "roadmap",
      status: "roadmap",
      thread: item.id.replace(/^obsidian\//, "").replace(/\.(md|mdx)$/i, ""),
      headings: headings(item.body),
      snippets: snippets([item.body, item.data.now, item.data.next].filter(Boolean).join(" ")),
    })),
    {
      type: "page",
      title: "CV",
      description: "Public resume PDF and online preview.",
      url: "/cv",
      tags: ["cv", "resume"],
      date: "2026-05-16",
      thread: "profile",
      status: "page",
      headings: [],
      snippets: ["Public resume PDF and online preview."],
    },
    {
      type: "page",
      title: "Contact",
      description: "Reach out for robotics, research, project feedback, or general conversation.",
      url: "/contact",
      tags: ["contact", "email"],
      date: "2026-05-17",
      thread: "contact",
      status: "page",
      headings: [],
      snippets: ["Contact page for research, project feedback, and general conversation."],
    },
    {
      type: "page",
      title: "Research Map",
      description: "Lightweight map connecting roadmap threads, papers, projects, notes, and library entries.",
      url: "/research/map",
      tags: ["research", "map", "evidence"],
      date: "2026-05-17",
      thread: "research-map",
      status: "page",
      headings: [],
      snippets: ["Research map connecting roadmap threads, papers, projects, notes, and library entries."],
    },
  ];

  return new Response(JSON.stringify(items), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=600",
    },
  });
}

function headings(value) {
  return [...String(value || "").matchAll(/^#{1,3}\s+(.+)$/gm)].map((match) => match[1].trim()).slice(0, 8);
}

function snippets(value) {
  return String(value || "")
    .replace(/^---[\s\S]*?---/, "")
    .split(/\n{2,}/)
    .map((chunk) => plainText(chunk))
    .filter((chunk) => chunk.length > 40)
    .map((chunk) => chunk.slice(0, 260))
    .slice(0, 3);
}

function inferThread(value) {
  const text = Array.isArray(value) ? value.join(" ") : String(value || "");
  const lower = text.toLowerCase();
  if (lower.includes("sim-to-real") || lower.includes("transfer")) return "sim-to-real";
  if (lower.includes("instruction") || lower.includes("instruct")) return "robotics-instruction";
  if (lower.includes("cloud") || lower.includes("scheduling") || lower.includes("cooperative")) return "distributed-cooperation";
  if (lower.includes("astro") || lower.includes("obsidian") || lower.includes("site")) return "research-infrastructure";
  if (lower.includes("tool") || lower.includes("automation")) return "tools";
  return "next-robotics-paradigm";
}

function plainText(value) {
  return String(value || "")
    .replace(/^---[\s\S]*?---/, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[#>*_`~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 260);
}
