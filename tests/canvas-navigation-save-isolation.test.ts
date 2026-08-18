import { describe, expect, it } from "vitest";
import {
  CANVAS_DOCUMENT_SCHEMA_VERSION,
  createEmptyCanvasDocumentV2,
} from "@/lib/canvas/canvas-document";
import { LocalCanvasShellController } from "@/lib/canvas/local-canvas-shell-controller";
import type {
  CanvasRepository,
  CanvasSummary,
  CanvasViewState,
  CanvasViewStateRepository,
  LoadedCanvas,
} from "@/lib/canvas/local-canvas-repository";

const WORKSPACE = "20000000-0000-0000-0000-000000000001";
const CANVAS_A = "30000000-0000-0000-0000-000000000001";
const CANVAS_B = "30000000-0000-0000-0000-000000000002";
const USER = "50000000-0000-0000-0000-000000000001";
const NOW = "2026-08-18T00:00:00.000Z";

function loadedCanvas(id: string, title: string): LoadedCanvas {
  return {
    id,
    workspaceId: WORKSPACE,
    title,
    revision: 1,
    schemaVersion: CANVAS_DOCUMENT_SCHEMA_VERSION,
    document: createEmptyCanvasDocumentV2(),
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

class RacingNavigationRepository
  implements CanvasRepository, CanvasViewStateRepository
{
  readonly events: string[] = [];
  readonly saveTargets: string[] = [];
  private readonly delayedCanvasA = deferred<LoadedCanvas | null>();
  private readonly canvases = new Map([
    [CANVAS_A, loadedCanvas(CANVAS_A, "A")],
    [CANVAS_B, loadedCanvas(CANVAS_B, "B")],
  ]);

  resolveCanvasA(): void {
    this.delayedCanvasA.resolve(structuredClone(this.canvases.get(CANVAS_A)!));
  }

  beginCanvasNavigation(canvasId: string | null): void {
    this.events.push(`navigate:${canvasId ?? "new"}`);
  }

  async listCanvases(): Promise<CanvasSummary[]> {
    return [...this.canvases.values()];
  }

  async createCanvas(): Promise<LoadedCanvas> {
    this.events.push("create:B");
    return structuredClone(this.canvases.get(CANVAS_B)!);
  }

  async loadCanvas(input: {
    workspaceId: string;
    canvasId: string;
  }): Promise<LoadedCanvas | null> {
    this.events.push(`load:${input.canvasId}`);
    if (input.canvasId === CANVAS_A) return this.delayedCanvasA.promise;
    return structuredClone(this.canvases.get(input.canvasId) ?? null);
  }

  async saveCanvas(input: {
    workspaceId: string;
    canvasId: string;
    expectedRevision: number;
  }) {
    this.events.push(`save:${input.canvasId}`);
    this.saveTargets.push(input.canvasId);
    return { status: "saved" as const, revision: input.expectedRevision + 1 };
  }

  async softDeleteCanvas() {
    return { status: "deleted" as const };
  }

  async loadViewState(): Promise<CanvasViewState | null> {
    return null;
  }

  async saveViewState(): Promise<void> {}

  async deleteViewState(): Promise<void> {}
}

describe("Canvas navigation save isolation", () => {
  it("does not let a stale open replace a newly created active Canvas", async () => {
    const repository = new RacingNavigationRepository();
    const controller = new LocalCanvasShellController({
      repository,
      workspaceId: WORKSPACE,
      userId: USER,
    });

    const staleOpen = controller.openCanvas(CANVAS_A);
    expect(repository.events).toEqual([
      `navigate:${CANVAS_A}`,
      `load:${CANVAS_A}`,
    ]);

    const created = await controller.createCanvas("B");
    expect(created.canvasId).toBe(CANVAS_B);
    expect(controller.state.canvasId).toBe(CANVAS_B);

    repository.resolveCanvasA();
    const staleResult = await staleOpen;

    expect(staleResult.canvasId).toBe(CANVAS_B);
    expect(controller.state.canvasId).toBe(CANVAS_B);

    controller.setTitle("B updated after create");
    await controller.save();

    expect(repository.saveTargets).toEqual([CANVAS_B]);
    expect(repository.events).not.toContain(`save:${CANVAS_A}`);
  });
});
