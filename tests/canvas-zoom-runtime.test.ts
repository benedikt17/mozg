import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CANVAS_VIEWPORT_LIMITS } from "@/lib/canvas/canvas-document";

const shell = fs.readFileSync(
  path.resolve(
    process.cwd(),
    "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
  ),
  "utf8",
);

describe("Canvas zoom runtime", () => {
  it("uses the canonical 10-400 percent zoom range", () => {
    expect(CANVAS_VIEWPORT_LIMITS.minZoom).toBe(0.1);
    expect(CANVAS_VIEWPORT_LIMITS.maxZoom).toBe(4);
    expect(shell).toContain("minZoom={CANVAS_VIEWPORT_LIMITS.minZoom}");
    expect(shell).toContain("maxZoom={CANVAS_VIEWPORT_LIMITS.maxZoom}");
  });

  it("smooths wheel-driven viewport transforms without changing pan inertia", () => {
    expect(shell).toContain(
      'viewport.style.transition = "transform 55ms linear"',
    );
    expect(shell).toContain("setTimeout(clearSmoothing, 75)");
    expect(shell).toContain("startPanInertia(velocity)");
  });
});
