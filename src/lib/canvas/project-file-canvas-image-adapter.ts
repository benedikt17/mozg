import type { ObjectUrlRegistry } from "@/lib/canvas/canvas-image-ingestion";
import {
  canvasImageLegacyKindFromResolutionSource,
  type CanvasImageResolutionSource,
} from "@/lib/canvas/canvas-image-variants";
import type {
  CanvasDocument,
  CanvasProjectFileImageNode,
  CanvasSize,
} from "@/lib/canvas/canvas-document";
import {
  CANVAS_IMAGE_NODE_TYPE,
  findCachedCanvasImagePayload,
  type CanvasImageFlowNode,
  type FlowPosition,
} from "@/lib/canvas/react-flow-canvas-adapter";
import {
  chooseProjectFilePreviewVariant,
  type ProjectFileImageVariantRepository,
} from "@/lib/files/project-file-image-variants";
import {
  isProjectFileImageMimeType,
  type ProjectFileRecord,
  type ProjectFileRepository,
} from "@/lib/files/project-file-repository";

const MAX_INITIAL_WIDTH = 640;
const MAX_INITIAL_HEIGHT = 480;
const MIN_INITIAL_WIDTH = 160;
const MIN_INITIAL_HEIGHT = 120;
const QUALITY_SAFETY_FACTOR = 1.2;

export type ProjectFileCanvasImageDependencies = {
  fileRepository: ProjectFileRepository;
  variantRepository: ProjectFileImageVariantRepository;
  objectUrls: ObjectUrlRegistry;
  workspaceId: string;
  projectId: string;
  canvasId: string;
};

export type RestoreProjectFileCanvasImageOptions = {
  cachedAssetPayloads?: ReadonlyMap<
    string,
    {
      objectUrl: string;
      mimeType: string;
      intrinsicWidth: number;
      intrinsicHeight: number;
      source: CanvasImageFlowNode["data"]["source"];
      variantKind?: CanvasImageFlowNode["data"]["variantKind"];
      resolutionSource?: CanvasImageResolutionSource;
    }
  >;
  viewportZoom?: number;
  devicePixelRatio?: number;
  renderedCssSizes?: ReadonlyMap<string, { width: number; height: number }>;
  currentResolutionSources?: ReadonlyMap<string, CanvasImageResolutionSource>;
  allowDowngrade?: boolean;
  signal?: AbortSignal;
  concurrency?: number;
  onNode?: (node: CanvasImageFlowNode, index: number, total: number) => void;
};

export type RestoreProjectFileCanvasImageResult = {
  nodes: CanvasImageFlowNode[];
  missingFileIds: string[];
  fileReadCount: number;
  maxConcurrentFileReads: number;
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

function nextNodeId(
  idGenerator: () => string = () =>
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`,
): string {
  return `file-node-${idGenerator()}`;
}

export function createCanvasProjectFileImageNode(input: {
  file: ProjectFileRecord;
  position: FlowPosition;
  zIndex: number;
  idGenerator?: () => string;
}): CanvasProjectFileImageNode {
  if (
    input.file.readyAt === null ||
    input.file.deletedAt !== null ||
    !isProjectFileImageMimeType(input.file.mimeType) ||
    input.file.width === null ||
    input.file.height === null
  ) {
    throw new Error("Project File image is unavailable.");
  }

  return {
    id: nextNodeId(input.idGenerator),
    kind: "image",
    fileId: input.file.id,
    position: { ...input.position },
    size: initialSize(input.file.width, input.file.height),
    zIndex: input.zIndex,
    aspectRatioLocked: true,
  };
}

function requiredMaxEdge(
  node: CanvasProjectFileImageNode,
  options: RestoreProjectFileCanvasImageOptions,
): number {
  const rendered = options.renderedCssSizes?.get(node.id);
  const width =
    rendered?.width ?? node.size.width * (options.viewportZoom ?? 1);
  const height =
    rendered?.height ?? node.size.height * (options.viewportZoom ?? 1);
  const dpr =
    options.devicePixelRatio ??
    (typeof window === "undefined" ? 1 : window.devicePixelRatio);
  return Math.max(
    1,
    Math.ceil(
      Math.max(width, height) * Math.max(1, dpr) * QUALITY_SAFETY_FACTOR,
    ),
  );
}

function abortError(): Error {
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}

function runtimeNode(
  node: CanvasProjectFileImageNode,
  file: ProjectFileRecord,
  objectUrl: string,
  mimeType: string,
  source: CanvasImageResolutionSource,
): CanvasImageFlowNode {
  return {
    id: node.id,
    type: CANVAS_IMAGE_NODE_TYPE,
    position: { ...node.position },
    width: node.size.width,
    height: node.size.height,
    style: { width: node.size.width, height: node.size.height },
    zIndex: node.zIndex,
    data: {
      assetId: file.id,
      fileId: file.id,
      mimeType,
      intrinsicWidth: file.width as number,
      intrinsicHeight: file.height as number,
      objectUrl,
      source: "restored",
      resolutionSource: source,
      variantKind: canvasImageLegacyKindFromResolutionSource(source),
    },
  };
}

async function hydrateOne(
  node: CanvasProjectFileImageNode,
  dependencies: ProjectFileCanvasImageDependencies,
  options: RestoreProjectFileCanvasImageOptions,
): Promise<CanvasImageFlowNode | null> {
  if (options.signal?.aborted) throw abortError();

  const file = await dependencies.fileRepository.getFile({
    workspaceId: dependencies.workspaceId,
    projectId: dependencies.projectId,
    fileId: node.fileId,
  });
  if (
    file.readyAt === null ||
    file.deletedAt !== null ||
    !isProjectFileImageMimeType(file.mimeType) ||
    file.width === null ||
    file.height === null
  ) {
    return null;
  }

  const variants = await dependencies.variantRepository.listImageVariants({
    workspaceId: dependencies.workspaceId,
    projectId: dependencies.projectId,
    fileId: file.id,
  });
  let variant = chooseProjectFilePreviewVariant(
    variants,
    requiredMaxEdge(node, options),
  );
  const current = options.currentResolutionSources?.get(node.id);
  if (
    !options.allowDowngrade &&
    current?.type === "variant" &&
    (variant === null || current.targetMaxEdge > variant.targetMaxEdge)
  ) {
    const retained = variants.find(
      (candidate) => candidate.targetMaxEdge === current.targetMaxEdge,
    );
    if (retained) variant = retained;
  }

  const requestedSource: CanvasImageResolutionSource = variant
    ? { type: "variant", targetMaxEdge: variant.targetMaxEdge }
    : { type: "original" };
  const cached = findCachedCanvasImagePayload({
    payloads: options.cachedAssetPayloads,
    workspaceId: dependencies.workspaceId,
    canvasId: dependencies.canvasId,
    assetId: file.id,
    requestedSource,
  });
  if (cached?.exact) {
    return runtimeNode(
      node,
      file,
      cached.payload.objectUrl,
      cached.payload.mimeType,
      cached.source,
    );
  }

  if (variant) {
    try {
      const loaded = await dependencies.variantRepository.loadImageVariant({
        workspaceId: dependencies.workspaceId,
        projectId: dependencies.projectId,
        fileId: file.id,
        targetMaxEdge: variant.targetMaxEdge,
      });
      if (loaded) {
        return runtimeNode(
          node,
          file,
          dependencies.objectUrls.create(loaded.blob),
          loaded.mimeType,
          requestedSource,
        );
      }
    } catch {
      // Derivatives are disposable cache; immutable original is the fallback.
    }
  }

  const originalSource: CanvasImageResolutionSource = { type: "original" };
  const cachedOriginal = findCachedCanvasImagePayload({
    payloads: options.cachedAssetPayloads,
    workspaceId: dependencies.workspaceId,
    canvasId: dependencies.canvasId,
    assetId: file.id,
    requestedSource: originalSource,
  });
  if (cachedOriginal?.exact) {
    return runtimeNode(
      node,
      file,
      cachedOriginal.payload.objectUrl,
      cachedOriginal.payload.mimeType,
      cachedOriginal.source,
    );
  }

  const download = await dependencies.fileRepository.downloadFile({
    workspaceId: dependencies.workspaceId,
    projectId: dependencies.projectId,
    fileId: file.id,
  });
  return runtimeNode(
    node,
    file,
    dependencies.objectUrls.create(download.blob),
    file.mimeType,
    originalSource,
  );
}

export async function restoreProjectFileCanvasImageNodes(
  document: CanvasDocument,
  dependencies: ProjectFileCanvasImageDependencies,
  options: RestoreProjectFileCanvasImageOptions = {},
): Promise<RestoreProjectFileCanvasImageResult> {
  const imageNodes = document.nodes.filter(
    (node): node is CanvasProjectFileImageNode =>
      node.kind === "image" && "fileId" in node,
  );
  const total = imageNodes.length;
  if (total === 0) {
    return {
      nodes: [],
      missingFileIds: [],
      fileReadCount: 0,
      maxConcurrentFileReads: 0,
    };
  }

  const concurrency = Math.max(
    1,
    Math.min(Math.floor(options.concurrency ?? 4), total),
  );
  const nodes: Array<CanvasImageFlowNode | undefined> = new Array(total);
  const missingFileIds: string[] = [];
  let nextIndex = 0;
  let activeReads = 0;
  let maxConcurrentFileReads = 0;
  let fileReadCount = 0;

  async function worker(): Promise<void> {
    while (true) {
      if (options.signal?.aborted) throw abortError();
      const index = nextIndex++;
      if (index >= total) return;
      const canonical = imageNodes[index]!;
      activeReads += 1;
      maxConcurrentFileReads = Math.max(maxConcurrentFileReads, activeReads);
      fileReadCount += 1;
      try {
        const node = await hydrateOne(canonical, dependencies, options);
        if (options.signal?.aborted) throw abortError();
        if (!node) {
          missingFileIds.push(canonical.fileId);
          continue;
        }
        nodes[index] = node;
        options.onNode?.(node, index, total);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw error;
        missingFileIds.push(canonical.fileId);
      } finally {
        activeReads -= 1;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return {
    nodes: nodes.filter(
      (node): node is CanvasImageFlowNode => node !== undefined,
    ),
    missingFileIds,
    fileReadCount,
    maxConcurrentFileReads,
  };
}
