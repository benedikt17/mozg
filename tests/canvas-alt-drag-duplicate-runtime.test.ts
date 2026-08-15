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

describe("Canvas Alt-drag duplication", () => {
  it("duplicates the dragged object or selection at its original center", () => {
    expect(shell).toContain(
      "if (!event.altKey || altDuplicateGestureRef.current) return",
    );
    expect(shell).toContain("createCanvasNodeClipboardPayload(");
    expect(shell).toContain(
      "target: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }",
    );
    expect(shell).toContain("selectPasted: false");
  });

  it("supports both single-node and multi-selection drag starts", () => {
    expect(
      shell.match(/onNodeDragStart=\{handleNodeDragStart\}/g),
    ).toHaveLength(2);
    expect(
      shell.match(/onSelectionDragStart=\{handleSelectionDragStart\}/g),
    ).toHaveLength(2);
    expect(shell).toContain("if (selectedNodes.length > 1) return");
  });
});
