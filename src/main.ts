import { invoke } from "@tauri-apps/api/core";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
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

window.addEventListener("keydown", (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
  event.preventDefault();
  if (event.shiftKey) {
    void saveAs();
  } else {
    void save();
  }
});

async function bootstrap(): Promise<void> {
  const argvPath = await invoke<string | null>("get_argv");
  let content = "";
  if (argvPath) {
    content = await invoke<string>("read_file", { path: argvPath });
    currentPath = argvPath;
  }

  crepe = new Crepe({ root: "#editor", defaultValue: content });
  await crepe.create();
}

void bootstrap();
