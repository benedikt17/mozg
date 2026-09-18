import { describe, expect, it } from "vitest";
import {
  canvasEdgeDefaultBend,
  canvasManualCurveMidpoint,
  canvasManualCurvePath,
} from "@/lib/canvas/canvas-edge-curve";
import { parseCanvasDocumentV2 } from "@/lib/canvas/canvas-document";

describe("manual Canvas edge curves", () => {
  it("uses a stable absolute control point and derives its midpoint", () => {
    const source = { x: 10, y: 20 };
    const target = { x: 210, y: 120 };
    const bend = canvasEdgeDefaultBend(source, target);

    expect(bend).toEqual({ x: 110, y: 70 });
    expect(canvasManualCurvePath(source, { x: 80, y: 190 }, target)).toBe(
      "M 10,20 Q 80,190 210,120",
    );
    expect(
      canvasManualCurveMidpoint(source, { x: 80, y: 190 }, target),
    ).toEqual({
      x: 95,
      y: 130,
    });
  });

  it("round-trips a manual bend without changing the manually chosen sides", () => {
    const document = parseCanvasDocumentV2({
      schemaVersion: 2,
      nodes: [
        {
          id: "a",
          kind: "text",
          markdown: "A",
          position: { x: 0, y: 0 },
          size: { width: 120, height: 80 },
          zIndex: 1,
        },
        {
          id: "b",
          kind: "text",
          markdown: "B",
          position: { x: 300, y: 0 },
          size: { width: 120, height: 80 },
          zIndex: 2,
        },
      ],
      edges: [
        {
          id: "a-b",
          sourceNodeId: "a",
          sourceHandle: "bottom",
          targetNodeId: "b",
          targetHandle: "top",
          routing: "curved",
          arrows: "end",
          bend: { x: 150, y: 240 },
        },
      ],
    });

    expect(document.edges[0]).toMatchObject({
      sourceHandle: "bottom",
      targetHandle: "top",
      bend: { x: 150, y: 240 },
    });
  });
});
