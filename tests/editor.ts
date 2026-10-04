// Headless Milkdown with the same presets Crepe builds on, so tests exercise the real
// editor → markdown path the app saves through.
import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { getMarkdown } from "@milkdown/kit/utils";
import type { EditorView } from "@milkdown/kit/prose/view";

export interface TestEditor {
  view: EditorView;
  root: HTMLElement;
  markdown: () => string;
  destroy: () => Promise<void>;
}

export async function makeEditor(md: string): Promise<TestEditor> {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root);
      ctx.set(defaultValueCtx, md);
    })
    .use(commonmark)
    .use(gfm)
    .create();
  return {
    view: editor.action((ctx) => ctx.get(editorViewCtx)),
    root,
    markdown: () => editor.action(getMarkdown()),
    destroy: async () => {
      await editor.destroy();
      root.remove();
    },
  };
}

export async function editorMarkdown(md: string): Promise<string> {
  const editor = await makeEditor(md);
  const out = editor.markdown();
  await editor.destroy();
  return out;
}
