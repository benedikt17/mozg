import { describe, expect, it, vi } from "vitest";
import { CanvasImageLoadCache } from "@/lib/canvas/canvas-image-load-cache";
import { CanvasImagePyramidScheduler } from "@/lib/canvas/canvas-image-pyramid";
import {
  generateCanvasImagePyramid,
  generateCanvasImagePyramidProgressively,
  planCanvasImagePyramidTiers,
  type CanvasAssetVariantV2Repository,
} from "@/lib/canvas/canvas-image-variants";
import type {
  CanvasAssetRecord,
  CanvasAssetRepository,
} from "@/lib/canvas/local-canvas-repository";

const scope = {
  userId: "user-1",
  workspaceId: "workspace-1",
  canvasId: "canvas-1",
};

function original(
  overrides: Partial<CanvasAssetRecord> = {},
): CanvasAssetRecord {
  return {
    id: "asset-1",
    workspaceId: scope.workspaceId,
    blob: new Blob(["original"], { type: "image/png" }),
    preview: null,
    mimeType: "image/png",
    byteSize: 8,
    width: 2752,
    height: 1536,
    checksum: null,
    createdAt: "2026-08-05T10:00:00.000Z",
    readyAt: "2026-08-05T10:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

function metadata(targetMaxEdge: number) {
  return {
    workspaceId: scope.workspaceId,
    canvasId: scope.canvasId,
    assetId: "asset-1",
    targetMaxEdge,
    storagePath: `${scope.workspaceId}/${scope.canvasId}/asset-1/edge-${targetMaxEdge}.webp`,
    mimeType: "image/webp" as const,
    byteSize: 4,
    pixelWidth: targetMaxEdge,
    pixelHeight: Math.round(targetMaxEdge / 2),
    createdAt: "2026-08-05T10:00:00.000Z",
  };
}

describe("Canvas image pyramid planner", () => {
  it.each([
    [7000, [256, 512, 1024, 2048, 4096]],
    [2752, [256, 512, 1024, 2048]],
    [1600, [256, 512, 1024]],
    [900, [256, 512]],
    [400, [256]],
    [256, []],
  ])("plans no-upscale tiers for original edge %i", (width, expected) => {
    expect(
      planCanvasImagePyramidTiers({ width, height: Math.max(1, width / 2) }),
    ).toEqual(expected);
  });

  it("normalizes configuration and treats ready legacy-sized rows as complete", () => {
    expect(
      planCanvasImagePyramidTiers({
        width: 2752,
        height: 1536,
        targetMaxEdges: [2048, 512, 512, -1, 20_000, 256, 1024],
        readyTargetMaxEdges: [512, 2560],
      }),
    ).toEqual([256, 1024, 2048]);
  });
});

describe("Canvas image pyramid generator", () => {
  it("decodes the original once, generates sorted WebP tiers, and releases the bitmap", async () => {
    const close = vi.fn();
    const drawImage = vi.fn();
    const createImageBitmap = vi.fn(async () => ({
      width: 2752,
      height: 1536,
      close,
    }));
    const canvases: Array<{ width: number; height: number }> = [];
    class TestOffscreenCanvas {
      readonly width: number;
      readonly height: number;

      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        canvases.push(this);
      }

      getContext() {
        return {
          imageSmoothingEnabled: false,
          imageSmoothingQuality: "low",
          drawImage,
        };
      }

      convertToBlob() {
        return Promise.resolve(new Blob(["tier"], { type: "image/webp" }));
      }
    }
    vi.stubGlobal("createImageBitmap", createImageBitmap);
    vi.stubGlobal("OffscreenCanvas", TestOffscreenCanvas);
    try {
      const tiers = await generateCanvasImagePyramid(
        new Blob(["original"], { type: "image/png" }),
        { width: 2752, height: 1536 },
        [2048, 1024, 256, 512, 4096, 512],
      );

      expect(tiers.map((tier) => tier.targetMaxEdge)).toEqual([
        256, 512, 1024, 2048,
      ]);
      expect(tiers.map((tier) => [tier.pixelWidth, tier.pixelHeight])).toEqual([
        [256, 143],
        [512, 286],
        [1024, 572],
        [2048, 1143],
      ]);
      expect(createImageBitmap).toHaveBeenCalledOnce();
      expect(drawImage).toHaveBeenCalledTimes(4);
      expect(canvases).toHaveLength(4);
      expect(close).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("honours cancellation before decode", async () => {
    const controller = new AbortController();
    controller.abort();
    const createImageBitmap = vi.fn();
    vi.stubGlobal("createImageBitmap", createImageBitmap);
    vi.stubGlobal("OffscreenCanvas", class {});
    try {
      await expect(
        generateCanvasImagePyramid(
          new Blob(["original"], { type: "image/png" }),
          { width: 7000, height: 3500 },
          [256],
          controller.signal,
        ),
      ).rejects.toMatchObject({ name: "AbortError" });
      expect(createImageBitmap).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps priority streaming separate from the canonical sorted result", async () => {
    const streamed: number[] = [];
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", async () => ({ close }));
    vi.stubGlobal(
      "OffscreenCanvas",
      class {
        getContext() {
          return {
            imageSmoothingEnabled: false,
            imageSmoothingQuality: "low",
            drawImage: vi.fn(),
          };
        }

        convertToBlob() {
          return Promise.resolve(new Blob(["tier"], { type: "image/webp" }));
        }
      },
    );
    try {
      await generateCanvasImagePyramidProgressively(
        new Blob(["original"], { type: "image/png" }),
        { width: 1600, height: 900 },
        [1024, 256, 512],
        (tier) => {
          streamed.push(tier.targetMaxEdge);
        },
      );
      expect(streamed).toEqual([1024, 256, 512]);
      expect(close).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("CanvasImagePyramidScheduler", () => {
  it("uses one original load/decode job for all missing tiers and primes exact cache records", async () => {
    const cache = new CanvasImageLoadCache();
    const record = original();
    const assetRepository = {
      storeImage: vi.fn(),
      loadAsset: vi.fn(async () => record),
      getAssetMetadata: vi.fn(async () => {
        const { blob, preview, ...value } = record;
        void blob;
        void preview;
        return value;
      }),
      markAssetDeleted: vi.fn(),
    } satisfies CanvasAssetRepository;
    const stored: ReturnType<typeof metadata>[] = [];
    const variantRepository = {
      listVariantTiers: vi.fn(async () => []),
      loadVariantTier: vi.fn(async () => null),
      storeVariantTier: vi.fn(async (input) => {
        const value = {
          ...metadata(input.targetMaxEdge),
          byteSize: input.blob.size,
          pixelWidth: input.pixelWidth,
          pixelHeight: input.pixelHeight,
        };
        stored.push(value);
        return value;
      }),
    } satisfies CanvasAssetVariantV2Repository;
    const generate = vi.fn(
      async (
        _blob: Blob,
        dimensions: { width: number; height: number },
        targetMaxEdges: readonly number[],
      ) =>
        targetMaxEdges.map((targetMaxEdge) => ({
          targetMaxEdge,
          blob: new Blob([String(targetMaxEdge)], { type: "image/webp" }),
          pixelWidth: targetMaxEdge,
          pixelHeight: Math.round(
            (dimensions.height / dimensions.width) * targetMaxEdge,
          ),
        })),
    );
    const scheduler = new CanvasImagePyramidScheduler();

    const [first, second] = await Promise.all([
      scheduler.enqueue({
        ...scope,
        assetId: record.id,
        assetRepository,
        variantRepository,
        loadCache: cache,
        generate,
      }),
      scheduler.enqueue({
        ...scope,
        assetId: record.id,
        assetRepository,
        variantRepository,
        loadCache: cache,
        generate,
      }),
    ]);

    expect(first.stored.map((tier) => tier.targetMaxEdge)).toEqual([
      256, 512, 1024, 2048,
    ]);
    expect(second.stored).toEqual(first.stored);
    expect(assetRepository.loadAsset).toHaveBeenCalledOnce();
    expect(generate).toHaveBeenCalledOnce();
    expect(variantRepository.storeVariantTier).toHaveBeenCalledTimes(4);
    const loaded = await cache.variantTier(scope, record.id, 1024, async () => {
      throw new Error("Storage download must not occur for a primed tier.");
    });
    expect(loaded?.blob.type).toBe("image/webp");
  });

  it("does not download an original when ready metadata already completes the pyramid", async () => {
    const record = original({ width: 900, height: 500 });
    const assetRepository = {
      storeImage: vi.fn(),
      loadAsset: vi.fn(async () => record),
      getAssetMetadata: vi.fn(async () => {
        const { blob, preview, ...value } = record;
        void blob;
        void preview;
        return value;
      }),
      markAssetDeleted: vi.fn(),
    } satisfies CanvasAssetRepository;
    const variantRepository = {
      listVariantTiers: vi.fn(async () => [metadata(256), metadata(512)]),
      loadVariantTier: vi.fn(async () => null),
      storeVariantTier: vi.fn(),
    } satisfies CanvasAssetVariantV2Repository;

    await expect(
      new CanvasImagePyramidScheduler().enqueue({
        ...scope,
        assetId: record.id,
        assetRepository,
        variantRepository,
      }),
    ).resolves.toMatchObject({ stored: [], missingTargetMaxEdges: [] });
    expect(assetRepository.loadAsset).not.toHaveBeenCalled();
    expect(variantRepository.storeVariantTier).not.toHaveBeenCalled();
  });

  it("keeps partial successes and retries only the failed tier", async () => {
    const record = original({ width: 1600, height: 900 });
    const existing = new Set<number>();
    const assetRepository = {
      storeImage: vi.fn(),
      loadAsset: vi.fn(async () => record),
      markAssetDeleted: vi.fn(),
    } satisfies CanvasAssetRepository;
    const variantRepository = {
      listVariantTiers: vi.fn(async () => [...existing].map(metadata)),
      loadVariantTier: vi.fn(async () => null),
      storeVariantTier: vi.fn(async (input) => {
        if (input.targetMaxEdge === 512 && !existing.has(512))
          throw new Error("temporary");
        existing.add(input.targetMaxEdge);
        return metadata(input.targetMaxEdge);
      }),
    } satisfies CanvasAssetVariantV2Repository;
    const generate = vi.fn(
      async (
        _blob: Blob,
        _dimensions: { width: number; height: number },
        targetMaxEdges: readonly number[],
      ) =>
        targetMaxEdges.map((targetMaxEdge) => ({
          targetMaxEdge,
          blob: new Blob([String(targetMaxEdge)], { type: "image/webp" }),
          pixelWidth: targetMaxEdge,
          pixelHeight: Math.round(targetMaxEdge / 2),
        })),
    );
    const scheduler = new CanvasImagePyramidScheduler();
    const first = await scheduler.enqueue({
      ...scope,
      assetId: record.id,
      assetRepository,
      variantRepository,
      originalAsset: record,
      generate,
    });
    expect(first.stored.map((tier) => tier.targetMaxEdge)).toEqual([256, 1024]);
    expect(first.failed.map((tier) => tier.targetMaxEdge)).toEqual([512]);
    existing.add(512);
    await scheduler.enqueue({
      ...scope,
      assetId: record.id,
      assetRepository,
      variantRepository,
      originalAsset: record,
      generate,
    });
    expect(generate).toHaveBeenCalledOnce();
  });
});
