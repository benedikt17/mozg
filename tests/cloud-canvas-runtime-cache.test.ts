import { describe, expect, it, vi } from "vitest";
import { createObjectUrlRegistry } from "@/lib/canvas/canvas-image-ingestion";
import {
  CloudCanvasRuntimeCache,
  type CloudCanvasRuntimeScope,
} from "@/lib/canvas/cloud-canvas-runtime-cache";
import { emptyShellState } from "@/lib/canvas/local-canvas-shell-controller";

const userId = "user-a";

function scope(
  workspaceId: string,
  projectId = "project-a",
): CloudCanvasRuntimeScope {
  return { workspaceId, projectId, userId };
}

function snapshot(
  workspaceId: string,
  projectId = "project-a",
  revoke = vi.fn(),
) {
  const objectUrls = createObjectUrlRegistry({
    createObjectURL: () => `blob:${workspaceId}:${projectId}`,
    revokeObjectURL: revoke,
  });
  objectUrls.create(new Blob([`${workspaceId}:${projectId}`]));
  return {
    ...scope(workspaceId, projectId),
    summaries: [],
    canvasId: `canvas-${workspaceId}-${projectId}`,
    shellState: {
      ...emptyShellState(),
      canvasId: `canvas-${workspaceId}-${projectId}`,
    },
    assetPayloads: new Map(),
    objectUrls,
  };
}

describe("CloudCanvasRuntimeCache", () => {
  it("keeps runtime state in bounded memory and revokes URLs on eviction", () => {
    const cache = new CloudCanvasRuntimeCache(1);
    const firstRevoke = vi.fn();
    const first = snapshot("workspace-a", "project-a", firstRevoke);
    cache.set(first);
    cache.set(snapshot("workspace-b"));

    expect(
      cache.get(scope("workspace-a"), "canvas-workspace-a-project-a"),
    ).toBeNull();
    expect(firstRevoke).toHaveBeenCalledWith("blob:workspace-a:project-a");
  });

  it("keeps cache ownership isolated by workspace and user lifecycle", () => {
    const cache = new CloudCanvasRuntimeCache();
    const revoke = vi.fn();
    const entry = snapshot("workspace-a", "project-a", revoke);
    cache.set(entry);

    expect(cache.getActive(scope("workspace-a"))).toBe(entry);
    cache.clearAllExcept("user-b");

    expect(cache.getActive(scope("workspace-a"))).toBeNull();
    expect(revoke).toHaveBeenCalledWith("blob:workspace-a:project-a");
  });

  it("never exposes cached Canvas runtime across Projects", () => {
    const cache = new CloudCanvasRuntimeCache();
    const projectA = snapshot("workspace-a", "project-a");
    const projectB = snapshot("workspace-a", "project-b");
    cache.set(projectA);
    cache.set(projectB);

    expect(cache.getActive(scope("workspace-a", "project-a"))).toBe(projectA);
    expect(cache.getActive(scope("workspace-a", "project-b"))).toBe(projectB);
    expect(
      cache.get(
        scope("workspace-a", "project-b"),
        "canvas-workspace-a-project-a",
      ),
    ).toBeNull();
  });
});
