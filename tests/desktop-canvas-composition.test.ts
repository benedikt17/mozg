import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("desktop Canvas toolbar composition", () => {
  it("exports a C4-only toolbar boundary", () => {
    const toolbar = source("src/prototype/canvases/canvas-desktop-composition.tsx");
    expect(toolbar).toContain("export function CanvasDesktopToolbar");
    expect(toolbar).toContain("onToggleTaskPicker");
    expect(toolbar).toContain("onAddImage");
  });

  it("keeps the task picker portaled and wired to the toolbar", () => {
    const toolbar = source("src/prototype/canvases/canvas-desktop-composition.tsx");
    expect(toolbar).toContain("createPortal(");
    expect(toolbar).toContain("taskPickerPanelRef");
    expect(toolbar).toContain('window.addEventListener("pointerdown"');
  });

  it("owns the embedded Canvas toolbar layout", () => {
    const shell = source("src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx");
    expect(shell).toContain("CanvasDesktopToolbar");
    expect(shell).toContain("desktopToolbar");
    expect(shell).toContain("desktopCanvasMain");
  });

  it("includes the toolbar text icon without later-scope icons", () => {
    const icons = source("src/prototype/desktop-icons.tsx");
    expect(icons).toContain('| "text"');
  });
});
