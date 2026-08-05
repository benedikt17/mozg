import { describe, expect, it, vi } from "vitest";
import {
  backfillCanvasImageVariant,
  calculateCanvasImageRequiredPixels,
  canvasImagePyramidTierCacheKey,
  canvasImagePyramidTierStoragePath,
  canvasImageVariantCacheKey,
  chooseCanvasImageVariant,
  CANVAS_IMAGE_PYRAMID_RECOMMENDED_TARGET_MAX_EDGES,
  CANVAS_IMAGE_VARIANT_QUALITY_SAFETY_FACTOR,
  isCanvasImagePyramidTargetMaxEdge,
  isCanvasImageVariantDimensionContractValid,
  type CanvasAssetVariantRepository,
} from "@/lib/canvas/canvas-image-variants";
import type {
  CanvasAssetRecord,
  CanvasAssetRepository,
} from "@/lib/canvas/local-canvas-repository";

const record: CanvasAssetRecord = {
  id: "asset-1",
  workspaceId: "workspace-1",
  blob: new Blob(["original"], { type: "image/png" }),
  preview: null,
  mimeType: "image/png",
  byteSize: 8,
  width: 4000,
  height: 2000,
  checksum: null,
  createdAt: "2026-08-03T10:00:00.000Z",
  readyAt: "2026-08-03T10:00:00.000Z",
  deletedAt: null,
};

describe("Canvas image variants", () => {
  it("defines open numeric pyramid tiers with deterministic edge paths", () => {
    expect(CANVAS_IMAGE_PYRAMID_RECOMMENDED_TARGET_MAX_EDGES).toEqual([
      256, 512, 1024, 2048, 4096,
    ]);
    expect(isCanvasImagePyramidTargetMaxEdge(3072)).toBe(true);
    expect(isCanvasImagePyramidTargetMaxEdge(0)).toBe(false);
    expect(isCanvasImagePyramidTargetMaxEdge(10_001)).toBe(false);
    expect(
      canvasImagePyramidTierStoragePath({
        workspaceId: "workspace-1",
        canvasId: "canvas-1",
        assetId: "asset-1",
        targetMaxEdge: 3072,
      }),
    ).toBe("workspace-1/canvas-1/asset-1/edge-3072.webp");
    expect(
      canvasImagePyramidTierCacheKey({
        workspaceId: "workspace-1",
        canvasId: "canvas-1",
        assetId: "asset-1",
        targetMaxEdge: 3072,
      }),
    ).toBe("workspace-1/canvas-1/asset-1/edge-3072");
  });

  it.each([
    [{ nodeWidth: 200, nodeHeight: 100, viewportZoom: 1 }, "thumbnail"],
    [{ nodeWidth: 1200, nodeHeight: 800, viewportZoom: 1 }, "preview"],
    [{ nodeWidth: 2000, nodeHeight: 1000, viewportZoom: 2 }, "original"],
  ])("selects a runtime source for %o", (input, expected) => {
    expect(chooseCanvasImageVariant(input)).toBe(expected);
  });

  it("accounts for DPR and keeps a hysteresis band around thresholds", () => {
    expect(
      chooseCanvasImageVariant({
        nodeWidth: 300,
        nodeHeight: 200,
        viewportZoom: 1,
        devicePixelRatio: 2,
      }),
    ).toBe("preview");
    expect(
      chooseCanvasImageVariant({
        nodeWidth: 360,
        nodeHeight: 100,
        viewportZoom: 1,
        currentKind: "thumbnail",
      }),
    ).toBe("thumbnail");
    expect(
      chooseCanvasImageVariant({
        nodeWidth: 450,
        nodeHeight: 100,
        viewportZoom: 1,
        currentKind: "thumbnail",
      }),
    ).toBe("preview");
    expect(
      chooseCanvasImageVariant({
        nodeWidth: 1800,
        nodeHeight: 100,
        viewportZoom: 1,
        currentKind: "original",
      }),
    ).toBe("preview");
  });

  it("calculates physical demand from rendered CSS size with DPR exactly once", () => {
    expect(
      calculateCanvasImageRequiredPixels({
        nodeWidth: 1100,
        nodeHeight: 620,
        viewportZoom: 99,
        renderedWidthCssPx: 1100,
        renderedHeightCssPx: 620,
        devicePixelRatio: 1.25,
      }),
    ).toEqual({
      width: Math.ceil(
        1100 * 1.25 * CANVAS_IMAGE_VARIANT_QUALITY_SAFETY_FACTOR,
      ),
      height: Math.ceil(
        620 * 1.25 * CANVAS_IMAGE_VARIANT_QUALITY_SAFETY_FACTOR,
      ),
      renderedWidthCssPx: 1100,
      renderedHeightCssPx: 620,
      devicePixelRatio: 1.25,
    });
  });

  it("accepts rounded dimensions at the one-pixel aspect-ratio tolerance boundary", () => {
    expect(
      isCanvasImageVariantDimensionContractValid({
        kind: "thumbnail",
        originalWidth: 1200,
        originalHeight: 400,
        pixelWidth: 512,
        pixelHeight: 171,
      }),
    ).toBe(true);
  });

  it("selects the lightest variant that covers both real pixel dimensions", () => {
    const availableVariants = [
      { kind: "thumbnail" as const, pixelWidth: 512, pixelHeight: 288 },
      { kind: "preview" as const, pixelWidth: 2048, pixelHeight: 1152 },
    ];
    expect(
      chooseCanvasImageVariant({
        nodeWidth: 1100,
        nodeHeight: 620,
        viewportZoom: 1,
        devicePixelRatio: 1.25,
        availableVariants,
      }),
    ).toBe("preview");
    expect(
      chooseCanvasImageVariant({
        nodeWidth: 1700,
        nodeHeight: 1200,
        viewportZoom: 1,
        devicePixelRatio: 1,
        availableVariants,
      }),
    ).toBe("original");
    expect(
      chooseCanvasImageVariant({
        nodeWidth: 600,
        nodeHeight: 500,
        viewportZoom: 1,
        availableVariants: [availableVariants[0]!],
      }),
    ).toBe("original");
  });

  it("does not downgrade until the lower real-size candidate has hysteresis headroom", () => {
    const availableVariants = [
      { kind: "thumbnail" as const, pixelWidth: 512, pixelHeight: 288 },
      { kind: "preview" as const, pixelWidth: 2048, pixelHeight: 1152 },
    ];
    expect(
      chooseCanvasImageVariant({
        nodeWidth: 400,
        nodeHeight: 225,
        viewportZoom: 1,
        currentKind: "preview",
        availableVariants,
      }),
    ).toBe("preview");
    expect(
      chooseCanvasImageVariant({
        nodeWidth: 300,
        nodeHeight: 169,
        viewportZoom: 1,
        currentKind: "preview",
        availableVariants,
      }),
    ).toBe("thumbnail");
  });

  it("uses a scope-qualified runtime cache key", () => {
    expect(
      canvasImageVariantCacheKey({
        workspaceId: "workspace-1",
        canvasId: "canvas-1",
        assetId: "asset-1",
        kind: "preview",
      }),
    ).toBe("workspace-1/canvas-1/asset-1/preview");
  });

  it("backfills only the missing variant and preserves the original asset", async () => {
    const loadAsset = vi.fn(async () => record);
    const storeVariant = vi.fn(
      async (
        input: Parameters<CanvasAssetVariantRepository["storeVariant"]>[0],
      ) => {
        return {
          workspaceId: input.workspaceId,
          canvasId: input.canvasId,
          assetId: input.assetId,
          kind: input.kind,
          storagePath: input.storagePath,
          mimeType: input.mimeType,
          byteSize: input.byteSize,
          pixelWidth: input.pixelWidth,
          pixelHeight: input.pixelHeight,
          createdAt: input.createdAt,
        };
      },
    );
    const assetRepository = {
      storeImage: vi.fn(),
      loadAsset,
      markAssetDeleted: vi.fn(),
    } as unknown as CanvasAssetRepository;
    const variantRepository = {
      listVariants: vi.fn(async () => []),
      loadVariant: vi.fn(async () => null),
      storeVariant,
      deleteVariants: vi.fn(),
    } satisfies CanvasAssetVariantRepository;
    const generated = vi.fn(async () => [
      {
        kind: "preview" as const,
        blob: new Blob(["preview"], { type: "image/webp" }),
        pixelWidth: 2560,
        pixelHeight: 1280,
      },
    ]);

    await expect(
      backfillCanvasImageVariant({
        assetRepository,
        variantRepository,
        workspaceId: "workspace-1",
        canvasId: "canvas-1",
        assetId: "asset-1",
        kind: "preview",
        generate: generated,
      }),
    ).resolves.toMatchObject({ kind: "preview", pixelWidth: 2560 });
    expect(loadAsset).toHaveBeenCalledOnce();
    expect(storeVariant).toHaveBeenCalledOnce();
    expect(storeVariant.mock.calls[0]?.[0]).toMatchObject({
      storagePath: "workspace-1/canvas-1/asset-1/preview.webp",
      mimeType: "image/webp",
    });
  });

  it("reuses the already loaded original asset during variant backfill", async () => {
    const loadAsset = vi.fn(async () => record);
    const assetRepository = {
      storeImage: vi.fn(),
      loadAsset,
      markAssetDeleted: vi.fn(),
    } as unknown as CanvasAssetRepository;
    const variantRepository = {
      listVariants: vi.fn(async () => []),
      loadVariant: vi.fn(async () => null),
      storeVariant: vi.fn(async (input) => ({ ...input })),
      deleteVariants: vi.fn(),
    } satisfies CanvasAssetVariantRepository;

    await backfillCanvasImageVariant({
      assetRepository,
      variantRepository,
      workspaceId: "workspace-1",
      canvasId: "canvas-1",
      assetId: "asset-1",
      kind: "thumbnail",
      originalAsset: record,
      generate: async () => [
        {
          kind: "thumbnail",
          blob: new Blob(["thumbnail"], { type: "image/webp" }),
          pixelWidth: 512,
          pixelHeight: 256,
        },
      ],
    });

    expect(loadAsset).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent backfills for the same scoped asset variant", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const loadAsset = vi.fn(async () => record);
    const storeVariant = vi.fn(
      async (
        input: Parameters<CanvasAssetVariantRepository["storeVariant"]>[0],
      ) => {
        await gate;
        return {
          workspaceId: input.workspaceId,
          canvasId: input.canvasId,
          assetId: input.assetId,
          kind: input.kind,
          storagePath: input.storagePath,
          mimeType: input.mimeType,
          byteSize: input.byteSize,
          pixelWidth: input.pixelWidth,
          pixelHeight: input.pixelHeight,
          createdAt: input.createdAt,
        };
      },
    );
    const assetRepository = {
      storeImage: vi.fn(),
      loadAsset,
      markAssetDeleted: vi.fn(),
    } as unknown as CanvasAssetRepository;
    const variantRepository = {
      listVariants: vi.fn(async () => []),
      loadVariant: vi.fn(async () => null),
      storeVariant,
      deleteVariants: vi.fn(),
    } satisfies CanvasAssetVariantRepository;
    const generate = vi.fn(async () => [
      {
        kind: "thumbnail" as const,
        blob: new Blob(["thumbnail"], { type: "image/webp" }),
        pixelWidth: 512,
        pixelHeight: 256,
      },
    ]);
    const first = backfillCanvasImageVariant({
      assetRepository,
      variantRepository,
      workspaceId: "workspace-1",
      canvasId: "canvas-1",
      assetId: "asset-1",
      kind: "thumbnail",
      generate,
    });
    const second = backfillCanvasImageVariant({
      assetRepository,
      variantRepository,
      workspaceId: "workspace-1",
      canvasId: "canvas-1",
      assetId: "asset-1",
      kind: "thumbnail",
      generate,
    });
    release?.();
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(loadAsset).toHaveBeenCalledOnce();
    expect(generate).toHaveBeenCalledOnce();
    expect(storeVariant).toHaveBeenCalledOnce();
  });
});
