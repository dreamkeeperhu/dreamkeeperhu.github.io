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
