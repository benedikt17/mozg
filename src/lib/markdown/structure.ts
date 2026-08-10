import type { Heading, PhrasingContent, Table } from "mdast";
import { parseMarkdown } from "@/lib/markdown/pipeline";
import type { MarkdownDocument } from "@/lib/markdown/types";

export type MarkdownHeadingStructure = {
  depth: Heading["depth"];
  endLineIndex: number;
  startLineIndex: number;
  text: string;
};

export type MarkdownTableStructure = {
  endLineIndex: number;
  startLineIndex: number;
  table: Table;
};

export type MarkdownDocumentStructure = {
  document: MarkdownDocument;
  headings: MarkdownHeadingStructure[];
  tables: MarkdownTableStructure[];
};

function getPhrasingText(node: PhrasingContent): string {
  if ("children" in node) {
    return node.children.map((child) => getPhrasingText(child)).join("");
  }
  if ("value" in node && typeof node.value === "string") return node.value;
  if ("alt" in node && typeof node.alt === "string") return node.alt;
  return "";
}

function getSourceLineRange(
  node: Heading | Table,
): { endLineIndex: number; startLineIndex: number } | null {
  const startLine = node.position?.start.line;
  const endLine = node.position?.end.line;
  if (startLine === undefined || endLine === undefined) return null;
  return {
    endLineIndex: endLine - 1,
    startLineIndex: startLine - 1,
  };
}

export function analyzeMarkdownStructure(
  markdown: string,
): MarkdownDocumentStructure {
  const document = parseMarkdown(markdown);
  const headings: MarkdownHeadingStructure[] = [];
  const tables: MarkdownTableStructure[] = [];

  for (const node of document.children) {
    if (node.type === "heading") {
      const range = getSourceLineRange(node);
      if (!range) continue;
      headings.push({
        depth: node.depth,
        text: node.children.map((child) => getPhrasingText(child)).join(""),
        ...range,
      });
      continue;
    }
    if (node.type === "table") {
      const range = getSourceLineRange(node);
      if (!range) continue;
      tables.push({ table: node, ...range });
    }
  }

  return { document, headings, tables };
}

export function getFirstMarkdownHeading(
  markdown: string,
): MarkdownHeadingStructure | undefined {
  return analyzeMarkdownStructure(markdown).headings[0];
}
