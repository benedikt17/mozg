import type { CanvasEdgeBend, CanvasPoint } from "@/lib/canvas/canvas-document";

/** Returns the midpoint used to create or reset a manual curved connection. */
export function canvasEdgeDefaultBend(
  source: CanvasPoint,
  target: CanvasPoint,
): CanvasEdgeBend {
  return {
    x: (source.x + target.x) / 2,
    y: (source.y + target.y) / 2,
  };
}

/**
 * SVG quadratic Bézier path for a connection whose bend is owned by the user.
 * The control point is stored in Canvas coordinates, so it stays stable when
 * either endpoint moves.
 */
export function canvasManualCurvePath(
  source: CanvasPoint,
  bend: CanvasEdgeBend,
  target: CanvasPoint,
): string {
  return `M ${source.x},${source.y} Q ${bend.x},${bend.y} ${target.x},${target.y}`;
}

/** The visible midpoint of a quadratic Bézier curve (t = 0.5). */
export function canvasManualCurveMidpoint(
  source: CanvasPoint,
  bend: CanvasEdgeBend,
  target: CanvasPoint,
): CanvasPoint {
  return {
    x: (source.x + 2 * bend.x + target.x) / 4,
    y: (source.y + 2 * bend.y + target.y) / 4,
  };
}
