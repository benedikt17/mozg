import type { ObjectUrlRegistry } from "@/lib/canvas/canvas-image-ingestion";
import type { CanvasImageNodeData } from "@/lib/canvas/react-flow-canvas-adapter";
import type { CanvasSummary } from "@/lib/canvas/local-canvas-repository";
import type { LocalCanvasShellState } from "@/lib/canvas/local-canvas-shell-controller";

export type CloudCanvasRuntimeScope = {
  workspaceId: string;
  userId: string;
};

export type CloudCanvasRuntimeSnapshot = CloudCanvasRuntimeScope & {
  canvasId: string;
  summaries: CanvasSummary[];
  shellState: LocalCanvasShellState;
  assetPayloads: Map<string, CanvasImageRuntimePayload>;
  objectUrls: ObjectUrlRegistry;
};

/** Runtime-only image content; canonical geometry stays in CanvasDocumentV2. */
export type CanvasImageRuntimePayload = Pick<
  CanvasImageNodeData,
  | "objectUrl"
  | "mimeType"
  | "intrinsicWidth"
  | "intrinsicHeight"
  | "source"
  | "variantKind"
  | "resolutionSource"
>;

function scopeKey(scope: CloudCanvasRuntimeScope): string {
  return `${scope.userId}:${scope.workspaceId}`;
}

function keyOf(scope: CloudCanvasRuntimeScope, canvasId: string): string {
  return `${scopeKey(scope)}:${canvasId}`;
}

/**
 * Browser-memory-only cache for the last active cloud Canvas in each workspace.
 * It deliberately holds runtime projections and object URLs, never canonical data.
 */
export class CloudCanvasRuntimeCache {
  private readonly entries = new Map<string, CloudCanvasRuntimeSnapshot>();
  private readonly activeCanvasIds = new Map<string, string>();

  constructor(private readonly capacity = 4) {}

  get(
    scope: CloudCanvasRuntimeScope,
    canvasId: string,
  ): CloudCanvasRuntimeSnapshot | null {
    const key = keyOf(scope, canvasId);
    const entry = this.entries.get(key);
    if (!entry) return null;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry;
  }

  getActive(scope: CloudCanvasRuntimeScope): CloudCanvasRuntimeSnapshot | null {
    const canvasId = this.activeCanvasIds.get(scopeKey(scope));
    return canvasId ? this.get(scope, canvasId) : null;
  }

  set(snapshot: CloudCanvasRuntimeSnapshot): void {
    const key = keyOf(snapshot, snapshot.canvasId);
    const replaced = this.entries.get(key);
    if (replaced && replaced.objectUrls !== snapshot.objectUrls) {
      replaced.objectUrls.revokeAll();
    }
    this.entries.delete(key);
    this.entries.set(key, snapshot);
    this.activeCanvasIds.set(scopeKey(snapshot), snapshot.canvasId);
    while (this.entries.size > this.capacity) {
      const oldest = this.entries.entries().next().value as
        [string, CloudCanvasRuntimeSnapshot] | undefined;
      if (!oldest) return;
      this.entries.delete(oldest[0]);
      oldest[1].objectUrls.revokeAll();
      if (
        this.activeCanvasIds.get(scopeKey(oldest[1])) === oldest[1].canvasId
      ) {
        this.activeCanvasIds.delete(scopeKey(oldest[1]));
      }
    }
  }

  clearScope(scope: CloudCanvasRuntimeScope): void {
    for (const [key, entry] of this.entries) {
      if (
        entry.workspaceId !== scope.workspaceId ||
        entry.userId !== scope.userId
      )
        continue;
      this.entries.delete(key);
      entry.objectUrls.revokeAll();
    }
    this.activeCanvasIds.delete(scopeKey(scope));
  }

  clearUser(userId: string): void {
    for (const [key, entry] of this.entries) {
      if (entry.userId !== userId) continue;
      this.entries.delete(key);
      entry.objectUrls.revokeAll();
      this.activeCanvasIds.delete(scopeKey(entry));
    }
  }

  clearAllExcept(userId: string | null): void {
    for (const [key, entry] of this.entries) {
      if (userId && entry.userId === userId) continue;
      this.entries.delete(key);
      entry.objectUrls.revokeAll();
      this.activeCanvasIds.delete(scopeKey(entry));
    }
  }
}

export const cloudCanvasRuntimeCache = new CloudCanvasRuntimeCache();
