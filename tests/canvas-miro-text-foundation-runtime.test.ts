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
const frame = fs.readFileSync(
  path.resolve(
    process.cwd(),
    "src/prototype/infinite-canvas-local-shell/canvas-node-frame.tsx",
  ),
  "utf8",
);
const css = fs.readFileSync(
  path.resolve(
    process.cwd(),
    "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.module.css",
  ),
  "utf8",
);

describe("Miro-style Canvas text foundation", () => {
  it("edits text directly on the Canvas with the Miro placeholder and no save/cancel card actions", () => {
    expect(shell).toContain('placeholder="Type something"');
    expect(shell).toContain('aria-label="Canvas text"');
    expect(shell).not.toContain("textEditorActions");
    expect(css).toContain("--node-visual-background: transparent");
    expect(css).toContain(".textEditorInput");
  });

  it("hosts future selection controls in React Flow NodeToolbar screen space", () => {
    expect(frame).toContain("NodeToolbar");
    expect(frame).toContain("position={Position.Top}");
    expect(frame).toContain("offset={10}");
  });

  it("preserves text style while committing markdown", () => {
    expect(shell).toContain("...node.data");
    expect(shell).toContain("isEditing: false");
  });
});
