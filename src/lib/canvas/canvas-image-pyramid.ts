import {
  CanvasImageLoadCache,
  type CanvasImageLoadScope,
} from "@/lib/canvas/canvas-image-load-cache";
import {
  CANVAS_IMAGE_PYRAMID_RECOMMENDED_TARGET_MAX_EDGES,
  CANVAS_IMAGE_VARIANT_MIME_TYPE,
  canvasImagePyramidTierStoragePath,
  generateCanvasImagePyramidProgressively,
  planCanvasImagePyramidTiers,
  type CanvasAssetVariantV2Metadata,
  type CanvasAssetVariantV2Repository,
  type CanvasImagePyramidGenerator,
  type CanvasImagePyramidTargetMaxEdge,
  type GeneratedCanvasImagePyramidTier,
} from "@/lib/canvas/canvas-image-variants";
import type {
  CanvasAssetRecord,
  CanvasAssetRepository,
} from "@/lib/canvas/local-canvas-repository";

export type CanvasImagePyramidJobResult = {
  stored: CanvasAssetVariantV2Metadata[];
  missingTargetMaxEdges: CanvasImagePyramidTargetMaxEdge[];
  failed: ReadonlyArray<{
    targetMaxEdge: CanvasImagePyramidTargetMaxEdge;
    error: unknown;
  }>;
  /** Missing tiers await a legitimately available original; this is not an error. */
  deferred: boolean;
};

/** Passive runtime work may reuse an original, but cannot download one. */
export type CanvasImagePyramidOriginalLoadPolicy =
  "reuse-only" | "allow-download";

export type CanvasImagePyramidJobInput = {
  assetRepository: CanvasAssetRepository;
  variantRepository: CanvasAssetVariantV2Repository;
  workspaceId: string;
  canvasId: string;
  assetId: string;
  userId?: string;
  originalAsset?: CanvasAssetRecord;
  /** Defaults to reuse-only so passive completion cannot download originals. */
  originalLoadPolicy?: CanvasImagePyramidOriginalLoadPolicy;
  targetMaxEdges?: readonly number[];
  priorityTargetMaxEdge?: CanvasImagePyramidTargetMaxEdge;
  loadCache?: CanvasImageLoadCache;
  generate?: CanvasImagePyramidGenerator;
  signal?: AbortSignal;
  onTierStored?: (input: {
    metadata: CanvasAssetVariantV2Metadata;
    blob: Blob;
  }) => void;
};

type ScheduledJob = {
  input: CanvasImagePyramidJobInput;
  controller: AbortController;
  resolve: (result: CanvasImagePyramidJobResult) => void;
  reject: (error: unknown) => void;
  promise: Promise<CanvasImagePyramidJobResult>;
};

type ScopeQueue = { active: number; waiting: ScheduledJob[] };

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function hasOriginalBlob(value: unknown): value is CanvasAssetRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    "blob" in value &&
    (value as { blob?: unknown }).blob instanceof Blob
  );
}

function abortError(): Error {
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}

function scopeOf(
  input: Pick<
    CanvasImagePyramidJobInput,
    "userId" | "workspaceId" | "canvasId"
  >,
): CanvasImageLoadScope {
  return {
    userId: input.userId,
    workspaceId: input.workspaceId,
    canvasId: input.canvasId,
  };
}

function jobKey(input: CanvasImagePyramidJobInput): string {
  const scope = scopeOf(input);
  return [
    scope.userId ?? "local",
    scope.workspaceId,
    scope.canvasId,
    input.assetId,
  ].join("\u0000");
}

function scopeKey(input: CanvasImagePyramidJobInput): string {
  const scope = scopeOf(input);
  return [scope.userId ?? "local", scope.workspaceId, scope.canvasId].join(
    "\u0000",
  );
}

function orderedMissing(
  missing: readonly CanvasImagePyramidTargetMaxEdge[],
  priority: CanvasImagePyramidTargetMaxEdge | undefined,
): CanvasImagePyramidTargetMaxEdge[] {
  if (!priority || !missing.includes(priority)) return [...missing];
  return [
    priority,
    ...missing.filter((edge) => edge < priority),
    ...missing.filter((edge) => edge > priority),
  ];
}

/**
 * Browser-scoped scheduler: one decode-heavy job per Canvas scope by default.
 * A job owns an asset, never a single tier, so all missing derivatives share
 * one original Blob load and one source decode.
 */
export class CanvasImagePyramidScheduler {
  private readonly inflight = new Map<string, ScheduledJob>();
  private readonly queues = new Map<string, ScopeQueue>();
  private uploadActive = 0;
  private readonly uploadWaiting: Array<() => void> = [];

  constructor(
    private readonly options: {
      maxConcurrentJobsPerScope?: number;
      maxConcurrentUploads?: number;
    } = {},
  ) {}

  enqueue(
    input: CanvasImagePyramidJobInput,
  ): Promise<CanvasImagePyramidJobResult> {
    if (input.signal?.aborted) return Promise.reject(abortError());
    const key = jobKey(input);
    const existing = this.inflight.get(key);
    if (existing) return existing.promise;
    let resolve!: (result: CanvasImagePyramidJobResult) => void;
    let reject!: (error: unknown) => void;
    const job: ScheduledJob = {
      input,
      controller: new AbortController(),
      promise: new Promise<CanvasImagePyramidJobResult>(
        (nextResolve, nextReject) => {
          resolve = nextResolve;
          reject = nextReject;
        },
      ),
      resolve,
      reject,
    };
    if (input.signal) {
      input.signal.addEventListener("abort", () => job.controller.abort(), {
        once: true,
      });
    }
    this.inflight.set(key, job);
    const queueKey = scopeKey(input);
    const queue = this.queues.get(queueKey) ?? { active: 0, waiting: [] };
    queue.waiting.push(job);
    this.queues.set(queueKey, queue);
    this.pump(queueKey);
    return job.promise;
  }

  /** Cancels queued work and, when requested, the active jobs in this scope. */
  cancelScope(scope: CanvasImageLoadScope, includeActive = false): void {
    const key = [
      scope.userId ?? "local",
      scope.workspaceId,
      scope.canvasId,
    ].join("\u0000");
    const queue = this.queues.get(key);
    if (queue) {
      for (const job of queue.waiting.splice(0)) {
        job.controller.abort();
        this.inflight.delete(jobKey(job.input));
        job.reject(abortError());
      }
    }
    if (!includeActive) return;
    for (const [inflightKey, job] of this.inflight) {
      if (!inflightKey.startsWith(`${key}\u0000`)) continue;
      job.controller.abort();
    }
  }

  private pump(key: string): void {
    const queue = this.queues.get(key);
    if (!queue) return;
    const limit = Math.max(
      1,
      Math.floor(this.options.maxConcurrentJobsPerScope ?? 1),
    );
    while (queue.active < limit && queue.waiting.length > 0) {
      const job = queue.waiting.shift();
      if (!job) return;
      if (job.controller.signal.aborted) continue;
      queue.active += 1;
      void this.run(job).finally(() => {
        queue.active -= 1;
        if (queue.active === 0 && queue.waiting.length === 0)
          this.queues.delete(key);
        else this.pump(key);
      });
    }
  }

  private async withUploadSlot<T>(work: () => Promise<T>): Promise<T> {
    const limit = Math.max(
      1,
      Math.floor(this.options.maxConcurrentUploads ?? 2),
    );
    if (this.uploadActive >= limit)
      await new Promise<void>((resolve) => this.uploadWaiting.push(resolve));
    this.uploadActive += 1;
    try {
      return await work();
    } finally {
      this.uploadActive -= 1;
      this.uploadWaiting.shift()?.();
    }
  }

  private async run(job: ScheduledJob): Promise<void> {
    const key = jobKey(job.input);
    try {
      const result = await this.generate(job.input, job.controller.signal);
      job.resolve(result);
    } catch (error: unknown) {
      job.reject(error);
    } finally {
      if (this.inflight.get(key) === job) this.inflight.delete(key);
    }
  }

  private async generate(
    input: CanvasImagePyramidJobInput,
    signal: AbortSignal,
  ): Promise<CanvasImagePyramidJobResult> {
    if (signal.aborted) throw abortError();
    const scope = scopeOf(input);
    const list = () =>
      input.variantRepository.listVariantTiers({
        workspaceId: input.workspaceId,
        canvasId: input.canvasId,
        assetId: input.assetId,
      });
    const ready = input.loadCache
      ? await input.loadCache.tiersForAsset(scope, input.assetId, list)
      : await list();
    if (signal.aborted) throw abortError();
    const cachedOriginal = input.loadCache?.peekResolvedAsset(
      scope,
      input.assetId,
    );
    const knownOriginal =
      input.originalAsset ??
      cachedOriginal ??
      (input.assetRepository.getAssetMetadata
        ? await input.assetRepository.getAssetMetadata({
            workspaceId: input.workspaceId,
            assetId: input.assetId,
          })
        : null);
    if (signal.aborted) throw abortError();
    const loadOriginal = () =>
      input.loadCache
        ? input.loadCache.asset(scope, input.assetId, () =>
            input.assetRepository.loadAsset({
              workspaceId: input.workspaceId,
              assetId: input.assetId,
              reason: "explicit-maintenance",
            }),
          )
        : input.assetRepository.loadAsset({
            workspaceId: input.workspaceId,
            assetId: input.assetId,
            reason: "explicit-maintenance",
          });
    const dimensions =
      knownOriginal ??
      (input.originalLoadPolicy === "allow-download"
        ? await loadOriginal()
        : null);
    if (!dimensions)
      return {
        stored: [],
        missingTargetMaxEdges: [],
        failed: [],
        deferred: true,
      };
    const missing = planCanvasImagePyramidTiers({
      width: dimensions.width,
      height: dimensions.height,
      targetMaxEdges:
        input.targetMaxEdges ??
        CANVAS_IMAGE_PYRAMID_RECOMMENDED_TARGET_MAX_EDGES,
      readyTargetMaxEdges: ready.map((tier) => tier.targetMaxEdge),
    });
    if (missing.length === 0)
      return {
        stored: [],
        missingTargetMaxEdges: [],
        failed: [],
        deferred: false,
      };
    const original =
      input.originalAsset ??
      cachedOriginal ??
      (hasOriginalBlob(dimensions)
        ? dimensions
        : input.originalLoadPolicy === "allow-download"
          ? await loadOriginal()
          : null);
    if (!original)
      return {
        stored: [],
        missingTargetMaxEdges: missing,
        failed: [],
        deferred: true,
      };
    const stored: CanvasAssetVariantV2Metadata[] = [];
    const failed: Array<{
      targetMaxEdge: CanvasImagePyramidTargetMaxEdge;
      error: unknown;
    }> = [];
    const generationOrder = orderedMissing(
      missing,
      input.priorityTargetMaxEdge,
    );
    const storeTier = async (
      tier: GeneratedCanvasImagePyramidTier,
    ): Promise<void> => {
      if (signal.aborted) throw abortError();
      try {
        const metadata = await this.withUploadSlot(() =>
          input.variantRepository.storeVariantTier({
            workspaceId: input.workspaceId,
            canvasId: input.canvasId,
            assetId: input.assetId,
            targetMaxEdge: tier.targetMaxEdge,
            storagePath: canvasImagePyramidTierStoragePath({
              workspaceId: input.workspaceId,
              canvasId: input.canvasId,
              assetId: input.assetId,
              targetMaxEdge: tier.targetMaxEdge,
            }),
            mimeType: CANVAS_IMAGE_VARIANT_MIME_TYPE,
            byteSize: tier.blob.size,
            pixelWidth: tier.pixelWidth,
            pixelHeight: tier.pixelHeight,
            createdAt: new Date().toISOString(),
            blob: tier.blob,
          }),
        );
        const record = { ...metadata, blob: tier.blob };
        input.loadCache?.primeVariantTier(scope, input.assetId, record);
        input.loadCache?.invalidateTierMetadata(scope, input.assetId);
        stored.push(metadata);
        input.onTierStored?.({ metadata, blob: tier.blob });
      } catch (error: unknown) {
        if (isAbort(error)) throw error;
        const existing = await list().then((tiers) =>
          tiers.find(
            (candidate) => candidate.targetMaxEdge === tier.targetMaxEdge,
          ),
        );
        if (existing) {
          stored.push(existing);
          return;
        }
        failed.push({ targetMaxEdge: tier.targetMaxEdge, error });
      }
    };
    if (input.generate) {
      const generated = await input.generate(
        original.blob,
        { width: original.width, height: original.height },
        generationOrder,
        signal,
      );
      const generatedByTarget = new Map(
        generated.map((tier) => [tier.targetMaxEdge, tier]),
      );
      for (const targetMaxEdge of generationOrder) {
        const tier = generatedByTarget.get(targetMaxEdge);
        if (tier) await storeTier(tier);
      }
    } else {
      await generateCanvasImagePyramidProgressively(
        original.blob,
        { width: original.width, height: original.height },
        generationOrder,
        storeTier,
        signal,
      );
    }
    return { stored, missingTargetMaxEdges: missing, failed, deferred: false };
  }
}
