import { describe, expect, it } from "vitest";
import {
  otherCanvasPane,
  resolveCanvasPaneSelection,
} from "@/lib/canvas/canvas-dual-pane";

describe("Canvas dual-pane routing", () => {
  it("opens a new sidebar selection in the active pane", () => {
    expect(
      resolveCanvasPaneSelection({
        activePane: "secondary",
        primaryCanvasId: "canvas-a",
        secondaryCanvasId: "canvas-b",
        requestedCanvasId: "canvas-c",
      }),
    ).toEqual({
      activePane: "secondary",
      openCanvasId: "canvas-c",
      targetPane: "secondary",
    });
  });

  it("focuses an already visible Canvas instead of opening it twice", () => {
    expect(
      resolveCanvasPaneSelection({
        activePane: "primary",
        primaryCanvasId: "canvas-a",
        secondaryCanvasId: "canvas-b",
        requestedCanvasId: "canvas-b",
      }),
    ).toEqual({
      activePane: "secondary",
      openCanvasId: null,
      targetPane: "secondary",
    });
  });

  it("returns the opposite pane", () => {
    expect(otherCanvasPane("primary")).toBe("secondary");
    expect(otherCanvasPane("secondary")).toBe("primary");
  });
});
