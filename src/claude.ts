// One Claude turn per comment thread: build the request from the document and parse the answer.
// Pure functions; the CLI call itself is the `ask_claude` Tauri command.
import { parseMarker, type Message } from "./comments";

export interface ThreadRequest {
  system: string;
  prompt: string;
  /** The commented passage as sent, to detect edits made while Claude was thinking. */
  passage: string;
}

export interface ClaudeAnswer {
  reply: string;
  /** New Markdown for the whole passage, or null when Claude only replies. */
  replacement: string | null;
}

const SYSTEM = `You are Claude, reviewing a Markdown document together with its author inside the md-read editor.
The author attached a comment thread to one passage of the document. Answer the latest message in that thread.

- Be direct and brief: a few sentences at most. Disagree when the author is wrong, and say why.
- Only change the passage when the author asks for a change, or agrees to one you proposed.
  Then return the complete rewritten passage as Markdown in "replacement": keep everything the
  author didn't ask to change, match the document's Markdown style, and never include <!-- --> comments.
- Otherwise "replacement" is null.

Respond with ONLY a JSON object, no code fence: {"reply": "<your reply>", "replacement": "<markdown>" | null}`;

const escapeId = (id: string) => id.replace(/[^A-Za-z0-9_-]/g, "");

function startRe(id: string): RegExp {
  return new RegExp(`<!--\\s*@claude\\s+${escapeId(id)}\\b[\\s\\S]*?-->`);
}

function endRe(id: string): RegExp {
  return new RegExp(`<!--\\s*\\/@claude\\s+${escapeId(id)}\\s*-->`);
}

/** The Markdown between a thread's markers, or null if the thread isn't in the document. */
export function passageOf(md: string, id: string): string | null {
  const start = startRe(id).exec(md);
  if (!start) return null;
  const rest = md.slice(start.index + start[0].length);
  const end = endRe(id).exec(rest);
  return end ? rest.slice(0, end.index).trim() : null;
}

export function threadOf(md: string, id: string): Message[] | null {
  const start = startRe(id).exec(md);
  const marker = start ? parseMarker(start[0]) : null;
  return marker?.kind === "start" ? marker.messages : null;
}

/** The document as a reader sees it: every @claude marker removed. */
export function stripMarkers(md: string): string {
  return md.replace(/<!--\s*\/?@claude\s[\s\S]*?-->\n*/g, "").trim();
}

export function buildRequest(md: string, id: string): ThreadRequest | null {
  const passage = passageOf(md, id);
  const thread = threadOf(md, id);
  if (passage === null || !thread) return null;
  const lines = thread.map((m) => `${m.author === "you" ? "author" : m.author}: ${m.text}`);
  const prompt = [
    "<document>",
    stripMarkers(md),
    "</document>",
    "",
    `<passage id="${id}">`,
    passage,
    "</passage>",
    "",
    "<thread>",
    ...lines,
    "</thread>",
  ].join("\n");
  return { system: SYSTEM, prompt, passage };
}

export function parseAnswer(text: string): ClaudeAnswer {
  const body = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  const from = body.indexOf("{");
  const to = body.lastIndexOf("}");
  if (from !== -1 && to > from) {
    try {
      const json = JSON.parse(body.slice(from, to + 1)) as { reply?: unknown; replacement?: unknown };
      if (typeof json.reply === "string") {
        const replacement =
          typeof json.replacement === "string" && json.replacement.trim() ? json.replacement.trim() : null;
        return { reply: json.reply.trim(), replacement };
      }
    } catch {
      // Not JSON after all; fall through and treat the text as a plain reply.
    }
  }
  return { reply: text.trim(), replacement: null };
}
