import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const root = process.cwd();
const errors = [];
const warnings = [];
const slugs = new Map();

validateCollection("notes", ["title", "description", "pubDate"]);
validateCollection("papers", ["title", "authors", "status", "year", "abstract"]);

if (errors.length) {
  console.error("[content-check] Failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

for (const warning of warnings) console.warn(`[content-check] ${warning}`);
console.log(`[content-check] OK${warnings.length ? ` with ${warnings.length} warning(s)` : ""}.`);

function validateCollection(collection, requiredFields) {
  const dir = path.join(root, "src", "content", collection);
  for (const file of walk(dir).filter((item) => /\.(md|mdx)$/.test(item))) {
    const relative = path.relative(root, file);
    const { data } = readFrontmatter(file);
    if (!data) {
      errors.push(`${relative} is missing frontmatter.`);
      continue;
    }

    for (const field of requiredFields) {
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

    if (data.draft === true && data.publish === true) {
      warnings.push(`${relative} has both draft: true and publish: true; draft wins in the site build.`);
    }

    for (const href of [...extractLinks(file), ...(data.relatedNotes || [])]) {
      if (isLocalMissing(href)) errors.push(`${relative} links to missing local target ${href}.`);
    }
  }
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
  if (href.startsWith("/notes/") || href.startsWith("/research/") || href.startsWith("/projects")) return false;
  const [clean] = href.split("#");
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
