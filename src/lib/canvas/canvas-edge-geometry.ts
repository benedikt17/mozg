import type { CanvasHandleSide } from "@/lib/canvas/canvas-document";

export const CANVAS_CONNECTION_HANDLE_DIAMETER = 18;
export const CANVAS_CONNECTION_HANDLE_RADIUS =
  CANVAS_CONNECTION_HANDLE_DIAMETER / 2;
export const CANVAS_CONNECTION_HANDLE_GAP = 4;
export const CANVAS_CONNECTION_HANDLE_CENTER_OFFSET =
  CANVAS_CONNECTION_HANDLE_GAP + CANVAS_CONNECTION_HANDLE_RADIUS;
/**
 * React Flow owns the hit target for reconnecting an existing edge. Keep this
 * radius shared with the visible endpoint affordance so a user can drag the
 * exact circle they see while editing a line.
 */
export const CANVAS_EDGE_RECONNECT_RADIUS = 18;

export type CanvasNodeBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CanvasNodeBoundsRecord = CanvasNodeBounds & {
  id: string;
};

export type CanvasEdgePoint = {
  x: number;
  y: number;
};

export function canvasNodeHandleCenter(
  bounds: CanvasNodeBounds,
  side: CanvasHandleSide,
  centerOffset = CANVAS_CONNECTION_HANDLE_CENTER_OFFSET,
): CanvasEdgePoint {
  switch (side) {
    case "top":
      return {
        x: bounds.x + bounds.width / 2,
        y: bounds.y - centerOffset,
      };
    case "right":
      return {
        x: bounds.x + bounds.width + centerOffset,
        y: bounds.y + bounds.height / 2,
      };
    case "bottom":
      return {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height + centerOffset,
      };
    case "left":
      return {
        x: bounds.x - centerOffset,
        y: bounds.y + bounds.height / 2,
      };
  }
}

export function canvasNodePerimeterAnchor(
  bounds: CanvasNodeBounds,
  side: CanvasHandleSide,
): CanvasEdgePoint {
  switch (side) {
    case "top":
      return { x: bounds.x + bounds.width / 2, y: bounds.y };
    case "right":
      return { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 };
    case "bottom":
      return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height };
    case "left":
      return { x: bounds.x, y: bounds.y + bounds.height / 2 };
  }
}

export function canvasHandleCenterToPerimeter(
  point: CanvasEdgePoint,
  side: CanvasHandleSide,
  centerOffset = CANVAS_CONNECTION_HANDLE_CENTER_OFFSET,
): CanvasEdgePoint {
  switch (side) {
    case "top":
      return { x: point.x, y: point.y + centerOffset };
    case "right":
      return { x: point.x - centerOffset, y: point.y };
    case "bottom":
      return { x: point.x, y: point.y - centerOffset };
    case "left":
      return { x: point.x + centerOffset, y: point.y };
  }
}

/**
 * React Flow places an existing-edge reconnect target one radius beyond the
 * corresponding node handle. This derives the same centre for the visible
 * editing affordance.
 */
export function canvasEdgeReconnectControlCenter(
  handleCenter: CanvasEdgePoint,
  side: CanvasHandleSide,
  radius = CANVAS_EDGE_RECONNECT_RADIUS,
): CanvasEdgePoint {
  switch (side) {
    case "top":
      return { x: handleCenter.x, y: handleCenter.y - radius };
    case "right":
      return { x: handleCenter.x + radius, y: handleCenter.y };
    case "bottom":
      return { x: handleCenter.x, y: handleCenter.y + radius };
    case "left":
      return { x: handleCenter.x - radius, y: handleCenter.y };
  }
}
