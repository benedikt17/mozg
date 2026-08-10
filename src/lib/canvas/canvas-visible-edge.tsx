"use client";

import { BaseEdge, useStoreApi } from "@xyflow/react";
import { useEffect, useRef } from "react";
import { CANVAS_VIEWPORT_LIMITS } from "@/lib/canvas/canvas-document";
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

function CanvasViewportBehavior({
  anchorRef,
}: {
  anchorRef: React.RefObject<SVGSVGElement | null>;
}): null {
  const store = useStoreApi();

  useEffect(() => {
    const applyLimits = (): void => {
      const state = store.getState();
      if (
        state.minZoom === CANVAS_VIEWPORT_LIMITS.minZoom &&
        state.maxZoom === CANVAS_VIEWPORT_LIMITS.maxZoom
      )
        return;
      store.setState({
        minZoom: CANVAS_VIEWPORT_LIMITS.minZoom,
        maxZoom: CANVAS_VIEWPORT_LIMITS.maxZoom,
      });
    };

    applyLimits();
    return store.subscribe((state) => {
      if (
        state.minZoom !== CANVAS_VIEWPORT_LIMITS.minZoom ||
        state.maxZoom !== CANVAS_VIEWPORT_LIMITS.maxZoom
      ) {
        queueMicrotask(applyLimits);
      }
    });
  }, [store]);

  useEffect(() => {
    const root = anchorRef.current?.closest(".react-flow");
    const viewport = root?.querySelector<HTMLElement>(".react-flow__viewport");
    if (!root || !viewport) return;

    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    let previousTransition = viewport.style.transition;
    const clearSmoothing = (): void => {
      if (settleTimer) {
        clearTimeout(settleTimer);
        settleTimer = null;
      }
      viewport.style.transition = previousTransition;
    };
    const onWheel = (): void => {
      if (settleTimer === null) previousTransition = viewport.style.transition;
      viewport.style.transition = "transform 55ms linear";
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(clearSmoothing, 75);
    };
    const onPointerDown = (): void => clearSmoothing();

    root.addEventListener("wheel", onWheel, { capture: true, passive: true });
    root.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      clearSmoothing();
      root.removeEventListener("wheel", onWheel, true);
      root.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [anchorRef]);

  return null;
}

export function CanvasEdgeMarkerDefinitions(): React.JSX.Element {
  const anchorRef = useRef<SVGSVGElement>(null);
  return (
    <>
      <CanvasViewportBehavior anchorRef={anchorRef} />
      <svg
        aria-hidden="true"
        height="0"
        ref={anchorRef}
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
    </>
  );
}
