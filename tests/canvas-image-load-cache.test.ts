import { describe, expect, it, vi } from "vitest";
import { CanvasImageLoadCache } from "@/lib/canvas/canvas-image-load-cache";
import type { CanvasAssetRecord } from "@/lib/canvas/local-canvas-repository";

const scope = {
  userId: "user-a",
  workspaceId: "workspace-a",
  canvasId: "canvas-a",
};

describe("CanvasImageLoadCache", () => {
  it("peeks only successfully resolved originals within the same scope", async () => {
    const cache = new CanvasImageLoadCache();
    const record = {
      id: "asset-a",
      workspaceId: scope.workspaceId,
      blob: new Blob(["original"], { type: "image/png" }),
      preview: null,
      mimeType: "image/png",
      byteSize: 8,
      width: 100,
      height: 50,
      checksum: null,
      createdAt: "2026-08-06T00:00:00.000Z",
      readyAt: "2026-08-06T00:00:00.000Z",
      deletedAt: null,
    } satisfies CanvasAssetRecord;
    let resolve!: (value: CanvasAssetRecord | null) => void;
    const pending = new Promise<CanvasAssetRecord | null>((nextResolve) => {
      resolve = nextResolve;
    });

    void cache.asset(scope, record.id, async () => pending);
    expect(cache.peekResolvedAsset(scope, record.id)).toBeNull();
    resolve(record);
    await vi.waitFor(() =>
      expect(cache.peekResolvedAsset(scope, record.id)).toBe(record),
    );
    expect(
      cache.peekResolvedAsset({ ...scope, canvasId: "canvas-b" }, record.id),
    ).toBeNull();
    cache.clearScope(scope);
    expect(cache.peekResolvedAsset(scope, record.id)).toBeNull();
  });

  it("shares successful and in-flight asset loads only within its Canvas scope", async () => {
    const cache = new CanvasImageLoadCache();
    const load = vi.fn(async () => null);

    await Promise.all([
      cache.asset(scope, "asset-a", load),
      cache.asset(scope, "asset-a", load),
    ]);
    await cache.asset(scope, "asset-a", load);
    await cache.asset({ ...scope, canvasId: "canvas-b" }, "asset-a", load);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it("evicts rejected work so a later restore can retry", async () => {
    const cache = new CanvasImageLoadCache();
    const load = vi
      .fn<() => Promise<null>>()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce(null);

    await expect(cache.asset(scope, "asset-a", load)).rejects.toThrow(
      "temporary",
    );
    await expect(cache.asset(scope, "asset-a", load)).resolves.toBeNull();

    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps numeric pyramid tiers isolated from legacy variant cache keys", async () => {
    const cache = new CanvasImageLoadCache();
    const load = vi.fn(async () => null);

    await Promise.all([
      cache.variantTier(scope, "asset-a", 1024, load),
      cache.variantTier(scope, "asset-a", 1024, load),
      cache.variantTier(scope, "asset-a", 2048, load),
    ]);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it("invalidates only the generated asset's tier metadata and catalogues", async () => {
    const cache = new CanvasImageLoadCache();
    const assetMetadata = vi.fn(async () => []);
    const sharedCatalogue = vi.fn(async () => new Map());
    const unrelatedCatalogue = vi.fn(async () => new Map());

    await cache.tiersForAsset(scope, "asset-a", assetMetadata);
    await cache.tierCatalogue(scope, ["asset-a", "asset-b"], sharedCatalogue);
    await cache.tierCatalogue(scope, ["asset-b"], unrelatedCatalogue);
    cache.invalidateTierMetadata(scope, "asset-a");
    await cache.tiersForAsset(scope, "asset-a", assetMetadata);
    await cache.tierCatalogue(scope, ["asset-a", "asset-b"], sharedCatalogue);
    await cache.tierCatalogue(scope, ["asset-b"], unrelatedCatalogue);

    expect(assetMetadata).toHaveBeenCalledTimes(2);
    expect(sharedCatalogue).toHaveBeenCalledTimes(2);
    expect(unrelatedCatalogue).toHaveBeenCalledOnce();
  });
});
