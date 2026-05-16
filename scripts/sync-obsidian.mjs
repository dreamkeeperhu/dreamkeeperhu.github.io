import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

await loadDotEnv(".env.local");
await loadDotEnv(".env");

const vaultPath = process.env.OBSIDIAN_VAULT_PATH;
const notesDir = process.env.OBSIDIAN_NOTES_DIR || "Notes";
const papersDir = process.env.OBSIDIAN_PAPERS_DIR || "Papers";
const syncDrafts = process.env.OBSIDIAN_SYNC_DRAFTS === "true";
const cleanSync = process.env.OBSIDIAN_CLEAN_SYNC !== "false";

if (!vaultPath) {
  console.log("[obsidian] Sync skipped: set OBSIDIAN_VAULT_PATH to enable vault import.");
  process.exit(0);
}

const absoluteVault = path.resolve(vaultPath);

await syncCollection({
  label: "notes",
  sourceDir: path.join(absoluteVault, notesDir),
  outDir: path.join(root, "src/content/notes/obsidian"),
  map: mapNote,
});

await syncCollection({
  label: "papers",
  sourceDir: path.join(absoluteVault, papersDir),
  outDir: path.join(root, "src/content/papers/obsidian"),
  map: mapPaper,
});

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

async function syncCollection({ label, sourceDir, outDir, map }) {
  if (!(await exists(sourceDir))) {
    console.log(`[obsidian] ${label} skipped: ${sourceDir} does not exist.`);
    return;
  }

  if (cleanSync) {
    await fs.rm(outDir, { recursive: true, force: true });
  }
  await fs.mkdir(outDir, { recursive: true });

  const files = (await walk(sourceDir)).filter((file) => file.endsWith(".md"));
  let written = 0;

  for (const file of files) {
    const raw = await fs.readFile(file, "utf8");
    const parsed = parseFrontmatter(raw);
    const mapped = map({ file, sourceDir, frontmatter: parsed.data, body: parsed.body });
    if (!mapped || (mapped.data.draft && !syncDrafts)) continue;

    const target = path.join(outDir, `${mapped.slug}.md`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, `${frontmatter(mapped.data)}\n${normalizeBody(parsed.body)}\n`, "utf8");
    written += 1;
  }

  console.log(`[obsidian] Synced ${written} ${label} from ${sourceDir}.`);
}

function mapNote({ file, sourceDir, frontmatter: fm, body }) {
  const title = stringValue(fm.title) || titleFromBody(body) || titleFromFile(file);
  const tags = tagList(fm.tags ?? fm.tag);
  return {
    slug: slugFrom(file, sourceDir, fm.slug),
    data: {
      title,
      description: stringValue(fm.description) || stringValue(fm.summary) || excerpt(body),
      pubDate: dateValue(fm.pubDate || fm.date || fm.created) || today(),
      updatedDate: dateValue(fm.updatedDate || fm.updated) || undefined,
      tags,
      draft: boolValue(fm.draft) || stringValue(fm.status).toLowerCase() === "draft",
      source: "obsidian",
      obsidianPath: relativeVaultPath(file),
    },
  };
}

function mapPaper({ file, sourceDir, frontmatter: fm, body }) {
  const title = stringValue(fm.title) || titleFromBody(body) || titleFromFile(file);
  const status = normalizeStatus(stringValue(fm.status) || "in preparation");
  const year = numberValue(fm.year) || Number((dateValue(fm.date) || today()).slice(0, 4));
  return {
    slug: slugFrom(file, sourceDir, fm.slug),
    data: {
      title,
      authors: listValue(fm.authors) || ["Jianheng Hu"],
      status,
      venue: stringValue(fm.venue || fm.journal || fm.target) || undefined,
      year,
      abstract: stringValue(fm.abstract || fm.summary) || excerpt(body),
      pdf: stringValue(fm.pdf) || undefined,
      code: stringValue(fm.code || fm.repository) || undefined,
      tags: tagList(fm.tags ?? fm.tag),
      source: "obsidian",
      obsidianPath: relativeVaultPath(file),
    },
  };
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else {
      files.push(full);
    }
  }
  return files;
}

function parseFrontmatter(raw) {
  if (!raw.startsWith("---")) return { data: {}, body: raw };
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { data: {}, body: raw };
  return { data: parseYamlLite(match[1]), body: raw.slice(match[0].length) };
}

function parseYamlLite(raw) {
  const data = {};
  const lines = raw.split(/\r?\n/);
  let currentKey = "";

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;

    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = [];
      data[currentKey].push(cleanScalar(listMatch[1]));
      continue;
    }

    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!pair) continue;
    currentKey = pair[1];
    const value = pair[2];
    data[currentKey] = value ? cleanScalar(value) : [];
  }

  return data;
}

function cleanScalar(value) {
  const trimmed = String(value).trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((item) => cleanScalar(item))
      .filter(Boolean);
  }
  return trimmed.replace(/^["']|["']$/g, "");
}

function frontmatter(data) {
  const lines = ["---", "# Generated from Obsidian. Edit the source note or copy this file out of the obsidian folder."];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === "") continue;
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

function normalizeBody(body) {
  return body
    .replace(/!\[\[([^\]]+)\]\]/g, (_, target) => `![${target}](${target})`)
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, target, label) => `[${label}](${slugify(target)})`)
    .replace(/\[\[([^\]]+)\]\]/g, (_, target) => `[${target}](${slugify(target)})`)
    .trim() || "Imported from Obsidian.";
}

function stringValue(value) {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value).trim();
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function boolValue(value) {
  return value === true || String(value).toLowerCase() === "true";
}

function listValue(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  const text = stringValue(value);
  return text ? text.split(/[,;，、]/).map((item) => item.trim()).filter(Boolean) : undefined;
}

function tagList(value) {
  return (listValue(value) || [])
    .map((tag) => tag.replace(/^#/, "").trim())
    .filter(Boolean);
}

function dateValue(value) {
  const text = stringValue(value);
  if (!text) return "";
  const date = new Date(text);
  return Number.isNaN(date.valueOf()) ? text.slice(0, 10) : date.toISOString().slice(0, 10);
}

function titleFromBody(body) {
  const match = body.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "";
}

function titleFromFile(file) {
  return path.basename(file, ".md").replace(/[-_]+/g, " ");
}

function excerpt(body) {
  return body
    .replace(/^---[\s\S]*?---/, "")
    .replace(/^#+\s+/gm, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180) || "Imported from Obsidian.";
}

function slugFrom(file, sourceDir, preferred) {
  const relative = path.relative(sourceDir, file).replace(/\.md$/, "");
  return slugify(preferred || relative);
}

function slugify(value) {
  return String(value)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "obsidian-note";
}

function relativeVaultPath(file) {
  return path.relative(absoluteVault, file).split(path.sep).join("/");
}

function normalizeStatus(status) {
  const lower = status.toLowerCase();
  if (lower.includes("published")) return "published";
  if (lower.includes("review")) return "under review";
  if (lower.includes("preprint")) return "preprint";
  return "in preparation";
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
