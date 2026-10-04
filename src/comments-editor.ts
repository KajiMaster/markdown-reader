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

/** Wraps the top-level blocks touched by the selection in a new comment. Returns its id. */
export function addComment(view: EditorView, text: string): string {
  const { state } = view;
  const { $from, $to } = state.selection;
  const from = $from.depth >= 1 ? $from.before(1) : $from.pos;
  const to = $to.depth >= 1 ? $to.after(1) : $to.pos;
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

export function scrollToComment(view: EditorView, id: string): void {
  const start = markers(view.state.doc).find((m) => m.marker.kind === "start" && m.marker.id === id);
  if (!start) return;
  const dom = view.nodeDOM(start.pos);
  if (dom instanceof HTMLElement) dom.scrollIntoView({ block: "center" });
}

/** Marker nodes render as small chips; any other raw HTML keeps the default rendering. */
export const commentChipView = $view(htmlSchema.node, () => (node) => {
  const value = node.attrs.value as string;
  const dom = document.createElement("span");
  dom.dataset.type = "html";
  dom.dataset.value = value;
  const marker = parseMarker(value);
  if (!marker) {
    dom.textContent = value;
  } else if (marker.kind === "start") {
    const last = marker.messages[marker.messages.length - 1];
    dom.className = "md-comment-chip";
    dom.dataset.commentId = marker.id;
    dom.textContent = `💬 ${marker.id} · ${marker.messages[0].text}`;
    dom.title = marker.messages.map((m) => `${m.author}: ${m.text}`).join("\n");
    if (last.author !== "you") dom.classList.add("md-comment-replied");
  } else {
    dom.className = "md-comment-end";
    dom.dataset.commentId = marker.id;
    dom.textContent = `end ${marker.id}`;
  }
  return { dom, ignoreMutation: () => true };
});

const highlightKey = new PluginKey("md-comment-highlight");

function highlights(doc: PMNode): DecorationSet {
  const decorations: Decoration[] = [];
  const open: string[] = [];
  doc.forEach((block, pos) => {
    const only = block.childCount === 1 ? block.firstChild : null;
    const marker = only?.type.name === "html" ? parseMarker(only.attrs.value as string) : null;
    if (marker?.kind === "start") open.push(marker.id);
    else if (marker?.kind === "end") {
      const i = open.lastIndexOf(marker.id);
      if (i !== -1) open.splice(i, 1);
    } else if (open.length) {
      decorations.push(Decoration.node(pos, pos + block.nodeSize, { class: "md-commented", "data-comments": open.join(" ") }));
    }
  });
  return DecorationSet.create(doc, decorations);
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
    }),
);
