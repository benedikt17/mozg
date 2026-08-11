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
  it("uses one persistent DOM surface in reading and editing states", () => {
    expect(shell).toContain("function CanvasTextSurface({");
    expect(shell).toContain("contentEditable={isEditing}");
    expect(shell).toContain("useLayoutEffect(() => {");
    expect(shell).not.toContain("function CanvasTextEditor({");
    expect(shell).not.toContain("<MarkdownStringPreview contentId={id}");
    expect(shell).not.toMatch(/<textarea[\s\S]*?aria-label="Canvas text"/);
    expect(frame).not.toContain("restoreCanvasTextEditSnapshot");
  });

  it("maps the double-click point to the caret before edit mode starts", () => {
    expect(shell).toContain("canvasTextCaretOffsetAtPoint(");
    expect(shell).toContain("pendingCanvasTextCaret = {");
    expect(shell).toContain("clientX");
    expect(shell).toContain("clientY");
    expect(shell).toContain("placeCanvasTextCaretAtOffset(");
  });

  it("keeps exactly the same typography box while contentEditable toggles", () => {
    expect(css).toMatch(
      /\.textNodeContent \{[\s\S]*display: flex;[\s\S]*align-items: center;/,
    );
    expect(css).toMatch(
      /\.textSurface \{[\s\S]*display: block;[\s\S]*width: 100%;[\s\S]*align-self: center;/,
    );
    expect(css).toContain("caret-color: #111111");
    expect(css).not.toContain("field-sizing: content");
  });
});
