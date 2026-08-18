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

describe("Miro-style Canvas text toolbar", () => {
  it("renders the requested text controls in the generic screen-space toolbar", () => {
    expect(shell).toContain("function TextSelectionToolbar");
    expect(shell).toContain("aria-label={typeLabel}");
    expect(shell).toContain("disabled");
    expect(shell).toContain("CANVAS_TEXT_FONT_FAMILIES.map");
    expect(shell).toContain("CANVAS_TEXT_FONT_SIZES.map");
    expect(shell).toContain('aria-label="Полужирный"');
    expect(shell).toContain('aria-label="Курсив"');
    expect(shell).toContain('aria-label="Подчеркнутый"');
    expect(shell).toContain('aria-label="Перечеркнутый"');
    expect(
      (shell.match(/<CanvasColorPicker/g) ?? []).length,
    ).toBeGreaterThanOrEqual(2);
    expect(shell).not.toContain('type="color"');
    expect(shell).toContain(
      "<TextAlignmentControls id={id} value={style.textAlign} />",
    );
    expect(shell).toContain("textAlign: style.textAlign");
    expect(shell).toContain(
      "toolbar={<TextSelectionToolbar id={id} style={data.style} />}",
    );
  });

  it("persists toolbar style changes through the existing runtime-node autosave path", () => {
    expect(shell).toContain('new CustomEvent("mozg:canvas-text-style"');
    expect(shell).toContain(
      'window.addEventListener("mozg:canvas-text-style", onStyle)',
    );
    expect(shell).toContain("controller.setRuntimeNodes(nextNodes)");
    expect(shell).toContain("style: { ...node.data.style, ...patch }");
    expect(shell).toContain("scheduleSave()");
  });

  it("keeps all style toggles independent and exposes transparent background reset", () => {
    expect(shell).toContain("bold: !style.bold");
    expect(shell).toContain("italic: !style.italic");
    expect(shell).toContain("underline: !style.underline");
    expect(shell).toContain("strikethrough: !style.strikethrough");
    expect(shell).toContain('backgroundColor: "transparent"');
  });
});
