import type { Node, NodeChange } from "@xyflow/react";

/** Only a completed NodeResizer action may alter persisted Canvas geometry. */
export function isExplicitCanvasResize<NodeType extends Node>(
  change: NodeChange<NodeType>,
): change is Extract<NodeChange<NodeType>, { type: "dimensions" }> {
  return (
    change.type === "dimensions" &&
    change.resizing === false &&
    change.dimensions !== undefined
  );
}

/**
 * React Flow's completed NodeResizer change has final dimensions but does not
 * set node width/height attributes. Project those dimensions into the runtime
 * node before it crosses the Canvas persistence boundary.
 */
export function projectExplicitCanvasResizes<NodeType extends Node>(
  nodes: readonly NodeType[],
  changes: readonly NodeChange<NodeType>[],
): NodeType[] {
  const finalDimensions = new Map<string, { width: number; height: number }>();
  for (const change of changes) {
    if (isExplicitCanvasResize(change) && change.dimensions) {
      finalDimensions.set(change.id, change.dimensions);
    }
  }

  return nodes.map((node) => {
    const dimensions = finalDimensions.get(node.id);
    if (!dimensions) return node;
    return {
      ...node,
      width: dimensions.width,
      height: dimensions.height,
      style: {
        ...node.style,
        width: dimensions.width,
        height: dimensions.height,
      },
    };
  });
}
