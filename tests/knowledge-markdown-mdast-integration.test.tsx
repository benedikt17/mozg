import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PrototypeDocument } from "@/prototype/desktop-mock-data";
import { MarkdownStringPreview, getDocumentHeadings } from "@/prototype/knowledge/markdown-document-preview";
import { getDocumentTitle } from "@/prototype/state/knowledge-state";

function documentWith(content: string[]): PrototypeDocument {
  return {
    id: "document-mdast-test",
    projectId: "lukomorie",
    folder: "",
    title: "Fallback title",
    excerpt: "",
    content,
    backlinks: [],
  };
}

describe("Knowledge canonical Markdown structure integration", () => {
  it("derives title and outline labels from MDAST heading semantics", () => {
    const document = documentWith([
      "# **Главный** `документ`",
      "",
      "Текст",
      "",
      "## Раздел *мира*",
      "",
      "#### Скрыт из трёхуровневого outline",
    ]);

    expect(getDocumentTitle(document)).toBe("Главный документ");
    expect(getDocumentHeadings(document)).toEqual([
      {
        id: "document-document-mdast-test-heading-0",
        label: "Главный документ",
        level: 1,
      },
      {
        id: "document-document-mdast-test-heading-4",
        label: "Раздел мира",
        level: 2,
      },
    ]);
  });

  it("renders only parser-recognized GFM tables", () => {
    const tableHtml = renderToStaticMarkup(
      <MarkdownStringPreview
        contentId="table"
        markdown={[
          "| Name | Value |",
          "| :--- | ---: |",
          "| A \\| B | **10** |",
        ].join("\n")}
      />,
    );
    const pipeTextHtml = renderToStaticMarkup(
      <MarkdownStringPreview
        contentId="pipe-text"
        markdown={"Alpha | Beta\n\nnot | a | table"}
      />,
    );

    expect(tableHtml).toContain("<table>");
    expect(tableHtml).toContain("A | B");
    expect(tableHtml).toContain("<strong>10</strong>");
    expect(pipeTextHtml).not.toContain("<table>");
  });
});
