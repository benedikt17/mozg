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

describe("Canvas middle-button pan inertia runtime", () => {
  it("tracks middle-button viewport movement in both Canvas render paths", () => {
    const source = readShell();

    expect(source.match(/onMove=\{handleViewportMove\}/g)).toHaveLength(2);
    expect(
      source.match(/onPointerDownCapture=\{handleCanvasPointerDown\}/g),
    ).toHaveLength(2);
    expect(source.match(/onWheelCapture=\{handleCanvasWheel\}/g)).toHaveLength(
      2,
    );
    expect(source).toContain("canvasPanReleaseVelocity");
    expect(source).toContain("advanceCanvasPanInertia");
  });

  it("keeps inertia transient and commits only when the glide stops or is interrupted", () => {
    const source = readShell();

    expect(source).toContain("panInertiaActiveRef");
    expect(source).toContain("commitViewportMove(reactFlow.getViewport())");
    expect(source).toContain(
      "if (middlePanActiveRef.current || panInertiaActiveRef.current) return;",
    );
  });
});
