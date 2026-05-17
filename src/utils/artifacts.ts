export interface Artifact {
  label: string;
  type: string;
  href: string;
  description: string;
  status: string;
}

export function mergeArtifacts(items: Array<Artifact | false | null | undefined>) {
  const seen = new Set<string>();
  return items.filter((item): item is Artifact => {
    if (!item?.label || !item.href) return false;
    const key = item.href;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function artifactTypes(artifacts: Artifact[] = []) {
  const order = ["pdf", "code", "demo", "note", "paper", "project", "map", "data", "slides", "link"];
  const seen = new Set<string>();
  const types = artifacts
    .map((artifact) => normalizeArtifactType(artifact.type))
    .filter((type) => {
      if (!type || seen.has(type)) return false;
      seen.add(type);
      return true;
    });
  return types.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

export function normalizeArtifactType(type: string) {
  const text = String(type || "link").toLowerCase();
  if (text.includes("pdf")) return "pdf";
  if (text.includes("code") || text.includes("repo")) return "code";
  if (text.includes("demo") || text.includes("site")) return "demo";
  if (text.includes("note")) return "note";
  if (text.includes("paper") || text.includes("research")) return "paper";
  if (text.includes("project")) return "project";
  if (text.includes("map")) return "map";
  if (text.includes("data")) return "data";
  if (text.includes("slide")) return "slides";
  return "link";
}
