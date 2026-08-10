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
  endOffset: number;
  source: string;
  startLineIndex: number;
  startOffset: number;
  table: Table;
};

export type MarkdownDocumentStructure = {
  document: MarkdownDocument;
  headings: MarkdownHeadingStructure[];
  tables: MarkdownTableStructure[];
};

type MarkdownSourceLine = {
  endOffset: number;
  startOffset: number;
};

const MARKDOWN_STRUCTURE_CACHE_LIMIT = 4;
const markdownStructureCache = new Map<string, MarkdownDocumentStructure>();

function getCachedMarkdownStructure(
  markdown: string,
): MarkdownDocumentStructure | undefined {
  const cached = markdownStructureCache.get(markdown);
  if (!cached) return undefined;
  markdownStructureCache.delete(markdown);
  markdownStructureCache.set(markdown, cached);
  return cached;
}

function cacheMarkdownStructure(
  markdown: string,
  structure: MarkdownDocumentStructure,
): MarkdownDocumentStructure {
  markdownStructureCache.set(markdown, structure);
  while (markdownStructureCache.size > MARKDOWN_STRUCTURE_CACHE_LIMIT) {
    const oldestKey = markdownStructureCache.keys().next().value;
    if (oldestKey === undefined) break;
    markdownStructureCache.delete(oldestKey);
  }
  return structure;
}

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

function getMarkdownSourceLines(markdown: string): MarkdownSourceLine[] {
  const lines: MarkdownSourceLine[] = [];
  const lineBreakPattern = /\r\n|\n|\r/g;
  let startOffset = 0;
  let match = lineBreakPattern.exec(markdown);

  while (match) {
    lines.push({ startOffset, endOffset: match.index });
    startOffset = match.index + match[0].length;
    match = lineBreakPattern.exec(markdown);
  }
  lines.push({ startOffset, endOffset: markdown.length });
  return lines;
}

export function analyzeMarkdownStructure(
  markdown: string,
): MarkdownDocumentStructure {
  const cached = getCachedMarkdownStructure(markdown);
  if (cached) return cached;

  const document = parseMarkdown(markdown);
  const sourceLines = getMarkdownSourceLines(markdown);
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
      const startLine = sourceLines[range.startLineIndex];
      const endLine = sourceLines[range.endLineIndex];
      if (!startLine || !endLine) continue;
      const startOffset = startLine.startOffset;
      const endOffset = endLine.endOffset;
      tables.push({
        table: node,
        source: markdown.slice(startOffset, endOffset),
        startOffset,
        endOffset,
        ...range,
      });
    }
  }

  return cacheMarkdownStructure(markdown, { document, headings, tables });
}

export function getFirstMarkdownHeading(
  markdown: string,
): MarkdownHeadingStructure | undefined {
  return analyzeMarkdownStructure(markdown).headings[0];
}
