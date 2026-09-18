import { describe, expect, it } from "vitest";
import type { CanvasEdgeV2 } from "@/lib/canvas/canvas-document";
import { reconnectCanvasEdgeSide } from "@/lib/canvas/canvas-manual-connection";

const edge: CanvasEdgeV2 = {
  id: "edge", sourceNodeId: "text", targetNodeId: "summary",
  sourceHandle: "right", targetHandle: "left", routing: "curved",
  arrows: "end", summaryOrder: 3,
};

describe("manual connection sides", () => {
  it("changes attachment sides while preserving identity and summary order", () => {
    expect(reconnectCanvasEdgeSide(edge, {
      source: "text", target: "summary", sourceHandle: "bottom", targetHandle: "top",
    })).toEqual({ ...edge, sourceHandle: "bottom", targetHandle: "top" });
    expect(edge.sourceHandle).toBe("right");
  });
  it("leaves the original connection intact after an invalid drop", () => {
    expect(reconnectCanvasEdgeSide(edge, {
      source: "text", target: "different", sourceHandle: "bottom", targetHandle: "top",
    })).toBeNull();
    expect(reconnectCanvasEdgeSide(edge, {
      source: "text", target: "summary", sourceHandle: null, targetHandle: "top",
    })).toBeNull();
  });
});
