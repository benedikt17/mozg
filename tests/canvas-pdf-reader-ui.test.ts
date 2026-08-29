import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("Canvas PDF reader UI", () => {
  it("marks the open PDF without selecting it", () => {
    const shell = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
    );
    const renderedNodes = shell.slice(
      shell.indexOf("const renderedNodes"),
      shell.indexOf("const [fileQuery"),
    );

    expect(shell).toContain("nodeId: node.id");
    expect(renderedNodes).toContain("node.id === openPdfNodeId");
    expect(renderedNodes).toContain("readerOpen: true");
    expect(renderedNodes).not.toContain("selected: true");
    expect(shell).toContain("nodes={renderedNodes}");
  });

  it("adds articles as Canvas nodes that open the reader on click", () => {
    const shell = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
    );
    const styles = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.module.css",
    );

    expect(shell).toContain("const createArticleNode");
    expect(shell).toContain('kind: "article" as const');
    expect(shell).toContain("createCanvasArticleFlowNode(canonical)");
    expect(shell).toContain("onSelectArticle={createArticleNode}");
    expect(shell).toContain("onNodeClick={(event, node) => {");
    expect(shell).toContain("openArticleNode(node);");
    expect(shell).toContain("saveOpenArticleId(node.data.articleId)");
    expect(styles).toContain(".articleNodeFrameReaderOpen .nodeBody");
  });

  it("does not delete an open PDF as part of another selected group", () => {
    const shell = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
    );

    expect(shell).toContain("const requestedRemovals = guardedChanges.filter(");
    expect(shell).toContain("requestedRemovals.length > 1");
    expect(shell).toContain("const safeChanges =");
    expect(shell).toContain("change.id !== openPdf.nodeId");
    expect(shell).toContain("onNodesChange(safeChanges)");
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
    expect(styles).toContain(".pdfNodeFrameReaderOpen .nodeBody");
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
    expect(readerStyles).toMatch(
      /\.pdfReader,\s*\.articleReader\s*\{[^}]*position: fixed;/u,
    );
    expect(readerStyles).toMatch(
      /\.pdfReader,\s*\.articleReader\s*\{[^}]*inset: 0 0 0 auto;/u,
    );
    expect(shellStyles).toContain(
      ":scope:has(.canvas-pdf-reader, .canvas-article-reader) .project-workspace",
    );
    expect(shellStyles).toContain(
      "padding-right: var(--canvas-pdf-reader-width);",
    );
  });

  it("re-centers the source node and restores only an automatically hidden sidebar", () => {
    const shell = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
    );

    expect(shell).toContain("const readerSidebarWasAutoCollapsedRef");
    expect(shell).toContain("const centerReaderNodeAfterLayout");
    expect(shell).toContain("reactFlow.setCenter(");
    expect(shell).toContain("const enterReaderLayout");
    expect(shell).toContain("const leaveReaderLayout");
    expect(shell).toContain("readerSidebarWasAutoCollapsedRef.current = false;");
    expect(shell).toContain("enterReaderLayout(node.id);");
    expect(shell).toContain("leaveReaderLayout(openNodeId);");
    expect(shell).toContain("const closeArticleReader");
  });

  it("opens at a stable half-width layout", () => {
    const shell = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
    );
    const readerStyles = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.module.css",
    );

    expect(shell).not.toContain("PDF_READER_WIDTH_STORAGE_KEY");
    expect(shell).not.toContain("beginPdfReaderResize");
    expect(readerStyles).not.toContain(".pdfReaderResizeHandle");
    expect(readerStyles).toMatch(
      /\.pdfReader,\s*\.articleReader\s*\{[^}]*width: var\(--canvas-pdf-reader-width, 50vw\);/u,
    );
  });

  it("uses the shared resumable upload preparation for PDFs", () => {
    const shell = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
    );

    expect(shell).toContain("prepareProjectFileBrowserUpload");
    expect(shell).toContain(
      "const prepared = await prepareProjectFileBrowserUpload(file);",
    );
    expect(shell).toContain("...prepared,");
  });

  it("makes repeated PDF selections idempotent and confirms the Canvas save", () => {
    const shell = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
    );

    expect(shell).toContain("pdfUploadInFlightRef");
    expect(shell).toContain("const key = `${canvasId}:${prepared.checksum}`;");
    expect(shell).toContain("await controller.flushPendingSave()");
    expect(shell).toContain("saveConflictDraft(controller.state)");
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
