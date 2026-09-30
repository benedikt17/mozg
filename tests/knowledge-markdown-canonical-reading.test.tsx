import React from "react";
import { renderToStaticMarkup as renderWithSourceMetadata } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PrototypeDocument } from "@/prototype/desktop-mock-data";
import {
  MarkdownDocumentPreview,
  MarkdownStringPreview,
} from "@/prototype/knowledge/markdown-document-preview";

// Source spans carry navigation coordinates; the existing assertions below
// still check the same Markdown semantics after removing only that metadata.
function renderToStaticMarkup(node: React.ReactNode): string {
  return renderWithSourceMetadata(node)
    .replace(
      /<span data-markdown-start="\d+" data-markdown-end="\d+">([^<]*)<\/span>/g,
      "$1",
    )
    .replace(/ data-markdown-(?:start|end)="\d+"/g, "");
}

function documentWith(
  content: string[],
  title = "Документ",
): PrototypeDocument {
  return {
    id: "document-canonical-reading",
    projectId: "lukomorie",
    folder: "",
    title,
    excerpt: "",
    content,
    backlinks: [],
  };
}

describe("Knowledge canonical MDAST Reading", () => {
  it("preserves Enter in text without changing source coordinates or paragraph boundaries", () => {
    const markdown = "**Кто:** Яга\n**Желание:** Покой\n\nДругой абзац";
    const html = renderWithSourceMetadata(
      <MarkdownStringPreview contentId="newlines" markdown={markdown} />,
    );

    expect(html).toContain('style="white-space:pre-line"');
    expect(html).toContain(" Яга\n</span>");
    expect(html.match(/<p>/g)).toHaveLength(2);
    expect(html).toContain('data-markdown-start="8" data-markdown-end="13"');
    expect(html).not.toContain("<br");
  });

  it("keeps explicit Markdown breaks and code rendering distinct from soft newlines", () => {
    const html = renderToStaticMarkup(
      <MarkdownStringPreview
        contentId="breaks-and-code"
        markdown={"Первая  \nВторая\n\n```txt\nстрока 1\nстрока 2\n```"}
      />,
    );

    expect(html).toContain("Первая<br/>Вторая");
    expect(html).toContain("<code>строка 1\nстрока 2</code>");
    expect(html).not.toContain("white-space:pre-line");
  });

  it("renders canonical block and inline Markdown semantics", () => {
    const html = renderToStaticMarkup(
      <MarkdownStringPreview
        contentId="canonical"
        markdown={[
          "#### Глубокий заголовок",
          "",
          "Первая строка",
          "вторая строка с **жирным**, *курсивом* и ~~удалённым~~.",
          "",
          "> Цитата с `кодом`",
          "",
          "```txt",
          "not | a | table",
          "```",
          "",
          "[OpenAI](https://openai.com) и https://example.com",
        ].join("\n")}
      />,
    );

    expect(html).toContain("<h4>Глубокий заголовок</h4>");
    expect(html).toContain("<strong>жирным</strong>");
    expect(html).toContain("<em>курсивом</em>");
    expect(html).toContain("<del>удалённым</del>");
    expect(html).toContain(
      "<blockquote><p>Цитата с <code>кодом</code></p></blockquote>",
    );
    expect(html).toContain(
      '<pre class="document-code-block"><code>not | a | table</code></pre>',
    );
    expect(html).not.toContain("<table>");
    expect(html).toContain('class="document-external-link"');
  });

  it("hides a formatted leading H1 by semantic title instead of raw source equality", () => {
    const html = renderToStaticMarkup(
      <MarkdownDocumentPreview
        document={documentWith(
          ["# **Главный** документ", "", "Тело статьи"],
          "Главный документ",
        )}
        hideLeadingTitle
      />,
    );

    expect(html).not.toContain("<h1");
    expect(html).toContain("<p>Тело статьи</p>");
  });

  it("keeps internal links and task-list presentation on top of MDAST positions", () => {
    const interactive = renderToStaticMarkup(
      <MarkdownDocumentPreview
        document={documentWith([
          "- [ ] Родитель [[doc:article-2|Открыть статью]]",
          "  - [x] Дочерняя задача",
        ])}
        onInternalLink={() => undefined}
        onTaskToggle={() => undefined}
      />,
    );
    const staticHtml = renderToStaticMarkup(
      <MarkdownStringPreview
        contentId="static-task"
        markdown="- [x] Выполнено **точно**"
      />,
    );

    expect(interactive).toContain('type="checkbox"');
    expect(interactive).toContain('aria-expanded="true"');
    expect(interactive).toContain('class="document-internal-link"');
    expect(interactive).toContain("Открыть статью");
    expect(staticHtml).toContain("- [x] ");
    expect(staticHtml).toContain("<strong>точно</strong>");
  });

  it("preserves the legacy literal bullet compatibility without duplicating its marker", () => {
    const html = renderToStaticMarkup(
      <MarkdownStringPreview
        contentId="legacy-bullet"
        markdown="• **Старый** пункт"
      />,
    );

    expect(html).toContain("• <strong>Старый</strong> пункт");
    expect(html).not.toContain("• •");
  });

  it("does not silently execute raw HTML", () => {
    const html = renderToStaticMarkup(
      <MarkdownStringPreview
        contentId="safe-html"
        markdown={'<script>alert("x")</script>'}
      />,
    );

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
