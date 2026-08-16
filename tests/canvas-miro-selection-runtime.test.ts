import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const shellPath = path.resolve(
  process.cwd(),
  "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
);
const shellCssPath = path.resolve(
  process.cwd(),
  "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.module.css",
);

function readShell(): string {
  return fs.readFileSync(shellPath, "utf8");
}

describe("Canvas Miro-style selection interaction", () => {
  it("keeps desktop marquee/MMB behavior while coarse touch uses one-finger pane pan", () => {
    const source = readShell();

    expect(source).toContain("SelectionMode,");
    expect(source).toContain('window.matchMedia("(pointer: coarse)")');
    expect(
      source.match(/panOnDrag=\{touchPrimaryInput \? \[0, 1\] : \[1\]\}/g),
    ).toHaveLength(2);
    expect(
      source.match(/selectionOnDrag=\{!touchPrimaryInput\}/g),
    ).toHaveLength(2);
    expect(
      source.match(/selectionMode=\{SelectionMode\.Partial\}/g),
    ).toHaveLength(2);
    expect(
      source.match(/nodeDragThreshold=\{touchPrimaryInput \? 8 : 1\}/g),
    ).toHaveLength(2);
  });

  it("gives a two-touch viewport gesture priority over node mutation", () => {
    const source = readShell();

    expect(source).toContain("activeTouchPointersRef");
    expect(source).toContain("snapshotCanvasTouchGestureNodes");
    expect(source).toContain("touchViewportGestureActiveRef.current = true");
    expect(source).toContain('event.pointerType === "touch"');
    expect(source).toContain(
      'change.type !== "position" && change.type !== "dimensions"',
    );
    expect(
      source.match(/nodesDraggable=\{!touchViewportGestureActive\}/g),
    ).toHaveLength(2);
    expect(
      source.match(/nodesConnectable=\{!touchViewportGestureActive\}/g),
    ).toHaveLength(2);
    expect(
      source.match(/elementsSelectable=\{!touchViewportGestureActive\}/g),
    ).toHaveLength(2);
    expect(source.match(/zoomOnPinch/g)).toHaveLength(2);
    expect(source).toContain("window.requestAnimationFrame(() => {");
  });

  it("keeps the arrow cursor while dragging a multi-selection", () => {
    const css = fs.readFileSync(shellCssPath, "utf8");

    expect(css).toContain(".react-flow__nodesselection-rect");
    expect(css).toContain("cursor: default !important");
  });

  it("does not re-enable unconditional pointer-drag panning", () => {
    const source = readShell();

    expect(source).not.toContain("panOnDrag={true}");
    expect(source).not.toContain("panOnDrag={false}");
  });
});
