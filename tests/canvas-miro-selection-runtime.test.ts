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
  it("uses left-button drag for partial marquee selection and middle-button drag for pan", () => {
    const source = readShell();

    expect(source).toContain("SelectionMode,");
    expect(source.match(/panOnDrag=\{\[1\]\}/g)).toHaveLength(2);
    expect(source.match(/selectionOnDrag/g)).toHaveLength(2);
    expect(
      source.match(/selectionMode=\{SelectionMode\.Partial\}/g),
    ).toHaveLength(2);
  });

  it("keeps the arrow cursor while dragging a multi-selection", () => {
    const css = fs.readFileSync(shellCssPath, "utf8");

    expect(css).toContain(".react-flow__nodesselection-rect");
    expect(css).toContain("cursor: default !important");
  });

  it("keeps hover visually silent and suppresses per-node controls for multi-selection", () => {
    const css = fs.readFileSync(shellCssPath, "utf8");
    const frame = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "src/prototype/infinite-canvas-local-shell/canvas-node-frame.tsx",
      ),
      "utf8",
    );

    expect(css).not.toContain(".nodeFrame:hover .connectionHandle");
    expect(frame).toContain("selectedNodeCount === 1");
    expect(frame).toContain(
      "const individualSelectionVisible = useIndividualSelectionVisible(selected);",
    );
    expect(frame).toContain(
      "<SelectionLayer selected={individualSelectionVisible} />",
    );
    expect(frame).toMatch(
      /<ResizeLayer[\s\S]*?selected=\{individualSelectionVisible\}/,
    );
    expect(frame).toContain('data-visible={visible ? "true" : "false"}');
  });

  it("does not re-enable generic pointer-drag panning", () => {
    const source = readShell();

    expect(source).not.toContain("panOnDrag={true}");
    expect(source).not.toContain("panOnDrag={false}");
  });
});
