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

/**
 * Reconnect either end of an existing edge to any available Canvas handle.
 * The edge keeps its identity and all presentation metadata; invalid graph
 * states are rejected before they can reach the persisted document parser.
 */
export function reconnectCanvasEdge(
  edge: CanvasEdgeV2,
  connection: {
    source: string | null;
    target: string | null;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  },
  existingEdges: readonly CanvasEdgeV2[],
): CanvasEdgeV2 | null {
  if (
    !connection.source ||
    !connection.target ||
    connection.source === connection.target ||
    !isSide(connection.sourceHandle) ||
    !isSide(connection.targetHandle)
  )
    return null;
  const duplicatesExistingConnection = existingEdges.some(
    (current) =>
      current.id !== edge.id &&
      current.sourceNodeId === connection.source &&
      current.targetNodeId === connection.target,
  );
  if (duplicatesExistingConnection) return null;
  return {
    ...edge,
    sourceNodeId: connection.source,
    targetNodeId: connection.target,
    sourceHandle: connection.sourceHandle,
    targetHandle: connection.targetHandle,
  };
}

/** Reattach a connection to another side without changing its linked blocks. */
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
    connection.target !== edge.targetNodeId
  )
    return null;
  return reconnectCanvasEdge(edge, connection, [edge]);
}
