import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownStringPreview } from "@/prototype/knowledge/markdown-document-preview";
import { sourceRangeInRenderedText } from "@/prototype/knowledge/knowledge-annotation-ranges";
import { analyzeMarkdownStructure } from "@/lib/markdown";

describe("Markdown coordinates in reading mode", () => {
  it("preserves text leaf positions and offsets after a wiki link of a different length", () => {
    const source =
      "# Article\n\n[[doc:short|Ссылка]]\n\n**Дата:** `2026-08-24`\n\nВторой абзац.";
    const structure = analyzeMarkdownStructure(source);
    const positions: Array<[number, number, string]> = [];
    const visit = (node: {
      type: string;
      value?: string;
      position?: { start: { offset?: number }; end: { offset?: number } };
      children?: unknown[];
    }): void => {
      if (node.type === "text")
        positions.push([
          node.position!.start.offset!,
          node.position!.end.offset!,
          node.value!,
        ]);
      for (const child of node.children ?? []) visit(child as typeof node);
    };
    visit(structure.document);
    for (const [start, end, value] of positions)
      expect(source.slice(start, end)).toBe(value);
    const html = renderToStaticMarkup(
      <MarkdownStringPreview contentId="source" markdown={source} />,
    );
    expect(html).toContain(
      `data-markdown-start="${source.indexOf("Дата:")}" data-markdown-end="${source.indexOf("Дата:") + 5}"`,
    );
    expect(html).toContain(
      `data-markdown-start="${source.indexOf("Второй абзац.")}"`,
    );
  });

  it("maps a partial literal text selection and ignores inline code delimiters", () => {
    expect(
      sourceRangeInRenderedText("Начало и конец", "Начало и конец", 9, 14),
    ).toEqual({ startOffset: 9, endOffset: 14 });
    expect(
      sourceRangeInRenderedText("`template.json`", "template.json", 0, 15),
    ).toEqual({ startOffset: 0, endOffset: 13 });
  });

  it("keeps an escaped/entity text selection inside its own source leaf", () => {
    expect(
      sourceRangeInRenderedText("A \\| &amp; B", "A | & B", 0, 12),
    ).toEqual({ startOffset: 0, endOffset: 7 });
  });
});
