// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeForSave, toHtml } from "../src/md";
import { editorMarkdown } from "./editor";

const fixture = readFileSync(resolve(__dirname, "fixtures/all-constructs.md"), "utf8");

describe("normalizeForSave", () => {
  const saved = normalizeForSave(fixture);
  it("is idempotent", () => { expect(normalizeForSave(saved)).toBe(saved); });
  it("keeps tasks, tables, fence languages and footnotes", () => {
    expect(saved).toMatch(/- \[x\] Task done/);
    expect(saved).toMatch(/\| Column A/);
    expect(saved).toMatch(/```ts/);
    expect(saved).toMatch(/\[\^1\]: The footnote text\./);
  });
  it("renders identically to the original", () => { expect(toHtml(saved)).toBe(toHtml(fixture)); });
});

describe("the editor's save path", () => {
  it("editor output, normalized, renders like the original and matches the pipeline's form", async () => {
    const saved = normalizeForSave(await editorMarkdown(fixture));
    expect(toHtml(saved)).toBe(toHtml(fixture));
    expect(saved).toBe(normalizeForSave(fixture));
  });
});
