import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const shellPath = path.resolve(
  process.cwd(),
  "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
);
const controllerPath = path.resolve(
  process.cwd(),
  "src/lib/canvas/local-canvas-shell-controller.ts",
);

describe("Canvas selection clipboard runtime", () => {
  it("copies selected canonical nodes into the MOZG Canvas MIME", () => {
    const source = fs.readFileSync(shellPath, "utf8");

    expect(source).toContain('window.addEventListener("copy", onCopy)');
    expect(source).toContain("createCanvasNodeClipboardPayload(");
    expect(source).toContain("CANVAS_NODE_CLIPBOARD_MIME,");
  });

  it("handles Canvas-node paste before image/plain-text clipboard paths and targets the cursor", () => {
    const source = fs.readFileSync(shellPath, "utf8");
    const canvasPaste = source.indexOf("parseCanvasNodeClipboardPayload(");
    const imagePaste = source.indexOf("shouldPreventCanvasImagePaste(event)");

    expect(canvasPaste).toBeGreaterThan(-1);
    expect(imagePaste).toBeGreaterThan(canvasPaste);
    expect(source).toContain("materializeCanvasNodeClipboardPaste(payload");
    expect(source).toContain("screenToFlowRef.current(pointerRef.current)");
    expect(source).toContain("target,");
    expect(source).toContain("onPointerMoveCapture={handleCanvasPointerMove}");
    expect(source).toContain("selected: true");
  });

  it("persists pasted nodes as one canonical controller mutation", () => {
    const source = fs.readFileSync(controllerPath, "utf8");
    const shell = fs.readFileSync(shellPath, "utf8");

    expect(source).toContain("insertCanvasNodes(nodes: readonly CanvasNode[])");
    expect(shell).toContain("controller.insertCanvasNodes(persistedNodes)");
  });
});
