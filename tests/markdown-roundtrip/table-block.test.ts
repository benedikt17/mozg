import type { PhrasingContent, Table, TableCell } from "mdast";
import { describe, expect, it } from "vitest";
import {
  analyzeMarkdownStructure,
  replaceMarkdownTableBlock,
  serializeMarkdownTableBlock,
} from "@/lib/markdown";

function tableFrom(markdown: string): Table {
  const table = analyzeMarkdownStructure(markdown).tables[0]?.table;
  if (!table) throw new Error("Expected a Markdown table");
  return table;
}

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

describe("Markdown table block replacement", () => {
  it("replaces only the selected table and preserves surrounding source bytes", () => {
    const original = [
      "<!-- keep: α | β -->",
      "# До таблицы",
      "",
      "| Key | Value |",
      "| :--- | ---: |",
      "| old | [[Связь]] |",
      "",
      "```txt",
      "not | a | table",
      "```",
      "",
      "| Other | Table |",
      "| --- | --- |",
      "| stay | exact |",
      "",
      "Хвост Ω",
    ].join("\n");
    const structure = analyzeMarkdownStructure(original);
    const target = structure.tables[0]!;
    const nextTable = tableFrom(
      [
        "| Key | Value |",
        "| :--- | ---: |",
        "| A \\| Б | [[Новая связь]] |",
      ].join("\n"),
    );
    const prefix = original.slice(0, target.startOffset);
    const suffix = original.slice(target.endOffset);

    const replaced = replaceMarkdownTableBlock(original, target, nextTable);

    expect(replaced.startsWith(prefix)).toBe(true);
    expect(replaced.endsWith(suffix)).toBe(true);
    expect(replaced).toContain("```txt\nnot | a | table\n```");
    expect(replaced).toContain(
      "| Other | Table |\n| --- | --- |\n| stay | exact |",
    );
    expect(replaced).toContain("Хвост Ω");

    const reparsed = analyzeMarkdownStructure(replaced);
    expect(reparsed.tables).toHaveLength(2);
    expect(cellText(reparsed.tables[0]?.table.children[1]?.children[0])).toBe(
      "A | Б",
    );
    expect(cellText(reparsed.tables[0]?.table.children[1]?.children[1])).toBe(
      "Новая связь",
    );
  });

  it("preserves CRLF outside and inside the replaced table", () => {
    const original = [
      "До",
      "",
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
      "",
      "После",
      "",
    ].join("\r\n");
    const target = analyzeMarkdownStructure(original).tables[0]!;
    const nextTable = tableFrom(
      "| A | B |\n| --- | --- |\n| три | четыре |",
    );
    const prefix = original.slice(0, target.startOffset);
    const suffix = original.slice(target.endOffset);

    const replaced = replaceMarkdownTableBlock(original, target, nextTable);
    const replacement = replaced.slice(
      target.startOffset,
      replaced.length - suffix.length,
    );

    expect(replaced.startsWith(prefix)).toBe(true);
    expect(replaced.endsWith(suffix)).toBe(true);
    expect(replacement).toContain("\r\n");
    expect(replacement.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("rejects stale table source ranges instead of corrupting another block", () => {
    const original = [
      "| A | B |",
      "| --- | --- |",
      "| old | value |",
    ].join("\n");
    const target = analyzeMarkdownStructure(original).tables[0]!;
    const nextTable = tableFrom(
      "| A | B |\n| --- | --- |\n| new | value |",
    );
    const staleMarkdown = original.replace("old", "changed");

    expect(() =>
      replaceMarkdownTableBlock(staleMarkdown, target, nextTable),
    ).toThrow("Markdown table source changed before replacement");
  });

  it("serializes exactly one table block without a trailing document newline", () => {
    const table = tableFrom(
      "| Лево | Право |\n| :--- | ---: |\n| A \\| B | [[Связь]] |",
    );
    const serialized = serializeMarkdownTableBlock(table);

    expect(serialized.endsWith("\n")).toBe(false);
    expect(serialized).toContain("A \\| B");
    expect(serialized).toContain("[[Связь]]");
  });
});
