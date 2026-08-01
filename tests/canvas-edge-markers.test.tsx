import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  CANVAS_EDGE_MARKER_COLOR,
  CANVAS_EDGE_MARKER_END_ID,
  CANVAS_EDGE_MARKER_END_REF_X,
  CANVAS_EDGE_MARKER_HEIGHT,
  CANVAS_EDGE_MARKER_START_ID,
  CANVAS_EDGE_MARKER_START_REF_X,
  CANVAS_EDGE_MARKER_UNITS,
  CANVAS_EDGE_MARKER_VIEW_BOX,
  CANVAS_EDGE_MARKER_WIDTH,
  canvasArrowsToRuntimeMarkers,
} from "@/lib/canvas/canvas-edge-markers";
import { CanvasEdgeMarkerDefinitions } from "@/lib/canvas/canvas-visible-edge";

describe("canvas edge runtime markers", () => {
  it.each([
    ["none", undefined, undefined],
    ["start", CANVAS_EDGE_MARKER_START_ID, undefined],
    ["end", undefined, CANVAS_EDGE_MARKER_END_ID],
    ["both", CANVAS_EDGE_MARKER_START_ID, CANVAS_EDGE_MARKER_END_ID],
  ] as const)(
    "projects %s to the correct start/end marker IDs",
    (arrows, markerStart, markerEnd) => {
      expect(canvasArrowsToRuntimeMarkers(arrows)).toEqual({
        markerStart,
        markerEnd,
      });
    },
  );

  it("renders separate start and end SVG definitions", () => {
    const markup = renderToStaticMarkup(<CanvasEdgeMarkerDefinitions />);

    expect(markup).toContain(`id="${CANVAS_EDGE_MARKER_START_ID}"`);
    expect(markup).toContain(`id="${CANVAS_EDGE_MARKER_END_ID}"`);
    expect(markup).toContain(`viewBox="${CANVAS_EDGE_MARKER_VIEW_BOX}"`);
    expect(markup).toContain(`markerWidth="${CANVAS_EDGE_MARKER_WIDTH}"`);
    expect(markup).toContain(`markerHeight="${CANVAS_EDGE_MARKER_HEIGHT}"`);
    expect(markup).toContain(`markerUnits="${CANVAS_EDGE_MARKER_UNITS}"`);
    expect(markup).toContain(`fill="${CANVAS_EDGE_MARKER_COLOR}"`);
    expect(markup).toContain(`stroke="${CANVAS_EDGE_MARKER_COLOR}"`);
    expect(markup).toContain(`refX="${CANVAS_EDGE_MARKER_START_REF_X}"`);
    expect(markup).toContain(`refX="${CANVAS_EDGE_MARKER_END_REF_X}"`);
  });
});
