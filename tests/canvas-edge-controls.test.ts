import { describe, expect, it } from "vitest";
import {
  canvasArrowsToEndpointArrows,
  endpointArrowsToCanvasArrows,
  swapCanvasEdgeArrows,
} from "@/lib/canvas/canvas-edge-controls";

describe("canvas edge controls", () => {
  it.each([
    ["none", { source: false, target: false }],
    ["start", { source: true, target: false }],
    ["end", { source: false, target: true }],
    ["both", { source: true, target: true }],
  ] as const)("projects %s to marker endpoints", (arrows, endpoints) => {
    expect(canvasArrowsToEndpointArrows(arrows)).toEqual(endpoints);
    expect(endpointArrowsToCanvasArrows(endpoints)).toBe(arrows);
  });

  it.each([
    ["none", "none"],
    ["start", "end"],
    ["end", "start"],
    ["both", "both"],
  ] as const)(
    "swaps %s to %s without changing direction",
    (arrows, expected) => {
      expect(swapCanvasEdgeArrows(arrows)).toBe(expected);
    },
  );
});
