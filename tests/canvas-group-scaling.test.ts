import { describe, expect, it } from "vitest";
import {
  canvasGroupBounds,
  scaleCanvasGroup,
} from "@/lib/canvas/canvas-group-scaling";

describe("Canvas group scaling", () => {
  const nodes = [
    { id: "parent", position: { x: 10, y: 20 }, width: 100, height: 80 },
    { id: "child", position: { x: 160, y: 100 }, width: 60, height: 40 },
  ];

  it("uses the selected objects as a single predictable group", () => {
    expect(canvasGroupBounds(nodes)).toEqual({
      x: 10,
      y: 20,
      width: 210,
      height: 120,
    });
  });

  it("preserves image proportions and relative placement while scaling", () => {
    expect(scaleCanvasGroup(nodes, { x: 10, y: 20 }, 1.5)).toEqual([
      { id: "parent", position: { x: 10, y: 20 }, width: 150, height: 120 },
      { id: "child", position: { x: 235, y: 140 }, width: 90, height: 60 },
    ]);
  });
});
