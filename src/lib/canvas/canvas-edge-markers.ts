import type { EdgeMarkerType } from "@xyflow/react";
import type { CanvasEdgeArrows } from "@/lib/canvas/canvas-document";

export const CANVAS_EDGE_MARKER_COLOR = "#78716c";
export const CANVAS_EDGE_MARKER_VIEW_BOX = "0 -6 12 12";
export const CANVAS_EDGE_MARKER_START_REF_X = 0;
export const CANVAS_EDGE_MARKER_END_REF_X = 12;
export const CANVAS_EDGE_MARKER_REF_Y = 0;
export const CANVAS_EDGE_MARKER_WIDTH = 14;
export const CANVAS_EDGE_MARKER_HEIGHT = 14;
export const CANVAS_EDGE_MARKER_UNITS = "userSpaceOnUse";
export const CANVAS_EDGE_MARKER_START_ID = "mozg-infinite-canvas-edge-start";
export const CANVAS_EDGE_MARKER_END_ID = "mozg-infinite-canvas-edge-end";

export type CanvasRuntimeEdgeMarkers = {
  markerStart?: EdgeMarkerType;
  markerEnd?: EdgeMarkerType;
};

export function canvasArrowsToRuntimeMarkers(
  arrows: CanvasEdgeArrows,
): CanvasRuntimeEdgeMarkers {
  return {
    markerStart:
      arrows === "start" || arrows === "both"
        ? CANVAS_EDGE_MARKER_START_ID
        : undefined,
    markerEnd:
      arrows === "end" || arrows === "both"
        ? CANVAS_EDGE_MARKER_END_ID
        : undefined,
  };
}
