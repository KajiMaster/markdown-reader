import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import remarkStringify from "remark-stringify";
import type { Root } from "mdast";

const parseProcessor = unified().use(remarkParse).use(remarkGfm);

const htmlProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeStringify);

const stringifyProcessor = unified().use(remarkStringify).use(remarkGfm);

export function parse(md: string): Root {
  return parseProcessor.parse(md) as Root;
}

export function toHtml(md: string): string {
  return htmlProcessor.processSync(md).toString();
}

export function toMarkdown(tree: Root): string {
  return stringifyProcessor.stringify(tree) as string;
}
