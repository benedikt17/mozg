import type { Table } from "mdast";
import { serializeMarkdown } from "@/lib/markdown/pipeline";
import type { MarkdownTableStructure } from "@/lib/markdown/structure";
import type { MarkdownDocument } from "@/lib/markdown/types";

function getLineEnding(value: string): "\r\n" | "\n" | "\r" {
  const match = /\r\n|\n|\r/.exec(value);
  return (match?.[0] as "\r\n" | "\n" | "\r" | undefined) ?? "\n";
}

export function serializeMarkdownTableBlock(
  table: Table,
  lineEnding: "\r\n" | "\n" | "\r" = "\n",
): string {
  const document: MarkdownDocument = {
    type: "root",
    children: [table],
    data: { wikiLinks: [] },
  };
  const serialized = serializeMarkdown(document).replace(/\n$/, "");
  return lineEnding === "\n"
    ? serialized
    : serialized.replace(/\n/g, lineEnding);
}

export function replaceMarkdownTableBlock(
  markdown: string,
  target: MarkdownTableStructure,
  nextTable: Table,
): string {
  const currentSource = markdown.slice(target.startOffset, target.endOffset);
  if (currentSource !== target.source) {
    throw new Error("Markdown table source changed before replacement");
  }

  const replacement = serializeMarkdownTableBlock(
    nextTable,
    getLineEnding(target.source),
  );
  return `${markdown.slice(0, target.startOffset)}${replacement}${markdown.slice(target.endOffset)}`;
}
