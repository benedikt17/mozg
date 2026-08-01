import type { CanvasEdgeArrows } from "@/lib/canvas/canvas-document";

export type CanvasEdgeEndpointArrows = {
  source: boolean;
  target: boolean;
};

export function canvasArrowsToEndpointArrows(
  arrows: CanvasEdgeArrows,
): CanvasEdgeEndpointArrows {
  return {
    source: arrows === "start" || arrows === "both",
    target: arrows === "end" || arrows === "both",
  };
}

export function endpointArrowsToCanvasArrows(
  endpoints: CanvasEdgeEndpointArrows,
): CanvasEdgeArrows {
  if (endpoints.source && endpoints.target) return "both";
  if (endpoints.source) return "start";
  if (endpoints.target) return "end";
  return "none";
}

export function swapCanvasEdgeArrows(
  arrows: CanvasEdgeArrows,
): CanvasEdgeArrows {
  const endpoints = canvasArrowsToEndpointArrows(arrows);
  return endpointArrowsToCanvasArrows({
    source: endpoints.target,
    target: endpoints.source,
  });
}
