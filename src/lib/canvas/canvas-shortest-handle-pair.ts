import type { CanvasHandleSide } from "@/lib/canvas/canvas-document";
import {
  canvasNodeHandleCenter,
  type CanvasNodeBounds,
  type CanvasNodeBoundsRecord,
} from "@/lib/canvas/canvas-edge-geometry";

export type {
  CanvasNodeBounds,
  CanvasNodeBoundsRecord,
} from "@/lib/canvas/canvas-edge-geometry";
export { canvasNodeHandleCenter as getCanvasHandleCenter } from "@/lib/canvas/canvas-edge-geometry";

export type ShortestCanvasHandlePair = {
  sourceHandle: CanvasHandleSide;
  targetHandle: CanvasHandleSide;
  distanceSquared: number;
};

const HANDLE_PAIR_ORDER: readonly (readonly [
  CanvasHandleSide,
  CanvasHandleSide,
])[] = [
  ["right", "left"],
  ["left", "right"],
  ["bottom", "top"],
  ["top", "bottom"],
  ["right", "top"],
  ["right", "bottom"],
  ["left", "top"],
  ["left", "bottom"],
  ["bottom", "right"],
  ["bottom", "left"],
  ["top", "right"],
  ["top", "left"],
  ["right", "right"],
  ["left", "left"],
  ["bottom", "bottom"],
  ["top", "top"],
];

export const CANVAS_HANDLE_DISTANCE_EPSILON = 1e-7;

export function findShortestCanvasHandlePair(
  sourceBounds: CanvasNodeBounds,
  targetBounds: CanvasNodeBounds,
): ShortestCanvasHandlePair {
  let best: ShortestCanvasHandlePair | undefined;

  for (const [sourceHandle, targetHandle] of HANDLE_PAIR_ORDER) {
    const source = canvasNodeHandleCenter(sourceBounds, sourceHandle);
    const target = canvasNodeHandleCenter(targetBounds, targetHandle);
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distanceSquared = dx ** 2 + dy ** 2;

    if (
      !best ||
      distanceSquared < best.distanceSquared - CANVAS_HANDLE_DISTANCE_EPSILON
    ) {
      best = { sourceHandle, targetHandle, distanceSquared };
    }
  }

  return best as ShortestCanvasHandlePair;
}

type CanvasRuntimeEdgeLike = {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

export function recomputeCanvasRuntimeEdgeHandles<
  EdgeType extends CanvasRuntimeEdgeLike,
>(
  edges: readonly EdgeType[],
  nodes: readonly CanvasNodeBoundsRecord[],
): EdgeType[] {
  const boundsById = new Map(nodes.map((node) => [node.id, node]));
  return edges.map((edge) => {
    const sourceBounds = boundsById.get(edge.source);
    const targetBounds = boundsById.get(edge.target);
    if (!sourceBounds || !targetBounds) return edge;

    const pair = findShortestCanvasHandlePair(sourceBounds, targetBounds);
    if (
      edge.sourceHandle === pair.sourceHandle &&
      edge.targetHandle === pair.targetHandle
    )
      return edge;
    return {
      ...edge,
      sourceHandle: pair.sourceHandle,
      targetHandle: pair.targetHandle,
    };
  });
}
