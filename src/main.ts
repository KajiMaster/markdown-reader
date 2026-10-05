import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog, confirm as confirmDialog } from "@tauri-apps/plugin-dialog";
import { dirname, homeDir } from "@tauri-apps/api/path";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Crepe } from "@milkdown/crepe";
import { editorViewCtx, parserCtx } from "@milkdown/kit/core";
import { getVersion } from "@tauri-apps/api/app";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/classic.css";
import { normalizeForSave } from "./md";
import { windowTitle } from "./title";
import { classifyHref, headingSlugs, htmlAnchorId } from "./links";
import { commentChipView, commentHighlight } from "./comments-editor";
import { commentAffordance, initComments, openBox, refreshComments, togglePanel } from "./comments-ui";

let currentPath: string | null = null;
let crepe: Crepe | null = null;
let dirty = false;
// What the file on disk held when we last read or wrote it; a difference means someone else
// (e.g. Claude Code answering comments) changed it.
let diskContent: string | null = null;
// Editor markdown as of the last load/save. Crepe emits an update right after loading, so
// "dirty" means "differs from this", not "an update event fired".
let cleanMarkdown = "";

let home: string | null = null;
let shownTitle = "";
function updateTitle(): void {
  const title = windowTitle(currentPath, dirty, home);
  if (title === shownTitle) return;
  shownTitle = title;
  void getCurrentWindow().setTitle(title);
}

async function saveTo(path: string): Promise<void> {
  if (!crepe) return;
  const content = normalizeForSave(crepe.getMarkdown());
  await invoke("write_file", { path, content });
  currentPath = path;
  diskContent = content;
  cleanMarkdown = crepe.getMarkdown();
  dirty = false;
  updateTitle();
}

/** Saves to the current path (asking for one if needed). Resolves false if cancelled. */
async function save(): Promise<boolean> {
  if (currentPath) {
    await saveTo(currentPath);
    return true;
  }
  return saveAs();
}

async function saveAs(): Promise<boolean> {
  const path = await saveDialog({
    defaultPath: currentPath ?? undefined,
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });
  if (!path) return false;
  await saveTo(path);
  return true;
}

async function loadDocument(content: string, path: string | null): Promise<void> {
  if (crepe) {
    await crepe.destroy();
  }
  crepe = new Crepe({ root: "#editor", defaultValue: content });
  crepe.editor.use([commentChipView, commentHighlight, commentAffordance]);
  crepe.on((listener) => {
    listener.markdownUpdated((_ctx, markdown) => {
      dirty = markdown !== cleanMarkdown;
      updateTitle();
      refreshComments();
    });
  });
  await crepe.create();
  cleanMarkdown = crepe.getMarkdown();
  currentPath = path;
  diskContent = path ? content : null;
  dirty = false;
  updateTitle();
  hideStatus();
  refreshComments();
}

function editorView() {
  return crepe?.editor.action((ctx) => ctx.get(editorViewCtx)) ?? null;
}

const statusBar = document.querySelector<HTMLElement>("#status")!;
let statusTimer: number | undefined;

/** One-line status at the bottom. With actions it stays until one is chosen. */
function showStatus(message: string, actions: Array<[string, () => void]> = []): void {
  window.clearTimeout(statusTimer);
  const buttons = actions.map(([label, run]) => {
    const button = document.createElement("button");
    button.textContent = label;
    button.addEventListener("click", () => {
      hideStatus();
      run();
    });
    return button;
  });
  const text = document.createElement("span");
  text.textContent = message;
  statusBar.replaceChildren(text, ...buttons);
  statusBar.hidden = false;
  if (!actions.length) statusTimer = window.setTimeout(hideStatus, 5000);
}

function hideStatus(): void {
  statusBar.hidden = true;
}

async function reloadFromDisk(content: string): Promise<void> {
  const scroller = document.querySelector("#editor")!;
  const top = scroller.scrollTop;
  await loadDocument(content, currentPath);
  scroller.scrollTop = top;
}

// Poll the open file so edits made elsewhere (Claude Code resolving comments) show up live.
// Unsaved local edits are never overwritten without asking.
let checkingDisk = false;
async function checkDisk(): Promise<void> {
  if (!currentPath || diskContent === null || checkingDisk) return;
  checkingDisk = true;
  try {
    const content = await invoke<string>("read_file", { path: currentPath });
    if (content === diskContent) return;
    if (!dirty) {
      await reloadFromDisk(content);
      showStatus("Reloaded — the file changed on disk.");
    } else {
      diskContent = content;
      showStatus("The file changed on disk, and you have unsaved edits.", [
        ["Load theirs", () => void reloadFromDisk(content)],
        ["Keep mine", () => {}],
      ]);
    }
  } catch {
    // Missing or unreadable for a moment (e.g. mid-write); try again on the next tick.
  } finally {
    checkingDisk = false;
  }
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

const about = document.querySelector<HTMLElement>("#about")!;

function toggleAbout(show = about.hidden): void {
  about.hidden = !show;
}

function initAbout(): void {
  void getVersion().then((v) => {
    about.querySelector(".about-version")!.textContent = `v${v}`;
  });
  document.querySelector("#about-button")!.addEventListener("click", () => toggleAbout(true));
  about.querySelector(".about-close")!.addEventListener("click", () => toggleAbout(false));
  about.addEventListener("click", (event) => {
    if (event.target === about) toggleAbout(false);
  });
  for (const button of about.querySelectorAll<HTMLButtonElement>("[data-url]")) {
    button.addEventListener("click", () => void openUrl(button.dataset.url!));
  }
}

function updateFollowCursor(event: KeyboardEvent): void {
  document.body.classList.toggle("follow-links", event.ctrlKey || event.metaKey);
}
window.addEventListener("keyup", updateFollowCursor);
window.addEventListener("blur", () => document.body.classList.remove("follow-links"));

window.addEventListener("keydown", (event) => {
  updateFollowCursor(event);
  if (event.key === "F1") {
    event.preventDefault();
    toggleAbout();
    return;
  }
  if (event.key === "Escape" && !about.hidden) {
    toggleAbout(false);
    return;
  }
  if (!(event.ctrlKey || event.metaKey)) return;
  const key = event.key;
  if (key.toLowerCase() === "s") {
    event.preventDefault();
    if (event.shiftKey) {
      void saveAs();
    } else {
      void save();
    }
  } else if (event.code === "KeyM" && event.altKey) {
    event.preventDefault();
    openBox();
  } else if (event.code === "KeyM" && event.shiftKey) {
    event.preventDefault();
    togglePanel();
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
  home = await homeDir().catch(() => null);
  initAbout();
  initComments({
    view: editorView,
    markdown: () => crepe?.getMarkdown() ?? "",
    parse: (md) => crepe!.editor.action((ctx) => ctx.get(parserCtx)(md)),
    askClaude: (system, prompt) => invoke<string>("ask_claude", { system, prompt }),
    path: () => currentPath,
    save,
    status: (message) => showStatus(message),
  });
  window.setInterval(() => void checkDisk(), 1500);
  const argvPath = await invoke<string | null>("get_argv");
  let content = "";
  if (argvPath) {
    content = await invoke<string>("read_file", { path: argvPath });
  }
  await loadDocument(content, argvPath);
}

void bootstrap();
