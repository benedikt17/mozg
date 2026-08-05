import type {
  CanvasAssetRecord,
  CanvasAssetRepository,
} from "@/lib/canvas/local-canvas-repository";

export const CANVAS_IMAGE_THUMBNAIL_MAX_EDGE = 512;
export const CANVAS_IMAGE_PREVIEW_MAX_EDGE = 2560;
/**
 * The V2 pyramid is intentionally configuration, not a database enum. New
 * levels may be introduced without changing the storage schema.
 */
export const CANVAS_IMAGE_PYRAMID_RECOMMENDED_TARGET_MAX_EDGES = [
  256, 512, 1024, 2048, 4096,
] as const;
export const CANVAS_IMAGE_PYRAMID_MAX_TARGET_MAX_EDGE = 10_000;
export const CANVAS_IMAGE_VARIANT_MIME_TYPE = "image/webp" as const;
export const CANVAS_IMAGE_VARIANT_QUALITY = 0.82;
export const CANVAS_IMAGE_VARIANT_HYSTERESIS = 0.15;
/**
 * Keeps a decoded source slightly ahead of the physical screen requirement.
 * 1.2 absorbs fractional transforms and browser resampling without making
 * preview/original selection unnecessarily eager.
 */
export const CANVAS_IMAGE_VARIANT_QUALITY_SAFETY_FACTOR = 1.2;
export const CANVAS_IMAGE_VARIANT_ALPHA_POLICY = "preserve" as const;
export const CANVAS_IMAGE_VARIANT_ORIENTATION_POLICY =
  "respect-image-metadata" as const;

export type CanvasAssetVariantKind = "thumbnail" | "preview";
export type CanvasImageSourceKind = CanvasAssetVariantKind | "original";
export type CanvasImagePyramidTargetMaxEdge = number;

/** Runtime-only identity. It never enters CanvasDocumentV2. */
export type CanvasImageResolutionSource =
  | { type: "variant"; targetMaxEdge: CanvasImagePyramidTargetMaxEdge }
  | { type: "original" };

export type CanvasImagePyramidCandidate = {
  source: Extract<CanvasImageResolutionSource, { type: "variant" }>;
  pixelWidth: number;
  pixelHeight: number;
};

export type CanvasImageVariantCandidate = {
  kind: CanvasAssetVariantKind;
  pixelWidth: number;
  pixelHeight: number;
};

export type CanvasImageRequiredPixels = {
  width: number;
  height: number;
  renderedWidthCssPx: number;
  renderedHeightCssPx: number;
  devicePixelRatio: number;
};

export function isCanvasImageVariantDimensionContractValid(input: {
  kind: CanvasAssetVariantKind;
  pixelWidth: number;
  pixelHeight: number;
  originalWidth: number;
  originalHeight: number;
}): boolean {
  if (
    input.pixelWidth <= 0 ||
    input.pixelHeight <= 0 ||
    input.pixelWidth > input.originalWidth ||
    input.pixelHeight > input.originalHeight
  )
    return false;
  const maxEdge = maxEdgeFor(input.kind);
  if (Math.max(input.pixelWidth, input.pixelHeight) > maxEdge) return false;
  // Equivalent to the former ratio check, but avoids rejecting valid rounded
  // dimensions at the exact one-pixel tolerance boundary due to IEEE-754
  // division rounding (for example, 1200×400 -> 512×171).
  return (
    Math.abs(
      input.pixelWidth * input.originalHeight -
        input.originalWidth * input.pixelHeight,
    ) <= input.originalHeight
  );
}

export type CanvasAssetVariantMetadata = {
  workspaceId: string;
  canvasId: string;
  assetId: string;
  kind: CanvasAssetVariantKind;
  storagePath: string;
  mimeType: typeof CANVAS_IMAGE_VARIANT_MIME_TYPE;
  byteSize: number;
  pixelWidth: number;
  pixelHeight: number;
  createdAt: string;
};

export type CanvasAssetVariantRecord = CanvasAssetVariantMetadata & {
  blob: Blob;
};

export type StoreCanvasAssetVariantInput = CanvasAssetVariantMetadata & {
  blob: Blob;
};

export type CanvasAssetVariantV2Metadata = {
  workspaceId: string;
  canvasId: string;
  assetId: string;
  targetMaxEdge: CanvasImagePyramidTargetMaxEdge;
  storagePath: string;
  mimeType: typeof CANVAS_IMAGE_VARIANT_MIME_TYPE;
  byteSize: number;
  pixelWidth: number;
  pixelHeight: number;
  createdAt: string;
};

export type CanvasAssetVariantV2Record = CanvasAssetVariantV2Metadata & {
  blob: Blob;
};

export type StoreCanvasAssetVariantV2Input = CanvasAssetVariantV2Metadata & {
  blob: Blob;
};

export interface CanvasAssetVariantRepository {
  listVariants(input: {
    workspaceId: string;
    canvasId: string;
    assetId: string;
  }): Promise<CanvasAssetVariantMetadata[]>;
  listVariantsForAssets?(input: {
    workspaceId: string;
    canvasId: string;
    assetIds: readonly string[];
  }): Promise<ReadonlyMap<string, readonly CanvasAssetVariantMetadata[]>>;
  loadVariant(input: {
    workspaceId: string;
    canvasId: string;
    assetId: string;
    kind: CanvasAssetVariantKind;
  }): Promise<CanvasAssetVariantRecord | null>;
  storeVariant(
    input: StoreCanvasAssetVariantInput,
  ): Promise<CanvasAssetVariantMetadata>;
  deleteVariants(input: {
    workspaceId: string;
    canvasId: string;
    assetId: string;
  }): Promise<void>;
}

/**
 * Additive V2 contract. It deliberately has no runtime-selection semantics;
 * production selection continues to use the legacy kind-based interface.
 */
export interface CanvasAssetVariantV2Repository {
  listVariantTiers(input: {
    workspaceId: string;
    canvasId: string;
    assetId: string;
  }): Promise<CanvasAssetVariantV2Metadata[]>;
  listVariantTiersForAssets?(input: {
    workspaceId: string;
    canvasId: string;
    assetIds: readonly string[];
  }): Promise<ReadonlyMap<string, readonly CanvasAssetVariantV2Metadata[]>>;
  loadVariantTier(input: {
    workspaceId: string;
    canvasId: string;
    assetId: string;
    targetMaxEdge: CanvasImagePyramidTargetMaxEdge;
  }): Promise<CanvasAssetVariantV2Record | null>;
  storeVariantTier(
    input: StoreCanvasAssetVariantV2Input,
  ): Promise<CanvasAssetVariantV2Metadata>;
}

export type GeneratedCanvasImageVariant = {
  kind: CanvasAssetVariantKind;
  blob: Blob;
  pixelWidth: number;
  pixelHeight: number;
};

export type CanvasImageVariantGenerator = (
  blob: Blob,
  dimensions: { width: number; height: number },
  signal?: AbortSignal,
) => Promise<GeneratedCanvasImageVariant[]>;

export type GeneratedCanvasImagePyramidTier = {
  targetMaxEdge: CanvasImagePyramidTargetMaxEdge;
  blob: Blob;
  pixelWidth: number;
  pixelHeight: number;
};

/** Generates every requested derivative from one decoded original source. */
export type CanvasImagePyramidGenerator = (
  blob: Blob,
  dimensions: { width: number; height: number },
  targetMaxEdges: readonly number[],
  signal?: AbortSignal,
) => Promise<GeneratedCanvasImagePyramidTier[]>;

/** Streams completed numeric tiers without retaining every encoded Blob in memory. */
export type CanvasImagePyramidTierConsumer = (
  tier: GeneratedCanvasImagePyramidTier,
) => Promise<void> | void;

export function canvasImageVariantCacheKey(input: {
  workspaceId: string;
  canvasId: string;
  assetId: string;
  kind: CanvasImageSourceKind;
}): string {
  return [input.workspaceId, input.canvasId, input.assetId, input.kind].join(
    "/",
  );
}

export function isCanvasImagePyramidTargetMaxEdge(
  value: unknown,
): value is CanvasImagePyramidTargetMaxEdge {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= CANVAS_IMAGE_PYRAMID_MAX_TARGET_MAX_EDGE
  );
}

export function canvasImagePyramidTierStorageName(
  targetMaxEdge: CanvasImagePyramidTargetMaxEdge,
): string {
  if (!isCanvasImagePyramidTargetMaxEdge(targetMaxEdge)) {
    throw new Error("Canvas image pyramid target_max_edge is invalid.");
  }
  return `edge-${targetMaxEdge}`;
}

export function canvasImagePyramidTierStoragePath(input: {
  workspaceId: string;
  canvasId: string;
  assetId: string;
  targetMaxEdge: CanvasImagePyramidTargetMaxEdge;
}): string {
  return [
    input.workspaceId,
    input.canvasId,
    input.assetId,
    `${canvasImagePyramidTierStorageName(input.targetMaxEdge)}.webp`,
  ].join("/");
}

export function canvasImagePyramidTierCacheKey(input: {
  workspaceId: string;
  canvasId: string;
  assetId: string;
  targetMaxEdge: CanvasImagePyramidTargetMaxEdge;
}): string {
  return [
    input.workspaceId,
    input.canvasId,
    input.assetId,
    canvasImagePyramidTierStorageName(input.targetMaxEdge),
  ].join("/");
}

export function canvasImageResolutionSourceCacheKey(input: {
  workspaceId: string;
  canvasId: string;
  assetId: string;
  source: CanvasImageResolutionSource;
}): string {
  return [
    input.workspaceId,
    input.canvasId,
    input.assetId,
    input.source.type === "original"
      ? "original"
      : canvasImagePyramidTierStorageName(input.source.targetMaxEdge),
  ].join("/");
}

export function canvasImageResolutionSourceFromLegacyKind(
  kind: CanvasImageSourceKind | undefined,
): CanvasImageResolutionSource {
  return kind === "thumbnail"
    ? { type: "variant", targetMaxEdge: 512 }
    : kind === "preview"
      ? { type: "variant", targetMaxEdge: 2560 }
      : { type: "original" };
}

export function canvasImageLegacyKindFromResolutionSource(
  source: CanvasImageResolutionSource,
): CanvasAssetVariantKind | "original" | undefined {
  if (source.type === "original") return "original";
  return source.targetMaxEdge === 512
    ? "thumbnail"
    : source.targetMaxEdge === 2560
      ? "preview"
      : undefined;
}

function sourceResolution(source: CanvasImageResolutionSource): number {
  return source.type === "original"
    ? Number.POSITIVE_INFINITY
    : source.targetMaxEdge;
}

function isValidPyramidCandidate(
  candidate: CanvasImagePyramidCandidate,
): boolean {
  return (
    isCanvasImagePyramidTargetMaxEdge(candidate.source.targetMaxEdge) &&
    Number.isSafeInteger(candidate.pixelWidth) &&
    Number.isSafeInteger(candidate.pixelHeight) &&
    candidate.pixelWidth > 0 &&
    candidate.pixelHeight > 0
  );
}

function sortedPyramidCandidates(
  candidates: readonly CanvasImagePyramidCandidate[],
): CanvasImagePyramidCandidate[] {
  return candidates
    .filter(isValidPyramidCandidate)
    .sort(
      (left, right) =>
        left.source.targetMaxEdge - right.source.targetMaxEdge ||
        left.pixelWidth - right.pixelWidth ||
        left.pixelHeight - right.pixelHeight,
    );
}

function sourceEquals(
  left: CanvasImageResolutionSource,
  right: CanvasImageResolutionSource,
): boolean {
  return (
    left.type === right.type &&
    (left.type === "original" ||
      right.type === "original" ||
      left.targetMaxEdge === right.targetMaxEdge)
  );
}

/**
 * Numeric runtime selector. Coverage always uses actual pixel dimensions;
 * targetMaxEdge only identifies a loadable derivative and provides ordering.
 */
export function chooseCanvasImageResolutionSource(input: {
  nodeWidth: number;
  nodeHeight: number;
  viewportZoom: number;
  devicePixelRatio?: number;
  renderedWidthCssPx?: number;
  renderedHeightCssPx?: number;
  currentSource?: CanvasImageResolutionSource;
  candidates: readonly CanvasImagePyramidCandidate[];
  allowDowngrade?: boolean;
}): CanvasImageResolutionSource {
  const required = calculateCanvasImageRequiredPixels(input);
  const candidates = sortedPyramidCandidates(input.candidates);
  const covers = (
    candidate: CanvasImagePyramidCandidate,
    multiplier = 1,
  ): boolean =>
    candidate.pixelWidth >= required.width * multiplier &&
    candidate.pixelHeight >= required.height * multiplier;
  const desired = candidates.find((candidate) => covers(candidate))?.source ?? {
    type: "original" as const,
  };
  const current = input.currentSource;
  if (!current || sourceEquals(current, desired)) return desired;
  if (sourceResolution(desired) >= sourceResolution(current)) return desired;
  if (!input.allowDowngrade) return current;
  return (
    candidates.find(
      (candidate) =>
        sourceResolution(candidate.source) < sourceResolution(current) &&
        covers(candidate, 1 + CANVAS_IMAGE_VARIANT_HYSTERESIS),
    )?.source ?? current
  );
}

function maxEdgeFor(kind: CanvasAssetVariantKind): number {
  return kind === "thumbnail"
    ? CANVAS_IMAGE_THUMBNAIL_MAX_EDGE
    : CANVAS_IMAGE_PREVIEW_MAX_EDGE;
}

function scaledDimensions(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function abortError(): Error {
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}

/**
 * Canonicalizes configuration input. Invalid values are ignored so a future
 * configuration typo cannot produce an unsafe storage identity.
 */
export function normalizeCanvasImagePyramidTargetMaxEdges(
  targetMaxEdges: readonly unknown[],
): CanvasImagePyramidTargetMaxEdge[] {
  return [
    ...new Set(targetMaxEdges.filter(isCanvasImagePyramidTargetMaxEdge)),
  ].sort((left, right) => left - right);
}

/** Returns useful derivative edges only: never equal to or above the original. */
export function planCanvasImagePyramidTiers(input: {
  width: number;
  height: number;
  targetMaxEdges?: readonly unknown[];
  readyTargetMaxEdges?: readonly unknown[];
}): CanvasImagePyramidTargetMaxEdge[] {
  const maximum = Math.max(input.width, input.height);
  if (
    !Number.isSafeInteger(input.width) ||
    !Number.isSafeInteger(input.height) ||
    input.width <= 0 ||
    input.height <= 0
  )
    return [];
  const ready = new Set(
    normalizeCanvasImagePyramidTargetMaxEdges(input.readyTargetMaxEdges ?? []),
  );
  return normalizeCanvasImagePyramidTargetMaxEdges(
    input.targetMaxEdges ?? CANVAS_IMAGE_PYRAMID_RECOMMENDED_TARGET_MAX_EDGES,
  ).filter(
    (targetMaxEdge) => targetMaxEdge < maximum && !ready.has(targetMaxEdge),
  );
}

function canvasToBlob(
  canvas: OffscreenCanvas | HTMLCanvasElement,
): Promise<Blob | null> {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({
      type: CANVAS_IMAGE_VARIANT_MIME_TYPE,
      quality: CANVAS_IMAGE_VARIANT_QUALITY,
    });
  }
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      CANVAS_IMAGE_VARIANT_MIME_TYPE,
      CANVAS_IMAGE_VARIANT_QUALITY,
    );
  });
}

async function decodeVariantSource(blob: Blob): Promise<{
  source: CanvasImageSource;
  close?: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob, {
      imageOrientation: "from-image",
    });
    return { source: bitmap, close: () => bitmap.close() };
  }
  if (
    typeof Image === "undefined" ||
    typeof URL?.createObjectURL !== "function"
  ) {
    throw new Error("Canvas image variant generation is unavailable.");
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error("Canvas image variant decode failed."));
      image.src = url;
    });
    return { source: image };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const generateCanvasImageVariants: CanvasImageVariantGenerator = async (
  blob,
  dimensions,
  signal,
) => {
  if (
    typeof OffscreenCanvas === "undefined" &&
    typeof document === "undefined"
  ) {
    return [];
  }
  const decoded = await decodeVariantSource(blob);
  try {
    const variants: GeneratedCanvasImageVariant[] = [];
    for (const kind of ["thumbnail", "preview"] as const) {
      if (signal?.aborted) {
        const error = new Error("Aborted");
        error.name = "AbortError";
        throw error;
      }
      const target = scaledDimensions(
        dimensions.width,
        dimensions.height,
        maxEdgeFor(kind),
      );
      const canvas =
        typeof OffscreenCanvas === "undefined"
          ? Object.assign(document.createElement("canvas"), {
              width: target.width,
              height: target.height,
            })
          : new OffscreenCanvas(target.width, target.height);
      const context = canvas.getContext("2d") as
        CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
      if (!context) throw new Error("Canvas 2D context is unavailable.");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(decoded.source, 0, 0, target.width, target.height);
      const generated = await canvasToBlob(canvas);
      if (!generated || generated.type !== CANVAS_IMAGE_VARIANT_MIME_TYPE) {
        throw new Error("WebP encoding is unavailable.");
      }
      variants.push({
        kind,
        blob: generated,
        pixelWidth: target.width,
        pixelHeight: target.height,
      });
    }
    return variants;
  } finally {
    decoded.close?.();
  }
};

export async function generateCanvasImagePyramidProgressively(
  blob: Blob,
  dimensions: { width: number; height: number },
  targetMaxEdges: readonly number[],
  onTier: CanvasImagePyramidTierConsumer,
  signal?: AbortSignal,
): Promise<void> {
  const planned = planCanvasImagePyramidTiers({
    width: dimensions.width,
    height: dimensions.height,
    targetMaxEdges,
  });
  if (signal?.aborted) throw abortError();
  if (planned.length === 0) return;
  if (typeof OffscreenCanvas === "undefined" && typeof document === "undefined")
    return;
  const decoded = await decodeVariantSource(blob);
  try {
    const plannedTargets = new Set(planned);
    const generationOrder = [
      ...new Set(targetMaxEdges.filter(isCanvasImagePyramidTargetMaxEdge)),
    ].filter((targetMaxEdge) => plannedTargets.has(targetMaxEdge));
    for (const targetMaxEdge of generationOrder) {
      if (signal?.aborted) throw abortError();
      const target = scaledDimensions(
        dimensions.width,
        dimensions.height,
        targetMaxEdge,
      );
      const canvas =
        typeof OffscreenCanvas === "undefined"
          ? Object.assign(document.createElement("canvas"), {
              width: target.width,
              height: target.height,
            })
          : new OffscreenCanvas(target.width, target.height);
      const context = canvas.getContext("2d") as
        CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
      if (!context) throw new Error("Canvas 2D context is unavailable.");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(decoded.source, 0, 0, target.width, target.height);
      const generated = await canvasToBlob(canvas);
      if (!generated || generated.type !== CANVAS_IMAGE_VARIANT_MIME_TYPE)
        throw new Error("WebP encoding is unavailable.");
      await onTier({
        targetMaxEdge,
        blob: generated,
        pixelWidth: target.width,
        pixelHeight: target.height,
      });
    }
  } finally {
    decoded.close?.();
  }
}

export const generateCanvasImagePyramid: CanvasImagePyramidGenerator = async (
  blob,
  dimensions,
  targetMaxEdges,
  signal,
) => {
  const tiers: GeneratedCanvasImagePyramidTier[] = [];
  const planned = planCanvasImagePyramidTiers({
    width: dimensions.width,
    height: dimensions.height,
    targetMaxEdges,
  });
  await generateCanvasImagePyramidProgressively(
    blob,
    dimensions,
    planned,
    (tier) => {
      tiers.push(tier);
    },
    signal,
  );
  return tiers;
};

export function calculateCanvasImageRequiredPixels(input: {
  nodeWidth: number;
  nodeHeight: number;
  viewportZoom: number;
  devicePixelRatio?: number;
  renderedWidthCssPx?: number;
  renderedHeightCssPx?: number;
}): CanvasImageRequiredPixels {
  const safeDimension = (value: number, fallback: number): number =>
    Number.isFinite(value) && value > 0 ? value : fallback;
  const nodeWidth = safeDimension(input.nodeWidth, 1);
  const nodeHeight = safeDimension(input.nodeHeight, 1);
  const viewportZoom = safeDimension(input.viewportZoom, 1);
  const fallbackWidth = nodeWidth * viewportZoom;
  const fallbackHeight = nodeHeight * viewportZoom;
  const renderedWidthCssPx = safeDimension(
    input.renderedWidthCssPx ?? fallbackWidth,
    fallbackWidth,
  );
  const renderedHeightCssPx = safeDimension(
    input.renderedHeightCssPx ?? fallbackHeight,
    fallbackHeight,
  );
  const devicePixelRatio = safeDimension(input.devicePixelRatio ?? 1, 1);
  return {
    width: Math.ceil(
      Math.max(renderedWidthCssPx, 1) *
        devicePixelRatio *
        CANVAS_IMAGE_VARIANT_QUALITY_SAFETY_FACTOR,
    ),
    height: Math.ceil(
      Math.max(renderedHeightCssPx, 1) *
        devicePixelRatio *
        CANVAS_IMAGE_VARIANT_QUALITY_SAFETY_FACTOR,
    ),
    renderedWidthCssPx,
    renderedHeightCssPx,
    devicePixelRatio,
  };
}

function sourceRank(kind: CanvasImageSourceKind): number {
  return kind === "thumbnail" ? 0 : kind === "preview" ? 1 : 2;
}

function defaultCandidates(): CanvasImageVariantCandidate[] {
  return [
    {
      kind: "thumbnail",
      pixelWidth: CANVAS_IMAGE_THUMBNAIL_MAX_EDGE,
      pixelHeight: CANVAS_IMAGE_THUMBNAIL_MAX_EDGE,
    },
    {
      kind: "preview",
      pixelWidth: CANVAS_IMAGE_PREVIEW_MAX_EDGE,
      pixelHeight: CANVAS_IMAGE_PREVIEW_MAX_EDGE,
    },
  ];
}

function coversRequiredPixels(
  candidate: CanvasImageVariantCandidate,
  required: Pick<CanvasImageRequiredPixels, "width" | "height">,
  multiplier = 1,
): boolean {
  return (
    candidate.pixelWidth >= required.width * multiplier &&
    candidate.pixelHeight >= required.height * multiplier
  );
}

export function chooseCanvasImageVariant(input: {
  nodeWidth: number;
  nodeHeight: number;
  viewportZoom: number;
  devicePixelRatio?: number;
  renderedWidthCssPx?: number;
  renderedHeightCssPx?: number;
  currentKind?: CanvasImageSourceKind;
  availableVariants?: readonly CanvasImageVariantCandidate[];
}): CanvasAssetVariantKind | "original" {
  const required = calculateCanvasImageRequiredPixels(input);
  const candidates = [...(input.availableVariants ?? defaultCandidates())].sort(
    (left, right) => sourceRank(left.kind) - sourceRank(right.kind),
  );
  const selected = candidates.find((candidate) =>
    coversRequiredPixels(candidate, required),
  );
  const desired = selected?.kind ?? "original";
  if (
    !input.currentKind ||
    sourceRank(desired) >= sourceRank(input.currentKind)
  )
    return desired;
  const downgradeCandidate = candidates.find(
    (candidate) => candidate.kind === desired,
  );
  return downgradeCandidate &&
    coversRequiredPixels(
      downgradeCandidate,
      required,
      1 + CANVAS_IMAGE_VARIANT_HYSTERESIS,
    )
    ? desired
    : input.currentKind;
}

const backfillInflight = new Map<
  string,
  Promise<CanvasAssetVariantMetadata | null>
>();

async function performBackfill(input: {
  assetRepository: CanvasAssetRepository;
  variantRepository: CanvasAssetVariantRepository;
  workspaceId: string;
  canvasId: string;
  assetId: string;
  kind: CanvasAssetVariantKind;
  generate?: CanvasImageVariantGenerator;
  signal?: AbortSignal;
  originalAsset?: CanvasAssetRecord;
}): Promise<CanvasAssetVariantMetadata | null> {
  const existing = await input.variantRepository.loadVariant(input);
  if (existing) return existing;
  const asset =
    input.originalAsset ??
    (await input.assetRepository.loadAsset({
      workspaceId: input.workspaceId,
      assetId: input.assetId,
    }));
  if (!asset) return null;
  const generated = await (input.generate ?? generateCanvasImageVariants)(
    asset.blob,
    { width: asset.width, height: asset.height },
    input.signal,
  );
  const variant = generated.find((item) => item.kind === input.kind);
  if (!variant) return null;
  return input.variantRepository.storeVariant({
    workspaceId: input.workspaceId,
    canvasId: input.canvasId,
    assetId: input.assetId,
    kind: variant.kind,
    storagePath: `${input.workspaceId}/${input.canvasId}/${input.assetId}/${variant.kind}.webp`,
    mimeType: CANVAS_IMAGE_VARIANT_MIME_TYPE,
    byteSize: variant.blob.size,
    pixelWidth: variant.pixelWidth,
    pixelHeight: variant.pixelHeight,
    createdAt: new Date().toISOString(),
    blob: variant.blob,
  });
}

export async function backfillCanvasImageVariant(input: {
  assetRepository: CanvasAssetRepository;
  variantRepository: CanvasAssetVariantRepository;
  workspaceId: string;
  canvasId: string;
  assetId: string;
  kind: CanvasAssetVariantKind;
  generate?: CanvasImageVariantGenerator;
  signal?: AbortSignal;
  originalAsset?: CanvasAssetRecord;
}): Promise<CanvasAssetVariantMetadata | null> {
  const key = canvasImageVariantCacheKey(input);
  const inflight = backfillInflight.get(key);
  if (inflight) return inflight;
  const promise = performBackfill(input).catch(async (error: unknown) => {
    const existing = await input.variantRepository.loadVariant(input);
    if (existing) return existing;
    throw error;
  });
  backfillInflight.set(key, promise);
  try {
    return await promise;
  } finally {
    if (backfillInflight.get(key) === promise) backfillInflight.delete(key);
  }
}
