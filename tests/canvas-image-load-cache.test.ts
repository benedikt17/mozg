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
});
