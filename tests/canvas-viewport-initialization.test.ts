import { describe, expect, it } from "vitest";
import {
  isCurrentViewportInitialization,
  isProgrammaticViewportMove,
  scheduleViewportReveal,
  viewportMatches,
} from "@/lib/canvas/canvas-viewport-initialization";

const initialization = {
  canvasId: "canvas-a",
  generation: 4,
  viewport: { x: 120, y: -40, zoom: 1.25 },
};

describe("Canvas viewport initialization", () => {
  it("recognizes the exact programmatic viewport move without treating it as user persistence", () => {
    expect(
      isProgrammaticViewportMove({
        canvasId: "canvas-a",
        initialization,
        viewport: { x: 120.00001, y: -40.00001, zoom: 1.25001 },
      }),
    ).toBe(true);
  });

  it("keeps a later user movement persistable", () => {
    expect(
      isProgrammaticViewportMove({
        canvasId: "canvas-a",
        initialization,
        viewport: { x: 100, y: -40, zoom: 1.25 },
      }),
    ).toBe(false);
  });

  it("rejects stale canvas generations and canvas identities", () => {
    expect(isCurrentViewportInitialization(initialization, 3)).toBe(false);
    expect(
      isProgrammaticViewportMove({
        canvasId: "canvas-b",
        initialization,
        viewport: initialization.viewport,
      }),
    ).toBe(false);
  });

  it("compares viewport values with a small floating-point tolerance", () => {
    expect(
      viewportMatches(
        { x: 10, y: 20, zoom: 1 },
        { x: 10.00001, y: 19.99999, zoom: 1.00001 },
      ),
    ).toBe(true);
  });

  it("reveals only on a render frame and cancels a stale pending reveal", () => {
    let frame: FrameRequestCallback | null = null;
    let cancelled = false;
    const cancel = scheduleViewportReveal(
      () => {
        throw new Error("A cancelled frame must not reveal the editor.");
      },
      {
        requestAnimationFrame: (callback) => {
          frame = callback;
          return 7;
        },
        cancelAnimationFrame: (handle) => {
          expect(handle).toBe(7);
          cancelled = true;
        },
      },
    );

    expect(frame).not.toBeNull();
    cancel();
    expect(cancelled).toBe(true);
  });
});
