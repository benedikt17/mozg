import type { Edge, Node } from "@xyflow/react";
import {
  parseCanvasDocumentV2,
  type CanvasDocument,
  type CanvasDocumentV2,
  type CanvasEdgeArrows,
  type CanvasEdgeRouting,
  type CanvasEdgeV2,
  type CanvasHandleSide,
  type CanvasImageNode,
  type CanvasNode,
  type CanvasPoint,
  type CanvasSize,
  type CanvasTextNode,
} from "@/lib/canvas/canvas-document";
import {
  extractCanvasImageTransfer,
  ingestCanvasImageCandidates,
  type AcceptedCanvasImage,
  type CanvasImageInputSource,
  type CanvasImageTransferPayload,
  type DecodeImageDimensions,
} from "@/lib/canvas/canvas-image-ingestion";
import type {
  CanvasAssetRecord,
  CanvasAssetRepository,
} from "@/lib/canvas/local-canvas-repository";
import type { ObjectUrlRegistry } from "@/lib/canvas/canvas-image-ingestion";
import type { CanvasTaskBridge } from "@/lib/canvas/canvas-task-bridge";
import { canvasArrowsToRuntimeMarkers } from "@/lib/canvas/canvas-edge-markers";

export const CANVAS_IMAGE_NODE_TYPE = "canvasImage";
export const CANVAS_TEXT_NODE_TYPE = "canvasText";
export const CANVAS_TASK_NODE_TYPE = "canvasTask";
export const CANVAS_EDGE_TYPE = "canvasEdge";
const MAX_INITIAL_WIDTH = 640;
const MAX_INITIAL_HEIGHT = 480;
const MIN_INITIAL_WIDTH = 160;
const MIN_INITIAL_HEIGHT = 120;
const NODE_STAGGER = 32;

export type FlowPosition = { x: number; y: number };

export type CanvasImageNodeData = {
  assetId: string;
  mimeType: CanvasAssetRecord["mimeType"];
  intrinsicWidth: number;
  intrinsicHeight: number;
  objectUrl: string;
  source: CanvasImageInputSource | "restored";
  variantKind?: "original";
};

export type CanvasImageFlowNode = Node<
  CanvasImageNodeData,
  typeof CANVAS_IMAGE_NODE_TYPE
>;

export type CanvasTextNodeData = {
  markdown: string;
  isEditing?: boolean;
};

export type CanvasTextFlowNode = Node<
  CanvasTextNodeData,
  typeof CANVAS_TEXT_NODE_TYPE
>;

export type CanvasTaskNodeData = {
  taskId: string;
  lastKnownTitle?: string;
  taskBridge?: CanvasTaskBridge;
  taskWorkspaceId?: string;
  onContentHeightChange?: (nodeId: string, height: number) => void;
};

export type CanvasTaskFlowNode = Node<
  CanvasTaskNodeData,
  typeof CANVAS_TASK_NODE_TYPE
>;

export type CanvasFlowNode =
  CanvasImageFlowNode | CanvasTextFlowNode | CanvasTaskFlowNode;

export type CanvasEdgeFlowData = {
  routing: CanvasEdgeRouting;
  arrows: CanvasEdgeArrows;
  onUpdate?: (
    edgeId: string,
    update: Pick<CanvasEdgeV2, "routing" | "arrows">,
  ) => void;
};

export type CanvasEdgeFlow = Edge<CanvasEdgeFlowData, typeof CANVAS_EDGE_TYPE>;

export function updateCanvasEdgeFlowRuntime(
  edge: CanvasEdgeFlow,
  update: Pick<CanvasEdgeFlowData, "routing" | "arrows">,
): CanvasEdgeFlow {
  const markers = canvasArrowsToRuntimeMarkers(update.arrows);
  return {
    ...edge,
    ...markers,
    data: { ...edge.data, ...update },
  };
}

export type CanvasImageAdapterDependencies = {
  assetRepository: CanvasAssetRepository;
  objectUrls: ObjectUrlRegistry;
  workspaceId: string;
  decodeImageDimensions?: DecodeImageDimensions;
  idGenerator?: () => string;
};

export type RestoreCanvasImageOptions = {
  cachedAssetPayloads?: ReadonlyMap<string, Pick<CanvasImageNodeData, "objectUrl" | "mimeType" | "intrinsicWidth" | "intrinsicHeight" | "source" | "variantKind">>;
  concurrency?: number;
  signal?: AbortSignal;
  onNode?: (node: CanvasImageFlowNode, index: number, total: number) => void;
};

export type RestoreCanvasImageResult = {
  nodes: CanvasImageFlowNode[];
  missingAssetIds: string[];
  assetReadCount: number;
  maxConcurrentAssetReads: number;
  staleIgnored: boolean;
};

export type CanvasDocumentEditor = {
  document: CanvasDocumentV2;
  nodes: CanvasImageFlowNode[];
};

function initialSize(width: number, height: number): CanvasSize {
  const fitScale = Math.min(
    1,
    MAX_INITIAL_WIDTH / width,
    MAX_INITIAL_HEIGHT / height,
  );
  const minimumScale = Math.max(
    MIN_INITIAL_WIDTH / width,
    MIN_INITIAL_HEIGHT / height,
  );
  const scale = Math.max(fitScale, minimumScale);
  return {
    width: Math.max(MIN_INITIAL_WIDTH, Math.round(width * scale)),
    height: Math.max(MIN_INITIAL_HEIGHT, Math.round(height * scale)),
  };
}

function staggeredPosition(base: FlowPosition, index: number): FlowPosition {
  return { x: base.x + index * NODE_STAGGER, y: base.y + index * NODE_STAGGER };
}

function nodeSize(node: CanvasImageFlowNode): CanvasSize {
  const style = node.style ?? {};
  const width = node.width ?? style.width;
  const height = node.height ?? style.height;
  if (typeof width !== "number" || typeof height !== "number") {
    throw new Error(`Canvas image node ${node.id} has no numeric dimensions.`);
  }
  return { width, height };
}

export function createCanvasImageFlowNode(input: {
  record: CanvasAssetRecord;
  objectUrl: string;
  position: FlowPosition;
  source: CanvasImageNodeData["source"];
  index?: number;
}): CanvasImageFlowNode {
  const size = initialSize(input.record.width, input.record.height);
  return {
    id: input.record.id,
    type: CANVAS_IMAGE_NODE_TYPE,
    position: staggeredPosition(input.position, input.index ?? 0),
    style: { width: size.width, height: size.height },
    data: {
      assetId: input.record.id,
      mimeType: input.record.mimeType,
      intrinsicWidth: input.record.width,
      intrinsicHeight: input.record.height,
      objectUrl: input.objectUrl,
      source: input.source,
    },
  };
}

function imageNodeForCanonical(
  node: CanvasImageNode,
  record: CanvasAssetRecord,
  objectUrl: string,
): CanvasImageFlowNode {
  return {
    id: node.id,
    type: CANVAS_IMAGE_NODE_TYPE,
    position: { ...node.position },
    style: { width: node.size.width, height: node.size.height },
    data: {
      assetId: record.id,
      mimeType: record.mimeType,
      intrinsicWidth: record.width,
      intrinsicHeight: record.height,
      objectUrl,
      source: "restored",
    },
  };
}

export function canvasDocumentToImageNodes(
  document: CanvasDocument,
): CanvasImageFlowNode[] {
  return document.nodes
    .filter((node): node is CanvasImageNode => node.kind === "image")
    .map((node) => ({
      id: node.id,
      type: CANVAS_IMAGE_NODE_TYPE,
      position: { ...node.position },
      style: { width: node.size.width, height: node.size.height },
      data: {
        assetId: node.assetId,
        mimeType: "image/png",
        intrinsicWidth: node.size.width,
        intrinsicHeight: node.size.height,
        objectUrl: "",
        source: "restored",
      },
    }));
}

export function createCanvasTextFlowNode(input: {
  id: string;
  markdown: string;
  position?: FlowPosition;
  size?: CanvasSize;
  zIndex?: number;
  isEditing?: boolean;
}): CanvasTextFlowNode {
  return {
    id: input.id,
    type: CANVAS_TEXT_NODE_TYPE,
    position: { ...(input.position ?? { x: 0, y: 0 }) },
    style: {
      width: input.size?.width ?? 320,
      height: input.size?.height ?? 220,
    },
    zIndex: input.zIndex,
    data: { markdown: input.markdown, isEditing: input.isEditing },
  };
}

export function createCanvasTaskId(
  idGenerator: () => string = () =>
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`,
): string {
  return `task-node-${idGenerator()}`;
}

export function createCanvasTaskFlowNode(input: {
  id: string;
  taskId: string;
  lastKnownTitle?: string;
  position: FlowPosition;
  size?: CanvasSize;
  zIndex?: number;
  taskBridge?: CanvasTaskBridge;
  taskWorkspaceId?: string;
  onContentHeightChange?: (nodeId: string, height: number) => void;
}): CanvasTaskFlowNode {
  return {
    id: input.id,
    type: CANVAS_TASK_NODE_TYPE,
    position: { ...input.position },
    style: {
      width: input.size?.width ?? 300,
      height: input.size?.height ?? 150,
    },
    zIndex: input.zIndex,
    data: {
      taskId: input.taskId,
      ...(input.lastKnownTitle === undefined
        ? {}
        : { lastKnownTitle: input.lastKnownTitle }),
      taskBridge: input.taskBridge,
      taskWorkspaceId: input.taskWorkspaceId,
      ...(input.onContentHeightChange === undefined
        ? {}
        : { onContentHeightChange: input.onContentHeightChange }),
    },
  };
}

export function canvasDocumentToTextNodes(
  document: CanvasDocument,
): CanvasTextFlowNode[] {
  return document.nodes
    .filter((node): node is CanvasTextNode => node.kind === "text")
    .map((node) =>
      createCanvasTextFlowNode({
        id: node.id,
        markdown: node.markdown,
        position: node.position,
        size: node.size,
        zIndex: node.zIndex,
      }),
    );
}

export function canvasDocumentToTaskNodes(
  document: CanvasDocument,
  options: {
    taskBridge?: CanvasTaskBridge;
    taskWorkspaceId?: string;
    onContentHeightChange?: (nodeId: string, height: number) => void;
  } = {},
): CanvasTaskFlowNode[] {
  return document.nodes
    .filter(
      (node): node is Extract<CanvasNode, { kind: "task" }> =>
        node.kind === "task",
    )
    .map((node) =>
      createCanvasTaskFlowNode({
        id: node.id,
        taskId: node.taskId,
        lastKnownTitle: node.lastKnownTitle,
        position: node.position,
        size: node.size,
        zIndex: node.zIndex,
        taskBridge: options.taskBridge,
        taskWorkspaceId: options.taskWorkspaceId,
        onContentHeightChange: options.onContentHeightChange,
      }),
    );
}

export function imageNodesToCanvasDocument(
  source: CanvasDocument,
  nodes: readonly CanvasImageFlowNode[],
): CanvasDocumentV2 {
  const canonical = parseCanvasDocumentV2(source);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const nextNodes: CanvasNode[] = canonical.nodes.map((node) => {
    if (node.kind !== "image") return { ...node } as CanvasNode;
    const runtime = byId.get(node.id);
    if (!runtime)
      return {
        ...node,
        position: { ...node.position },
        size: { ...node.size },
      };
    return {
      ...node,
      position: { ...runtime.position },
      size: nodeSize(runtime),
    };
  });
  return parseCanvasDocumentV2({
    schemaVersion: canonical.schemaVersion,
    nodes: nextNodes,
    edges: canonical.edges.map((edge) => ({ ...edge })),
  });
}

function runtimeNodeSize(node: CanvasFlowNode): CanvasSize {
  const style = node.style ?? {};
  const width = node.width ?? style.width;
  const height = node.height ?? style.height;
  if (typeof width !== "number" || typeof height !== "number") {
    throw new Error(`Canvas node ${node.id} has no numeric dimensions.`);
  }
  return { width, height };
}

export function runtimeNodesToCanvasDocument(
  source: CanvasDocument,
  nodes: readonly CanvasFlowNode[],
): CanvasDocumentV2 {
  const canonical = parseCanvasDocumentV2(source);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const nextNodes: CanvasNode[] = canonical.nodes.map((node) => {
    const runtime = byId.get(node.id);
    if (!runtime) return { ...node } as CanvasNode;
    if (node.kind === "image" && runtime.type === CANVAS_IMAGE_NODE_TYPE) {
      return {
        ...node,
        position: { ...runtime.position },
        size: runtimeNodeSize(runtime),
      };
    }
    if (node.kind === "text" && runtime.type === CANVAS_TEXT_NODE_TYPE) {
      return {
        ...node,
        markdown: runtime.data.markdown,
        position: { ...runtime.position },
        size: runtimeNodeSize(runtime),
      };
    }
    if (node.kind === "task" && runtime.type === CANVAS_TASK_NODE_TYPE) {
      return {
        ...node,
        position: { ...runtime.position },
        size: runtimeNodeSize(runtime),
      };
    }
    return { ...node } as CanvasNode;
  });
  return parseCanvasDocumentV2({
    schemaVersion: canonical.schemaVersion,
    nodes: nextNodes,
    edges: canonical.edges.map((edge) => ({ ...edge })),
  });
}

export function createCanvasEdgeId(
  idGenerator: () => string = () =>
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`,
): string {
  return `edge-${idGenerator()}`;
}

function isCanvasHandleSide(
  value: string | null | undefined,
): value is CanvasHandleSide {
  return (
    value === "top" ||
    value === "right" ||
    value === "bottom" ||
    value === "left"
  );
}

export function createCanvasEdgeFromConnection(input: {
  id?: string;
  source: string | null;
  sourceHandle: string | null;
  target: string | null;
  targetHandle: string | null;
}): CanvasEdgeV2 | null {
  if (
    !input.source ||
    !input.target ||
    input.source === input.target ||
    !isCanvasHandleSide(input.sourceHandle) ||
    !isCanvasHandleSide(input.targetHandle)
  )
    return null;
  return {
    id: input.id ?? createCanvasEdgeId(),
    sourceNodeId: input.source,
    sourceHandle: input.sourceHandle,
    targetNodeId: input.target,
    targetHandle: input.targetHandle,
    routing: "curved",
    arrows: "none",
  };
}

export function canvasEdgeToFlowEdge(
  edge: CanvasEdgeV2,
  onUpdate?: CanvasEdgeFlowData["onUpdate"],
): CanvasEdgeFlow {
  const markers = canvasArrowsToRuntimeMarkers(edge.arrows);
  return {
    id: edge.id,
    type: CANVAS_EDGE_TYPE,
    source: edge.sourceNodeId,
    sourceHandle: edge.sourceHandle,
    target: edge.targetNodeId,
    targetHandle: edge.targetHandle,
    markerStart: markers.markerStart,
    markerEnd: markers.markerEnd,
    data: {
      routing: edge.routing,
      arrows: edge.arrows,
      onUpdate,
    },
  };
}

export function canvasDocumentToEdges(
  document: CanvasDocumentV2,
  onUpdate?: CanvasEdgeFlowData["onUpdate"],
): CanvasEdgeFlow[] {
  return document.edges.map((edge) => canvasEdgeToFlowEdge(edge, onUpdate));
}

export function runtimeEdgesToCanvasDocument(
  source: CanvasDocumentV2,
  edges: readonly CanvasEdgeFlow[],
): CanvasDocumentV2 {
  const byId = new Map(edges.map((edge) => [edge.id, edge]));
  return parseCanvasDocumentV2({
    ...source,
    edges: source.edges.map((canonical) => {
      const runtime = byId.get(canonical.id);
      if (
        !runtime ||
        !isCanvasHandleSide(runtime.sourceHandle) ||
        !isCanvasHandleSide(runtime.targetHandle)
      )
        return { ...canonical };
      return {
        ...canonical,
        sourceNodeId: runtime.source,
        sourceHandle: runtime.sourceHandle,
        targetNodeId: runtime.target,
        targetHandle: runtime.targetHandle,
      };
    }),
  });
}

export function canvasPointFromNode(node: CanvasImageFlowNode): CanvasPoint {
  return { x: node.position.x, y: node.position.y };
}

export async function ingestCanvasImageTransferToNodes(
  payload: CanvasImageTransferPayload,
  source: CanvasImageInputSource,
  position: FlowPosition,
  dependencies: CanvasImageAdapterDependencies,
): Promise<{
  accepted: AcceptedCanvasImage[];
  rejected: number;
  nodes: CanvasImageFlowNode[];
}> {
  const extracted = extractCanvasImageTransfer(payload, source);
  const result = await ingestCanvasImageCandidates(extracted.candidates, {
    repository: dependencies.assetRepository,
    workspaceId: dependencies.workspaceId,
    decodeImageDimensions: dependencies.decodeImageDimensions,
    idGenerator: dependencies.idGenerator,
  });
  const nodes: CanvasImageFlowNode[] = [];
  for (const [index, accepted] of result.accepted.entries()) {
    const record = await dependencies.assetRepository.loadAsset({
      workspaceId: dependencies.workspaceId,
      assetId: accepted.assetId,
    });
    if (!record) continue;
    nodes.push(
      createCanvasImageFlowNode({
        record,
        objectUrl: dependencies.objectUrls.create(record.blob),
        position,
        source,
        index,
      }),
    );
  }
  return { accepted: result.accepted, rejected: result.rejected.length, nodes };
}

export async function restoreCanvasImageNodes(
  document: CanvasDocument,
  dependencies: CanvasImageAdapterDependencies,
  options: RestoreCanvasImageOptions = {},
): Promise<RestoreCanvasImageResult> {
  const imageNodes = document.nodes.filter(
    (node): node is CanvasImageNode => node.kind === "image",
  );
  const concurrency = Math.max(
    1,
    Math.min(Math.floor(options.concurrency ?? 4), imageNodes.length || 1),
  );
  const nodes: Array<CanvasImageFlowNode | undefined> = [];
  const missingAssetIds: string[] = [];
  let nextIndex = 0;
  let activeReads = 0;
  let maxConcurrentAssetReads = 0;
  let assetReadCount = 0;
  let staleIgnored = false;
  const worker = async (): Promise<void> => {
    while (true) {
      const index = nextIndex++;
      if (index >= imageNodes.length) return;
      if (options.signal?.aborted) {
        staleIgnored = true;
        return;
      }
      const canonical = imageNodes[index];
      const cachedPayload = options.cachedAssetPayloads?.get(canonical.assetId);
      if (cachedPayload) {
        const node: CanvasImageFlowNode = {
          id: canonical.id, type: CANVAS_IMAGE_NODE_TYPE, position: { ...canonical.position },
          style: { width: canonical.size.width, height: canonical.size.height },
          data: { assetId: canonical.assetId, ...cachedPayload },
        };
        nodes[index] = node;
        options.onNode?.(node, index, imageNodes.length);
        continue;
      }
      activeReads += 1;
      maxConcurrentAssetReads = Math.max(maxConcurrentAssetReads, activeReads);
      let record: CanvasAssetRecord | null;
      try {
        record = await dependencies.assetRepository.loadAsset({
          workspaceId: dependencies.workspaceId,
          assetId: canonical.assetId,
        });
      } finally {
        activeReads -= 1;
        assetReadCount += 1;
      }
      if (options.signal?.aborted) {
        staleIgnored = true;
        return;
      }
      if (!record) {
        missingAssetIds.push(canonical.assetId);
        continue;
      }
      const node = imageNodeForCanonical(
        canonical,
        record,
        dependencies.objectUrls.create(record.blob),
      );
      nodes[index] = node;
      options.onNode?.(node, index, imageNodes.length);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  if (options.signal?.aborted) staleIgnored = true;
  return {
    nodes: nodes.filter(
      (node): node is CanvasImageFlowNode => node !== undefined,
    ),
    missingAssetIds,
    assetReadCount,
    maxConcurrentAssetReads,
    staleIgnored,
  };
}
