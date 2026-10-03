// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { TextSelection } from "@milkdown/kit/prose/state";
import { normalizeForSave, toHtml } from "../src/md";
import { listComments } from "../src/comments";
import { addComment, replyToComment, resolveComment } from "../src/comments-editor";
import { makeEditor } from "./editor";

const doc = "# Title\n\nFirst paragraph.\n\nSecond paragraph.\n\nThird paragraph.\n";

function selectText(view: import("@milkdown/kit/prose/view").EditorView, from: string, to: string): void {
  let a = -1;
  let b = -1;
  view.state.doc.descendants((node, pos) => {
    if (!node.isText) return true;
    const i = node.text!.indexOf(from);
    if (a === -1 && i !== -1) a = pos + i;
    const j = node.text!.indexOf(to);
    if (j !== -1) b = pos + j + to.length;
    return false;
  });
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, a, b)));
}

describe("comments in the editor", () => {
  it("wraps the selected blocks, saves as markers, and renders nothing raw", async () => {
    const ed = await makeEditor(doc);
    selectText(ed.view, "First", "Second paragraph");
    expect(addComment(ed.view, "merge these")).toBe("c1");
    const saved = normalizeForSave(ed.markdown());
    expect(saved).toBe(
      "# Title\n\n<!-- @claude c1: merge these -->\n\nFirst paragraph.\n\nSecond paragraph.\n\n<!-- /@claude c1 -->\n\nThird paragraph.\n",
    );
    expect(ed.root.querySelectorAll(".md-commented")).toHaveLength(2);
    expect(ed.root.querySelector(".md-comment-chip")?.textContent).toBe("💬 c1 · merge these");
    expect(ed.root.textContent).not.toMatch(/<!--/);
    // Other renderers show none of it.
    expect(toHtml(saved).replace(/<!--[\s\S]*?-->/g, "")).not.toMatch(/merge these/);
    await ed.destroy();
  });

  it("loads existing markers, replies, and resolves", async () => {
    const ed = await makeEditor(
      "<!-- @claude c1: shorter\nclaude: Which part? -->\n\nLong paragraph.\n\n<!-- /@claude c1 -->\n\nAfter.\n",
    );
    expect(ed.root.querySelector(".md-comment-chip.md-comment-replied")).not.toBeNull();
    replyToComment(ed.view, "c1", "you", "the second sentence");
    expect(listComments(normalizeForSave(ed.markdown()))[0].messages).toEqual([
      { author: "you", text: "shorter" },
      { author: "claude", text: "Which part?" },
      { author: "you", text: "the second sentence" },
    ]);
    resolveComment(ed.view, "c1");
    expect(normalizeForSave(ed.markdown())).toBe("Long paragraph.\n\nAfter.\n");
    await ed.destroy();
  });

  it("numbers new comments after existing ones and comments on the cursor's block", async () => {
    const ed = await makeEditor(doc);
    selectText(ed.view, "Third", "Third");
    addComment(ed.view, "one");
    selectText(ed.view, "First", "First");
    expect(addComment(ed.view, "two")).toBe("c2");
    expect(normalizeForSave(ed.markdown())).toMatch(
      /<!-- @claude c2: two -->\n\nFirst paragraph\.\n\n<!-- \/@claude c2 -->[\s\S]*<!-- @claude c1: one -->\n\nThird paragraph\.\n\n<!-- \/@claude c1 -->/,
    );
    await ed.destroy();
  });
});
