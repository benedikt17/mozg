"use client";

import { BaseEdge } from "@xyflow/react";
import {
  CANVAS_EDGE_MARKER_COLOR,
  CANVAS_EDGE_MARKER_END_REF_X,
  CANVAS_EDGE_MARKER_END_ID,
  CANVAS_EDGE_MARKER_HEIGHT,
  CANVAS_EDGE_MARKER_REF_Y,
  CANVAS_EDGE_MARKER_START_ID,
  CANVAS_EDGE_MARKER_START_REF_X,
  CANVAS_EDGE_MARKER_UNITS,
  CANVAS_EDGE_MARKER_VIEW_BOX,
  CANVAS_EDGE_MARKER_WIDTH,
} from "@/lib/canvas/canvas-edge-markers";

export type CanvasVisibleEdgeProps = {
  id: string;
  path: string;
  className?: string;
  markerStart?: string;
  markerEnd?: string;
  interactionWidth?: number;
};

export function CanvasVisibleEdge({
  id,
  path,
  className,
  markerStart,
  markerEnd,
  interactionWidth = 24,
}: CanvasVisibleEdgeProps): React.JSX.Element {
  return (
    <BaseEdge
      id={id}
      path={path}
      className={className}
      markerStart={markerStart}
      markerEnd={markerEnd}
      interactionWidth={interactionWidth}
    />
  );
}

export function CanvasEdgeMarkerDefinitions(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      height="0"
      style={{ position: "absolute", width: 0, height: 0 }}
      width="0"
    >
      <defs>
        <marker
          id={CANVAS_EDGE_MARKER_START_ID}
          markerHeight={CANVAS_EDGE_MARKER_HEIGHT}
          markerUnits={CANVAS_EDGE_MARKER_UNITS}
          markerWidth={CANVAS_EDGE_MARKER_WIDTH}
          orient="auto"
          refX={CANVAS_EDGE_MARKER_START_REF_X}
          refY={CANVAS_EDGE_MARKER_REF_Y}
          viewBox={CANVAS_EDGE_MARKER_VIEW_BOX}
        >
          <path
            d="M 12 -6 L 0 0 L 12 6 Z"
            fill={CANVAS_EDGE_MARKER_COLOR}
            stroke={CANVAS_EDGE_MARKER_COLOR}
          />
        </marker>
        <marker
          id={CANVAS_EDGE_MARKER_END_ID}
          markerHeight={CANVAS_EDGE_MARKER_HEIGHT}
          markerUnits={CANVAS_EDGE_MARKER_UNITS}
          markerWidth={CANVAS_EDGE_MARKER_WIDTH}
          orient="auto"
          refX={CANVAS_EDGE_MARKER_END_REF_X}
          refY={CANVAS_EDGE_MARKER_REF_Y}
          viewBox={CANVAS_EDGE_MARKER_VIEW_BOX}
        >
          <path
            d="M 0 -6 L 12 0 L 0 6 Z"
            fill={CANVAS_EDGE_MARKER_COLOR}
            stroke={CANVAS_EDGE_MARKER_COLOR}
          />
        </marker>
      </defs>
    </svg>
  );
}
