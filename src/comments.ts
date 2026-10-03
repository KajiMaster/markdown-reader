// @claude review comments, stored in the Markdown file itself as HTML comments so they travel
// with the document, stay invisible in other renderers, and need no tooling for Claude to read:
//
//   <!-- @claude c1: tighten these two paragraphs
//   claude: Merged them into one. -->
//   …the commented blocks…
//   <!-- /@claude c1 -->
//
// The first line of the opening marker is the request; each later `name: text` line is a reply.
// Resolving a comment means deleting both markers. Pure functions only — no editor, no I/O.
import type { Html } from "mdast";
import { parse } from "./md";

export interface Message {
  author: string;
  text: string;
}

export interface Comment {
  id: string;
  messages: Message[];
}

export type Marker = { kind: "start"; id: string; messages: Message[] } | { kind: "end"; id: string };

const START = /^<!--\s*@claude\s+([A-Za-z0-9_-]+)\s*:?([\s\S]*?)-->\s*$/;
const END = /^<!--\s*\/@claude\s+([A-Za-z0-9_-]+)\s*-->\s*$/;
const REPLY = /^([A-Za-z][\w .-]{0,31}):\s?(.*)$/;

export function parseMarker(html: string): Marker | null {
  const value = html.trim();
  const end = END.exec(value);
  if (end) return { kind: "end", id: end[1] };
  const start = START.exec(value);
  if (!start) return null;
  const [first, ...rest] = start[2].trim().split(/\r?\n/);
  const messages: Message[] = [{ author: "you", text: first.trim() }];
  for (const line of rest) {
    const reply = REPLY.exec(line.trim());
    if (reply) messages.push({ author: reply[1], text: reply[2].trim() });
    else if (line.trim()) messages[messages.length - 1].text += `\n${line.trim()}`;
  }
  return { kind: "start", id: start[1], messages };
}

/** `-->` would close the HTML comment early; break it up without changing what it reads as. */
function clean(text: string): string {
  return text.replace(/--+>/g, (m) => `${m.slice(0, -1)} >`).replace(/\r?\n/g, " ").trim();
}

export function startMarker(id: string, messages: Message[]): string {
  const [first, ...replies] = messages;
  const lines = [`<!-- @claude ${id}: ${clean(first.text)}`];
  for (const m of replies) lines.push(`${m.author}: ${clean(m.text)}`);
  return `${lines.join("\n")} -->`;
}

export function endMarker(id: string): string {
  return `<!-- /@claude ${id} -->`;
}

export function nextId(existing: Iterable<string>): string {
  const used = new Set(existing);
  let n = 1;
  while (used.has(`c${n}`)) n += 1;
  return `c${n}`;
}

/** Every comment in the document, in order of its opening marker. */
export function listComments(md: string): Comment[] {
  const out: Comment[] = [];
  const visit = (node: { type: string; children?: unknown[] }): void => {
    if (node.type === "html") {
      const marker = parseMarker((node as Html).value);
      if (marker?.kind === "start") out.push({ id: marker.id, messages: marker.messages });
    }
    for (const child of (node.children ?? []) as Array<{ type: string; children?: unknown[] }>) visit(child);
  };
  visit(parse(md));
  return out;
}

/** The instruction handed to Claude Code (copied to the clipboard from the comments panel). */
export function claudePrompt(path: string): string {
  return [
    `Address the @claude review comments in ${path}.`,
    "",
    "Each comment wraps the text it refers to:",
    "<!-- @claude ID: request (later lines are `name: reply`) -->  …text…  <!-- /@claude ID -->",
    "",
    "For each comment: make the requested change to the text between its markers, then either",
    "delete both markers (done), or, if you need input, leave the markers and add a line",
    "`claude: <short reply>` just before the `-->` of the opening marker.",
    "Do not change anything outside the marked ranges unless a comment asks you to.",
  ].join("\n");
}
