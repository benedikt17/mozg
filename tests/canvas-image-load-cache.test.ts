import { describe, expect, it, vi } from "vitest";
import { CanvasImageLoadCache } from "@/lib/canvas/canvas-image-load-cache";

const scope = {
  userId: "user-a",
  workspaceId: "workspace-a",
  canvasId: "canvas-a",
};

describe("CanvasImageLoadCache", () => {
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
