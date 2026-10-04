import { describe, it, expect } from "vitest";
import { parseMarker, startMarker, endMarker, nextId, listComments, claudePrompt } from "../src/comments";

describe("markers", () => {
  it("parse a request with replies", () => {
    expect(parseMarker("<!-- @claude c1: tighten this\nclaude: Done, merged.\nyou: thanks -->")).toEqual({
      kind: "start",
      id: "c1",
      messages: [
        { author: "you", text: "tighten this" },
        { author: "claude", text: "Done, merged." },
        { author: "you", text: "thanks" },
      ],
    });
    expect(parseMarker("<!-- /@claude c1 -->")).toEqual({ kind: "end", id: "c1" });
  });
  it("ignores ordinary HTML and comments", () => {
    expect(parseMarker("<!-- just a note -->")).toBeNull();
    expect(parseMarker('<a id="x"></a>')).toBeNull();
  });
  it("round-trip through startMarker", () => {
    const messages = [{ author: "you", text: "fix a --> b" }, { author: "claude", text: "ok" }];
    const html = startMarker("c2", messages);
    expect(html).not.toMatch(/-->[\s\S]+-->/);
    expect(parseMarker(html)).toEqual({ kind: "start", id: "c2", messages: [{ author: "you", text: "fix a -- > b" }, messages[1]] });
    expect(parseMarker(endMarker("c2"))).toEqual({ kind: "end", id: "c2" });
  });
  it("nextId fills the first free slot", () => {
    expect(nextId([])).toBe("c1");
    expect(nextId(["c1", "c3"])).toBe("c2");
  });
});

describe("listComments", () => {
  it("finds comments in a document", () => {
    const md = "# T\n\n<!-- @claude c1: shorter -->\n\nOne.\n\nTwo.\n\n<!-- /@claude c1 -->\n\n<!-- other -->\n";
    expect(listComments(md)).toEqual([{ id: "c1", messages: [{ author: "you", text: "shorter" }] }]);
  });
  it("prompt names the file", () => {
    expect(claudePrompt("/x/doc.md")).toMatch(/^Address the @claude review comments in \/x\/doc\.md\./);
  });
});
