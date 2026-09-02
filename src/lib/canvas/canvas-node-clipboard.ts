import {
  CANVAS_DOCUMENT_LIMITS,
  CANVAS_DOCUMENT_V2_SCHEMA_VERSION,
  parseCanvasDocumentV2,
  type CanvasDocumentV2,
  type CanvasEdgeV2,
  type CanvasNode,
} from "@/lib/canvas/canvas-document";

export const CANVAS_NODE_CLIPBOARD_MIME =
  "application/x-mozg-canvas-nodes+json";
const CANVAS_NODE_CLIPBOARD_VERSION = 2 as const;

export type CanvasNodeClipboardPayload = {
  version: typeof CANVAS_NODE_CLIPBOARD_VERSION;
  sourceCanvasId?: string;
  nodes: CanvasNode[];
  edges: CanvasEdgeV2[];
};

export type CanvasClipboardPasteResult = {
  edges: CanvasEdgeV2[];
  nodes: CanvasNode[];
  skippedCanvasAssetImages: number;
};

export type CanvasClipboardPasteTarget = {
  x: number;
  y: number;
};

function cloneNode(node: CanvasNode): CanvasNode {
  return structuredClone(node);
}

export function createCanvasNodeClipboardPayload(
  document: CanvasDocumentV2,
  selectedNodeIds: ReadonlySet<string>,
  sourceCanvasId?: string,
): CanvasNodeClipboardPayload | null {
  const nodes = document.nodes
    .filter((node) => selectedNodeIds.has(node.id))
    .map(cloneNode);
  if (nodes.length === 0) return null;
  const copiedNodeIds = new Set(nodes.map((node) => node.id));
  const edges = document.edges
    .filter(
      (edge) =>
        copiedNodeIds.has(edge.sourceNodeId) &&
        copiedNodeIds.has(edge.targetNodeId),
    )
    .map((edge) => structuredClone(edge));
  return {
    version: CANVAS_NODE_CLIPBOARD_VERSION,
    ...(sourceCanvasId ? { sourceCanvasId } : {}),
    nodes,
    edges,
  };
}

export function serializeCanvasNodeClipboardPayload(
  payload: CanvasNodeClipboardPayload,
): string {
  return JSON.stringify(payload);
}

export function parseCanvasNodeClipboardPayload(
  value: string,
): CanvasNodeClipboardPayload | null {
  if (!value.trim()) return null;
  try {
    const parsed = JSON.parse(value) as {
      version?: unknown;
      nodes?: unknown;
    };
    if (
      parsed.version !== 1 &&
      parsed.version !== CANVAS_NODE_CLIPBOARD_VERSION
    )
      return null;
    if (!Array.isArray(parsed.nodes)) return null;
    const edges =
      parsed.version === CANVAS_NODE_CLIPBOARD_VERSION &&
      Array.isArray((parsed as { edges?: unknown }).edges)
        ? (parsed as { edges: unknown[] }).edges
        : [];
    const validated = parseCanvasDocumentV2({
      schemaVersion: CANVAS_DOCUMENT_V2_SCHEMA_VERSION,
      nodes: parsed.nodes,
      edges,
    });
    if (validated.nodes.length === 0) return null;
    const sourceCanvasId = (parsed as { sourceCanvasId?: unknown })
      .sourceCanvasId;
    if (sourceCanvasId !== undefined && typeof sourceCanvasId !== "string")
      return null;
    return {
      version: CANVAS_NODE_CLIPBOARD_VERSION,
      ...(sourceCanvasId ? { sourceCanvasId } : {}),
      nodes: validated.nodes.map(cloneNode),
      edges: validated.edges.map((edge) => structuredClone(edge)),
    };
  } catch {
    return null;
  }
}

function shiftedCoordinate(value: number, offset: number): number {
  const limit = CANVAS_DOCUMENT_LIMITS.maxAbsoluteCoordinate;
  return Math.max(-limit, Math.min(limit, value + offset));
}

function pasteTranslation(
  nodes: readonly CanvasNode[],
  target: CanvasClipboardPasteTarget | undefined,
  fallbackOffset: number,
): CanvasClipboardPasteTarget {
  if (!target || nodes.length === 0)
    return { x: fallbackOffset, y: fallbackOffset };

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const node of nodes) {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + node.size.width);
    maxY = Math.max(maxY, node.position.y + node.size.height);
  }
  return {
    x: target.x - (minX + maxX) / 2,
    y: target.y - (minY + maxY) / 2,
  };
}

export function materializeCanvasNodeClipboardPaste(
  payload: CanvasNodeClipboardPayload,
  options: {
    offset?: number;
    target?: CanvasClipboardPasteTarget;
    zIndexStart: number;
    idGenerator?: () => string;
  },
): CanvasNode[] {
  return materializeCanvasClipboardPaste(payload, options).nodes;
}

export function materializeCanvasClipboardPaste(
  payload: CanvasNodeClipboardPayload,
  options: {
    offset?: number;
    target?: CanvasClipboardPasteTarget;
    targetCanvasId?: string;
    zIndexStart: number;
    idGenerator?: () => string;
  },
): CanvasClipboardPasteResult {
  const idGenerator =
    options.idGenerator ??
    (() =>
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const isCrossCanvasPaste = Boolean(
    payload.sourceCanvasId &&
    options.targetCanvasId &&
    payload.sourceCanvasId !== options.targetCanvasId,
  );
  const sourceNodes = payload.nodes.filter(
    (node) =>
      !(isCrossCanvasPaste && node.kind === "image" && "assetId" in node),
  );
  const translation = pasteTranslation(
    sourceNodes,
    options.target,
    options.offset ?? 0,
  );
  const nodeIds = new Map<string, string>();
  const nodes = sourceNodes.map((node, index) => {
    const id = `${node.kind}-${idGenerator()}`;
    nodeIds.set(node.id, id);
    return {
      ...cloneNode(node),
      id,
      position: {
        x: shiftedCoordinate(node.position.x, translation.x),
        y: shiftedCoordinate(node.position.y, translation.y),
      },
      zIndex: Math.min(
        CANVAS_DOCUMENT_LIMITS.maxZIndex,
        options.zIndexStart + index,
      ),
    };
  });
  const edges = payload.edges.flatMap((edge) => {
    const sourceNodeId = nodeIds.get(edge.sourceNodeId);
    const targetNodeId = nodeIds.get(edge.targetNodeId);
    if (!sourceNodeId || !targetNodeId) return [];
    return [
      {
        ...structuredClone(edge),
        id: `edge-${idGenerator()}`,
        sourceNodeId,
        targetNodeId,
      },
    ];
  });
  return {
    nodes,
    edges,
    skippedCanvasAssetImages: payload.nodes.length - sourceNodes.length,
  };
}
