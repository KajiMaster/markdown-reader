import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { dirname } from "@tauri-apps/api/path";
import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/classic.css";

let currentPath: string | null = null;
let crepe: Crepe | null = null;

async function saveTo(path: string): Promise<void> {
  if (!crepe) return;
  const content = crepe.getMarkdown();
  await invoke("write_file", { path, content });
  currentPath = path;
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
  await crepe.create();
  currentPath = path;
}

async function openFile(): Promise<void> {
  const defaultPath = currentPath ? await dirname(currentPath) : undefined;
  const path = await openDialog({
    defaultPath,
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });
  if (typeof path === "string") {
    const content = await invoke<string>("read_file", { path });
    await loadDocument(content, path);
  }
}

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

window.addEventListener("keydown", (event) => {
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
