// The comments side panel and the "new comment" box. Editing goes through comments-editor.ts;
// this file only builds DOM and wires events.
import type { EditorView } from "@milkdown/kit/prose/view";
import { claudePrompt, listComments, type Comment } from "./comments";
import { addComment, replyToComment, resolveComment, scrollToComment } from "./comments-editor";

export interface CommentsHost {
  view: () => EditorView | null;
  markdown: () => string;
  path: () => string | null;
  save: () => Promise<boolean>;
  status: (message: string) => void;
}

const panel = document.querySelector<HTMLElement>("#comments")!;
const list = panel.querySelector<HTMLElement>(".comments-list")!;
const box = document.querySelector<HTMLElement>("#comment-box")!;
const boxInput = box.querySelector<HTMLTextAreaElement>("textarea")!;

let host: CommentsHost;
let userHidden = false;

export function initComments(h: CommentsHost): void {
  host = h;
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
  // Clicking a chip in the document opens its thread.
  document.addEventListener("click", (event) => {
    const chip = (event.target as Element | null)?.closest?.<HTMLElement>(".md-comment-chip");
    if (!chip?.dataset.commentId) return;
    togglePanel(true);
    panel.querySelector(`[data-thread="${chip.dataset.commentId}"]`)?.scrollIntoView({ block: "nearest" });
  });
}

export function togglePanel(show = panel.hidden): void {
  userHidden = !show;
  panel.hidden = !show;
}

/** Re-reads the comments from the document. Call after every document change. */
export function refreshComments(): void {
  const comments = listComments(host.markdown());
  list.replaceChildren(...comments.map(renderThread));
  if (!comments.length) {
    const empty = document.createElement("p");
    empty.className = "comments-empty";
    empty.textContent = "Select text and press Ctrl+Alt+M to ask Claude about it.";
    list.append(empty);
  }
  panel.hidden = userHidden || !comments.length;
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

  const reply = document.createElement("input");
  reply.placeholder = "Reply…";
  reply.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !reply.value.trim()) return;
    const view = host.view();
    if (view) replyToComment(view, comment.id, "you", reply.value.trim());
  });

  const resolve = document.createElement("button");
  resolve.className = "thread-resolve";
  resolve.textContent = "Resolve";
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

/** Opens the "new comment" box next to the current selection. */
export function openBox(): void {
  const view = host.view();
  if (!view) return;
  const coords = view.coordsAtPos(view.state.selection.from);
  box.style.top = `${Math.min(coords.bottom + 6, window.innerHeight - 120)}px`;
  box.style.left = `${Math.max(8, Math.min(coords.left, window.innerWidth - 340))}px`;
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
  if (!text || !view) return;
  addComment(view, text);
  togglePanel(true);
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
