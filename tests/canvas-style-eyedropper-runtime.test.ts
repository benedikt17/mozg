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
  it("keeps the eyedropper directly after the two reusable color swatches", () => {
    const fillPickerIndex = shellSource.indexOf("label={fillLabel}");
    const eyedropperIndex = shellSource.indexOf(
      'aria-label="Пипетка"',
      fillPickerIndex,
    );
    const alignmentIndex = shellSource.indexOf(
      "<TextAlignmentControls",
      eyedropperIndex,
    );

    expect(fillPickerIndex).toBeGreaterThan(-1);
    expect(eyedropperIndex).toBeGreaterThan(fillPickerIndex);
    expect(alignmentIndex).toBeGreaterThan(eyedropperIndex);
    expect(shellSource).toContain(
      'eyedropperTitle = "Скопировать цвет текста и фона"',
    );
    expect(shellSource).toContain(
      'eyedropperTitle="Скопировать цвет текста и заливки"',
    );
    expect(shellSource).toContain("title={eyedropperTitle}");
  });

  it("copies text colors atomically within the same Canvas node family", () => {
    expect(shellSource).toContain('"mozg:canvas-style-eyedropper-start"');
    expect(shellSource).toContain("styleEyedropperSourceId");
    expect(shellSource).toContain(
      "sourceNode?.type === CANVAS_TEXT_NODE_TYPE &&",
    );
    expect(shellSource).toContain(
      "targetNode?.type === CANVAS_TEXT_NODE_TYPE",
    );
    expect(shellSource).toContain(
      `updateTextStyle(sourceId, {
              color: targetNode.data.style.color,
              backgroundColor: targetNode.data.style.backgroundColor,
            });`,
    );
    expect(shellSource).toContain(
      "sourceNode?.type === CANVAS_SHAPE_NODE_TYPE &&",
    );
    expect(shellSource).toContain(
      "targetNode?.type === CANVAS_SHAPE_NODE_TYPE",
    );
    expect(shellSource).toContain(
      `updateShapeStyle(sourceId, {
              color: targetNode.data.style.color,
              fillColor: targetNode.data.style.fillColor,
            });`,
    );
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
    expect(cssSource).toContain(
      ".canvasStyleEyedropperActive :global(.react-flow__pane)",
    );
    expect(cssSource).toContain(
      ".canvasStyleEyedropperActive :global(.react-flow__node *)",
    );
    expect(cssSource).toContain("data:image/svg+xml");
    expect(cssSource).toContain("4 20,");
    expect(cssSource).not.toContain("cursor: crosshair !important;");
    expect(cssSource).toContain(".styleEyedropperButton");
  });

  it("leaves eyedropper mode after applying or clicking blank canvas", () => {
    expect(shellSource).toContain("if (!targetElement) {");
    expect(
      shellSource.match(/setStyleEyedropperSourceId\(null\)/g)?.length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("keeps eyedropper sampling within text-to-text or shape-to-shape pairs", () => {
    expect(shellSource).toContain(
      "sourceNode?.type === CANVAS_TEXT_NODE_TYPE &&",
    );
    expect(shellSource).toContain(
      "targetNode?.type === CANVAS_TEXT_NODE_TYPE",
    );
    expect(shellSource).toContain(
      "sourceNode?.type === CANVAS_SHAPE_NODE_TYPE &&",
    );
    expect(shellSource).toContain(
      "targetNode?.type === CANVAS_SHAPE_NODE_TYPE",
    );
  });

  it("applies only text and background colors through one text style update", () => {
    const updateStart = shellSource.indexOf("updateTextStyle(sourceId, {");
    const updateEnd = shellSource.indexOf("});", updateStart);
    const updateBlock = shellSource.slice(updateStart, updateEnd);
    expect(updateBlock).toContain("color: targetNode.data.style.color");
    expect(updateBlock).toContain(
      "backgroundColor: targetNode.data.style.backgroundColor",
    );
    expect(updateBlock).not.toContain("fontSize:");
    expect(updateBlock).not.toContain("position:");
  });
});
