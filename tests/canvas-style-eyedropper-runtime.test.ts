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

describe("Canvas style eyedropper runtime", () => {
  it("places an eyedropper directly after the two color swatches", () => {
    const backgroundPickerIndex = shellSource.indexOf('label="Цвет фона"');
    const eyedropperIndex = shellSource.indexOf(
      'aria-label="Пипетка"',
      backgroundPickerIndex,
    );
    const alignmentIndex = shellSource.indexOf(
      "<TextAlignmentControls",
      eyedropperIndex,
    );

    expect(backgroundPickerIndex).toBeGreaterThan(-1);
    expect(eyedropperIndex).toBeGreaterThan(backgroundPickerIndex);
    expect(alignmentIndex).toBeGreaterThan(eyedropperIndex);
  });

  it("copies text and background colors from another text node", () => {
    expect(shellSource).toContain('"mozg:canvas-style-eyedropper-start"');
    expect(shellSource).toContain("styleEyedropperSourceId");
    expect(shellSource).toContain("targetNode?.type !== CANVAS_TEXT_NODE_TYPE");
    expect(shellSource).toContain("color: targetNode.data.style.color");
    expect(shellSource).toContain(
      "backgroundColor: targetNode.data.style.backgroundColor",
    );
    expect(shellSource).toContain("updateTextStyle(sourceId, {");
  });

  it("intercepts target picking before normal React Flow selection", () => {
    expect(shellSource).toContain(
      "onPointerDownCapture={handleCanvasPointerDown}",
    );
    expect(shellSource).toContain('closest<HTMLElement>(".react-flow__node")');
    expect(shellSource).toContain("reactFlow.getNodes()");
    expect(shellSource).toContain("event.preventDefault();");
    expect(shellSource).toContain("event.stopPropagation();");
    expect(cssSource).toContain(".canvasStyleEyedropperActive");
  });

  it("leaves eyedropper mode after applying or clicking blank canvas", () => {
    expect(shellSource).toContain("if (!targetElement) {");
    expect(shellSource.match(/setStyleEyedropperSourceId\(null\)/g)?.length).toBeGreaterThanOrEqual(
      2,
    );
  });
});
