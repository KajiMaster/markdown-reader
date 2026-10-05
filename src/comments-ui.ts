// The comments side panel and the "new comment" box. Editing goes through comments-editor.ts;
// this file only builds DOM and wires events.
import type { EditorView } from "@milkdown/kit/prose/view";
import type { Node as PMNode } from "@milkdown/kit/prose/model";
import { claudePrompt, listComments, type Comment } from "./comments";
import { $prose } from "@milkdown/kit/utils";
import { Plugin } from "@milkdown/kit/prose/state";
import {
  addComment,
  answerThread,
  blockAt,
  commentsAt,
  replyToComment,
  resolveAll,
  resolveComment,
  scrollToComment,
  selectedBlocks,
} from "./comments-editor";
import { buildRequest, parseAnswer, passageOf } from "./claude";
import { normalizeForSave } from "./md";

export interface CommentsHost {
  view: () => EditorView | null;
  markdown: () => string;
  parse: (md: string) => PMNode;
  askClaude: (system: string, prompt: string) => Promise<string>;
  path: () => string | null;
  save: () => Promise<boolean>;
  status: (message: string) => void;
}

// Per-thread Claude state. Kept in memory only; only real replies are written to the file.
const thinking = new Set<string>();
const failures = new Map<string, string>();

const panel = document.querySelector<HTMLElement>("#comments")!;
const list = panel.querySelector<HTMLElement>(".comments-list")!;
const box = document.querySelector<HTMLElement>("#comment-box")!;
const boxInput = box.querySelector<HTMLTextAreaElement>("textarea")!;
const addButton = document.querySelector<HTMLButtonElement>("#comment-add")!;
const badges = document.querySelector<HTMLElement>("#comment-badges")!;
let comments: Comment[] = [];

type Range = { from: number; to: number };
/** What the margin 💬 button will comment on: the selection, or the hovered block. */
let buttonRange: Range | null = null;
let buttonFromSelection = false;
/** What the open "new comment" box will comment on. */
let boxRange: Range | null = null;
let hideTimer: number | undefined;

let host: CommentsHost;
let userHidden = false;

export function initComments(h: CommentsHost): void {
  host = h;
  // Keep the editor's selection when the button is pressed.
  addButton.addEventListener("mousedown", (event) => event.preventDefault());
  addButton.addEventListener("click", () => {
    if (buttonRange) openBox(buttonRange);
  });
  addButton.addEventListener("mouseenter", () => window.clearTimeout(hideTimer));
  const editorEl = document.querySelector<HTMLElement>("#editor")!;
  editorEl.addEventListener("mousemove", onHover);
  editorEl.addEventListener("mouseleave", () => {
    if (!buttonFromSelection) hideButtonSoon();
  });
  editorEl.addEventListener("scroll", () => {
    if (!buttonFromSelection) hideButton();
    else placeForSelection();
    const view = host.view();
    if (view) renderBadges(view);
  });
  panel.querySelector(".comments-copy")!.addEventListener("click", () => void copyPrompt());
  panel.querySelector(".comments-close")!.addEventListener("click", () => togglePanel(false));
  boxInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeBox();
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitBox();
    }
  });
  boxInput.addEventListener("blur", closeBox);
  panel.querySelector(".comments-resolve-all")!.addEventListener("click", () => {
    const view = host.view();
    if (view) resolveAll(view);
  });
  window.addEventListener("resize", () => {
    const view = host.view();
    if (view) renderBadges(view);
  });
}

export function togglePanel(show = panel.hidden): void {
  userHidden = !show;
  panel.hidden = !show;
}

/** Re-reads the comments from the document. Call after every document change. */
export function refreshComments(): void {
  comments = listComments(host.markdown());
  list.replaceChildren(...comments.map(renderThread));
  if (!comments.length) {
    const empty = document.createElement("p");
    empty.className = "comments-empty";
    empty.textContent = "Select text and press Ctrl+Alt+M to start a thread with Claude about it.";
    list.append(empty);
  }
  panel.hidden = userHidden || !comments.length;
  const view = host.view();
  if (view) renderBadges(view);
}

function focusThread(id: string): void {
  togglePanel(true);
  const thread = panel.querySelector<HTMLElement>(`[data-thread="${id}"]`);
  thread?.scrollIntoView({ block: "nearest" });
  thread?.querySelector<HTMLInputElement>("input")?.focus();
}

/** A 💬 badge in the right margin beside the first block of each thread. */
function renderBadges(view: EditorView): void {
  const byId = new Map(comments.map((c) => [c.id, c]));
  const out: HTMLElement[] = [];
  for (const block of view.dom.querySelectorAll<HTMLElement>(".md-commented-first")) {
    const rect = block.getBoundingClientRect();
    const ids = (block.dataset.commentFirst ?? "").split(" ").filter((id) => byId.has(id));
    ids.forEach((id, i) => {
      const comment = byId.get(id)!;
      const last = comment.messages[comment.messages.length - 1];
      const badge = document.createElement("button");
      badge.className = "md-comment-badge";
      if (last.author !== "you") badge.classList.add("replied");
      if (thinking.has(id)) badge.classList.add("thinking");
      badge.textContent = "💬";
      badge.title = `${comment.messages[0].text}\n(${comment.messages.length} message${comment.messages.length > 1 ? "s" : ""})`;
      badge.style.top = `${rect.top + i * 34}px`;
      badge.style.left = `${Math.min(rect.right + 12, window.innerWidth - 40)}px`;
      badge.addEventListener("mousedown", (event) => event.preventDefault());
      badge.addEventListener("click", () => focusThread(id));
      out.push(badge);
    });
  }
  badges.replaceChildren(...out);
}

function renderThread(comment: Comment): HTMLElement {
  const thread = document.createElement("section");
  thread.className = "thread";
  thread.dataset.thread = comment.id;

  const head = document.createElement("button");
  head.className = "thread-id";
  head.textContent = comment.id;
  head.title = "Show in document";
  head.addEventListener("click", () => {
    const view = host.view();
    if (view) scrollToComment(view, comment.id);
  });
  thread.append(head);

  for (const m of comment.messages) {
    const p = document.createElement("p");
    p.className = `msg msg-${m.author === "you" ? "you" : "other"}`;
    const who = document.createElement("strong");
    who.textContent = m.author === "you" ? "You" : m.author;
    p.append(who, ` ${m.text}`);
    thread.append(p);
  }

  const last = comment.messages[comment.messages.length - 1];
  if (thinking.has(comment.id)) {
    const p = document.createElement("p");
    p.className = "msg msg-thinking";
    p.textContent = "Claude is thinking…";
    thread.append(p);
  } else if (failures.has(comment.id)) {
    const p = document.createElement("p");
    p.className = "msg msg-error";
    p.textContent = failures.get(comment.id)!;
    thread.append(p, askButton(comment.id, "Try again"));
  } else if (last.author === "you") {
    thread.append(askButton(comment.id, "Ask Claude"));
  }

  const reply = document.createElement("input");
  reply.placeholder = "Reply to Claude…";
  reply.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !reply.value.trim()) return;
    const view = host.view();
    if (!view) return;
    replyToComment(view, comment.id, "you", reply.value.trim());
    void ask(comment.id);
  });

  const resolve = document.createElement("button");
  resolve.className = "thread-resolve";
  resolve.textContent = last.author === "you" ? "Resolve" : "Accept & resolve";
  resolve.title = "Remove this comment, keep the text";
  resolve.addEventListener("click", () => {
    const view = host.view();
    if (view) resolveComment(view, comment.id);
  });

  const actions = document.createElement("div");
  actions.className = "thread-actions";
  actions.append(reply, resolve);
  thread.append(actions);
  return thread;
}

function askButton(id: string, label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "thread-ask";
  button.textContent = label;
  button.addEventListener("click", () => void ask(id));
  return button;
}

/**
 * Asks Claude about one thread and applies the answer. If the passage was edited while Claude
 * was thinking, the reply is still added but the rewrite is not applied over the new text.
 */
async function ask(id: string): Promise<void> {
  if (thinking.has(id)) return;
  const request = buildRequest(normalizeForSave(host.markdown()), id);
  if (!request) return;
  thinking.add(id);
  failures.delete(id);
  refreshComments();
  try {
    const answer = parseAnswer(await host.askClaude(request.system, request.prompt));
    const view = host.view();
    if (!view) return;
    let { reply, replacement } = answer;
    if (replacement !== null && passageOf(normalizeForSave(host.markdown()), id) !== request.passage) {
      replacement = null;
      reply += " (The text changed while I was answering, so I didn't apply my edit. Ask again to retry.)";
    }
    answerThread(view, id, reply, replacement, host.parse);
  } catch (error) {
    failures.set(id, String(error));
  } finally {
    thinking.delete(id);
    refreshComments();
  }
}

// ---- the margin 💬 button -------------------------------------------------------------

/** Right edge of the text column: the block elements span it, the editor itself is wider. */
function columnRight(view: EditorView, range: Range): number {
  const dom = view.nodeDOM(range.from);
  const rect = dom instanceof HTMLElement ? dom.getBoundingClientRect() : view.dom.getBoundingClientRect();
  return rect.right;
}

function showButton(view: EditorView, range: Range, top: number, fromSelection: boolean): void {
  window.clearTimeout(hideTimer);
  buttonRange = range;
  buttonFromSelection = fromSelection;
  addButton.style.top = `${Math.max(4, top)}px`;
  addButton.style.left = `${Math.min(columnRight(view, range) + 12, window.innerWidth - 40)}px`;
  addButton.title = fromSelection ? "Comment on the selection (Ctrl+Alt+M)" : "Comment on this block";
  addButton.hidden = false;
}

function hideButton(): void {
  addButton.hidden = true;
  buttonRange = null;
  buttonFromSelection = false;
}

function hideButtonSoon(): void {
  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(hideButton, 400);
}

function placeForSelection(): void {
  const view = host.view();
  const range = view ? selectedBlocks(view) : null;
  if (!view || !range) return;
  showButton(view, range, view.coordsAtPos(view.state.selection.from).top - 2, true);
}

function onHover(event: MouseEvent): void {
  const view = host.view();
  if (!view || !box.hidden || buttonFromSelection) return;
  // Hovering in the margin beside a block counts as hovering the block.
  const column = view.dom.getBoundingClientRect();
  const style = getComputedStyle(view.dom);
  const left = Math.min(
    Math.max(event.clientX, column.left + parseFloat(style.paddingLeft) + 4),
    column.right - parseFloat(style.paddingRight) - 4,
  );
  const pos = view.posAtCoords({ left, top: event.clientY });
  const block = pos ? (blockAt(view, pos.pos) ?? (pos.inside >= 0 ? blockAt(view, pos.inside + 1) : null)) : null;
  const dom = block ? view.nodeDOM(block.from) : null;
  if (!block || !(dom instanceof HTMLElement)) {
    hideButtonSoon();
    return;
  }
  showButton(view, block, dom.getBoundingClientRect().top, false);
  // Sit beside the block's thread badge rather than on top of it.
  if (dom.classList.contains("md-commented-first")) {
    addButton.style.left = `${parseFloat(addButton.style.left) + 36}px`;
  }
}

/** Selection changes: show the button for a selection, and mark the thread under the cursor. */
function onEditorUpdate(view: EditorView): void {
  renderBadges(view);
  if (selectedBlocks(view) && box.hidden) placeForSelection();
  else if (buttonFromSelection) hideButton();
  const active = new Set(commentsAt(view, view.state.selection.from));
  for (const el of list.querySelectorAll<HTMLElement>(".thread")) {
    el.classList.toggle("active", active.has(el.dataset.thread ?? ""));
  }
}

export const commentAffordance = $prose(
  () =>
    new Plugin({
      view: () => ({ update: (view) => onEditorUpdate(view) }),
    }),
);

/**
 * Opens the "new comment" box for `range`, or for the selected blocks, or the block holding
 * the cursor.
 */
export function openBox(range?: Range): void {
  const view = host.view();
  if (!view) return;
  const target = range ?? selectedBlocks(view) ?? blockAt(view, view.state.selection.from);
  if (!target) return;
  boxRange = target;
  hideButton();
  const top = view.coordsAtPos(Math.min(target.from + 1, view.state.doc.content.size)).top;
  box.style.top = `${Math.max(8, Math.min(top, window.innerHeight - 140))}px`;
  box.style.left = `${Math.max(8, Math.min(columnRight(view, target) - 320, window.innerWidth - 340))}px`;
  box.hidden = false;
  boxInput.value = "";
  boxInput.focus();
}

function closeBox(): void {
  if (box.hidden) return;
  box.hidden = true;
  host.view()?.focus();
}

function submitBox(): void {
  const text = boxInput.value.trim();
  const view = host.view();
  closeBox();
  const range = boxRange;
  boxRange = null;
  if (!text || !view || !range) return;
  const id = addComment(view, text, range);
  togglePanel(true);
  void ask(id);
}

async function copyPrompt(): Promise<void> {
  if (!(await host.save())) return;
  const path = host.path();
  if (!path) return;
  await copyText(claudePrompt(path));
  host.status("Prompt copied — paste it into Claude Code. The document reloads when Claude saves.");
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}
