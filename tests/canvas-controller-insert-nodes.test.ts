import { describe, expect, it } from "vitest";
import {
  emptyShellState,
  LocalCanvasShellController,
} from "@/lib/canvas/local-canvas-shell-controller";
import type {
  CanvasRepository,
  CanvasViewState,
  CanvasViewStateRepository,
} from "@/lib/canvas/local-canvas-repository";

function controller(): LocalCanvasShellController {
  const repository = {} as CanvasRepository & CanvasViewStateRepository;
  const instance = new LocalCanvasShellController({
    repository,
    workspaceId: "workspace-1",
    userId: "user-1",
  });
  instance.restoreRuntimeState({
    ...emptyShellState(),
    canvasId: "canvas-1",
    title: "Canvas",
    status: "saved",
  });
  return instance;
}

describe("LocalCanvasShellController.insertCanvasNodes", () => {
  it("persists the open article as Canvas view state without mutating the graph", async () => {
    const savedViewStates: CanvasViewState[] = [];
    const repository = {
      saveViewState: async (viewState: CanvasViewState): Promise<void> => {
        savedViewStates.push(viewState);
      },
    } as CanvasRepository & CanvasViewStateRepository;
    const instance = new LocalCanvasShellController({
      repository,
      workspaceId: "workspace-1",
      userId: "user-1",
      clock: () => "2026-08-29T00:00:00.000Z",
    });
    instance.restoreRuntimeState({
      ...emptyShellState(),
      canvasId: "canvas-1",
      title: "Canvas",
      status: "saved",
    });
    const document = instance.state.document;

    await instance.saveOpenArticleId("doc-l-koschei");

    expect(instance.state.openArticleId).toBe("doc-l-koschei");
    expect(instance.state.document).toEqual(document);
    expect(savedViewStates).toMatchObject([
      { canvasId: "canvas-1", openArticleId: "doc-l-koschei" },
    ]);
  });

  it("appends a heterogeneous node group in one pending mutation", () => {
    const instance = controller();
    const next = instance.insertCanvasNodes([
      {
        id: "text-copy",
        kind: "text",
        markdown: "Copy",
        position: { x: 24, y: 24 },
        size: { width: 200, height: 100 },
        zIndex: 1,
      },
      {
        id: "task-copy",
        kind: "task",
        taskId: "task-source",
        position: { x: 48, y: 48 },
        size: { width: 300, height: 150 },
        zIndex: 2,
      },
    ]);

    expect(next.status).toBe("saving");
    expect(next.document.nodes.map((node) => node.id)).toEqual([
      "text-copy",
      "task-copy",
    ]);
    expect(instance.hasPendingSave).toBe(true);
  });

  it("ignores duplicate node ids instead of duplicating canonical nodes", () => {
    const instance = controller();
    const node = {
      id: "text-copy",
      kind: "text" as const,
      markdown: "Copy",
      position: { x: 24, y: 24 },
      size: { width: 200, height: 100 },
      zIndex: 1,
    };

    instance.insertCanvasNodes([node]);
    const next = instance.insertCanvasNodes([node]);

    expect(next.document.nodes).toHaveLength(1);
  });
});
