import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const shellPath = path.resolve(
  process.cwd(),
  "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
);
const toolbarPath = path.resolve(
  process.cwd(),
  "src/prototype/canvases/canvas-desktop-composition.tsx",
);

describe("Canvas local recovery draft controls", () => {
  it("opens the local copy as a standalone read-only viewer", () => {
    const shell = fs.readFileSync(shellPath, "utf8");

    expect(shell).toContain("createCanvasPortableBackup({");
    expect(shell).toContain(
      'new Blob([viewer.content], { type: "text/html" })',
    );
    expect(shell).toMatch(
      /window\.open\(\s*objectUrl,\s*"_blank",\s*"noopener,noreferrer",\s*\)/u,
    );
    expect(shell).toContain("autosaveBlocked: true");
  });

  it("offers preview and discard controls instead of restoring in place", () => {
    const toolbar = fs.readFileSync(toolbarPath, "utf8");

    expect(toolbar).toContain("onPreviewLocalDraft");
    expect(toolbar).toContain("onDiscardLocalDraft");
    expect(toolbar).toContain("copy.previewLocalDraft");
    expect(toolbar).toContain("copy.discardLocalDraft");
    expect(toolbar).not.toContain("onRestoreLocalDraft");
  });

  it("keeps the mounted flow while a discarded conflict reloads the server copy", () => {
    const shell = fs.readFileSync(shellPath, "utf8");
    const discardStart = shell.indexOf("const discardLocalConflictDraft");
    const discardEnd = shell.indexOf("const desktopListState", discardStart);
    const discardHandler = shell.slice(discardStart, discardEnd);

    expect(discardHandler).toContain("controller.discardConflictState()");
    expect(discardHandler).toContain("void openCanvas(canvasId)");
    expect(discardHandler).not.toContain("setShellState(discarded)");
    expect(discardHandler).not.toContain("setNodes([])");
    expect(discardHandler).not.toContain("setEdges([])");
  });
});
