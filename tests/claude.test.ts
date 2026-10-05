import { describe, it, expect } from "vitest";
import { buildRequest, parseAnswer, passageOf, stripMarkers, threadOf } from "../src/claude";

const md = [
  "# Plan",
  "",
  "<!-- @claude c1: is this claim right?",
  "claude: Mostly.",
  "you: prove it -->",
  "",
  "Our tool is the fastest.",
  "",
  "It has no bugs.",
  "",
  "<!-- /@claude c1 -->",
  "",
  "<!-- @claude c2: shorter -->",
  "",
  "Tail.",
  "",
  "<!-- /@claude c2 -->",
  "",
].join("\n");

describe("thread requests", () => {
  it("extracts the passage and thread", () => {
    expect(passageOf(md, "c1")).toBe("Our tool is the fastest.\n\nIt has no bugs.");
    expect(passageOf(md, "c2")).toBe("Tail.");
    expect(passageOf(md, "c9")).toBeNull();
    expect(threadOf(md, "c1")?.map((m) => m.author)).toEqual(["you", "claude", "you"]);
  });
  it("does not confuse c1 with c10", () => {
    const ten = md.replaceAll("c1", "c10");
    expect(passageOf(ten, "c1")).toBeNull();
    expect(passageOf(ten, "c10")).toBe("Our tool is the fastest.\n\nIt has no bugs.");
  });
  it("strips every marker from the document context", () => {
    expect(stripMarkers(md)).toBe("# Plan\n\nOur tool is the fastest.\n\nIt has no bugs.\n\nTail.");
  });
  it("builds a prompt with the clean document, the passage and the thread", () => {
    const req = buildRequest(md, "c1")!;
    expect(req.passage).toBe("Our tool is the fastest.\n\nIt has no bugs.");
    expect(req.prompt).not.toMatch(/<!--/);
    expect(req.prompt).toMatch(/<passage id="c1">\nOur tool is the fastest\./);
    expect(req.prompt).toMatch(/<thread>\nauthor: is this claim right\?\nclaude: Mostly\.\nauthor: prove it\n<\/thread>/);
    expect(req.system).toMatch(/ONLY a JSON object/);
    expect(buildRequest(md, "nope")).toBeNull();
  });
});

describe("parseAnswer", () => {
  it("reads JSON, with or without a code fence", () => {
    expect(parseAnswer('{"reply":"Fair.","replacement":null}')).toEqual({ reply: "Fair.", replacement: null });
    expect(parseAnswer('```json\n{"reply":"Done.","replacement":"New text."}\n```')).toEqual({
      reply: "Done.",
      replacement: "New text.",
    });
    expect(parseAnswer('Sure: {"reply":"x","replacement":"  "}')).toEqual({ reply: "x", replacement: null });
  });
  it("falls back to plain text", () => {
    expect(parseAnswer("I disagree, here's why.")).toEqual({ reply: "I disagree, here's why.", replacement: null });
    expect(parseAnswer('{"oops": 1}')).toEqual({ reply: '{"oops": 1}', replacement: null });
  });
});
