import type { Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { extractWikiLinks } from "@/lib/markdown/references";
import type { MarkdownDocument } from "@/lib/markdown/types";

const parser = unified().use(remarkParse).use(remarkGfm);

const serializer = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkStringify, {
    bullet: "-",
    emphasis: "*",
    fences: true,
    listItemIndent: "one",
    rule: "-",
    strong: "*",
  });

export function normalizeMarkdownLineEndings(markdown: string): string {
  return markdown.replace(/\r\n?/g, "\n");
}

export function parseMarkdown(markdown: string): MarkdownDocument {
  const normalized = normalizeMarkdownLineEndings(markdown);
  const document = parser.parse(normalized) as Root;
  return Object.assign(document, {
    data: {
      ...document.data,
      wikiLinks: extractWikiLinks(normalized),
    },
  });
}

export function serializeMarkdown(document: MarkdownDocument): string {
  let markdown = serializer.stringify(document);

  for (const wikiLink of document.data.wikiLinks) {
    const escaped = wikiLink.raw.replace("[[", "\\[\\[");
    markdown = markdown.replace(escaped, wikiLink.raw);
  }

  return markdown;
}
