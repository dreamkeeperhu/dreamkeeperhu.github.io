import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import yaml from "js-yaml";

const root = process.cwd();

await loadDotEnv(".env.local");
await loadDotEnv(".env");

const sourceMode = process.env.OBSIDIAN_SOURCE || (process.env.R2_ACCESS_KEY_ID ? "r2" : "local");
const vaultPath = process.env.OBSIDIAN_VAULT_PATH;
const syncDrafts = process.env.OBSIDIAN_SYNC_DRAFTS === "true";
const cleanSync = process.env.OBSIDIAN_CLEAN_SYNC !== "false";

const collectionConfigs = [
  {
    label: "notes",
    localDir: process.env.OBSIDIAN_NOTES_DIR || "Homepage/Notes",
    r2Prefix: process.env.OBSIDIAN_R2_NOTES_PREFIX || process.env.R2_NOTES_PREFIX || "Homepage/Notes/",
    outDir: path.join(root, "src/content/notes/obsidian"),
    map: mapNote,
  },
  {
    label: "papers",
    localDir: process.env.OBSIDIAN_PAPERS_DIR || "Homepage/Papers",
    r2Prefix: process.env.OBSIDIAN_R2_PAPERS_PREFIX || process.env.R2_PAPERS_PREFIX || "Homepage/Papers/",
    outDir: path.join(root, "src/content/papers/obsidian"),
    map: mapPaper,
  },
  {
    label: "projects",
    localDir: process.env.OBSIDIAN_PROJECTS_DIR || "Homepage/Projects",
    r2Prefix: process.env.OBSIDIAN_R2_PROJECTS_PREFIX || process.env.R2_PROJECTS_PREFIX || "Homepage/Projects/",
    outDir: path.join(root, "src/content/projects/obsidian"),
    map: mapProject,
  },
  {
    label: "library",
    localDir: process.env.OBSIDIAN_LIBRARY_DIR || "Homepage/Library",
    r2Prefix: process.env.OBSIDIAN_R2_LIBRARY_PREFIX || process.env.R2_LIBRARY_PREFIX || "Homepage/Library/",
    outDir: path.join(root, "src/content/library/obsidian"),
    map: mapLibrary,
  },
  {
    label: "timeline",
    localDir: process.env.OBSIDIAN_TIMELINE_DIR || "Homepage/Timeline",
    r2Prefix: process.env.OBSIDIAN_R2_TIMELINE_PREFIX || process.env.R2_TIMELINE_PREFIX || "Homepage/Timeline/",
    outDir: path.join(root, "src/content/timeline/obsidian"),
    map: mapTimeline,
  },
  {
    label: "roadmap",
    localDir: process.env.OBSIDIAN_ROADMAP_DIR || "Homepage/Roadmap",
    r2Prefix: process.env.OBSIDIAN_R2_ROADMAP_PREFIX || process.env.R2_ROADMAP_PREFIX || "Homepage/Roadmap/",
    outDir: path.join(root, "src/content/roadmap/obsidian"),
    map: mapRoadmap,
  },
];

if (sourceMode === "r2") {
  await syncR2Source();
} else {
  await syncLocalVault();
}

async function syncLocalVault() {
  if (!vaultPath) {
    console.log("[obsidian] Sync skipped: set OBSIDIAN_VAULT_PATH to enable vault import.");
    return;
  }

  const absoluteVault = path.resolve(vaultPath);
  const results = [];
  for (const config of collectionConfigs) {
    results.push(await syncLocalCollection({
      ...config,
      sourceDir: path.join(absoluteVault, config.localDir),
      sourcePath: (file) => path.relative(absoluteVault, file).split(path.sep).join("/"),
    }));
  }
  await writeSyncReport("obsidian", results);
  printSyncReport("obsidian", results);
}

async function syncR2Source() {
  const accountId = process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.OBSIDIAN_R2_BUCKET || process.env.R2_BUCKET || "obsidian-sync";
  const endpoint = process.env.OBSIDIAN_R2_ENDPOINT || process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  const requireR2 = process.env.OBSIDIAN_R2_REQUIRED === "true";

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    const message = "[obsidian-r2] Sync skipped: set R2_ACCOUNT_ID/CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.";
    if (requireR2) throw new Error(message);
    console.log(message);
    return;
  }

  const { S3Client, ListObjectsV2Command, GetObjectCommand } = await import("@aws-sdk/client-s3");
  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  const results = [];
  for (const config of collectionConfigs) {
    results.push(await syncR2Collection({
      ...config,
      client,
      bucket,
      prefix: ensureTrailingSlash(config.r2Prefix),
      commands: { ListObjectsV2Command, GetObjectCommand },
    }));
  }
  await writeSyncReport("obsidian-r2", results);
  printSyncReport("obsidian-r2", results);
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

async function syncLocalCollection({ label, sourceDir, outDir, map, sourcePath }) {
  if (!(await exists(sourceDir))) {
    if (cleanSync) await fs.rm(outDir, { recursive: true, force: true });
    return { label, source: sourceDir, found: false, scanned: 0, written: 0, skipped: 0 };
  }

  if (cleanSync) await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });

  const files = (await walk(sourceDir)).filter((file) => file.endsWith(".md") || file.endsWith(".mdx"));
  let written = 0;
  let skipped = 0;

  for (const file of files) {
    const raw = await fs.readFile(file, "utf8");
    const parsed = parseFrontmatter(raw);
    const sourceRelative = path.relative(sourceDir, file);
    const mapped = map({
      frontmatter: parsed.data,
      body: parsed.body,
      slugPath: sourceRelative,
      sourcePath: sourcePath(file),
    });
    if (!mapped || (mapped.data.draft && !syncDrafts)) {
      skipped += 1;
      continue;
    }

    const target = path.join(outDir, `${mapped.slug}.md`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, `${frontmatter(mapped.data)}\n${normalizeBody(parsed.body)}\n`, "utf8");
    written += 1;
  }

  return { label, source: sourceDir, found: true, scanned: files.length, written, skipped };
}

async function syncR2Collection({ client, bucket, label, prefix, outDir, map, commands }) {
  if (cleanSync) await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });

  const objects = await listR2Objects({ client, bucket, prefix, command: commands.ListObjectsV2Command });
  let written = 0;
  let skipped = 0;

  for (const object of objects) {
    const key = object.Key;
    if (!key || !/\.(md|mdx)$/.test(key) || path.basename(key).startsWith(".")) continue;

    const raw = await getR2Text({ client, bucket, key, command: commands.GetObjectCommand });
    const parsed = parseFrontmatter(raw);
    const mapped = map({
      frontmatter: parsed.data,
      body: parsed.body,
      slugPath: key.slice(prefix.length),
      sourcePath: key,
    });
    if (!mapped || (mapped.data.draft && !syncDrafts)) {
      skipped += 1;
      continue;
    }

    const target = path.join(outDir, `${mapped.slug}.md`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, `${frontmatter(mapped.data)}\n${normalizeBody(parsed.body)}\n`, "utf8");
    written += 1;
  }

  return { label, source: `r2://${bucket}/${prefix}`, found: true, scanned: objects.length, written, skipped };
}

async function listR2Objects({ client, bucket, prefix, command }) {
  const objects = [];
  let ContinuationToken;

  do {
    const response = await client.send(new command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken,
    }));
    objects.push(...(response.Contents || []));
    ContinuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (ContinuationToken);

  return objects;
}

async function getR2Text({ client, bucket, key, command }) {
  const response = await client.send(new command({ Bucket: bucket, Key: key }));
  return response.Body.transformToString();
}

function mapNote({ frontmatter: fm, body, slugPath, sourcePath }) {
  const title = stringValue(fm.title) || titleFromBody(body) || titleFromFile(slugPath);
  return {
    slug: slugFrom(slugPath, fm.slug),
    data: {
      title,
      description: stringValue(fm.description) || stringValue(fm.summary) || excerpt(body),
      pubDate: dateValue(fm.pubDate || fm.date || fm.created) || today(),
      updatedDate: dateValue(fm.updatedDate || fm.updated) || undefined,
      thread: stringValue(fm.thread) || undefined,
      series: stringValue(fm.series) || undefined,
      audience: stringValue(fm.audience) || undefined,
      difficulty: normalizeDifficulty(stringValue(fm.difficulty) || "working"),
      category: normalizeNoteCategory(stringValue(fm.category || fm.type) || "research"),
      tags: tagList(fm.tags ?? fm.tag),
      draft: shouldKeepPrivate(fm),
      source: "obsidian",
      obsidianPath: sourcePath,
    },
  };
}

function mapPaper({ frontmatter: fm, body, slugPath, sourcePath }) {
  const title = stringValue(fm.title) || titleFromBody(body) || titleFromFile(slugPath);
  const status = normalizePaperStatus(stringValue(fm.status) || "in preparation");
  const year = numberValue(fm.year) || Number((dateValue(fm.date) || today()).slice(0, 4));
  return {
    slug: slugFrom(slugPath, fm.slug),
    data: {
      title,
      authors: listValue(fm.authors) || ["Jianheng Hu"],
      status,
      venue: stringValue(fm.venue || fm.journal || fm.target) || undefined,
      year,
      updatedDate: dateValue(fm.updatedDate || fm.updated) || undefined,
      abstract: stringValue(fm.abstract || fm.summary) || excerpt(body),
      problem: stringValue(fm.problem) || undefined,
      method: stringValue(fm.method) || undefined,
      contribution: listValue(fm.contribution || fm.contributions) || [],
      limitations: listValue(fm.limitations || fm.limits) || [],
      reviewNote: stringValue(fm.reviewNote || fm.review) || undefined,
      evidence: listValue(fm.evidence) || [],
      nextStep: stringValue(fm.nextStep || fm.next) || undefined,
      thread: stringValue(fm.thread) || undefined,
      series: stringValue(fm.series) || undefined,
      audience: stringValue(fm.audience) || undefined,
      pdf: stringValue(fm.pdf) || undefined,
      code: stringValue(fm.code || fm.repository) || undefined,
      relatedProjects: listValue(fm.relatedProjects) || [],
      relatedNotes: listValue(fm.relatedNotes) || [],
      relatedLibrary: listValue(fm.relatedLibrary) || [],
      artifacts: artifactList(fm.artifacts),
      bibtex: stringValue(fm.bibtex) || undefined,
      tags: tagList(fm.tags ?? fm.tag),
      draft: shouldKeepPrivate(fm),
      source: "obsidian",
      obsidianPath: sourcePath,
    },
  };
}

function mapProject({ frontmatter: fm, body, slugPath, sourcePath }) {
  const title = stringValue(fm.title || fm.name) || titleFromBody(body) || titleFromFile(slugPath);
  return {
    slug: slugFrom(slugPath, fm.slug),
    data: {
      title,
      summary: stringValue(fm.summary || fm.description) || excerpt(body),
      problem: stringValue(fm.problem) || "Problem statement will be expanded from Obsidian.",
      method: stringValue(fm.method) || "Method notes will be expanded from Obsidian.",
      status: normalizeProjectStatus(stringValue(fm.status) || "active"),
      statusDetail: normalizeProjectStatusDetail(stringValue(fm.statusDetail || fm.maturity) || "prototype"),
      updatedDate: dateValue(fm.updatedDate || fm.updated) || undefined,
      thread: stringValue(fm.thread) || undefined,
      series: stringValue(fm.series) || undefined,
      audience: stringValue(fm.audience) || undefined,
      tags: tagList(fm.tags ?? fm.tag),
      techStack: listValue(fm.techStack || fm.stack) || [],
      repo: stringValue(fm.repo || fm.repository) || undefined,
      url: stringValue(fm.url || fm.github) || undefined,
      links: linkList(fm.links),
      relatedNotes: listValue(fm.relatedNotes) || [],
      relatedPapers: listValue(fm.relatedPapers) || [],
      relatedLibrary: listValue(fm.relatedLibrary) || [],
      artifacts: artifactList(fm.artifacts),
      evidence: listValue(fm.evidence) || [],
      outcome: stringValue(fm.outcome || fm.result) || undefined,
      lessons: listValue(fm.lessons || fm.learned) || [],
      maturityNote: stringValue(fm.maturityNote || fm.maturity_note) || undefined,
      nextStep: stringValue(fm.nextStep || fm.next) || undefined,
      featured: boolValue(fm.featured),
      order: numberValue(fm.order) || 99,
      draft: shouldKeepPrivate(fm),
      source: "obsidian",
      obsidianPath: sourcePath,
    },
  };
}

function mapLibrary({ frontmatter: fm, body, slugPath, sourcePath }) {
  const title = stringValue(fm.title) || titleFromBody(body) || titleFromFile(slugPath);
  return {
    slug: slugFrom(slugPath, fm.slug),
    data: {
      title,
      authors: listValue(fm.authors) || [],
      type: stringValue(fm.type) || "resource",
      status: normalizeLibraryStatus(stringValue(fm.status) || "reading"),
      year: stringValue(fm.year || fm.date) || "ongoing",
      updatedDate: dateValue(fm.updatedDate || fm.updated) || undefined,
      thread: stringValue(fm.thread) || undefined,
      series: stringValue(fm.series) || undefined,
      audience: stringValue(fm.audience) || undefined,
      tags: tagList(fm.tags ?? fm.tag),
      url: stringValue(fm.url || fm.link) || undefined,
      note: stringValue(fm.note || fm.summary || fm.description) || excerpt(body),
      whyItMatters: stringValue(fm.whyItMatters || fm.why || fm.relevance) || undefined,
      takeaways: listValue(fm.takeaways || fm.keyTakeaways) || [],
      relatedNotes: listValue(fm.relatedNotes) || [],
      relatedPapers: listValue(fm.relatedPapers) || [],
      relatedProjects: listValue(fm.relatedProjects) || [],
      artifacts: artifactList(fm.artifacts),
      featured: boolValue(fm.featured),
      order: numberValue(fm.order) || 99,
      draft: shouldKeepPrivate(fm),
      source: "obsidian",
      obsidianPath: sourcePath,
    },
  };
}

function mapTimeline({ frontmatter: fm, body, slugPath, sourcePath }) {
  const title = stringValue(fm.title) || titleFromBody(body) || titleFromFile(slugPath);
  return {
    slug: slugFrom(slugPath, fm.slug),
    data: {
      title,
      date: dateValue(fm.date || fm.when) || today(),
      type: normalizeTimelineType(stringValue(fm.type) || "project"),
      summary: stringValue(fm.summary || fm.description) || excerpt(body),
      link: stringValue(fm.link || fm.url) || "/",
      featured: boolValue(fm.featured),
      order: numberValue(fm.order) || 99,
      draft: shouldKeepPrivate(fm),
      source: "obsidian",
      obsidianPath: sourcePath,
    },
  };
}

function mapRoadmap({ frontmatter: fm, body, slugPath, sourcePath }) {
  const title = stringValue(fm.title) || titleFromBody(body) || titleFromFile(slugPath);
  return {
    slug: slugFrom(slugPath, fm.slug),
    data: {
      title,
      question: stringValue(fm.question) || excerpt(body),
      now: stringValue(fm.now || fm.current) || "Current work will be updated from Obsidian.",
      next: stringValue(fm.next || fm.nextStep) || "Next step will be updated from Obsidian.",
      links: linkList(fm.links),
      tags: tagList(fm.tags ?? fm.tag),
      relatedProjects: listValue(fm.relatedProjects) || [],
      relatedNotes: listValue(fm.relatedNotes) || [],
      order: numberValue(fm.order) || 99,
      draft: shouldKeepPrivate(fm),
      source: "obsidian",
      obsidianPath: sourcePath,
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
  return { data: yaml.load(match[1]) || {}, body: raw.slice(match[0].length) };
}

function frontmatter(data) {
  const clean = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined && value !== ""));
  return `---\n# Generated from Obsidian. Edit the source note or copy this file out of the obsidian folder.\n${yaml.dump(clean, {
    lineWidth: 100,
    noRefs: true,
    sortKeys: false,
  }).trim()}\n---`;
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

function shouldKeepPrivate(fm) {
  const status = stringValue(fm.status).toLowerCase();
  if (boolValue(fm.draft) || status === "draft" || status === "private") return true;
  return !isExplicitlyPublic(fm);
}

function isExplicitlyPublic(fm) {
  if (Object.hasOwn(fm, "draft") && String(fm.draft).toLowerCase() === "false") return true;
  if (boolValue(fm.publish) || boolValue(fm.public)) return true;
  return stringValue(fm.status).toLowerCase() === "public";
}

function listValue(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  const text = stringValue(value);
  return text ? text.split(/[,;，、]/).map((item) => item.trim()).filter(Boolean) : undefined;
}

function linkList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return { label: item, href: item };
      return {
        label: stringValue(item?.label || item?.title || item?.name),
        href: stringValue(item?.href || item?.url || item?.link),
      };
    })
    .filter((item) => item.label && item.href);
}

function artifactList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") {
        return {
          label: item,
          type: "link",
          href: item,
          description: "Linked research artifact.",
          status: "available",
        };
      }
      return {
        label: stringValue(item?.label || item?.title || item?.name),
        type: stringValue(item?.type || item?.kind) || "link",
        href: stringValue(item?.href || item?.url || item?.link),
        description: stringValue(item?.description || item?.summary) || "Linked research artifact.",
        status: stringValue(item?.status) || "available",
      };
    })
    .filter((item) => item.label && item.href);
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
  return path.basename(file, path.extname(file)).replace(/[-_]+/g, " ");
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

function slugFrom(slugPath, preferred) {
  return slugify(preferred || String(slugPath).replace(/\.(md|mdx)$/i, ""));
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

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizePaperStatus(status) {
  const lower = status.toLowerCase();
  if (lower.includes("idea")) return "idea";
  if (lower.includes("draft")) return "draft";
  if (lower.includes("archive")) return "archived";
  if (lower.includes("published")) return "published";
  if (lower.includes("review")) return "under review";
  if (lower.includes("preprint")) return "preprint";
  return "in preparation";
}

function normalizeProjectStatus(status) {
  const lower = status.toLowerCase();
  if (lower.includes("research")) return "research";
  if (lower.includes("utility")) return "utility";
  if (lower.includes("pause")) return "paused";
  if (lower.includes("archive")) return "archived";
  if (lower.includes("idea")) return "idea";
  return "active";
}

function normalizeProjectStatusDetail(status) {
  const lower = status.toLowerCase();
  if (lower.includes("usable") || lower.includes("ready")) return "usable";
  if (lower.includes("research")) return "research trace";
  if (lower.includes("archive")) return "archived";
  return "prototype";
}

function normalizeNoteCategory(category) {
  const lower = category.toLowerCase();
  if (lower.includes("site") || lower.includes("web")) return "site";
  if (lower.includes("personal")) return "personal";
  if (lower.includes("log") || lower.includes("journal")) return "log";
  return "research";
}

function normalizeLibraryStatus(status) {
  const lower = status.toLowerCase();
  if (lower.includes("planned")) return "planned";
  if (lower === "read" || lower.includes("finished")) return "read";
  if (lower.includes("used")) return "used";
  if (lower.includes("collect")) return "collecting";
  return "reading";
}

function normalizeDifficulty(value) {
  const lower = value.toLowerCase();
  if (lower.includes("intro") || lower.includes("beginner")) return "intro";
  if (lower.includes("deep") || lower.includes("advanced")) return "deep";
  return "working";
}

function normalizeTimelineType(type) {
  const lower = type.toLowerCase();
  if (lower.includes("research")) return "research";
  if (lower.includes("writing") || lower.includes("note")) return "writing";
  if (lower.includes("site")) return "site";
  if (lower.includes("education") || lower.includes("school")) return "education";
  if (lower.includes("background")) return "background";
  return "project";
}

function printSyncReport(label, results) {
  console.log(`[${label}] Sync report`);
  for (const result of results) {
    const status = result.found ? `${result.written}/${result.scanned} published, ${result.skipped} private` : "folder not found";
    console.log(`- ${result.label}: ${status} (${result.source})`);
  }
}

async function writeSyncReport(label, results) {
  const report = {
    ok: true,
    source: label,
    generatedAt: new Date().toISOString(),
    totals: results.reduce((acc, item) => {
      acc.scanned += item.scanned || 0;
      acc.published += item.written || 0;
      acc.private += item.skipped || 0;
      acc.missingFolders += item.found ? 0 : 1;
      return acc;
    }, { scanned: 0, published: 0, private: 0, missingFolders: 0 }),
    collections: results.map((item) => ({
      name: item.label,
      source: item.source,
      found: item.found,
      scanned: item.scanned,
      published: item.written,
      private: item.skipped,
    })),
  };
  const target = path.join(root, ".cache", "content-sync-report.json");
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
