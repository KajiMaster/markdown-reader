// Window title: "● notes.md — ~/projects/docs — md-read". Pure, so it's unit-tested.

export function windowTitle(path: string | null, dirty: boolean, home: string | null): string {
  const mark = dirty ? "● " : "";
  if (!path) return `${mark}Untitled — md-read`;
  const cut = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  const name = path.slice(cut + 1);
  let dir = cut > 0 ? path.slice(0, cut) : path.slice(0, cut + 1);
  const h = home?.replace(/[\\/]+$/, "");
  if (h && (dir === h || dir.startsWith(`${h}/`) || dir.startsWith(`${h}\\`))) {
    dir = `~${dir.slice(h.length)}`;
  }
  return `${mark}${name} — ${dir} — md-read`;
}
