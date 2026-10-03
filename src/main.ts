import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog, confirm as confirmDialog } from "@tauri-apps/plugin-dialog";
import { dirname } from "@tauri-apps/api/path";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/classic.css";
import { normalizeForSave } from "./md";
import { classifyHref, headingSlugs, htmlAnchorId } from "./links";

let currentPath: string | null = null;
let crepe: Crepe | null = null;
let dirty = false;

async function saveTo(path: string): Promise<void> {
  if (!crepe) return;
  const content = normalizeForSave(crepe.getMarkdown());
  await invoke("write_file", { path, content });
  currentPath = path;
  dirty = false;
}

async function save(): Promise<void> {
  if (currentPath) {
    await saveTo(currentPath);
  } else {
    await saveAs();
  }
}

async function saveAs(): Promise<void> {
  const path = await saveDialog({
    defaultPath: currentPath ?? undefined,
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });
  if (path) {
    await saveTo(path);
  }
}

async function loadDocument(content: string, path: string | null): Promise<void> {
  if (crepe) {
    await crepe.destroy();
  }
  crepe = new Crepe({ root: "#editor", defaultValue: content });
  crepe.on((listener) => {
    listener.markdownUpdated(() => {
      dirty = true;
    });
  });
  await crepe.create();
  currentPath = path;
  dirty = false;
}

async function confirmDiscard(): Promise<boolean> {
  if (!dirty) return true;
  return confirmDialog("You have unsaved changes. Discard them and open a different file?", {
    title: "Unsaved changes",
    kind: "warning",
  });
}

async function openPath(path: string): Promise<boolean> {
  let content: string;
  try {
    content = await invoke<string>("read_file", { path });
  } catch {
    return false;
  }
  await loadDocument(content, path);
  return true;
}

async function openFile(): Promise<void> {
  if (!(await confirmDiscard())) return;
  const defaultPath = currentPath ? await dirname(currentPath) : undefined;
  const path = await openDialog({
    defaultPath,
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });
  if (typeof path === "string") {
    await openPath(path);
  }
}

function scrollToAnchor(id: string): void {
  const root = document.querySelector("#editor .ProseMirror");
  if (!root) return;
  const headings = Array.from(root.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"));
  const slugs = headingSlugs(headings.map((h) => h.textContent ?? ""));
  let target: Element | undefined = headings[slugs.indexOf(id.toLowerCase())];
  if (!target) {
    const raw = Array.from(root.querySelectorAll<HTMLElement>('[data-type="html"]'));
    target = raw.find((el) => htmlAnchorId(el.dataset.value ?? "") === id);
  }
  target?.scrollIntoView({ block: "start" });
}

// Ctrl/Cmd+Click follows a link; a plain click keeps placing the cursor for editing.
async function followLink(href: string): Promise<void> {
  const target = classifyHref(href, currentPath);
  if (target.kind === "external") {
    await openUrl(target.url);
  } else if (target.kind === "anchor") {
    scrollToAnchor(target.id);
  } else if (target.kind === "file") {
    if (!(await confirmDiscard())) return;
    if ((await openPath(target.path)) && target.anchor) scrollToAnchor(target.anchor);
  }
}

document.addEventListener(
  "click",
  (event) => {
    const link = (event.target as Element | null)?.closest?.("#editor a[href]");
    if (!link) return;
    // Never let the webview itself navigate away from the document.
    event.preventDefault();
    if (!(event.ctrlKey || event.metaKey)) return;
    event.stopPropagation();
    void followLink(link.getAttribute("href") ?? "");
  },
  true,
);

const ZOOM_STORAGE_KEY = "md-read:zoom";
const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;
let zoom = 1;

function applyZoom(): void {
  document.documentElement.style.setProperty("--zoom", String(zoom));
  localStorage.setItem(ZOOM_STORAGE_KEY, String(zoom));
}

function initZoom(): void {
  const stored = Number(localStorage.getItem(ZOOM_STORAGE_KEY));
  if (!Number.isNaN(stored) && stored > 0) {
    zoom = stored;
  }
  applyZoom();
}

function zoomIn(): void {
  zoom = Math.min(ZOOM_MAX, Number((zoom + ZOOM_STEP).toFixed(2)));
  applyZoom();
}

function zoomOut(): void {
  zoom = Math.max(ZOOM_MIN, Number((zoom - ZOOM_STEP).toFixed(2)));
  applyZoom();
}

function zoomReset(): void {
  zoom = 1;
  applyZoom();
}

function updateFollowCursor(event: KeyboardEvent): void {
  document.body.classList.toggle("follow-links", event.ctrlKey || event.metaKey);
}
window.addEventListener("keyup", updateFollowCursor);
window.addEventListener("blur", () => document.body.classList.remove("follow-links"));

window.addEventListener("keydown", (event) => {
  updateFollowCursor(event);
  if (!(event.ctrlKey || event.metaKey)) return;
  const key = event.key;
  if (key.toLowerCase() === "s") {
    event.preventDefault();
    if (event.shiftKey) {
      void saveAs();
    } else {
      void save();
    }
  } else if (key.toLowerCase() === "o") {
    event.preventDefault();
    void openFile();
  } else if (key.toLowerCase() === "p") {
    event.preventDefault();
    window.print();
  } else if (key === "=" || key === "+") {
    event.preventDefault();
    zoomIn();
  } else if (key === "-" || key === "_") {
    event.preventDefault();
    zoomOut();
  } else if (key === "0") {
    event.preventDefault();
    zoomReset();
  }
});

async function bootstrap(): Promise<void> {
  initZoom();
  const argvPath = await invoke<string | null>("get_argv");
  let content = "";
  if (argvPath) {
    content = await invoke<string>("read_file", { path: argvPath });
  }
  await loadDocument(content, argvPath);
}

void bootstrap();
