import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse, toHtml, toMarkdown } from "../src/md";

const fixture = readFileSync(new URL("./fixtures/all-constructs.md", import.meta.url), "utf8");

// Every construct in the fixture must render to recognisable HTML. Assertions are on specific
// tags/attributes, not just "no throw", so a trivial renderer cannot pass.
const expectations: Array<[string, RegExp]> = [
  ["h1", /<h1[^>]*>H1 heading<\/h1>/],
  ["h6", /<h6[^>]*>H6 heading<\/h6>/],
  ["emphasis", /<em>emphasis<\/em>/],
  ["strong", /<strong>strong<\/strong>/],
  ["strong+em", /<em><strong>both<\/strong><\/em>|<strong><em>both<\/em><\/strong>/],
  ["inline code", /<code>inline code<\/code>/],
  ["strikethrough (GFM)", /<del>strikethrough<\/del>/],
  ["link with title", /<a href="https:\/\/example\.com" title="title">link<\/a>/],
  ["bare autolink (GFM)", /<a href="https:\/\/example\.com\/auto">https:\/\/example\.com\/auto<\/a>/],
  ["angle autolink", /<a href="https:\/\/example\.com\/angle">/],
  ["hard break", /<br>/],
  ["blockquote", /<blockquote>[\s\S]*Blockquote line one/],
  ["nested blockquote", /<blockquote>[\s\S]*<blockquote>[\s\S]*Nested blockquote/],
  ["unordered list", /<ul>[\s\S]*<li>Unordered item one<\/li>/],
  ["nested list", /<li>[\s\S]*Unordered item two[\s\S]*<ul>[\s\S]*Nested item[\s\S]*<ul>[\s\S]*Deeper nested item/],
  ["ordered list", /<ol>[\s\S]*<li>Ordered one<\/li>/],
  ["task list unchecked (GFM)", /<input[^>]*type="checkbox"[^>]*disabled[^>]*>[^<]*Task not done|<input[^>]*disabled[^>]*type="checkbox"[^>]*>[^<]*Task not done/],
  ["task list checked (GFM)", /<input[^>]*checked[^>]*>[^<]*Task done/],
  ["fenced code with lang", /<pre><code class="language-ts">const fenced/],
  ["plain fenced code", /<pre><code>plain fenced block/],
  ["indented code", /<pre><code>indented code block/],
  ["table (GFM)", /<table>[\s\S]*<th[^>]*>Column A<\/th>[\s\S]*<td[^>]*>a1<\/td>/],
  ["table alignment", /<th align="center">Column B<\/th>|<th style="text-align:\s*center;?">Column B<\/th>/],
  ["image with title", /<img src="https:\/\/example\.com\/image\.png" alt="Alt text" title="Image title">/],
  ["footnote reference (GFM)", /<sup>[\s\S]*<a[^>]*href="#user-content-fn-1"/],
  ["footnote definition (GFM)", /The footnote text\./],
  ["entity", /&#x26;|&amp;/],
  ["escaped asterisk", /\*asterisk\*/],
  ["thematic break", /<hr>/],
];

describe("toHtml renders every construct in all-constructs.md", () => {
  const html = toHtml(fixture);
  for (const [name, re] of expectations) {
    it(name, () => { expect(html).toMatch(re); });
  }
  it("emits no raw markdown syntax for headings/emphasis", () => {
    expect(html).not.toMatch(/^#+ /m);
    expect(html).not.toMatch(/\*\*strong\*\*/);
  });
});

describe("round-trip: parse → toMarkdown → parse is structurally stable", () => {
  const once = toMarkdown(parse(fixture));
  const twice = toMarkdown(parse(once));
  it("stringify is idempotent (2nd pass == 1st pass)", () => { expect(twice).toBe(once); });
  it("re-rendered HTML equals original HTML", () => { expect(toHtml(once)).toBe(toHtml(fixture)); });
  it("preserves task-list state, table, code fence language and footnote", () => {
    expect(once).toMatch(/- \[x\] Task done/);
    expect(once).toMatch(/- \[ \] Task not done/);
    expect(once).toMatch(/\| Column A/);
    expect(once).toMatch(/```ts/);
    expect(once).toMatch(/\[\^1\]: The footnote text\./);
  });
});

describe("editing semantics", () => {
  it("a paragraph edit survives the round-trip without touching other constructs", () => {
    const edited = fixture.replace("Final paragraph after a thematic break.", "Edited final paragraph.");
    const out = toMarkdown(parse(edited));
    expect(out).toMatch(/Edited final paragraph\./);
    expect(toHtml(out)).toMatch(/<h1[^>]*>H1 heading<\/h1>/);
    expect(toHtml(out)).toMatch(/<table>/);
  });
});
