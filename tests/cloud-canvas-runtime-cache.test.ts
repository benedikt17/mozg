import { describe, expect, it, vi } from "vitest";
import { createObjectUrlRegistry } from "@/lib/canvas/canvas-image-ingestion";
import {
  CloudCanvasRuntimeCache,
  type CloudCanvasRuntimeScope,
} from "@/lib/canvas/cloud-canvas-runtime-cache";
import { emptyShellState } from "@/lib/canvas/local-canvas-shell-controller";

const userId = "user-a";

function scope(workspaceId: string): CloudCanvasRuntimeScope {
  return { workspaceId, userId };
}

function snapshot(workspaceId: string, revoke = vi.fn()) {
  const objectUrls = createObjectUrlRegistry({
    createObjectURL: () => `blob:${workspaceId}`,
    revokeObjectURL: revoke,
  });
  objectUrls.create(new Blob([workspaceId]));
  return {
    ...scope(workspaceId),
    summaries: [],
    canvasId: `canvas-${workspaceId}`,
    shellState: { ...emptyShellState(), canvasId: `canvas-${workspaceId}` },
    assetPayloads: new Map(),
    objectUrls,
  };
}

describe("CloudCanvasRuntimeCache", () => {
  it("keeps runtime state in bounded memory and revokes URLs on eviction", () => {
    const cache = new CloudCanvasRuntimeCache(1);
    const firstRevoke = vi.fn();
    const first = snapshot("workspace-a", firstRevoke);
    cache.set(first);
    cache.set(snapshot("workspace-b"));

    expect(cache.get(scope("workspace-a"), "canvas-workspace-a")).toBeNull();
    expect(firstRevoke).toHaveBeenCalledWith("blob:workspace-a");
  });

  it("keeps cache ownership isolated by workspace and user lifecycle", () => {
    const cache = new CloudCanvasRuntimeCache();
    const revoke = vi.fn();
    const entry = snapshot("workspace-a", revoke);
    cache.set(entry);

    expect(cache.getActive(scope("workspace-a"))).toBe(entry);
    cache.clearAllExcept("user-b");

    expect(cache.getActive(scope("workspace-a"))).toBeNull();
    expect(revoke).toHaveBeenCalledWith("blob:workspace-a");
  });
});
