import { describe, expect, it } from "vitest";
import {
  emptyShellState,
  LocalCanvasShellController,
} from "@/lib/canvas/local-canvas-shell-controller";
import type {
  CanvasRepository,
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
