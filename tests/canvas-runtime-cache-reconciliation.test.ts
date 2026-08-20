import { describe, expect, it } from "vitest";
import { createEmptyCanvasDocumentV2 } from "@/lib/canvas/canvas-document";
import {
  reconcileCachedRuntimeWithServer,
  serverCanvasMatchesCachedRuntime,
} from "@/lib/canvas/canvas-runtime-cache-reconciliation";
import type { LoadedCanvas } from "@/lib/canvas/local-canvas-repository";
import type { LocalCanvasShellState } from "@/lib/canvas/local-canvas-shell-controller";

const canvasId = "30000000-0000-0000-0000-000000000001";
const workspaceId = "20000000-0000-0000-0000-000000000001";
const document = createEmptyCanvasDocumentV2();
const cached: LocalCanvasShellState = {
  canvasId,
  title: "Canvas",
  revision: 4,
  document,
  viewport: { x: 10, y: 20, zoom: 1.1 },
  status: "saving",
  error: null,
  conflictRevision: null,
  autosaveBlocked: false,
};
const latest: LoadedCanvas = {
  id: canvasId,
  workspaceId,
  title: "Canvas",
  groupId: null,
  sortOrder: 0,
  schemaVersion: 1,
  revision: 5,
  document,
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:01:00.000Z",
  deletedAt: null,
};

describe("Canvas runtime cache reconciliation", () => {
  it("recognizes an already-flushed cached document despite a newer server revision", () => {
    expect(serverCanvasMatchesCachedRuntime(latest, cached)).toBe(true);
    expect(reconcileCachedRuntimeWithServer(latest, cached)).toEqual(
      expect.objectContaining({
        revision: 5,
        status: "saved",
        autosaveBlocked: false,
        viewport: cached.viewport,
      }),
    );
  });

  it("does not dismiss a real divergent server state as the same Canvas", () => {
    const divergent: LoadedCanvas = { ...latest, title: "Changed elsewhere" };
    expect(serverCanvasMatchesCachedRuntime(divergent, cached)).toBe(false);
  });
});
