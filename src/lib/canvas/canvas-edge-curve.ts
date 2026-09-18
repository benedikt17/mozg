import type { CanvasEdgeBend, CanvasPoint } from "@/lib/canvas/canvas-document";

/** Returns the midpoint used before the user pulls a connection point. */
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
 * SVG quadratic Bézier path for a connection whose visible midpoint is owned
 * by the user. Storing the point the line passes through keeps the draggable
 * point on the curve instead of exposing an abstract Bézier control point.
 */
export function canvasManualCurvePath(
  source: CanvasPoint,
  bend: CanvasEdgeBend,
  target: CanvasPoint,
): string {
  const control = {
    x: 2 * bend.x - (source.x + target.x) / 2,
    y: 2 * bend.y - (source.y + target.y) / 2,
  };
  return `M ${source.x},${source.y} Q ${control.x},${control.y} ${target.x},${target.y}`;
}

/** A two-segment straight connection with its editable break at `bend`. */
export function canvasManualStraightPath(
  source: CanvasPoint,
  bend: CanvasEdgeBend,
  target: CanvasPoint,
): string {
  return `M ${source.x},${source.y} L ${bend.x},${bend.y} L ${target.x},${target.y}`;
}

/** A predictable orthogonal connection around a single editable middle corner. */
export function canvasManualOrthogonalPath(
  source: CanvasPoint,
  bend: CanvasEdgeBend,
  target: CanvasPoint,
): string {
  return `M ${source.x},${source.y} L ${bend.x},${source.y} L ${bend.x},${bend.y} L ${target.x},${bend.y} L ${target.x},${target.y}`;
}
