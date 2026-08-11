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

describe("Canvas Miro-style in-place text editing", () => {
  it("focuses a native caret without replacing the node with a full-size edit card", () => {
    expect(shell).toContain("input.focus({ preventScroll: true })");
    expect(shell).toContain("input.setSelectionRange(caret, caret)");
    expect(frame).not.toContain("withCenteredTextContent");
    expect(css).toContain("caret-color: #111111");
    expect(css).toContain("field-sizing: content");
  });

  it("keeps preview and editor vertically centered in the same node geometry", () => {
    expect(css).toMatch(
      /\.textNodeContent \{[\s\S]*display: flex;[\s\S]*align-items: center;/,
    );
    expect(css).toMatch(
      /\.textPreview \{[\s\S]*height: auto;[\s\S]*max-height: 100%;/,
    );
    expect(css).toMatch(
      /\.textEditorInput \{[\s\S]*height: auto;[\s\S]*align-self: center;/,
    );
  });
});
