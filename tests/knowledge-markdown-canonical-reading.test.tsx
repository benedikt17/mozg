import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PrototypeDocument } from "@/prototype/desktop-mock-data";
import {
  MarkdownDocumentPreview,
  MarkdownStringPreview,
} from "@/prototype/knowledge/markdown-document-preview";

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
    expect(html).toContain("<blockquote><p>Цитата с <code>кодом</code></p></blockquote>");
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
