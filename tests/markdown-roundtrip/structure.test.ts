import type { PhrasingContent, TableCell } from "mdast";
import { describe, expect, it } from "vitest";
import {
  analyzeMarkdownStructure,
  parseMarkdown,
  serializeMarkdown,
} from "@/lib/markdown";

function phrasingText(nodes: PhrasingContent[]): string {
  return nodes
    .map((node) => {
      if ("children" in node) return phrasingText(node.children);
      if ("value" in node && typeof node.value === "string") return node.value;
      if ("alt" in node && typeof node.alt === "string") return node.alt;
      return "";
    })
    .join("");
}

function cellText(cell: TableCell | undefined): string {
  return cell ? phrasingText(cell.children) : "";
}

describe("Markdown document structure", () => {
  it("derives semantic headings and source lines from MDAST", () => {
    const markdown = [
      "# **Главный** [[Документ]]",
      "",
      "Текст.",
      "",
      "## Раздел `API`",
      "",
    ].join("\n");

    const structure = analyzeMarkdownStructure(markdown);

    expect(structure.headings).toEqual([
      {
        depth: 1,
        endLineIndex: 0,
        startLineIndex: 0,
        text: "Главный Документ",
      },
      {
        depth: 2,
        endLineIndex: 4,
        startLineIndex: 4,
        text: "Раздел API",
      },
    ]);
  });

  it("recognizes a GFM table once and preserves its source range", () => {
    const markdown = [
      "| Name | Value | Notes |",
      "| :--- | ---: | :---: |",
      "| A \\| B | **10** | [site](https://example.com) |",
      "| C | 20 | `code` |",
      "",
    ].join("\n");

    const structure = analyzeMarkdownStructure(markdown);
    const table = structure.tables[0]?.table;

    expect(structure.tables).toHaveLength(1);
    expect(structure.tables[0]?.startLineIndex).toBe(0);
    expect(structure.tables[0]?.endLineIndex).toBe(3);
    expect(table?.align).toEqual(["left", "right", "center"]);
    expect(cellText(table?.children[1]?.children[0])).toBe("A | B");
    expect(cellText(table?.children[1]?.children[1])).toBe("10");
    expect(cellText(table?.children[1]?.children[2])).toBe("site");
    expect(cellText(table?.children[2]?.children[2])).toBe("code");
  });

  it("does not mistake ordinary pipe text for a table", () => {
    const markdown = "Alpha | Beta\n\nnot | a | table\n";

    expect(analyzeMarkdownStructure(markdown).tables).toEqual([]);
  });

  it("keeps table semantics stable across canonical round-trips", () => {
    const source = [
      "| Key | Value |",
      "| --- | --- |",
      "| escaped \\| pipe | **bold** |",
      "| wiki | [[Связанная статья]] |",
      "",
    ].join("\n");

    const once = serializeMarkdown(parseMarkdown(source));
    const twice = serializeMarkdown(parseMarkdown(once));
    const table = analyzeMarkdownStructure(once).tables[0]?.table;

    expect(twice).toBe(once);
    expect(cellText(table?.children[1]?.children[0])).toBe("escaped | pipe");
    expect(cellText(table?.children[1]?.children[1])).toBe("bold");
    expect(cellText(table?.children[2]?.children[1])).toBe("Связанная статья");
  });

  it("reuses the same structure for identical immutable Markdown", () => {
    const markdown = "# Cache identity\n\nParagraph with **formatting**.\n";

    const first = analyzeMarkdownStructure(markdown);
    const second = analyzeMarkdownStructure(markdown);

    expect(second).toBe(first);
  });

  it("bounds the recent structure cache instead of retaining every edit", () => {
    const firstMarkdown = "# LRU unique A 2026-08-10\n";
    const first = analyzeMarkdownStructure(firstMarkdown);

    analyzeMarkdownStructure("# LRU unique B 2026-08-10\n");
    analyzeMarkdownStructure("# LRU unique C 2026-08-10\n");
    analyzeMarkdownStructure("# LRU unique D 2026-08-10\n");
    analyzeMarkdownStructure("# LRU unique E 2026-08-10\n");

    const afterEviction = analyzeMarkdownStructure(firstMarkdown);
    expect(afterEviction).not.toBe(first);
    expect(afterEviction.headings[0]?.text).toBe("LRU unique A 2026-08-10");
  });
});
