import type { CanvasHandleSide } from "@/lib/canvas/canvas-document";

export const CANVAS_CONNECTION_HANDLE_DIAMETER = 18;
export const CANVAS_CONNECTION_HANDLE_RADIUS =
  CANVAS_CONNECTION_HANDLE_DIAMETER / 2;
export const CANVAS_CONNECTION_HANDLE_GAP = 4;
export const CANVAS_CONNECTION_HANDLE_CENTER_OFFSET =
  CANVAS_CONNECTION_HANDLE_GAP + CANVAS_CONNECTION_HANDLE_RADIUS;

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
