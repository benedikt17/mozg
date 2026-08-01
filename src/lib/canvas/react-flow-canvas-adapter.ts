import type { Node } from "@xyflow/react";
import {
  parseCanvasDocumentV1,
  type CanvasDocumentV1,
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

export const CANVAS_IMAGE_NODE_TYPE = "canvasImage";
export const CANVAS_TEXT_NODE_TYPE = "canvasText";
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

export type CanvasFlowNode = CanvasImageFlowNode | CanvasTextFlowNode;

export type CanvasImageAdapterDependencies = {
  assetRepository: CanvasAssetRepository;
  objectUrls: ObjectUrlRegistry;
  workspaceId: string;
  decodeImageDimensions?: DecodeImageDimensions;
  idGenerator?: () => string;
};

export type RestoreCanvasImageOptions = {
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
  document: CanvasDocumentV1;
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
  document: CanvasDocumentV1,
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

export function canvasDocumentToTextNodes(
  document: CanvasDocumentV1,
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

export function imageNodesToCanvasDocument(
  source: CanvasDocumentV1,
  nodes: readonly CanvasImageFlowNode[],
): CanvasDocumentV1 {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const nextNodes: CanvasNode[] = source.nodes.map((canonical) => {
    if (canonical.kind !== "image") return { ...canonical } as CanvasNode;
    const runtime = byId.get(canonical.id);
    if (!runtime)
      return {
        ...canonical,
        position: { ...canonical.position },
        size: { ...canonical.size },
      };
    return {
      ...canonical,
      position: { ...runtime.position },
      size: nodeSize(runtime),
    };
  });
  return parseCanvasDocumentV1({
    schemaVersion: source.schemaVersion,
    nodes: nextNodes,
    edges: source.edges.map((edge) => ({ ...edge })),
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
  source: CanvasDocumentV1,
  nodes: readonly CanvasFlowNode[],
): CanvasDocumentV1 {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const nextNodes: CanvasNode[] = source.nodes.map((canonical) => {
    const runtime = byId.get(canonical.id);
    if (!runtime) return { ...canonical } as CanvasNode;
    if (canonical.kind === "image" && runtime.type === CANVAS_IMAGE_NODE_TYPE) {
      return {
        ...canonical,
        position: { ...runtime.position },
        size: runtimeNodeSize(runtime),
      };
    }
    if (canonical.kind === "text" && runtime.type === CANVAS_TEXT_NODE_TYPE) {
      return {
        ...canonical,
        markdown: runtime.data.markdown,
        position: { ...runtime.position },
        size: runtimeNodeSize(runtime),
      };
    }
    return { ...canonical } as CanvasNode;
  });
  return parseCanvasDocumentV1({
    schemaVersion: source.schemaVersion,
    nodes: nextNodes,
    edges: source.edges.map((edge) => ({ ...edge })),
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
  document: CanvasDocumentV1,
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
