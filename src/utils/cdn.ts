export function asset(path: string) {
  const base = import.meta.env.PUBLIC_ASSET_CDN || "";
  if (!base) return path;
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
