import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const root = process.cwd();
const errors = [];
const warnings = [];
const slugs = new Map();
const staticRoutes = new Set([
  "/",
  "/about",
  "/contact",
  "/cv",
  "/friends",
  "/library",
  "/notes",
  "/now",
  "/projects",
  "/research",
  "/research/map",
  "/search",
  "/tags",
  "/timeline",
  "/writing",
]);
const collectionRules = {
  notes: {
    required: ["title", "description", "pubDate"],
  },
  papers: {
    required: ["title", "authors", "status", "year", "abstract"],
    statuses: ["idea", "draft", "under review", "published", "archived", "preprint", "in preparation"],
  },
  projects: {
    required: ["title", "summary", "problem", "method", "status"],
    statuses: ["idea", "active", "research", "utility", "paused", "archived"],
  },
  library: {
    required: ["title", "status", "year", "note"],
    statuses: ["planned", "reading", "read", "used", "collecting"],
  },
  timeline: {
    required: ["title", "date", "type", "summary", "link"],
    statuses: ["research", "project", "writing", "site", "education", "background"],
    statusField: "type",
  },
  roadmap: {
    required: ["title", "question", "now", "next"],
  },
};

for (const [collection, rule] of Object.entries(collectionRules)) {
  validateCollection(collection, rule);
}

if (errors.length) {
  console.error("[content-check] Failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

for (const warning of warnings) console.warn(`[content-check] ${warning}`);
console.log(`[content-check] OK${warnings.length ? ` with ${warnings.length} warning(s)` : ""}.`);

function validateCollection(collection, rule) {
  const dir = path.join(root, "src", "content", collection);
  for (const file of walk(dir).filter((item) => /\.(md|mdx)$/.test(item))) {
    const relative = path.relative(root, file);
    const { data } = readFrontmatter(file);
    if (!data) {
      errors.push(`${relative} is missing frontmatter.`);
      continue;
    }

    for (const field of rule.required) {
      if (data[field] === undefined || data[field] === null || data[field] === "") {
        errors.push(`${relative} is missing required frontmatter field "${field}".`);
      }
    }

    const slug = slugFor(collection, file);
    if (slugs.has(`${collection}:${slug}`)) {
      errors.push(`${relative} duplicates slug "${slug}" from ${slugs.get(`${collection}:${slug}`)}.`);
    }
    slugs.set(`${collection}:${slug}`, relative);

    if (data.pdf) {
      const pdfPath = path.join(root, "public", String(data.pdf).replace(/^\//, ""));
      if (!fs.existsSync(pdfPath)) errors.push(`${relative} points to missing PDF ${data.pdf}.`);
    }

    validateArtifacts(relative, data.artifacts);

    const statusField = rule.statusField || "status";
    if (rule.statuses && data[statusField] && !rule.statuses.includes(String(data[statusField]))) {
      errors.push(`${relative} has invalid ${statusField} "${data[statusField]}".`);
    }

    if (data.draft === true && data.publish === true) {
      warnings.push(`${relative} has both draft: true and publish: true; draft wins in the site build.`);
    }

    if (relative.includes(`${path.sep}obsidian${path.sep}`) && data.draft === false && data.source !== "obsidian") {
      warnings.push(`${relative} is in an obsidian folder but does not say source: obsidian.`);
    }

    const related = [
      ...(data.relatedNotes || []),
      ...(data.relatedPapers || []),
      ...(data.relatedProjects || []),
      ...(data.relatedLibrary || []),
      ...(data.artifacts || []).map((artifact) => artifact?.href).filter(Boolean),
      ...(data.links || []).map((link) => link?.href).filter(Boolean),
      data.url,
      data.link,
    ].filter(Boolean);

    for (const href of [...extractLinks(file), ...related]) {
      if (isLocalMissing(href)) errors.push(`${relative} links to missing local target ${href}.`);
    }
  }
}

function validateArtifacts(relative, artifacts) {
  if (!artifacts) return;
  if (!Array.isArray(artifacts)) {
    errors.push(`${relative} has artifacts but it is not an array.`);
    return;
  }

  artifacts.forEach((artifact, index) => {
    const prefix = `${relative} artifacts[${index}]`;
    for (const field of ["label", "type", "href", "description", "status"]) {
      if (!artifact?.[field]) errors.push(`${prefix} is missing "${field}".`);
    }
    if (artifact?.type === "pdf" && artifact?.href && artifact.href.startsWith("/")) {
      const target = path.join(root, "public", String(artifact.href).replace(/^\//, ""));
      if (!fs.existsSync(target)) errors.push(`${prefix} points to missing PDF ${artifact.href}.`);
    }
  });
}

function readFrontmatter(file) {
  const raw = fs.readFileSync(file, "utf8");
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { data: null, body: raw };
  return { data: yaml.load(match[1]) || {}, body: raw.slice(match[0].length) };
}

function extractLinks(file) {
  const raw = fs.readFileSync(file, "utf8");
  return [...raw.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
}

function isLocalMissing(href) {
  if (!href || /^(https?:|mailto:|#)/.test(href)) return false;
  const [clean] = href.split("#");
  if (staticRoutes.has(clean)) return false;
  if (href.startsWith("/notes/") || href.startsWith("/research/") || href.startsWith("/projects") || href.startsWith("/library") || href.startsWith("/timeline")) return false;
  const target = path.join(root, "public", clean.replace(/^\//, ""));
  return clean.startsWith("/") && !fs.existsSync(target);
}

function slugFor(collection, file) {
  return path
    .relative(path.join(root, "src", "content", collection), file)
    .replace(/^obsidian\//, "")
    .replace(/\.(md|mdx)$/i, "");
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
