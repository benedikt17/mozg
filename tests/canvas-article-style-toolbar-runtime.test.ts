import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const shellSource = readFileSync(
  "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
  "utf8",
);
const cssSource = readFileSync(
  "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.module.css",
  "utf8",
);

describe("Canvas article style toolbar", () => {
  it("shows formatting only for one selected article", () => {
    expect(shellSource).toContain("function ArticleSelectionToolbar");
    expect(shellSource).toContain("if (selectedNodeCount !== 1) return null;");
    expect(shellSource).toContain(
      "toolbar={<ArticleSelectionToolbar id={id} style={data.style} />}",
    );
  });

  it("offers title size plus the three article colors", () => {
    expect(shellSource).toContain("titleFontSize:");
    expect(shellSource).toContain('label="Цвет надписи «СТАТЬЯ»"');
    expect(shellSource).toContain('label="Цвет названия статьи"');
    expect(shellSource).toContain('label="Цвет заливки статьи"');
    expect(shellSource).toContain("data.style.backgroundColor");
    expect(shellSource).toContain("data.style.badgeColor");
    expect(shellSource).toContain("data.style.titleColor");
    expect(cssSource).toContain(".articleToolbarSize");
  });

  it("samples complete styling only from one article node to another", () => {
    expect(shellSource).toContain('aria-label="Пипетка статьи"');
    expect(shellSource).toContain(
      "sourceNode?.type === CANVAS_ARTICLE_NODE_TYPE &&",
    );
    expect(shellSource).toContain(
      "targetNode?.type === CANVAS_ARTICLE_NODE_TYPE",
    );
    expect(shellSource).toContain(
      "updateArticleStyle(sourceId, targetNode.data.style)",
    );
    expect(shellSource).not.toContain(
      "sourceNode?.type === CANVAS_ARTICLE_NODE_TYPE &&\n            targetNode?.type === CANVAS_TEXT_NODE_TYPE",
    );
  });
});
