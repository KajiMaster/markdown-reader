import { describe, it, expect } from "vitest";
import { classifyHref, resolveRelative, slugify, headingSlugs, htmlAnchorId } from "../src/links";

describe("classifyHref", () => {
  const cur = "/home/u/notes/doc.md";
  it("external http(s)", () => {
    expect(classifyHref("https://example.com/x", cur)).toEqual({ kind: "external", url: "https://example.com/x" });
    expect(classifyHref("HTTP://a.b", cur).kind).toBe("external");
  });
  it("anchors", () => {
    expect(classifyHref("#my-heading", cur)).toEqual({ kind: "anchor", id: "my-heading" });
    expect(classifyHref("#caf%C3%A9", cur)).toEqual({ kind: "anchor", id: "café" });
    expect(classifyHref("#", cur).kind).toBe("none");
  });
  it("relative .md files resolve against the current file's directory", () => {
    expect(classifyHref("other.md", cur)).toEqual({ kind: "file", path: "/home/u/notes/other.md", anchor: null });
    expect(classifyHref("../up/x.markdown#sec", cur)).toEqual({ kind: "file", path: "/home/u/up/x.markdown", anchor: "sec" });
    expect(classifyHref("./my%20file.md", cur)).toEqual({ kind: "file", path: "/home/u/notes/my file.md", anchor: null });
  });
  it("ignores non-md files, other schemes, absolute paths, and unsaved docs", () => {
    expect(classifyHref("image.png", cur).kind).toBe("none");
    expect(classifyHref("mailto:a@b.c", cur).kind).toBe("none");
    expect(classifyHref("javascript:alert(1)", cur).kind).toBe("none");
    expect(classifyHref("file:///etc/x.md", cur).kind).toBe("none");
    expect(classifyHref("/etc/x.md", cur).kind).toBe("none");
    expect(classifyHref("other.md", null).kind).toBe("none");
  });
});

describe("resolveRelative", () => {
  it("handles Windows paths", () => {
    expect(resolveRelative("C:\\docs\\a\\doc.md", "..\\b\\x.md")).toBe("C:\\docs\\b\\x.md");
    expect(resolveRelative("C:\\docs\\doc.md", "sub/x.md")).toBe("C:\\docs\\sub\\x.md");
  });
  it("does not climb above the root", () => {
    expect(resolveRelative("/doc.md", "../../x.md")).toBe("/x.md");
  });
});

describe("heading slugs", () => {
  it("GitHub-style", () => {
    expect(slugify("Hello, World!")).toBe("hello-world");
    expect(slugify("  API v2.0 — notes ")).toBe("api-v20--notes");
    expect(slugify("snake_case & stuff")).toBe("snake_case--stuff");
    expect(slugify("Café Ünïcode")).toBe("café-ünïcode");
  });
  it("de-duplicates in document order", () => {
    expect(headingSlugs(["Intro", "Intro", "Intro", "Intro 1"])).toEqual(["intro", "intro-1", "intro-2", "intro-1-1"]);
  });
  it("reads raw HTML anchors", () => {
    expect(htmlAnchorId('<a id="top"></a>')).toBe("top");
    expect(htmlAnchorId("<a name='old'>")).toBe("old");
    expect(htmlAnchorId("<span id='x'>")).toBeNull();
  });
});
