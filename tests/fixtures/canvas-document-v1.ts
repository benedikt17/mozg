import type {
  CanvasDocumentV1,
  CanvasNode,
} from "@/lib/canvas/canvas-document";

export const canvasNodeBase = {
  id: "node-1",
  position: { x: 10, y: 20 },
  size: { width: 240, height: 120 },
  zIndex: 1,
} satisfies Omit<CanvasNode, "kind">;

export const emptyCanvasDocumentV1: CanvasDocumentV1 = {
  schemaVersion: 1,
  nodes: [],
  edges: [],
};

export const taskCanvasDocumentV1: CanvasDocumentV1 = {
  schemaVersion: 1,
  nodes: [
    {
      ...canvasNodeBase,
      kind: "task",
      taskId: "task-1",
      lastKnownTitle: "Implement the Canvas foundation",
    },
  ],
  edges: [],
};

export const articleCanvasDocumentV1: CanvasDocumentV1 = {
  schemaVersion: 1,
  nodes: [
    {
      ...canvasNodeBase,
      id: "article-node-1",
      kind: "article",
      articleId: "article-1",
      lastKnownTitle: "Canvas architecture",
    },
  ],
  edges: [],
};

export const textCanvasDocumentV1: CanvasDocumentV1 = {
  schemaVersion: 1,
  nodes: [
    {
      ...canvasNodeBase,
      id: "text-node-1",
      kind: "text",
      markdown: "  **exact Markdown**\n\n",
    },
  ],
  edges: [],
};

export const imageCanvasDocumentV1: CanvasDocumentV1 = {
  schemaVersion: 1,
  nodes: [
    {
      ...canvasNodeBase,
      id: "image-node-1",
      kind: "image",
      assetId: "asset-1",
      aspectRatioLocked: true,
    },
  ],
  edges: [],
};

export const mixedCanvasDocumentV1: CanvasDocumentV1 = {
  schemaVersion: 1,
  nodes: [
    taskCanvasDocumentV1.nodes[0],
    articleCanvasDocumentV1.nodes[0],
    textCanvasDocumentV1.nodes[0],
    imageCanvasDocumentV1.nodes[0],
  ],
  edges: [
    {
      id: "edge-1",
      sourceNodeId: "node-1",
      targetNodeId: "article-node-1",
    },
  ],
};
