import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("Canvas PDF reader UI", () => {
  it("keeps the open PDF node visibly selected", () => {
    const shell = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
    );

    expect(shell).toContain("nodeId: string;");
    expect(shell).toContain("nodeId: node.id");
    expect(shell).toContain("node.id === openNodeId");
    expect(shell).toContain("{ ...node, selected: true }");
    expect(shell).toContain("nodes={renderedNodes}");
  });

  it("uses the larger red PDF badge and title", () => {
    const styles = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.module.css",
    );

    expect(styles).toMatch(/\.pdfNodeBadge\s*\{[^}]*width: 78px;/u);
    expect(styles).toMatch(/\.pdfNodeBadge\s*\{[^}]*height: 96px;/u);
    expect(styles).toMatch(/\.pdfNodeBadge\s*\{[^}]*background: #d92d20;/u);
    expect(styles).toMatch(/\.pdfNodeBadge\s*\{[^}]*font-size: 18px;/u);
    expect(styles).toMatch(/\.pdfNodeName\s*\{[^}]*font-size: 18px;/u);
  });

  it("reserves the right side for a full-height reader", () => {
    const shell = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
    );
    const readerStyles = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.module.css",
    );
    const shellStyles = source("src/prototype/desktop-shell.css");

    expect(shell).toContain("canvas-pdf-reader");
    expect(readerStyles).toMatch(/\.pdfReader\s*\{[^}]*position: fixed;/u);
    expect(readerStyles).toMatch(/\.pdfReader\s*\{[^}]*inset: 0 0 0 auto;/u);
    expect(shellStyles).toContain(
      ":scope:has(.canvas-pdf-reader) .project-workspace",
    );
    expect(shellStyles).toContain(
      "padding-right: var(--canvas-pdf-reader-width);",
    );
  });

  it("opens at half width and remembers a manually resized PDF reader", () => {
    const shell = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
    );
    const readerStyles = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.module.css",
    );

    expect(shell).toContain("PDF_READER_WIDTH_STORAGE_KEY");
    expect(shell).toContain("window.localStorage.getItem");
    expect(shell).toContain("window.localStorage.setItem");
    expect(shell).toContain("beginPdfReaderResize");
    expect(shell).toContain("Изменить ширину PDF");
    expect(readerStyles).toContain(".pdfReaderResizeHandle");
    expect(readerStyles).toMatch(
      /\.pdfReader\s*\{[^}]*width: var\(--canvas-pdf-reader-width, 50vw\);/u,
    );
  });

  it("offers an accessible full-screen PDF control", () => {
    const shell = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
    );

    expect(shell).toContain("pdfReaderFullscreen");
    expect(shell).toContain("Развернуть PDF на весь экран");
    expect(shell).toContain("Вернуть PDF в боковую панель");
    expect(shell).toContain(
      'name={pdfFullscreen ? "fullscreen-exit" : "fullscreen"}',
    );
  });

  it("pins all desktop header regions to the same row", () => {
    const styles = source("src/prototype/desktop-shell.css");

    expect(styles).toContain("height: var(--header-height);");
    expect(styles).toContain(".application-project-title,");
    expect(styles).toContain(".application-section-navigation,");
    expect(styles).toContain(".application-header-right {");
    expect(styles).toContain("grid-row: 1;");
    expect(styles).toContain("align-self: center;");
    expect(styles).toContain(".mobile-sidebar-edge-hint,");
    expect(styles).toContain(".mobile-sidebar-edge-hint {");
  });
});
