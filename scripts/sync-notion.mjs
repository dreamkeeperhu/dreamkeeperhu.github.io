import { Client } from "@notionhq/client";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

await loadDotEnv(".env.local");
await loadDotEnv(".env");

const auth = process.env.NOTION_API_KEY || process.env.NOTION_TOKEN || process.env.NOTION_KEY;
const notionVersion = process.env.NOTION_VERSION || "2026-03-11";
const syncDrafts = process.env.NOTION_SYNC_DRAFTS === "true";
const cleanSync = process.env.NOTION_CLEAN_SYNC !== "false";

if (!auth) {
  console.log("[notion] Sync skipped: set NOTION_API_KEY to enable Notion import.");
  process.exit(0);
}

const notion = new Client({ auth, notionVersion });

const notesSource = await resolveDataSource({
  label: "notes",
  dataSourceId: process.env.NOTION_NOTES_DATA_SOURCE_ID,
  databaseId: process.env.NOTION_NOTES_DATABASE_ID,
});

const papersSource = await resolveDataSource({
  label: "papers",
  dataSourceId: process.env.NOTION_PAPERS_DATA_SOURCE_ID,
  databaseId: process.env.NOTION_PAPERS_DATABASE_ID,
});

if (!notesSource && !papersSource) {
  console.log("[notion] Sync skipped: set NOTION_NOTES_DATA_SOURCE_ID or NOTION_NOTES_DATABASE_ID.");
  process.exit(0);
}

if (notesSource) {
  await syncCollection({
    label: "notes",
    dataSourceId: notesSource,
    outDir: path.join(root, "src/content/notes/notion"),
    map: mapNote,
  });
}

if (papersSource) {
  await syncCollection({
    label: "papers",
    dataSourceId: papersSource,
    outDir: path.join(root, "src/content/papers/notion"),
    map: mapPaper,
  });
}

async function loadDotEnv(file) {
  try {
    const raw = await fs.readFile(path.join(root, file), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (process.env[key]) continue;
      process.env[key] = rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // Optional local env file.
  }
}

async function resolveDataSource({ label, dataSourceId, databaseId }) {
  if (dataSourceId) return cleanId(dataSourceId);
  if (!databaseId) return "";

  const database = await notion.databases.retrieve({ database_id: cleanId(databaseId) });
  const first = database.data_sources?.[0]?.id;
  if (!first) {
    throw new Error(`[notion] ${label}: database has no data_sources. Copy the data source ID directly.`);
  }
  return first;
}

async function syncCollection({ label, dataSourceId, outDir, map }) {
  if (cleanSync) {
    await fs.rm(outDir, { recursive: true, force: true });
  }
  await fs.mkdir(outDir, { recursive: true });

  const pages = await queryAll(dataSourceId);
  let written = 0;

  for (const page of pages) {
    if (page.object !== "page" || page.archived || page.in_trash) continue;

    const body = await pageToMarkdown(page.id);
    const mapped = map({ page, body });
    if (!mapped || (mapped.data.draft && !syncDrafts)) continue;

    const target = path.join(outDir, `${mapped.slug}.md`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, `${frontmatter(mapped.data)}\n${body || "Imported from Notion."}\n`, "utf8");
    written += 1;
  }

  console.log(`[notion] Synced ${written} ${label} from ${dataSourceId}.`);
}

async function queryAll(dataSourceId) {
  const pages = [];
  let start_cursor;

  do {
    const response = await notion.dataSources.query({
      data_source_id: cleanId(dataSourceId),
      page_size: 100,
      start_cursor,
    });
    pages.push(...response.results);
    start_cursor = response.has_more ? response.next_cursor : undefined;
  } while (start_cursor);

  return pages;
}

async function pageToMarkdown(blockId, depth = 0) {
  const blocks = await listBlocks(blockId);
  const lines = [];

  for (const block of blocks) {
    const markdown = await blockToMarkdown(block, depth);
    if (markdown) lines.push(markdown);
  }

  return lines.join("\n\n").trim();
}

async function listBlocks(blockId) {
  const blocks = [];
  let start_cursor;

  do {
    const response = await notion.blocks.children.list({
      block_id: blockId,
      page_size: 100,
      start_cursor,
    });
    blocks.push(...response.results);
    start_cursor = response.has_more ? response.next_cursor : undefined;
  } while (start_cursor);

  return blocks;
}

async function blockToMarkdown(block, depth) {
  const indent = "  ".repeat(depth);
  const type = block.type;
  const value = block[type] || {};
  const text = richText(value.rich_text || []);
  const children = block.has_children ? await pageToMarkdown(block.id, depth + 1) : "";

  switch (type) {
    case "paragraph":
      return joinWithChildren(text, children);
    case "heading_1":
      return `# ${text}`;
    case "heading_2":
      return `## ${text}`;
    case "heading_3":
      return `### ${text}`;
    case "bulleted_list_item":
      return `${indent}- ${text}${children ? `\n${children}` : ""}`;
    case "numbered_list_item":
      return `${indent}1. ${text}${children ? `\n${children}` : ""}`;
    case "to_do":
      return `${indent}- [${value.checked ? "x" : " "}] ${text}${children ? `\n${children}` : ""}`;
    case "quote":
      return `> ${text.replace(/\n/g, "\n> ")}`;
    case "callout":
      return `> ${emoji(value.icon)} ${text}`.trim();
    case "code":
      return `\`\`\`${value.language || ""}\n${plainText(value.rich_text || [])}\n\`\`\``;
    case "divider":
      return "---";
    case "image":
      return imageMarkdown(value);
    case "bookmark":
    case "embed":
    case "link_preview":
      return value.url ? `[${value.url}](${value.url})` : "";
    case "toggle":
      return `<details><summary>${text}</summary>\n\n${children}\n\n</details>`;
    case "child_page":
      return `## ${value.title || "Child page"}`;
    default:
      return joinWithChildren(text, children);
  }
}

function joinWithChildren(text, children) {
  if (text && children) return `${text}\n\n${children}`;
  return text || children;
}

function mapNote({ page, body }) {
  const title = propertyTitle(page) || "Untitled Notion note";
  const description = propertyText(page, ["Description", "Summary", "Excerpt", "描述", "摘要"]) || excerpt(body);
  const pubDate = propertyDate(page, ["Date", "Published", "Publish Date", "Created", "日期", "创建时间"]) || page.created_time.slice(0, 10);

  return {
    slug: slugify(propertyText(page, ["Slug", "URL Slug", "路径"]) || title),
    data: {
      title,
      description,
      pubDate,
      updatedDate: page.last_edited_time?.slice(0, 10),
      tags: propertyList(page, ["Tags", "Tag", "标签"]),
      draft: isDraft(page),
      source: "notion",
      notionId: page.id,
      notionUrl: page.url,
    },
  };
}

function mapPaper({ page, body }) {
  const title = propertyTitle(page) || "Untitled Notion paper";
  const status = normalizeStatus(propertyText(page, ["Status", "状态"]) || "in preparation");
  const year = numberValue(propertyText(page, ["Year", "年份"])) || Number((propertyDate(page, ["Date", "Published", "日期"]) || page.created_time).slice(0, 4));

  return {
    slug: slugify(propertyText(page, ["Slug", "URL Slug", "路径"]) || title),
    data: {
      title,
      authors: propertyList(page, ["Authors", "Author", "作者"]) || ["Jianheng Hu"],
      status,
      venue: propertyText(page, ["Venue", "Journal", "Target", "会议", "期刊"]) || undefined,
      year,
      abstract: propertyText(page, ["Abstract", "Summary", "摘要"]) || excerpt(body),
      pdf: propertyText(page, ["PDF", "Pdf", "Paper PDF"]),
      code: propertyText(page, ["Code", "Repository", "Repo", "GitHub"]),
      tags: propertyList(page, ["Tags", "Tag", "标签"]),
      source: "notion",
      notionId: page.id,
      notionUrl: page.url,
      draft: isDraft(page),
    },
  };
}

function propertyTitle(page) {
  const property = findProperty(page, ["Title", "Name", "标题", "名称"]) || firstPropertyOfType(page, "title");
  return propertyValue(property);
}

function propertyText(page, names) {
  return propertyValue(findProperty(page, names));
}

function propertyDate(page, names) {
  const value = findProperty(page, names);
  if (value?.type === "date") return value.date?.start || "";
  if (value?.type === "created_time") return value.created_time?.slice(0, 10) || "";
  return propertyValue(value);
}

function propertyList(page, names) {
  const value = findProperty(page, names);
  if (!value) return [];
  if (value.type === "multi_select") return value.multi_select.map((item) => item.name).filter(Boolean);
  if (value.type === "people") return value.people.map((person) => person.name || person.id).filter(Boolean);
  const text = propertyValue(value);
  return text ? text.split(/[,;，、]/).map((item) => item.trim()).filter(Boolean) : [];
}

function findProperty(page, names) {
  const wanted = names.map(normalizeName);
  return Object.entries(page.properties || {}).find(([name]) => wanted.includes(normalizeName(name)))?.[1];
}

function firstPropertyOfType(page, type) {
  return Object.values(page.properties || {}).find((property) => property.type === type);
}

function propertyValue(property) {
  if (!property) return "";

  switch (property.type) {
    case "title":
      return richText(property.title || []);
    case "rich_text":
      return richText(property.rich_text || []);
    case "select":
      return property.select?.name || "";
    case "status":
      return property.status?.name || "";
    case "multi_select":
      return property.multi_select.map((item) => item.name).join(", ");
    case "date":
      return property.date?.start || "";
    case "checkbox":
      return property.checkbox ? "true" : "false";
    case "url":
      return property.url || "";
    case "email":
      return property.email || "";
    case "phone_number":
      return property.phone_number || "";
    case "number":
      return property.number === null ? "" : String(property.number);
    case "people":
      return property.people.map((person) => person.name || person.id).join(", ");
    case "created_time":
      return property.created_time?.slice(0, 10) || "";
    case "last_edited_time":
      return property.last_edited_time?.slice(0, 10) || "";
    case "formula":
      return formulaValue(property.formula);
    default:
      return "";
  }
}

function isDraft(page) {
  const draft = findProperty(page, ["Draft", "Private", "草稿"]);
  if (draft?.type === "checkbox" && draft.checkbox) return true;

  const publish = findProperty(page, ["Publish", "Published", "Public", "公开"]);
  if (publish?.type === "checkbox" && !publish.checkbox) return true;

  const status = propertyText(page, ["Status", "状态"]).toLowerCase();
  if (["draft", "private", "idea", "inbox", "草稿"].some((word) => status.includes(word))) return true;

  const visibility = propertyText(page, ["Visibility", "可见性"]).toLowerCase();
  return visibility.includes("private") || visibility.includes("草稿");
}

function richText(items) {
  return items.map((item) => annotate(item.plain_text || "", item.annotations || {}, item.href)).join("");
}

function plainText(items) {
  return items.map((item) => item.plain_text || "").join("");
}

function annotate(text, annotations, href) {
  let value = text.replace(/\|/g, "\\|");
  if (!value) return "";
  if (annotations.code) value = `\`${value}\``;
  if (annotations.bold) value = `**${value}**`;
  if (annotations.italic) value = `_${value}_`;
  if (annotations.strikethrough) value = `~~${value}~~`;
  if (href) value = `[${value}](${href})`;
  return value;
}

function imageMarkdown(value) {
  const url = value.type === "external" ? value.external?.url : value.file?.url;
  if (!url) return "";
  const caption = richText(value.caption || []) || "Notion image";
  return `![${caption}](${url})`;
}

function emoji(icon) {
  return icon?.type === "emoji" ? icon.emoji : "";
}

function formulaValue(formula) {
  if (!formula) return "";
  if (formula.type === "string") return formula.string || "";
  if (formula.type === "number") return formula.number === null ? "" : String(formula.number);
  if (formula.type === "boolean") return formula.boolean ? "true" : "false";
  if (formula.type === "date") return formula.date?.start || "";
  return "";
}

function frontmatter(data) {
  const lines = ["---", "# Generated from Notion. Edit the source database item or copy this file out of the notion folder."];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === "" || (Array.isArray(value) && !value.length)) continue;
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) lines.push(`  - ${JSON.stringify(item)}`);
    } else if (typeof value === "string") {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

function excerpt(body) {
  return body
    .replace(/^#+\s+/gm, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[#>*_`[\]()~-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180) || "Imported from Notion.";
}

function normalizeName(name) {
  return String(name).toLowerCase().replace(/[\s_-]+/g, "");
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function normalizeStatus(status) {
  const lower = status.toLowerCase();
  if (lower.includes("published")) return "published";
  if (lower.includes("review")) return "under review";
  if (lower.includes("preprint")) return "preprint";
  return "in preparation";
}

function cleanId(value) {
  const text = String(value || "").trim();
  const id = text.match(/[a-f0-9]{32}|[a-f0-9-]{36}/i)?.[0] || text;
  return id.replace(/-/g, "");
}

function slugify(value) {
  return String(value)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "notion-note";
}
