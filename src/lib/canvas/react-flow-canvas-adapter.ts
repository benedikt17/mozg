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
import { CanvasImageLoadCache } from "@/lib/canvas/canvas-image-load-cache";
import { canvasArrowsToRuntimeMarkers } from "@/lib/canvas/canvas-edge-markers";
import {
  canvasImageLegacyKindFromResolutionSource,
  canvasImageResolutionSourceCacheKey,
  canvasImageResolutionSourceFromLegacyKind,
  chooseCanvasImageResolutionSource,
  generateCanvasImageVariants,
  type CanvasAssetVariantKind,
  type CanvasAssetVariantMetadata,
  type CanvasAssetVariantRepository,
  type CanvasAssetVariantV2Metadata,
  type CanvasAssetVariantV2Repository,
  type CanvasImagePyramidCandidate,
  type CanvasImageResolutionSource,
  type CanvasImageSourceKind,
  type CanvasImageVariantGenerator,
  isCanvasImagePyramidTargetMaxEdge,
} from "@/lib/canvas/canvas-image-variants";

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
  resolutionSource?: CanvasImageResolutionSource;
  /** Compatibility projection only; resolutionSource is authoritative. */
  variantKind?: CanvasAssetVariantKind | "original";
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
  variantRepository?: CanvasAssetVariantRepository &
    Partial<CanvasAssetVariantV2Repository>;
  objectUrls: ObjectUrlRegistry;
  workspaceId: string;
  userId?: string;
  canvasId?: string;
  loadCache?: CanvasImageLoadCache;
  decodeImageDimensions?: DecodeImageDimensions;
  generateImageVariants?: CanvasImageVariantGenerator;
  onVariantError?: (error: unknown) => void;
  idGenerator?: () => string;
};

export type RestoreCanvasImageOptions = {
  cachedAssetPayloads?: ReadonlyMap<
    string,
    Pick<
      CanvasImageNodeData,
      | "objectUrl"
      | "mimeType"
      | "intrinsicWidth"
      | "intrinsicHeight"
      | "source"
      | "variantKind"
      | "resolutionSource"
    >
  >;
  viewportZoom?: number;
  devicePixelRatio?: number;
  /** Measured screen-space sizes. When present, these already include zoom. */
  renderedCssSizes?: ReadonlyMap<string, { width: number; height: number }>;
  currentResolutionSources?: ReadonlyMap<string, CanvasImageResolutionSource>;
  /** Upgrades are immediate; the shell enables downgrades only after zoom settles. */
  allowDowngrade?: boolean;
  onVariantError?: (error: unknown) => void;
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

export type CanvasCachedImagePayload = Pick<
  CanvasImageNodeData,
  | "objectUrl"
  | "mimeType"
  | "intrinsicWidth"
  | "intrinsicHeight"
  | "source"
  | "variantKind"
  | "resolutionSource"
>;

function runtimePayloadSource(
  payload: CanvasCachedImagePayload,
  fallback: CanvasImageResolutionSource,
): CanvasImageResolutionSource {
  if (payload.resolutionSource) return payload.resolutionSource;
  if (payload.variantKind)
    return canvasImageResolutionSourceFromLegacyKind(payload.variantKind);
  return fallback;
}

function pyramidCandidateFromLegacyVariant(
  variant: CanvasAssetVariantMetadata,
): CanvasImagePyramidCandidate {
  return {
    source: canvasImageResolutionSourceFromLegacyKind(variant.kind) as Extract<
      CanvasImageResolutionSource,
      { type: "variant" }
    >,
    pixelWidth: variant.pixelWidth,
    pixelHeight: variant.pixelHeight,
  };
}

export function findCachedCanvasImagePayload(input: {
  payloads: ReadonlyMap<string, CanvasCachedImagePayload> | undefined;
  workspaceId: string;
  canvasId: string;
  assetId: string;
  requestedSource?: CanvasImageResolutionSource;
  /** @deprecated Compatibility input; numeric source keys remain canonical. */
  requestedKind?: CanvasImageSourceKind;
}): {
  source: CanvasImageResolutionSource;
  payload: CanvasCachedImagePayload;
  exact: boolean;
  /** @deprecated Compatibility projection for callers still asserting legacy labels. */
  kind?: CanvasImageSourceKind;
} | null {
  if (!input.payloads) return null;
  const requestedSource =
    input.requestedSource ??
    canvasImageResolutionSourceFromLegacyKind(
      input.requestedKind ?? "original",
    );
  const exactKey = canvasImageResolutionSourceCacheKey({
    workspaceId: input.workspaceId,
    canvasId: input.canvasId,
    assetId: input.assetId,
    source: requestedSource,
  });
  const prefix = `${input.workspaceId}/${input.canvasId}/${input.assetId}/`;
  const consider = (
    payload: CanvasCachedImagePayload | undefined,
    fallbackSource: CanvasImageResolutionSource,
    best: {
      source: CanvasImageResolutionSource;
      payload: CanvasCachedImagePayload;
    } | null,
  ): {
    source: CanvasImageResolutionSource;
    payload: CanvasCachedImagePayload;
  } | null => {
    if (!payload) return best;
    const source = runtimePayloadSource(payload, fallbackSource);
    const rank = source.type === "original" ? Infinity : source.targetMaxEdge;
    const bestRank =
      best?.source.type === "original"
        ? Infinity
        : (best?.source.targetMaxEdge ?? -1);
    return !best || rank > bestRank ? { source, payload } : best;
  };
  const exact = input.payloads.get(exactKey);
  if (exact)
    return {
      source: runtimePayloadSource(exact, requestedSource),
      payload: exact,
      exact: true,
      kind: canvasImageLegacyKindFromResolutionSource(requestedSource),
    };
  const legacyKind = canvasImageLegacyKindFromResolutionSource(requestedSource);
  const legacyExact = legacyKind
    ? input.payloads.get(`${prefix}${legacyKind}`)
    : undefined;
  if (legacyExact)
    return {
      source: runtimePayloadSource(legacyExact, requestedSource),
      payload: legacyExact,
      exact: true,
      kind: legacyKind,
    };
  const unscoped = input.payloads.get(input.assetId);
  if (unscoped)
    return {
      source: runtimePayloadSource(unscoped, requestedSource),
      payload: unscoped,
      exact: true,
      kind: canvasImageLegacyKindFromResolutionSource(requestedSource),
    };
  let best = null as {
    source: CanvasImageResolutionSource;
    payload: CanvasCachedImagePayload;
  } | null;
  for (const [key, payload] of input.payloads) {
    if (!key.startsWith(prefix)) continue;
    const suffix = key.slice(prefix.length);
    const edge = suffix.startsWith("edge-")
      ? Number(suffix.slice("edge-".length))
      : null;
    const fallbackSource =
      suffix === "original"
        ? { type: "original" as const }
        : edge !== null && isCanvasImagePyramidTargetMaxEdge(edge)
          ? { type: "variant" as const, targetMaxEdge: edge }
          : null;
    if (!fallbackSource) continue;
    best = consider(payload, fallbackSource, best);
  }
  return best
    ? {
        ...best,
        exact: false,
        kind: canvasImageLegacyKindFromResolutionSource(best.source),
      }
    : null;
}

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
    width: size.width,
    height: size.height,
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
  resolutionSource: CanvasImageResolutionSource = { type: "original" },
): CanvasImageFlowNode {
  return {
    id: node.id,
    type: CANVAS_IMAGE_NODE_TYPE,
    position: { ...node.position },
    width: node.size.width,
    height: node.size.height,
    style: { width: node.size.width, height: node.size.height },
    data: {
      assetId: record.id,
      mimeType: record.mimeType,
      intrinsicWidth: record.width,
      intrinsicHeight: record.height,
      objectUrl,
      source: "restored",
      resolutionSource,
      variantKind: canvasImageLegacyKindFromResolutionSource(resolutionSource),
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
      width: node.size.width,
      height: node.size.height,
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
    width: input.size?.width ?? 320,
    height: input.size?.height ?? 220,
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
    width: input.size?.width ?? 300,
    height: input.size?.height ?? 150,
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
    if (dependencies.variantRepository && dependencies.canvasId) {
      void (dependencies.generateImageVariants ?? generateCanvasImageVariants)(
        record.blob,
        { width: record.width, height: record.height },
      )
        .then((variants) =>
          Promise.all(
            variants.map((variant) =>
              dependencies.variantRepository!.storeVariant({
                workspaceId: dependencies.workspaceId,
                canvasId: dependencies.canvasId!,
                assetId: record.id,
                kind: variant.kind,
                storagePath: `${dependencies.workspaceId}/${dependencies.canvasId}/${record.id}/${variant.kind}.webp`,
                mimeType: "image/webp",
                byteSize: variant.blob.size,
                pixelWidth: variant.pixelWidth,
                pixelHeight: variant.pixelHeight,
                createdAt: new Date().toISOString(),
                blob: variant.blob,
              }),
            ),
          ),
        )
        .catch((error: unknown) => {
          dependencies.onVariantError?.(error);
        });
    }
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
  const loadScope = {
    userId: dependencies.userId,
    workspaceId: dependencies.workspaceId,
    canvasId: dependencies.canvasId ?? "",
  };
  let variantCatalogue:
    ReadonlyMap<string, readonly CanvasAssetVariantV2Metadata[]> | undefined;
  let legacyVariantCatalogue:
    ReadonlyMap<string, readonly CanvasAssetVariantMetadata[]> | undefined;
  if (
    dependencies.variantRepository?.listVariantTiersForAssets &&
    dependencies.canvasId
  ) {
    try {
      const assetIds = imageNodes.map((node) => node.assetId);
      const load = () =>
        dependencies.variantRepository!.listVariantTiersForAssets!({
          workspaceId: dependencies.workspaceId,
          canvasId: dependencies.canvasId!,
          assetIds,
        });
      variantCatalogue = dependencies.loadCache
        ? await dependencies.loadCache.tierCatalogue(loadScope, assetIds, load)
        : await load();
    } catch (error: unknown) {
      options.onVariantError?.(error);
    }
  }
  if (
    !variantCatalogue &&
    dependencies.variantRepository?.listVariantsForAssets &&
    dependencies.canvasId
  ) {
    try {
      const assetIds = imageNodes.map((node) => node.assetId);
      const load = () =>
        dependencies.variantRepository!.listVariantsForAssets!({
          workspaceId: dependencies.workspaceId,
          canvasId: dependencies.canvasId!,
          assetIds,
        });
      legacyVariantCatalogue = dependencies.loadCache
        ? await dependencies.loadCache.catalogue(loadScope, assetIds, load)
        : await load();
    } catch (error: unknown) {
      options.onVariantError?.(error);
    }
  }
  const variantLoads = new Map<
    string,
    ReturnType<CanvasAssetVariantV2Repository["loadVariantTier"]>
  >();
  const legacyVariantLoads = new Map<
    string,
    ReturnType<CanvasAssetVariantRepository["loadVariant"]>
  >();
  const assetLoads = new Map<
    string,
    ReturnType<CanvasAssetRepository["loadAsset"]>
  >();
  const worker = async (): Promise<void> => {
    while (true) {
      const index = nextIndex++;
      if (index >= imageNodes.length) return;
      if (options.signal?.aborted) {
        staleIgnored = true;
        return;
      }
      const canonical = imageNodes[index];
      let availableVariants: readonly CanvasImagePyramidCandidate[] = [];
      if (
        dependencies.variantRepository?.listVariantTiers &&
        dependencies.canvasId
      ) {
        try {
          if (variantCatalogue) {
            availableVariants = (
              variantCatalogue.get(canonical.assetId) ?? []
            ).map((variant) => ({
              source: {
                type: "variant" as const,
                targetMaxEdge: variant.targetMaxEdge,
              },
              pixelWidth: variant.pixelWidth,
              pixelHeight: variant.pixelHeight,
            }));
          } else {
            const load = () =>
              dependencies.variantRepository!.listVariantTiers!({
                workspaceId: dependencies.workspaceId,
                canvasId: dependencies.canvasId!,
                assetId: canonical.assetId,
              });
            const tiers = dependencies.loadCache
              ? await dependencies.loadCache.tiersForAsset(
                  loadScope,
                  canonical.assetId,
                  load,
                )
              : await load();
            availableVariants = tiers.map((variant) => ({
              source: {
                type: "variant" as const,
                targetMaxEdge: variant.targetMaxEdge,
              },
              pixelWidth: variant.pixelWidth,
              pixelHeight: variant.pixelHeight,
            }));
          }
        } catch (error: unknown) {
          options.onVariantError?.(error);
          // Metadata is required to prove a smaller source is sufficient.
          // An empty list intentionally falls through to original.
          availableVariants = [];
        }
        if (options.signal?.aborted) {
          staleIgnored = true;
          return;
        }
      } else if (
        dependencies.variantRepository?.listVariants &&
        dependencies.canvasId
      ) {
        try {
          if (legacyVariantCatalogue) {
            availableVariants = (
              legacyVariantCatalogue.get(canonical.assetId) ?? []
            ).map(pyramidCandidateFromLegacyVariant);
          } else {
            const load = () =>
              dependencies.variantRepository!.listVariants({
                workspaceId: dependencies.workspaceId,
                canvasId: dependencies.canvasId!,
                assetId: canonical.assetId,
              });
            const variants = dependencies.loadCache
              ? await dependencies.loadCache.variantsForAsset(
                  loadScope,
                  canonical.assetId,
                  load,
                )
              : await load();
            availableVariants = variants.map(pyramidCandidateFromLegacyVariant);
          }
        } catch (error: unknown) {
          options.onVariantError?.(error);
        }
        if (options.signal?.aborted) {
          staleIgnored = true;
          return;
        }
      }
      const renderedCssSize = options.renderedCssSizes?.get(canonical.id);
      const selectedSource = chooseCanvasImageResolutionSource({
        nodeWidth: canonical.size.width,
        nodeHeight: canonical.size.height,
        viewportZoom: options.viewportZoom ?? 1,
        devicePixelRatio:
          options.devicePixelRatio ??
          (typeof window === "undefined" ? 1 : window.devicePixelRatio),
        ...(renderedCssSize === undefined
          ? {}
          : {
              renderedWidthCssPx: renderedCssSize.width,
              renderedHeightCssPx: renderedCssSize.height,
            }),
        currentSource: options.currentResolutionSources?.get(canonical.id),
        candidates: availableVariants,
        allowDowngrade: options.allowDowngrade,
      });
      const cachedPayload = findCachedCanvasImagePayload({
        payloads: options.cachedAssetPayloads,
        workspaceId: dependencies.workspaceId,
        canvasId: dependencies.canvasId ?? "",
        assetId: canonical.assetId,
        requestedSource: selectedSource,
      });
      if (cachedPayload) {
        const node: CanvasImageFlowNode = {
          id: canonical.id,
          type: CANVAS_IMAGE_NODE_TYPE,
          position: { ...canonical.position },
          width: canonical.size.width,
          height: canonical.size.height,
          style: { width: canonical.size.width, height: canonical.size.height },
          data: { assetId: canonical.assetId, ...cachedPayload.payload },
        };
        nodes[index] = node;
        options.onNode?.(node, index, imageNodes.length);
        if (cachedPayload.exact) continue;
      }
      if (
        selectedSource.type === "variant" &&
        dependencies.variantRepository?.loadVariantTier &&
        dependencies.canvasId
      ) {
        const variantKey = canvasImageResolutionSourceCacheKey({
          workspaceId: dependencies.workspaceId,
          canvasId: dependencies.canvasId,
          assetId: canonical.assetId,
          source: selectedSource,
        });
        let variantPromise = variantLoads.get(variantKey);
        if (!variantPromise) {
          const load = () =>
            dependencies.variantRepository!.loadVariantTier!({
              workspaceId: dependencies.workspaceId,
              canvasId: dependencies.canvasId!,
              assetId: canonical.assetId,
              targetMaxEdge: selectedSource.targetMaxEdge,
            });
          variantPromise = dependencies.loadCache
            ? dependencies.loadCache.variantTier(
                loadScope,
                canonical.assetId,
                selectedSource.targetMaxEdge,
                load,
              )
            : load();
          variantLoads.set(variantKey, variantPromise);
        }
        let variant: Awaited<typeof variantPromise> = null;
        try {
          variant = await variantPromise;
        } catch (error: unknown) {
          options.onVariantError?.(error);
          variant = null;
        }
        if (options.signal?.aborted) {
          staleIgnored = true;
          return;
        }
        if (variant) {
          const node = imageNodeForCanonical(
            canonical,
            {
              id: variant.assetId,
              workspaceId: variant.workspaceId,
              blob: variant.blob,
              preview: null,
              mimeType: variant.mimeType,
              byteSize: variant.byteSize,
              width: variant.pixelWidth,
              height: variant.pixelHeight,
              checksum: null,
              createdAt: variant.createdAt,
              readyAt: variant.createdAt,
              deletedAt: null,
            },
            dependencies.objectUrls.create(variant.blob),
            selectedSource,
          );
          nodes[index] = node;
          options.onNode?.(node, index, imageNodes.length);
          continue;
        }
      }
      if (
        selectedSource.type === "variant" &&
        !dependencies.variantRepository?.loadVariantTier &&
        dependencies.variantRepository?.loadVariant &&
        dependencies.canvasId
      ) {
        const kind = canvasImageLegacyKindFromResolutionSource(selectedSource);
        if (kind && kind !== "original") {
          const variantKey = canvasImageResolutionSourceCacheKey({
            workspaceId: dependencies.workspaceId,
            canvasId: dependencies.canvasId,
            assetId: canonical.assetId,
            source: selectedSource,
          });
          let variantPromise = legacyVariantLoads.get(variantKey);
          if (!variantPromise) {
            const load = () =>
              dependencies.variantRepository!.loadVariant({
                workspaceId: dependencies.workspaceId,
                canvasId: dependencies.canvasId!,
                assetId: canonical.assetId,
                kind,
              });
            variantPromise = dependencies.loadCache
              ? dependencies.loadCache.variant(
                  loadScope,
                  canonical.assetId,
                  kind,
                  load,
                )
              : load();
            legacyVariantLoads.set(variantKey, variantPromise);
          }
          let variant: Awaited<typeof variantPromise> = null;
          try {
            variant = await variantPromise;
          } catch (error: unknown) {
            options.onVariantError?.(error);
          }
          if (options.signal?.aborted) {
            staleIgnored = true;
            return;
          }
          if (variant) {
            const node = imageNodeForCanonical(
              canonical,
              {
                id: variant.assetId,
                workspaceId: variant.workspaceId,
                blob: variant.blob,
                preview: null,
                mimeType: variant.mimeType,
                byteSize: variant.byteSize,
                width: variant.pixelWidth,
                height: variant.pixelHeight,
                checksum: null,
                createdAt: variant.createdAt,
                readyAt: variant.createdAt,
                deletedAt: null,
              },
              dependencies.objectUrls.create(variant.blob),
              selectedSource,
            );
            nodes[index] = node;
            options.onNode?.(node, index, imageNodes.length);
            continue;
          }
        }
      }
      const assetKey = `${dependencies.workspaceId}/${canonical.assetId}`;
      let assetPromise = assetLoads.get(assetKey);
      if (!assetPromise) {
        activeReads += 1;
        maxConcurrentAssetReads = Math.max(
          maxConcurrentAssetReads,
          activeReads,
        );
        assetReadCount += 1;
        const load = () =>
          dependencies.assetRepository.loadAsset({
            workspaceId: dependencies.workspaceId,
            assetId: canonical.assetId,
          });
        assetPromise = dependencies.loadCache
          ? dependencies.loadCache.asset(loadScope, canonical.assetId, load)
          : load();
        assetLoads.set(assetKey, assetPromise);
        void assetPromise.then(
          () => {
            activeReads -= 1;
          },
          () => {
            activeReads -= 1;
          },
        );
      }
      const record = await assetPromise;
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
        { type: "original" },
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
