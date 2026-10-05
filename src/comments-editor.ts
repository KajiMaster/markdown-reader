// Editor side of @claude comments: ProseMirror operations on the live document, the chip view
// for marker nodes, and highlighting of the commented blocks. Marker syntax lives in comments.ts.
import { $prose, $view } from "@milkdown/kit/utils";
import { htmlSchema } from "@milkdown/kit/preset/commonmark";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import type { Node as PMNode } from "@milkdown/kit/prose/model";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import { endMarker, nextId, parseMarker, startMarker, type Marker } from "./comments";

interface Found {
  pos: number;
  node: PMNode;
  marker: Marker;
}

function markers(doc: PMNode): Found[] {
  const out: Found[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== "html") return true;
    const marker = parseMarker(node.attrs.value as string);
    if (marker) out.push({ pos, node, marker });
    return false;
  });
  return out;
}

/** Range to delete for a marker: its whole paragraph when the marker is all it holds. */
function markerRange(doc: PMNode, found: Found): [number, number] {
  const $pos = doc.resolve(found.pos);
  const parent = $pos.parent;
  if (parent.type.name === "paragraph" && parent.childCount === 1) {
    return [$pos.before(), $pos.after()];
  }
  return [found.pos, found.pos + found.node.nodeSize];
}

/** Top-level block range [from, to] covering the selection, or null for an empty selection. */
export function selectedBlocks(view: EditorView): { from: number; to: number } | null {
  const { $from, $to, empty } = view.state.selection;
  if (empty) return null;
  return {
    from: $from.depth >= 1 ? $from.before(1) : $from.pos,
    to: $to.depth >= 1 ? $to.after(1) : $to.pos,
  };
}

/** The top-level block at a document position, unless it is a comment marker line. */
export function blockAt(view: EditorView, pos: number): { from: number; to: number } | null {
  const $pos = view.state.doc.resolve(pos);
  if ($pos.depth < 1) return null;
  const node = $pos.node(1);
  const only = node.childCount === 1 ? node.firstChild : null;
  if (only?.type.name === "html" && parseMarker(only.attrs.value as string)) return null;
  return { from: $pos.before(1), to: $pos.after(1) };
}

/** Ids of the comments whose highlighted range contains the top-level block at `pos`. */
export function commentsAt(view: EditorView, pos: number): string[] {
  const $pos = view.state.doc.resolve(Math.min(pos, view.state.doc.content.size));
  const index = $pos.index(0);
  const open: string[] = [];
  view.state.doc.forEach((block, _offset, i) => {
    if (i >= index) return;
    const only = block.childCount === 1 ? block.firstChild : null;
    const marker = only?.type.name === "html" ? parseMarker(only.attrs.value as string) : null;
    if (marker?.kind === "start") open.push(marker.id);
    if (marker?.kind === "end") {
      const at = open.lastIndexOf(marker.id);
      if (at !== -1) open.splice(at, 1);
    }
  });
  return open;
}

/**
 * Wraps top-level blocks in a new comment: the given range, or the blocks the selection
 * touches. Returns the new id.
 */
export function addComment(view: EditorView, text: string, range?: { from: number; to: number }): string {
  const { state } = view;
  const { $from, $to } = state.selection;
  const from = range?.from ?? ($from.depth >= 1 ? $from.before(1) : $from.pos);
  const to = range?.to ?? ($to.depth >= 1 ? $to.after(1) : $to.pos);
  const id = nextId(markers(state.doc).map((m) => m.marker.id));
  const { html, paragraph } = state.schema.nodes;
  const block = (value: string) => paragraph.create(null, html.create({ value }));
  const tr = state.tr
    .insert(to, block(endMarker(id)))
    .insert(from, block(startMarker(id, [{ author: "you", text }])));
  view.dispatch(tr.scrollIntoView());
  return id;
}

/** Removes both markers, leaving the commented text in place. */
export function resolveComment(view: EditorView, id: string): void {
  const { doc } = view.state;
  const ranges = markers(doc)
    .filter((m) => m.marker.id === id)
    .map((m) => markerRange(doc, m))
    .sort((a, b) => b[0] - a[0]);
  if (!ranges.length) return;
  let tr = view.state.tr;
  for (const [from, to] of ranges) tr = tr.delete(from, to);
  view.dispatch(tr);
}

export function replyToComment(view: EditorView, id: string, author: string, text: string): void {
  const start = markers(view.state.doc).find((m) => m.marker.kind === "start" && m.marker.id === id);
  if (!start || start.marker.kind !== "start") return;
  const value = startMarker(id, [...start.marker.messages, { author, text }]);
  view.dispatch(view.state.tr.setNodeMarkup(start.pos, undefined, { ...start.node.attrs, value }));
}

/**
 * Applies Claude's answer as ONE transaction (a single Ctrl+Z undoes it): appends the reply to
 * the thread and, when given, replaces the blocks between the markers with `replacement`.
 * Returns false if the thread no longer exists.
 */
export function answerThread(
  view: EditorView,
  id: string,
  reply: string,
  replacement: string | null,
  parseMarkdown: (md: string) => PMNode,
): boolean {
  const { doc } = view.state;
  const found = markers(doc).filter((m) => m.marker.id === id);
  const start = found.find((m) => m.marker.kind === "start");
  const end = found.find((m) => m.marker.kind === "end");
  if (!start || start.marker.kind !== "start") return false;
  const value = startMarker(id, [...start.marker.messages, { author: "claude", text: reply }]);
  let tr = view.state.tr.setNodeMarkup(start.pos, undefined, { ...start.node.attrs, value });
  if (replacement !== null && end && end.pos > start.pos) {
    // Marker nodes are atoms, so the attr change above leaves every position intact.
    const from = markerRange(doc, start)[1];
    const to = markerRange(doc, end)[0];
    tr = tr.replaceWith(from, to, parseMarkdown(replacement).content);
  }
  view.dispatch(tr);
  return true;
}

export function scrollToComment(view: EditorView, id: string): void {
  const start = markers(view.state.doc).find((m) => m.marker.kind === "start" && m.marker.id === id);
  if (!start) return;
  const dom = view.nodeDOM(start.pos);
  if (dom instanceof HTMLElement) dom.scrollIntoView({ block: "center" });
}

/** Marker nodes render as nothing visible; any other raw HTML keeps the default rendering. */
export const commentChipView = $view(htmlSchema.node, () => (node) => {
  const value = node.attrs.value as string;
  const dom = document.createElement("span");
  dom.dataset.type = "html";
  dom.dataset.value = value;
  const marker = parseMarker(value);
  if (!marker) {
    dom.textContent = value;
  } else {
    dom.className = "md-marker";
    dom.dataset.commentId = marker.id;
    dom.contentEditable = "false";
  }
  return { dom, ignoreMutation: () => true };
});

/** The marker held by a top-level block that contains only a marker, if any. */
function markerOf(block: PMNode): Marker | null {
  const only = block.childCount === 1 ? block.firstChild : null;
  return only?.type.name === "html" ? parseMarker(only.attrs.value as string) : null;
}

const highlightKey = new PluginKey("md-comment-highlight");

function highlights(doc: PMNode): DecorationSet {
  const decorations: Decoration[] = [];
  const open: string[] = [];
  let starting: string[] = [];
  doc.forEach((block, pos) => {
    const marker = markerOf(block);
    const range = { from: pos, to: pos + block.nodeSize };
    if (marker) {
      decorations.push(Decoration.node(range.from, range.to, { class: "md-marker-line" }));
      if (marker.kind === "start") {
        open.push(marker.id);
        starting.push(marker.id);
      } else {
        const i = open.lastIndexOf(marker.id);
        if (i !== -1) open.splice(i, 1);
      }
    } else if (open.length) {
      const attrs: Record<string, string> = { class: "md-commented", "data-comments": open.join(" ") };
      if (starting.length) {
        attrs.class += " md-commented-first";
        attrs["data-comment-first"] = starting.join(" ");
        starting = [];
      }
      decorations.push(Decoration.node(range.from, range.to, attrs));
    }
  });
  return DecorationSet.create(doc, decorations);
}

/**
 * Markers are invisible, so Backspace/Delete next to one could merge it into a text paragraph,
 * which would turn that text into part of an HTML comment. Split any such paragraph back apart.
 */
export function separateMarkers(doc: PMNode, tr: import("@milkdown/kit/prose/state").Transaction): boolean {
  const fixes: Array<{ from: number; to: number; nodes: PMNode[] }> = [];
  doc.forEach((block, pos) => {
    if (block.type.name !== "paragraph" || block.childCount < 2) return;
    let hasMarker = false;
    block.forEach((child) => {
      if (child.type.name === "html" && parseMarker(child.attrs.value as string)) hasMarker = true;
    });
    if (!hasMarker) return;
    const nodes: PMNode[] = [];
    let run: PMNode[] = [];
    const flush = () => {
      if (run.length) nodes.push(block.type.create(block.attrs, run));
      run = [];
    };
    block.forEach((child) => {
      if (child.type.name === "html" && parseMarker(child.attrs.value as string)) {
        flush();
        nodes.push(block.type.create(block.attrs, child));
      } else {
        run.push(child);
      }
    });
    flush();
    fixes.push({ from: pos, to: pos + block.nodeSize, nodes });
  });
  for (const fix of fixes.reverse()) tr.replaceWith(fix.from, fix.to, fix.nodes);
  return fixes.length > 0;
}

export const commentHighlight = $prose(
  () =>
    new Plugin({
      key: highlightKey,
      state: {
        init: (_, state) => highlights(state.doc),
        apply: (tr, old) => (tr.docChanged ? highlights(tr.doc) : old),
      },
      props: {
        decorations: (state) => highlightKey.getState(state),
      },
      appendTransaction: (trs, _old, state) => {
        if (!trs.some((tr) => tr.docChanged)) return null;
        const tr = state.tr;
        return separateMarkers(state.doc, tr) ? tr : null;
      },
    }),
);

/** Resolves every thread at once: removes all markers, keeps all text. */
export function resolveAll(view: EditorView): void {
  const { doc } = view.state;
  const ranges = markers(doc)
    .map((m) => markerRange(doc, m))
    .sort((a, b) => b[0] - a[0]);
  if (!ranges.length) return;
  let tr = view.state.tr;
  for (const [from, to] of ranges) tr = tr.delete(from, to);
  view.dispatch(tr);
}
