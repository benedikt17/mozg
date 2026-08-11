// trigger persistent Canvas text surface PR patch
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
  it("keeps the native focused caret and compact textarea editor", () => {
    expect(shell).toContain("input.focus({ preventScroll: true })");
    expect(shell).toContain("input.setSelectionRange(caret, caret)");
    expect(shell).toMatch(
      /<textarea[\s\S]*?ref=\{inputRef\}[\s\S]*?rows=\{1\}/,
    );
    expect(frame).not.toContain("withCenteredTextContent");
    expect(css).toContain("caret-color: #111111");
    expect(css).toContain("field-sizing: content");
  });

  it("restores the caret from the actual double-click point instead of forcing the end", () => {
    expect(frame).toContain("canvasTextCaretOffsetAtPoint");
    expect(frame).toContain("caretPositionFromPoint");
    expect(frame).toContain("caretRangeFromPoint");
    expect(frame).toContain("onDoubleClickCapture={handleDoubleClickCapture}");
    expect(frame).toContain("input.setSelectionRange(caret, caret)");
  });

  it("locks the initial editor height to the preview height so entering edit mode does not jump", () => {
    expect(frame).toContain("previewHeight: surface.offsetHeight");
    expect(frame).toContain('input.style.height = `${previewHeight}px`');
    expect(frame).toContain('input.style.minHeight = `${previewHeight}px`');
    expect(frame).toContain('input.style.height = ""');
    expect(frame).toContain('input.style.minHeight = ""');
    expect(css).toMatch(
      /\.textNodeContent \{[\s\S]*display: flex;[\s\S]*align-items: center;/,
    );
  });
});
