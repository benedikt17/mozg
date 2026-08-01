import type { Node } from "@xyflow/react";
import type {
  AcceptedCanvasImage,
  CanvasImageInputSource,
  CanvasImageTransferPayload,
  CanvasImageLabManifestStore,
  ObjectUrlRegistry,
  ExtractedCanvasImageTransfer,
  CanvasImageIngestionResult,
  DecodeImageDimensions,
} from "@/lib/canvas/canvas-image-ingestion";
import {
  extractCanvasImageTransfer,
  ingestCanvasImageCandidates,
} from "@/lib/canvas/canvas-image-ingestion";
import type {
  CanvasAssetRecord,
  CanvasAssetRepository,
} from "@/lib/canvas/local-canvas-repository";

export const CANVAS_REACT_FLOW_WORKSPACE_ID =
  "__mozg_canvas_react_flow_ingestion_spike__";
export const CANVAS_REACT_FLOW_DATABASE_NAME =
  "mozg-canvas-react-flow-ingestion-spike";
export const CANVAS_REACT_FLOW_MANIFEST_KEY =
  "mozg.canvas-react-flow-ingestion-spike.asset-ids.v1";
export const CANVAS_IMAGE_NODE_TYPE = "canvasImage";

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
  onPreviewReady?: (assetId: string) => void;
};

export type CanvasImageNode = Node<
  CanvasImageNodeData,
  typeof CANVAS_IMAGE_NODE_TYPE
>;

export type ReactFlowImageIngestionDependencies = {
  repository: CanvasAssetRepository;
  manifest: CanvasImageLabManifestStore;
  objectUrls: ObjectUrlRegistry;
  workspaceId?: string;
  decodeImageDimensions?: DecodeImageDimensions;
  idGenerator?: () => string;
  restorationCoordinator?: ReactFlowRestorationCoordinator;
  onPreviewReady?: (assetId: string) => void;
};

export type ReactFlowImageIngestion = {
  extracted: ExtractedCanvasImageTransfer;
  result: CanvasImageIngestionResult;
  nodes: CanvasImageNode[];
};

export type ReactFlowImageRestore = {
  nodes: CanvasImageNode[];
  missingAssetIds: string[];
  timings?: ReactFlowRestoreTimings;
};

export type ReactFlowRestoreTimings = {
  runId: number;
  manifestMs: number;
  nodeMetadataMs: number;
  firstNodeMs: number | null;
  allNodesMs: number;
  firstPreviewMs: number | null;
  allPreviewsMs: number | null;
  assetReadCount: number;
  maxConcurrentAssetReads: number;
  staleIgnored: boolean;
};

export type ReactFlowRestoreProgress = {
  node: CanvasImageNode;
  index: number;
  total: number;
  timings: ReactFlowRestoreTimings;
};

export type ReactFlowRestoreOptions = {
  concurrency?: number;
  runId?: number;
  signal?: AbortSignal;
  onNode?: (progress: ReactFlowRestoreProgress) => void;
  onPreviewReady?: (assetId: string) => void;
};

export type ReactFlowRestorationCoordinator = {
  loadAsset: (input: {
    workspaceId: string;
    assetId: string;
  }) => Promise<CanvasAssetRecord | null>;
  clear: () => void;
};

export function createReactFlowRestorationCoordinator(
  repository: CanvasAssetRepository,
): ReactFlowRestorationCoordinator {
  const completed = new Map<string, CanvasAssetRecord | null>();
  const inflight = new Map<string, Promise<CanvasAssetRecord | null>>();
  return {
    loadAsset(input) {
      const cacheKey = `${input.workspaceId}\u0000${input.assetId}`;
      if (completed.has(cacheKey))
        return Promise.resolve(completed.get(cacheKey) ?? null);
      const current = inflight.get(cacheKey);
      if (current) return current;
      const request = repository.loadAsset(input).then((record) => {
        completed.set(cacheKey, record);
        inflight.delete(cacheKey);
        return record;
      });
      inflight.set(cacheKey, request);
      return request;
    },
    clear() {
      completed.clear();
      inflight.clear();
    },
  };
}

function initialSize(
  width: number,
  height: number,
): {
  width: number;
  height: number;
} {
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

export function staggeredFlowPosition(
  base: FlowPosition,
  index: number,
): FlowPosition {
  return {
    x: base.x + index * NODE_STAGGER,
    y: base.y + index * NODE_STAGGER,
  };
}

export function createCanvasImageNode(input: {
  record: CanvasAssetRecord;
  objectUrl: string;
  position: FlowPosition;
  source: CanvasImageNodeData["source"];
  index?: number;
  onPreviewReady?: (assetId: string) => void;
}): CanvasImageNode {
  const size = initialSize(input.record.width, input.record.height);
  return {
    id: `react-flow-image-${input.record.id}`,
    type: CANVAS_IMAGE_NODE_TYPE,
    position: staggeredFlowPosition(input.position, input.index ?? 0),
    style: { width: size.width, height: size.height },
    data: {
      assetId: input.record.id,
      mimeType: input.record.mimeType,
      intrinsicWidth: input.record.width,
      intrinsicHeight: input.record.height,
      objectUrl: input.objectUrl,
      source: input.source,
      onPreviewReady: input.onPreviewReady,
    },
  };
}

async function nodeForAsset(
  accepted: AcceptedCanvasImage,
  position: FlowPosition,
  index: number,
  source: CanvasImageNodeData["source"],
  dependencies: ReactFlowImageIngestionDependencies,
): Promise<CanvasImageNode | null> {
  const record = await dependencies.repository.loadAsset({
    workspaceId: dependencies.workspaceId ?? CANVAS_REACT_FLOW_WORKSPACE_ID,
    assetId: accepted.assetId,
  });
  if (!record) return null;
  dependencies.manifest.add(record.id);
  return createCanvasImageNode({
    record,
    objectUrl: dependencies.objectUrls.create(record.blob),
    position,
    source,
    index,
    onPreviewReady: dependencies.onPreviewReady,
  });
}

export async function ingestReactFlowTransfer(
  payload: CanvasImageTransferPayload,
  source: CanvasImageInputSource,
  position: FlowPosition,
  dependencies: ReactFlowImageIngestionDependencies,
): Promise<ReactFlowImageIngestion> {
  const extracted = extractCanvasImageTransfer(payload, source);
  const result = await ingestCanvasImageCandidates(extracted.candidates, {
    repository: dependencies.repository,
    workspaceId: dependencies.workspaceId ?? CANVAS_REACT_FLOW_WORKSPACE_ID,
    decodeImageDimensions: dependencies.decodeImageDimensions,
    idGenerator: dependencies.idGenerator,
  });
  const nodes: CanvasImageNode[] = [];
  for (const [index, accepted] of result.accepted.entries()) {
    const node = await nodeForAsset(
      accepted,
      position,
      index,
      source,
      dependencies,
    );
    if (node) nodes.push(node);
  }
  return { extracted, result, nodes };
}

function restoreNow(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

export async function restoreReactFlowImageNodesProgressive(
  dependencies: ReactFlowImageIngestionDependencies,
  position: FlowPosition,
  options: ReactFlowRestoreOptions = {},
): Promise<ReactFlowImageRestore> {
  const startedAt = restoreNow();
  const runId = options.runId ?? 1;
  const idsStartedAt = restoreNow();
  const assetIds = dependencies.manifest.list();
  const manifestMs = restoreNow() - idsStartedAt;
  const total = assetIds.length;
  const concurrency = Math.max(
    1,
    Math.min(Math.floor(options.concurrency ?? 4), total || 1),
  );
  const nodes: Array<CanvasImageNode | undefined> = [];
  const missingAssetIds: string[] = [];
  let nextIndex = 0;
  let activeReads = 0;
  let maxConcurrentAssetReads = 0;
  let assetReadCount = 0;
  let firstNodeMs: number | null = null;
  const firstPreviewMs: number | null = null;
  let staleIgnored = false;
  const nodeMetadataStartedAt = restoreNow();
  const timings: ReactFlowRestoreTimings = {
    runId,
    manifestMs,
    nodeMetadataMs: 0,
    firstNodeMs: null,
    allNodesMs: 0,
    firstPreviewMs: null,
    allPreviewsMs: null,
    assetReadCount: 0,
    maxConcurrentAssetReads: 0,
    staleIgnored: false,
  };
  const loadAsset =
    dependencies.restorationCoordinator?.loadAsset ??
    ((input: { workspaceId: string; assetId: string }) =>
      dependencies.repository.loadAsset(input));
  const worker = async (): Promise<void> => {
    while (true) {
      const index = nextIndex++;
      if (index >= total) return;
      if (options.signal?.aborted) {
        staleIgnored = true;
        return;
      }
      activeReads += 1;
      maxConcurrentAssetReads = Math.max(maxConcurrentAssetReads, activeReads);
      let record: CanvasAssetRecord | null;
      try {
        record = await loadAsset({
          workspaceId:
            dependencies.workspaceId ?? CANVAS_REACT_FLOW_WORKSPACE_ID,
          assetId: assetIds[index],
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
        missingAssetIds.push(assetIds[index]);
        continue;
      }
      const objectUrl = dependencies.objectUrls.create(record.blob);
      const node = createCanvasImageNode({
        record,
        objectUrl,
        position,
        source: "restored",
        index,
        onPreviewReady: options.onPreviewReady,
      });
      nodes[index] = node;
      if (firstNodeMs === null) firstNodeMs = restoreNow() - startedAt;
      timings.firstNodeMs = firstNodeMs;
      timings.firstPreviewMs = firstPreviewMs;
      timings.assetReadCount = assetReadCount;
      timings.maxConcurrentAssetReads = maxConcurrentAssetReads;
      options.onNode?.({ node, index, total, timings: { ...timings } });
    }
  };
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  if (options.signal?.aborted) staleIgnored = true;
  timings.nodeMetadataMs = restoreNow() - nodeMetadataStartedAt;
  timings.allNodesMs = restoreNow() - startedAt;
  timings.firstNodeMs = firstNodeMs;
  timings.firstPreviewMs = firstPreviewMs;
  timings.allPreviewsMs =
    firstPreviewMs === null ? null : restoreNow() - startedAt;
  timings.assetReadCount = assetReadCount;
  timings.maxConcurrentAssetReads = maxConcurrentAssetReads;
  timings.staleIgnored = staleIgnored;
  return {
    nodes: nodes.filter((node): node is CanvasImageNode => node !== undefined),
    missingAssetIds,
    timings,
  };
}

export async function restoreReactFlowImageNodes(
  dependencies: ReactFlowImageIngestionDependencies,
  position: FlowPosition,
): Promise<ReactFlowImageRestore> {
  return restoreReactFlowImageNodesProgressive(dependencies, position);
}

export async function removeReactFlowImageNode(
  node: CanvasImageNode,
  dependencies: ReactFlowImageIngestionDependencies,
): Promise<void> {
  dependencies.objectUrls.revoke(node.data.objectUrl);
  await dependencies.repository.markAssetDeleted({
    workspaceId: dependencies.workspaceId ?? CANVAS_REACT_FLOW_WORKSPACE_ID,
    assetId: node.data.assetId,
  });
  dependencies.manifest.remove(node.data.assetId);
}

export async function clearReactFlowImageAssets(
  nodes: readonly CanvasImageNode[],
  dependencies: ReactFlowImageIngestionDependencies,
): Promise<void> {
  for (const node of nodes) {
    dependencies.objectUrls.revoke(node.data.objectUrl);
    await dependencies.repository.markAssetDeleted({
      workspaceId: dependencies.workspaceId ?? CANVAS_REACT_FLOW_WORKSPACE_ID,
      assetId: node.data.assetId,
    });
  }
  dependencies.manifest.clear();
}
