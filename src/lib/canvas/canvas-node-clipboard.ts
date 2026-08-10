import {
  CANVAS_DOCUMENT_LIMITS,
  CANVAS_DOCUMENT_V2_SCHEMA_VERSION,
  parseCanvasDocumentV2,
  type CanvasDocumentV2,
  type CanvasNode,
} from "@/lib/canvas/canvas-document";

export const CANVAS_NODE_CLIPBOARD_MIME =
  "application/x-mozg-canvas-nodes+json";
const CANVAS_NODE_CLIPBOARD_VERSION = 1 as const;

export type CanvasNodeClipboardPayload = {
  version: typeof CANVAS_NODE_CLIPBOARD_VERSION;
  nodes: CanvasNode[];
};

export type CanvasClipboardPasteTarget = {
  x: number;
  y: number;
};

function cloneNode(node: CanvasNode): CanvasNode {
  return structuredClone(node);
}

function copyableNode(node: CanvasNode): boolean {
  return node.kind === "image" || node.kind === "text" || node.kind === "task";
}

export function createCanvasNodeClipboardPayload(
  document: CanvasDocumentV2,
  selectedNodeIds: ReadonlySet<string>,
): CanvasNodeClipboardPayload | null {
  const nodes = document.nodes
    .filter((node) => selectedNodeIds.has(node.id) && copyableNode(node))
    .map(cloneNode);
  if (nodes.length === 0) return null;
  return { version: CANVAS_NODE_CLIPBOARD_VERSION, nodes };
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
    if (parsed.version !== CANVAS_NODE_CLIPBOARD_VERSION) return null;
    if (!Array.isArray(parsed.nodes)) return null;
    const validated = parseCanvasDocumentV2({
      schemaVersion: CANVAS_DOCUMENT_V2_SCHEMA_VERSION,
      nodes: parsed.nodes,
      edges: [],
    });
    const nodes = validated.nodes.filter(copyableNode).map(cloneNode);
    if (nodes.length !== validated.nodes.length || nodes.length === 0)
      return null;
    return { version: CANVAS_NODE_CLIPBOARD_VERSION, nodes };
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
  const idGenerator =
    options.idGenerator ??
    (() =>
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const translation = pasteTranslation(
    payload.nodes,
    options.target,
    options.offset ?? 0,
  );
  return payload.nodes.map((node, index) => ({
    ...cloneNode(node),
    id: `${node.kind}-${idGenerator()}`,
    position: {
      x: shiftedCoordinate(node.position.x, translation.x),
      y: shiftedCoordinate(node.position.y, translation.y),
    },
    zIndex: Math.min(
      CANVAS_DOCUMENT_LIMITS.maxZIndex,
      options.zIndexStart + index,
    ),
  }));
}
