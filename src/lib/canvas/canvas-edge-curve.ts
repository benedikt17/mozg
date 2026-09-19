import type { CanvasEdgeBend, CanvasPoint } from "@/lib/canvas/canvas-document";

/**
 * The edge toolbar is 50px tall at its compact size. Keep its lower edge
 * 20px clear of either block connection point, regardless of edge routing.
 */
const CANVAS_EDGE_TOOLBAR_HEIGHT = 50;
const CANVAS_EDGE_TOOLBAR_GAP = 20;

/**
 * Positions the connection menu between the linked blocks instead of beside
 * the source block. Its top edge remains above the higher connection point,
 * leaving enough space for the complete toolbar and a visible gap.
 */
export function canvasEdgeToolbarPosition(
  source: CanvasPoint,
  target: CanvasPoint,
): CanvasPoint {
  return {
    x: (source.x + target.x) / 2,
    y:
      Math.min(source.y, target.y) -
      CANVAS_EDGE_TOOLBAR_HEIGHT -
      CANVAS_EDGE_TOOLBAR_GAP,
  };
}

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
