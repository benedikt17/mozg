import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CANVAS_DOCUMENT_SCHEMA_VERSION,
  createEmptyCanvasDocumentV2,
  type CanvasDocument,
} from "@/lib/canvas/canvas-document";
import type {
  CanvasPendingSaveFlushRegistration,
  CanvasPendingSaveLifecycleRepository,
} from "@/lib/canvas/canvas-pending-save-lifecycle";
import {
  LocalCanvasShellController,
  type LocalCanvasShellControllerOptions,
} from "@/lib/canvas/local-canvas-shell-controller";
import type {
  CanvasRepository,
  CanvasSaveResult,
  CanvasSummary,
  CanvasViewState,
  CanvasViewStateRepository,
  LoadedCanvas,
} from "@/lib/canvas/local-canvas-repository";

const WORKSPACE = "workspace-stage3";
const USER = "user-stage3";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

class PendingSaveRepository
  implements
    CanvasRepository,
    CanvasViewStateRepository,
    CanvasPendingSaveLifecycleRepository
{
  readonly canvases = new Map<string, LoadedCanvas>();
  readonly saveCalls: Array<{
    canvasId: string;
    expectedRevision: number;
    title: string;
    document: CanvasDocument;
  }> = [];
  registration: CanvasPendingSaveFlushRegistration | null = null;
  private nextId = 1;
  private nextSaveGate:
    | {
        started: ReturnType<typeof deferred<void>>;
        release: ReturnType<typeof deferred<void>>;
      }
    | null = null;

  registerPendingSaveFlush(
    registration: CanvasPendingSaveFlushRegistration,
  ): void {
    this.registration = registration;
  }

  seed(id: string, title: string): LoadedCanvas {
    const timestamp = "2026-08-09T00:00:00.000Z";
    const canvas: LoadedCanvas = {
      id,
      workspaceId: WORKSPACE,
      title,
      revision: 1,
      schemaVersion: CANVAS_DOCUMENT_SCHEMA_VERSION,
      document: createEmptyCanvasDocumentV2(),
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    };
    this.canvases.set(id, clone(canvas));
    return clone(canvas);
  }

  blockNextSave() {
    const gate = {
      started: deferred<void>(),
      release: deferred<void>(),
    };
    this.nextSaveGate = gate;
    return gate;
  }

  async listCanvases(workspaceId: string): Promise<CanvasSummary[]> {
    return [...this.canvases.values()]
      .filter(
        (canvas) =>
          canvas.workspaceId === workspaceId && canvas.deletedAt === null,
      )
      .map((canvas) =>
        clone({
          id: canvas.id,
          workspaceId: canvas.workspaceId,
          title: canvas.title,
          groupId: canvas.groupId,
          sortOrder: canvas.sortOrder,
          revision: canvas.revision,
          createdAt: canvas.createdAt,
          updatedAt: canvas.updatedAt,
          deletedAt: canvas.deletedAt,
        }),
      );
  }

  async createCanvas(input: {
    workspaceId: string;
    title: string;
    groupId?: string | null;
  }): Promise<LoadedCanvas> {
    const canvas = this.seed(`created-${this.nextId++}`, input.title);
    return { ...canvas, workspaceId: input.workspaceId, groupId: input.groupId };
  }

  async loadCanvas(input: {
    workspaceId: string;
    canvasId: string;
  }): Promise<LoadedCanvas | null> {
    const canvas = this.canvases.get(input.canvasId);
    return canvas?.workspaceId === input.workspaceId ? clone(canvas) : null;
  }

  async saveCanvas(input: {
    workspaceId: string;
    canvasId: string;
    expectedRevision: number;
    title: string;
    document: CanvasDocument;
  }): Promise<CanvasSaveResult> {
    this.saveCalls.push({
      canvasId: input.canvasId,
      expectedRevision: input.expectedRevision,
      title: input.title,
      document: clone(input.document),
    });
    const gate = this.nextSaveGate;
    if (gate) {
      this.nextSaveGate = null;
      gate.started.resolve();
      await gate.release.promise;
    }
    const current = this.canvases.get(input.canvasId);
    if (!current || current.workspaceId !== input.workspaceId)
      throw new Error("Canvas not found");
    if (current.revision !== input.expectedRevision)
      return { status: "conflict", revision: current.revision };
    const next: LoadedCanvas = {
      ...current,
      title: input.title,
      document: clone(input.document),
      revision: current.revision + 1,
      updatedAt: "2026-08-09T00:00:01.000Z",
    };
    this.canvases.set(input.canvasId, clone(next));
    return { status: "saved", revision: next.revision };
  }

  async softDeleteCanvas(input: {
    workspaceId: string;
    canvasId: string;
  }): Promise<{ status: "deleted" | "already-deleted" }> {
    const current = this.canvases.get(input.canvasId);
    if (!current || current.workspaceId !== input.workspaceId)
      throw new Error("Canvas not found");
    if (current.deletedAt) return { status: "already-deleted" };
    this.canvases.set(input.canvasId, {
      ...current,
      deletedAt: "2026-08-09T00:00:02.000Z",
    });
    return { status: "deleted" };
  }

  async loadViewState(): Promise<CanvasViewState | null> {
    return null;
  }

  async saveViewState(): Promise<void> {}

  async deleteViewState(): Promise<void> {}
}

function controllerOptions(
  repository: PendingSaveRepository,
): LocalCanvasShellControllerOptions {
  return {
    repository,
    workspaceId: WORKSPACE,
    userId: USER,
    clock: () => "2026-08-09T00:00:00.000Z",
  };
}

describe("Stage 3.1 Canvas pending-save lifecycle", () => {
  it("flushes the current Canvas before switching to another Canvas", async () => {
    const repository = new PendingSaveRepository();
    repository.seed("canvas-a", "Canvas A");
    repository.seed("canvas-b", "Canvas B");
    const controller = new LocalCanvasShellController(
      controllerOptions(repository),
    );

    await controller.openCanvas("canvas-a");
    controller.setTitle("Canvas A edited");
    expect(controller.hasPendingSave).toBe(true);

    await controller.openCanvas("canvas-b");

    expect(repository.saveCalls).toHaveLength(1);
    expect(repository.saveCalls[0]).toMatchObject({
      canvasId: "canvas-a",
      expectedRevision: 1,
      title: "Canvas A edited",
    });
    expect(repository.canvases.get("canvas-a")).toMatchObject({
      title: "Canvas A edited",
      revision: 2,
    });
    expect(controller.state).toMatchObject({
      canvasId: "canvas-b",
      status: "saved",
    });
  });

  it("serializes an in-flight save and flushes edits made while it is pending", async () => {
    const repository = new PendingSaveRepository();
    repository.seed("canvas-a", "Canvas A");
    const controller = new LocalCanvasShellController(
      controllerOptions(repository),
    );
    await controller.openCanvas("canvas-a");

    const gate = repository.blockNextSave();
    controller.setTitle("First edit");
    const firstSave = controller.save();
    await gate.started.promise;

    controller.setTitle("Second edit");
    const flush = controller.flushPendingSave();
    gate.release.resolve();

    await firstSave;
    await flush;

    expect(repository.saveCalls).toHaveLength(2);
    expect(repository.saveCalls.map((call) => call.title)).toEqual([
      "First edit",
      "Second edit",
    ]);
    expect(repository.saveCalls.map((call) => call.expectedRevision)).toEqual([
      1, 2,
    ]);
    expect(repository.canvases.get("canvas-a")).toMatchObject({
      title: "Second edit",
      revision: 3,
    });
    expect(controller.hasPendingSave).toBe(false);
    expect(controller.state).toMatchObject({ revision: 3, status: "saved" });
  });

  it("registers a leave/unmount flush with lifecycle-aware repositories", async () => {
    const repository = new PendingSaveRepository();
    repository.seed("canvas-a", "Canvas A");
    const controller = new LocalCanvasShellController(
      controllerOptions(repository),
    );
    await controller.openCanvas("canvas-a");
    controller.setTitle("Saved on leave");

    expect(repository.registration?.userId).toBe(USER);
    const flushed = await repository.registration!.flush();

    expect(flushed).toMatchObject({
      canvasId: "canvas-a",
      title: "Saved on leave",
      revision: 2,
      status: "saved",
    });
    expect(repository.canvases.get("canvas-a")).toMatchObject({
      title: "Saved on leave",
      revision: 2,
    });
    expect(await repository.registration!.flush()).toBeNull();
    expect(repository.saveCalls).toHaveLength(1);
  });

  it("blocks switching away when the pending flush detects a CAS conflict", async () => {
    const repository = new PendingSaveRepository();
    repository.seed("canvas-a", "Canvas A");
    repository.seed("canvas-b", "Canvas B");
    const first = new LocalCanvasShellController(controllerOptions(repository));
    const second = new LocalCanvasShellController(controllerOptions(repository));
    await first.openCanvas("canvas-a");
    await second.openCanvas("canvas-a");

    first.setTitle("Remote winner");
    await first.flushPendingSave();
    second.setTitle("Local pending edit");

    await expect(second.openCanvas("canvas-b")).rejects.toThrow(
      "Resolve the current Canvas save conflict before leaving it.",
    );
    expect(second.state).toMatchObject({
      canvasId: "canvas-a",
      status: "conflict",
      autosaveBlocked: true,
      conflictRevision: 2,
    });
  });

  it("keeps cleanup projection before repository.close and syncs cloud warm cache after flush", () => {
    const shell = readFileSync(
      new URL(
        "../src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    const adapter = readFileSync(
      new URL("../src/lib/canvas/cloud-canvas-shell-adapter.ts", import.meta.url),
      "utf8",
    );

    const nodeProjection = shell.indexOf(
      "controller.setRuntimeNodes(nodesRef.current)",
    );
    const edgeProjection = shell.indexOf(
      "latestState = controller.setRuntimeEdges(edgesRef.current)",
    );
    const close = shell.indexOf("repository.close?.()", edgeProjection);

    expect(nodeProjection).toBeGreaterThan(-1);
    expect(edgeProjection).toBeGreaterThan(nodeProjection);
    expect(close).toBeGreaterThan(edgeProjection);
    expect(adapter).toContain("registerPendingSaveFlush(");
    expect(adapter).toContain("cloudCanvasRuntimeCache.get(scope, state.canvasId)");
    expect(adapter).toContain("cloudCanvasRuntimeCache.set({");
  });
});
