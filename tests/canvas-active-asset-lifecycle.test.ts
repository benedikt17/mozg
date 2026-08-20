import { describe, expect, it } from "vitest";
import { createEmptyCanvasDocumentV2 } from "@/lib/canvas/canvas-document";
import { LocalCanvasShellController } from "@/lib/canvas/local-canvas-shell-controller";
import type {
  CanvasRepository,
  CanvasViewStateRepository,
} from "@/lib/canvas/local-canvas-repository";

const workspaceId = "20000000-0000-0000-0000-000000000001";
const canvasId = "30000000-0000-0000-0000-000000000001";
const userId = "50000000-0000-0000-0000-000000000001";

describe("Canvas active asset lifecycle", () => {
  it("reactivates the repository Canvas when runtime state is restored from cache", () => {
    const navigations: Array<string | null> = [];
    const repository: CanvasRepository &
      CanvasViewStateRepository & {
        beginCanvasNavigation(canvasId: string | null): void;
      } = {
      listCanvases: async () => [],
      createCanvas: async () => {
        throw new Error("unused");
      },
      loadCanvas: async () => null,
      saveCanvas: async () => ({ status: "saved", revision: 2 }),
      softDeleteCanvas: async () => ({ status: "deleted" }),
      loadViewState: async () => null,
      saveViewState: async () => undefined,
      deleteViewState: async () => undefined,
      beginCanvasNavigation: (nextCanvasId) => navigations.push(nextCanvasId),
    };
    const controller = new LocalCanvasShellController({
      repository,
      workspaceId,
      userId,
    });

    controller.restoreRuntimeState({
      canvasId,
      title: "Cached Canvas",
      revision: 7,
      document: createEmptyCanvasDocumentV2(),
      viewport: { x: 0, y: 0, zoom: 1 },
      status: "saved",
      error: null,
      conflictRevision: null,
      autosaveBlocked: false,
    });

    expect(navigations).toEqual([canvasId]);
  });
});
