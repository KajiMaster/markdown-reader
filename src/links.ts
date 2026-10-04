// Pure link resolution for clicks in the rendered view. No I/O, so it is unit-tested directly.

export type LinkTarget =
  | { kind: "external"; url: string }
  | { kind: "anchor"; id: string }
  | { kind: "file"; path: string; anchor: string | null }
  | { kind: "none" };

const MD_EXT = /\.(md|markdown)$/i;

export function classifyHref(href: string, currentPath: string | null): LinkTarget {
  const trimmed = href.trim();
  if (/^https?:\/\//i.test(trimmed)) return { kind: "external", url: trimmed };
  if (trimmed.startsWith("#")) {
    return trimmed.length > 1 ? { kind: "anchor", id: safeDecode(trimmed.slice(1)) } : { kind: "none" };
  }
  // Any other scheme (mailto:, file:, javascript:, …) and absolute paths are not followed.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith("/") || !currentPath) {
    return { kind: "none" };
  }
  const hashAt = trimmed.indexOf("#");
  const pathPart = (hashAt === -1 ? trimmed : trimmed.slice(0, hashAt)).split("?")[0];
  const anchor = hashAt === -1 ? null : safeDecode(trimmed.slice(hashAt + 1)) || null;
  const rel = safeDecode(pathPart);
  if (!MD_EXT.test(rel)) return { kind: "none" };
  return { kind: "file", path: resolveRelative(currentPath, rel), anchor };
}

/** Resolves `rel` against the directory of `fromFile`, keeping the platform's separator. */
export function resolveRelative(fromFile: string, rel: string): string {
  const sep = fromFile.includes("\\") && !fromFile.includes("/") ? "\\" : "/";
  const parts = fromFile.split(/[\\/]/);
  parts.pop();
  for (const seg of rel.split(/[\\/]/)) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (parts.length > 1) parts.pop();
    } else {
      parts.push(seg);
    }
  }
  return parts.join(sep);
}

/** GitHub-style heading slug: lowercase, drop punctuation, spaces → hyphens. */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

/** Slugs for headings in document order, de-duplicated the way GitHub does (`x`, `x-1`, `x-2`). */
export function headingSlugs(texts: string[]): string[] {
  const seen = new Map<string, number>();
  return texts.map((text) => {
    const base = slugify(text);
    let slug = base;
    let n = seen.get(base) ?? 0;
    while (seen.has(slug)) {
      n += 1;
      slug = `${base}-${n}`;
    }
    seen.set(base, n);
    seen.set(slug, 0);
    return slug;
  });
}

/** Extracts the `id`/`name` from a raw HTML anchor such as `<a id="x"></a>`. */
export function htmlAnchorId(html: string): string | null {
  const m = /^<a\s[^>]*\b(?:id|name)\s*=\s*["']([^"']+)["']/i.exec(html.trim());
  return m ? m[1] : null;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
