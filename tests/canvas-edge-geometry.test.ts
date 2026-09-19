import { describe, expect, it } from "vitest";
import {
  CANVAS_CONNECTION_HANDLE_CENTER_OFFSET,
  CANVAS_CONNECTION_HANDLE_DIAMETER,
  CANVAS_CONNECTION_HANDLE_GAP,
  CANVAS_CONNECTION_HANDLE_RADIUS,
  CANVAS_EDGE_RECONNECT_RADIUS,
  canvasEdgeReconnectControlCenter,
  canvasHandleCenterToPerimeter,
  canvasNodeHandleCenter,
  canvasNodePerimeterAnchor,
} from "@/lib/canvas/canvas-edge-geometry";

const bounds = {
  x: 100,
  y: 200,
  width: 300,
  height: 180,
};

describe("canvas edge geometry", () => {
  it("keeps one shared handle-center model", () => {
    expect(CANVAS_CONNECTION_HANDLE_RADIUS).toBe(
      CANVAS_CONNECTION_HANDLE_DIAMETER / 2,
    );
    expect(CANVAS_CONNECTION_HANDLE_CENTER_OFFSET).toBe(
      CANVAS_CONNECTION_HANDLE_GAP + CANVAS_CONNECTION_HANDLE_RADIUS,
    );
    expect(CANVAS_CONNECTION_HANDLE_CENTER_OFFSET).toBe(13);
  });

  it("places all handle centers 13px outside their matching borders", () => {
    expect(
      (["top", "right", "bottom", "left"] as const).map((side) =>
        canvasNodeHandleCenter(bounds, side),
      ),
    ).toEqual([
      { x: 250, y: 187 },
      { x: 413, y: 290 },
      { x: 250, y: 393 },
      { x: 87, y: 290 },
    ]);
  });

  it("derives visible endpoints directly from node bounds", () => {
    expect(
      (["top", "right", "bottom", "left"] as const).map((side) =>
        canvasNodePerimeterAnchor(bounds, side),
      ),
    ).toEqual([
      { x: 250, y: 200 },
      { x: 400, y: 290 },
      { x: 250, y: 380 },
      { x: 100, y: 290 },
    ]);
  });

  it("projects a connection preview center to the perimeter", () => {
    expect(canvasHandleCenterToPerimeter({ x: 40, y: 60 }, "bottom")).toEqual({
      x: 40,
      y: 47,
    });
  });

  it("places visible reconnect controls on React Flow's edge hit targets", () => {
    expect(CANVAS_EDGE_RECONNECT_RADIUS).toBe(18);
    expect(
      (["top", "right", "bottom", "left"] as const).map((side) =>
        canvasEdgeReconnectControlCenter(
          canvasNodeHandleCenter(bounds, side),
          side,
        ),
      ),
    ).toEqual([
      { x: 250, y: 169 },
      { x: 431, y: 290 },
      { x: 250, y: 411 },
      { x: 69, y: 290 },
    ]);
  });
});
