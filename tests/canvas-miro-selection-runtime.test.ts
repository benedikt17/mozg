import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const shellPath = path.resolve(
  process.cwd(),
  "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
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

  it("does not re-enable generic pointer-drag panning", () => {
    const source = readShell();

    expect(source).not.toContain("panOnDrag={true}");
    expect(source).not.toContain("panOnDrag={false}");
  });
});
