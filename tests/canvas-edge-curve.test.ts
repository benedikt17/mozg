import { describe, expect, it } from "vitest";
import {
  canvasEdgeDefaultBend,
  canvasEdgeToolbarPosition,
  canvasManualCurvePath,
  canvasManualOrthogonalPath,
  canvasManualStraightPath,
} from "@/lib/canvas/canvas-edge-curve";
import { parseCanvasDocumentV2 } from "@/lib/canvas/canvas-document";

describe("manual Canvas edge curves", () => {
  it("centers the toolbar between blocks and clears the higher connection", () => {
    expect(
      canvasEdgeToolbarPosition({ x: 360, y: 286 }, { x: 727, y: 470 }),
    ).toEqual({ x: 543.5, y: 216 });
    expect(
      canvasEdgeToolbarPosition({ x: 129, y: 474 }, { x: 947, y: 264 }),
    ).toEqual({ x: 538, y: 194 });
  });

  it("keeps the visible connection point on each manual path", () => {
    const source = { x: 10, y: 20 };
    const target = { x: 210, y: 120 };
    const bend = canvasEdgeDefaultBend(source, target);

    expect(bend).toEqual({ x: 110, y: 70 });
    expect(canvasManualCurvePath(source, { x: 80, y: 190 }, target)).toBe(
      "M 10,20 Q 50,310 210,120",
    );
    expect(canvasManualStraightPath(source, { x: 80, y: 190 }, target)).toBe(
      "M 10,20 L 80,190 L 210,120",
    );
    expect(canvasManualOrthogonalPath(source, { x: 80, y: 190 }, target)).toBe(
      "M 10,20 L 80,20 L 80,190 L 210,190 L 210,120",
    );
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
