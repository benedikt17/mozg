import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const shell = fs.readFileSync(
  path.resolve(
    process.cwd(),
    "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
  ),
  "utf8",
);
const toolbar = fs.readFileSync(
  path.resolve(
    process.cwd(),
    "src/prototype/canvases/canvas-desktop-composition.tsx",
  ),
  "utf8",
);
const controller = fs.readFileSync(
  path.resolve(
    process.cwd(),
    "src/lib/canvas/local-canvas-shell-controller.ts",
  ),
  "utf8",
);

describe("Canvas undo redo runtime", () => {
  it(
    "routes toolbar actions and keyboard shortcuts through canonical history",
    () => {
      expect(shell).toContain('applyCanvasHistory("undo")');
      expect(shell).toContain('applyCanvasHistory("redo")');
      expect(shell).toContain(
        'window.addEventListener("keydown", onHistoryKeyDown, true)',
      );
      expect(shell).toContain('key === "y" || (key === "z" && event.shiftKey)');
      expect(controller).toContain(
        "undoDocument(): LocalCanvasShellState | null",
      );
      expect(controller).toContain(
        "redoDocument(): LocalCanvasShellState | null",
      );
    },
  );

  it("reuses the accepted Knowledge history button treatment", () => {
    expect(toolbar).toContain('className="knowledge-content-history-action"');
    expect(toolbar).toContain('icon={<UiIcon name="arrow-left" />}');
    expect(toolbar).toContain('icon={<UiIcon name="arrow-right" />}');
    expect(toolbar).toContain('label="Отменить"');
    expect(toolbar).toContain('label="Повторить"');
  });

  it("keeps viewport state outside canonical document history", () => {
    expect(controller).toContain("saveViewport(viewport: CanvasViewport)");
    expect(controller).not.toContain(
      "documentHistory.commit(this.stateValue.viewport",
    );
  });
});
