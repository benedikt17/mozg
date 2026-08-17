import type { NodeChange } from "@xyflow/react";
import {
  CANVAS_DOCUMENT_LIMITS,
  type CanvasNode,
} from "@/lib/canvas/canvas-document";
import {
  CANVAS_TEXT_NODE_TYPE,
  type CanvasFlowNode,
} from "@/lib/canvas/react-flow-canvas-adapter";

export type CanvasAltDragDuplicateSession = {
  sourceNodeId: string;
  duplicateNodeId: string;
  duplicate: CanvasNode;
  finalPosition: { x: number; y: number };
};

function nextCanvasNodeId(
  kind: CanvasNode["kind"],
  idGenerator: () => string,
): string {
  return `${kind}-${idGenerator()}`;
}

export function createCanvasAltDragDuplicate(
  node: CanvasNode,
  options: {
    zIndex: number;
    idGenerator?: () => string;
  },
): CanvasNode | null {
  if (node.kind === "article") return null;
  const idGenerator =
    options.idGenerator ??
    (() =>
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const duplicate = structuredClone(node);
  return {
    ...duplicate,
    id: nextCanvasNodeId(node.kind, idGenerator),
    position: { ...node.position },
    size: { ...node.size },
    zIndex: Math.min(CANVAS_DOCUMENT_LIMITS.maxZIndex, options.zIndex),
  } as CanvasNode;
}

export function createCanvasAltDragRuntimeNode(
  source: CanvasFlowNode,
  duplicate: CanvasNode,
): CanvasFlowNode {
  const data =
    source.type === CANVAS_TEXT_NODE_TYPE
      ? {
          ...source.data,
          style: { ...source.data.style },
          isEditing: false,
        }
      : { ...source.data };
  return {
    ...source,
    id: duplicate.id,
    position: { ...source.position },
    selected: false,
    zIndex: duplicate.zIndex,
    data,
    ...(source.style ? { style: { ...source.style } } : {}),
    ...(source.measured ? { measured: { ...source.measured } } : {}),
  } as CanvasFlowNode;
}

export function redirectCanvasAltDragNodeChanges(
  changes: readonly NodeChange<CanvasFlowNode>[],
  session: CanvasAltDragDuplicateSession | null,
): NodeChange<CanvasFlowNode>[] {
  if (!session) return [...changes];
  return changes.map((change) => {
    if (change.type !== "position" || change.id !== session.sourceNodeId)
      return change;
    if (change.position) {
      session.finalPosition = { ...change.position };
    }
    return { ...change, id: session.duplicateNodeId };
  });
}

export function finalizeCanvasAltDragDuplicate(
  session: CanvasAltDragDuplicateSession,
): CanvasNode {
  return {
    ...structuredClone(session.duplicate),
    position: { ...session.finalPosition },
  } as CanvasNode;
}
