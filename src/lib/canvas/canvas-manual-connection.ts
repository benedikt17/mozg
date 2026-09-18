import type {
  CanvasEdgeV2,
  CanvasHandleSide,
} from "@/lib/canvas/canvas-document";

function isSide(value: unknown): value is CanvasHandleSide {
  return (
    value === "top" ||
    value === "right" ||
    value === "bottom" ||
    value === "left"
  );
}

/** Reattach a connection to another side without changing its graph meaning. */
export function reconnectCanvasEdgeSide(
  edge: CanvasEdgeV2,
  connection: {
    source: string | null;
    target: string | null;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  },
): CanvasEdgeV2 | null {
  if (
    connection.source !== edge.sourceNodeId ||
    connection.target !== edge.targetNodeId ||
    !isSide(connection.sourceHandle) ||
    !isSide(connection.targetHandle)
  )
    return null;
  return {
    ...edge,
    sourceHandle: connection.sourceHandle,
    targetHandle: connection.targetHandle,
  };
}
