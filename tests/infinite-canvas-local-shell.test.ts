import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  parseCanvasDocumentV2,
  parseCanvasDocumentV1,
  type CanvasDocumentV1,
} from "@/lib/canvas/canvas-document";
import type { CanvasTaskBridge } from "@/lib/canvas/canvas-task-bridge";
import {
  createObjectUrlRegistry,
  eventTouchesEditingSurface,
  extractCanvasImageTransfer,
  type CanvasImageTransferPayload,
} from "@/lib/canvas/canvas-image-ingestion";
import {
  canvasDocumentToTaskNodes,
  canvasDocumentToImageNodes,
  createCanvasTaskFlowNode,
  createCanvasTextFlowNode,
  imageNodesToCanvasDocument,
  ingestCanvasImageTransferToNodes,
  restoreCanvasImageNodes,
  runtimeNodesToCanvasDocument,
  type CanvasImageFlowNode,
} from "@/lib/canvas/react-flow-canvas-adapter";
import { shouldCloseCanvasTaskDetails } from "@/lib/canvas/canvas-task-selection";
import type { CanvasAssetVariantRepository } from "@/lib/canvas/canvas-image-variants";
import {
  LocalCanvasShellController,
  type LocalCanvasShellControllerOptions,
} from "@/lib/canvas/local-canvas-shell-controller";
import type {
  CanvasAssetRecord,
  CanvasAssetRepository,
  CanvasRepository,
  CanvasSaveResult,
  CanvasSummary,
  CanvasViewState,
  CanvasViewStateRepository,
  LoadedCanvas,
  StoreLocalCanvasImageInput,
} from "@/lib/canvas/local-canvas-repository";

const WORKSPACE_A = "shell-workspace-a";
const WORKSPACE_B = "shell-workspace-b";
const USER = "shell-user";

function documentWithImage(
  overrides: Partial<CanvasDocumentV1["nodes"][number]> = {},
): CanvasDocumentV1 {
  return parseCanvasDocumentV1({
    schemaVersion: 1,
    nodes: [
      {
        id: "image-node-1",
        kind: "image",
        assetId: "asset-1",
        position: { x: 120, y: 240 },
        size: { width: 320, height: 180 },
        zIndex: 1,
        aspectRatioLocked: true,
        ...overrides,
      },
    ],
    edges: [],
  });
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

class MemoryCanvasRepository
  implements CanvasRepository, CanvasViewStateRepository, CanvasAssetRepository
{
  canvases = new Map<string, LoadedCanvas>();
  views = new Map<string, CanvasViewState>();
  assets = new Map<string, CanvasAssetRecord>();
  saveCalls = 0;
  loadCalls = 0;
  assetLoadCalls = 0;
  nextId = 1;
  delayMs = 0;

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
          revision: canvas.revision,
          createdAt: canvas.createdAt,
          updatedAt: canvas.updatedAt,
          deletedAt: canvas.deletedAt,
        }),
      )
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  async createCanvas(input: {
    workspaceId: string;
    title: string;
  }): Promise<LoadedCanvas> {
    const now = new Date().toISOString();
    const canvas: LoadedCanvas = {
      id: `canvas-${this.nextId++}`,
      workspaceId: input.workspaceId,
      title: input.title,
      schemaVersion: 1,
      document: { schemaVersion: 1, nodes: [], edges: [] },
      revision: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.canvases.set(canvas.id, clone(canvas));
    return clone(canvas);
  }

  async loadCanvas(input: {
    workspaceId: string;
    canvasId: string;
  }): Promise<LoadedCanvas | null> {
    this.loadCalls += 1;
    const canvas = this.canvases.get(input.canvasId);
    if (
      !canvas ||
      canvas.workspaceId !== input.workspaceId ||
      canvas.deletedAt !== null
    )
      return null;
    return clone(canvas);
  }

  async saveCanvas(input: {
    workspaceId: string;
    canvasId: string;
    expectedRevision: number;
    title: string;
    document: CanvasDocumentV1;
  }): Promise<CanvasSaveResult> {
    this.saveCalls += 1;
    const current = this.canvases.get(input.canvasId);
    if (!current || current.workspaceId !== input.workspaceId)
      throw new Error("not found");
    if (current.revision !== input.expectedRevision)
      return { status: "conflict", revision: current.revision };
    const next = {
      ...current,
      title: input.title,
      document: clone(input.document),
      revision: current.revision + 1,
      updatedAt: new Date().toISOString(),
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
      throw new Error("not found");
    if (current.deletedAt !== null) return { status: "already-deleted" };
    this.canvases.set(input.canvasId, {
      ...current,
      deletedAt: new Date().toISOString(),
    });
    return { status: "deleted" };
  }

  async loadViewState(input: {
    canvasId: string;
    userId: string;
  }): Promise<CanvasViewState | null> {
    return clone(this.views.get(`${input.canvasId}:${input.userId}`) ?? null);
  }

  async saveViewState(input: CanvasViewState): Promise<void> {
    this.views.set(`${input.canvasId}:${input.userId}`, clone(input));
  }

  async deleteViewState(input: {
    canvasId: string;
    userId: string;
  }): Promise<void> {
    this.views.delete(`${input.canvasId}:${input.userId}`);
  }

  async storeImage(
    input: StoreLocalCanvasImageInput,
  ): Promise<CanvasAssetRecord> {
    const now = new Date().toISOString();
    const record: CanvasAssetRecord = {
      id: input.id ?? `asset-${this.nextId++}`,
      workspaceId: input.workspaceId,
      blob: input.blob,
      preview: input.preview ?? null,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
      width: input.width,
      height: input.height,
      checksum: input.checksum ?? null,
      createdAt: now,
      readyAt: now,
      deletedAt: null,
    };
    this.assets.set(record.id, clone(record));
    return clone(record);
  }

  async loadAsset(input: {
    workspaceId: string;
    assetId: string;
  }): Promise<CanvasAssetRecord | null> {
    this.assetLoadCalls += 1;
    if (this.delayMs > 0)
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    const asset = this.assets.get(input.assetId);
    if (
      !asset ||
      asset.workspaceId !== input.workspaceId ||
      asset.deletedAt !== null
    )
      return null;
    return clone(asset);
  }

  async markAssetDeleted(input: {
    workspaceId: string;
    assetId: string;
  }): Promise<void> {
    const asset = this.assets.get(input.assetId);
    if (asset?.workspaceId === input.workspaceId)
      this.assets.set(input.assetId, {
        ...asset,
        deletedAt: new Date().toISOString(),
      });
  }
}

function controllerOptions(
  repository: MemoryCanvasRepository,
  workspaceId = WORKSPACE_A,
): LocalCanvasShellControllerOptions {
  return {
    repository,
    workspaceId,
    userId: USER,
    clock: () => "2026-08-01T00:00:00.000Z",
  };
}

async function canvasWithImage(
  repository: MemoryCanvasRepository,
  workspaceId = WORKSPACE_A,
) {
  const canvas = await repository.createCanvas({
    workspaceId,
    title: "Canvas",
  });
  await repository.storeImage({
    id: "asset-1",
    workspaceId,
    blob: new Blob(["png"], { type: "image/png" }),
    mimeType: "image/png",
    byteSize: 3,
    width: 640,
    height: 360,
  });
  await repository.saveCanvas({
    workspaceId,
    canvasId: canvas.id,
    expectedRevision: 1,
    title: canvas.title,
    document: documentWithImage(),
  });
  return repository.loadCanvas({ workspaceId, canvasId: canvas.id });
}

function urlRegistry() {
  let sequence = 0;
  const revoked: string[] = [];
  const registry = createObjectUrlRegistry({
    createObjectURL: () => `blob:shell-${++sequence}`,
    revokeObjectURL: (url) => revoked.push(url),
  });
  return { registry, revoked };
}

describe("production-shaped local Canvas shell", () => {
  it("closes task details only when every matching reference leaves selection", () => {
    const selectedTask = {
      ...createCanvasTaskFlowNode({
        id: "task-node-a",
        taskId: "task-a",
        position: { x: 0, y: 0 },
      }),
      selected: true,
    };
    const duplicateTask = {
      ...createCanvasTaskFlowNode({
        id: "task-node-a-copy",
        taskId: "task-a",
        position: { x: 320, y: 0 },
      }),
      selected: false,
    };
    const otherTask = {
      ...createCanvasTaskFlowNode({
        id: "task-node-b",
        taskId: "task-b",
        position: { x: 0, y: 220 },
      }),
      selected: true,
    };
    const textNode = createCanvasTextFlowNode({
      id: "text-node",
      markdown: "text",
      position: { x: 320, y: 220 },
    });

    expect(shouldCloseCanvasTaskDetails("task-a", [selectedTask])).toBe(false);
    expect(
      shouldCloseCanvasTaskDetails("task-a", [selectedTask, duplicateTask]),
    ).toBe(false);
    expect(
      shouldCloseCanvasTaskDetails("task-a", [duplicateTask, otherTask]),
    ).toBe(true);
    expect(shouldCloseCanvasTaskDetails("task-a", [otherTask, textNode])).toBe(
      true,
    );
    expect(shouldCloseCanvasTaskDetails(undefined, [otherTask])).toBe(false);
  });

  it("loads strict CanvasDocumentV1 image nodes with canonical position and size", async () => {
    const repository = new MemoryCanvasRepository();
    await repository.storeImage({
      id: "asset-1",
      workspaceId: WORKSPACE_A,
      blob: new Blob(["x"], { type: "image/png" }),
      mimeType: "image/png",
      byteSize: 1,
      width: 640,
      height: 360,
    });
    const { registry } = urlRegistry();
    const result = await restoreCanvasImageNodes(documentWithImage(), {
      assetRepository: repository,
      objectUrls: registry,
      workspaceId: WORKSPACE_A,
    });
    expect(result.nodes[0]?.position).toEqual({ x: 120, y: 240 });
    expect(result.nodes[0]?.width).toBe(320);
    expect(result.nodes[0]?.height).toBe(180);
    expect(result.nodes[0]?.style).toEqual({ width: 320, height: 180 });
    expect(parseCanvasDocumentV1(documentWithImage())).toEqual(
      documentWithImage(),
    );
  });

  it("uses real variant dimensions instead of a nominal thumbnail threshold", async () => {
    const repository = new MemoryCanvasRepository();
    const { registry } = urlRegistry();
    const variantRepository = {
      listVariants: vi.fn(async () => [
        {
          workspaceId: WORKSPACE_A,
          canvasId: "canvas-1",
          assetId: "asset-1",
          kind: "thumbnail" as const,
          storagePath: "thumbnail.webp",
          mimeType: "image/webp" as const,
          byteSize: 10,
          pixelWidth: 512,
          pixelHeight: 288,
          createdAt: "2026-08-03T10:00:00.000Z",
        },
        {
          workspaceId: WORKSPACE_A,
          canvasId: "canvas-1",
          assetId: "asset-1",
          kind: "preview" as const,
          storagePath: "preview.webp",
          mimeType: "image/webp" as const,
          byteSize: 20,
          pixelWidth: 2048,
          pixelHeight: 1152,
          createdAt: "2026-08-03T10:00:00.000Z",
        },
      ]),
      loadVariant: vi.fn(async (input) =>
        input.kind === "preview"
          ? {
              workspaceId: WORKSPACE_A,
              canvasId: "canvas-1",
              assetId: "asset-1",
              kind: "preview" as const,
              storagePath: "preview.webp",
              mimeType: "image/webp" as const,
              byteSize: 20,
              pixelWidth: 2048,
              pixelHeight: 1152,
              createdAt: "2026-08-03T10:00:00.000Z",
              blob: new Blob(["preview"], { type: "image/webp" }),
            }
          : null,
      ),
      storeVariant: vi.fn(),
      deleteVariants: vi.fn(),
    } satisfies CanvasAssetVariantRepository;
    const restored = await restoreCanvasImageNodes(
      documentWithImage({ size: { width: 1100, height: 620 } }),
      {
        assetRepository: repository,
        variantRepository,
        objectUrls: registry,
        workspaceId: WORKSPACE_A,
        canvasId: "canvas-1",
      },
      { viewportZoom: 1, devicePixelRatio: 1.25 },
    );

    expect(variantRepository.loadVariant).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "preview" }),
    );
    expect(restored.nodes[0]?.data.variantKind).toBe("preview");
  });

  it("does not emit a stale lower-resolution completion after abort", async () => {
    const repository = new MemoryCanvasRepository();
    const { registry } = urlRegistry();
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const variantRepository = {
      listVariants: vi.fn(async () => [
        {
          workspaceId: WORKSPACE_A,
          canvasId: "canvas-1",
          assetId: "asset-1",
          kind: "thumbnail" as const,
          storagePath: "thumbnail.webp",
          mimeType: "image/webp" as const,
          byteSize: 10,
          pixelWidth: 512,
          pixelHeight: 288,
          createdAt: "2026-08-03T10:00:00.000Z",
        },
      ]),
      loadVariant: vi.fn(async () => {
        await gate;
        return {
          workspaceId: WORKSPACE_A,
          canvasId: "canvas-1",
          assetId: "asset-1",
          kind: "thumbnail" as const,
          storagePath: "thumbnail.webp",
          mimeType: "image/webp" as const,
          byteSize: 10,
          pixelWidth: 512,
          pixelHeight: 288,
          createdAt: "2026-08-03T10:00:00.000Z",
          blob: new Blob(["thumbnail"], { type: "image/webp" }),
        };
      }),
      storeVariant: vi.fn(),
      deleteVariants: vi.fn(),
    } satisfies CanvasAssetVariantRepository;
    const abort = new AbortController();
    const onNode = vi.fn();
    const pending = restoreCanvasImageNodes(
      documentWithImage(),
      {
        assetRepository: repository,
        variantRepository,
        objectUrls: registry,
        workspaceId: WORKSPACE_A,
        canvasId: "canvas-1",
      },
      { signal: abort.signal, onNode },
    );
    await vi.waitFor(() =>
      expect(variantRepository.loadVariant).toHaveBeenCalledOnce(),
    );
    abort.abort();
    release?.();

    await expect(pending).resolves.toMatchObject({ staleIgnored: true });
    expect(onNode).not.toHaveBeenCalled();
    expect(registry.count()).toBe(0);
  });

  it("serializes runtime nodes back to strict canonical data without Blob or Object URL fields", () => {
    const source = documentWithImage();
    const runtime = canvasDocumentToImageNodes(source)[0];
    runtime.data.objectUrl = "blob:runtime-only";
    runtime.data.intrinsicWidth = 999;
    runtime.position = { x: 12, y: 34 };
    runtime.style = { width: 500, height: 250 };
    const serialized = imageNodesToCanvasDocument(source, [runtime]);
    expect(serialized.nodes[0]).toEqual(
      expect.objectContaining({
        position: { x: 12, y: 34 },
        size: { width: 500, height: 250 },
      }),
    );
    expect(JSON.stringify(serialized)).not.toContain("objectUrl");
    expect(JSON.stringify(serialized)).not.toContain("blob:runtime-only");
    expect(parseCanvasDocumentV2(serialized)).toEqual(serialized);
  });

  it("updates canonical position and size after move and resize", () => {
    const source = documentWithImage();
    const runtime = canvasDocumentToImageNodes(source)[0];
    runtime.position = { x: 700, y: 800 };
    runtime.style = { width: 420, height: 210 };
    const serialized = imageNodesToCanvasDocument(source, [runtime]);
    expect(serialized.nodes[0]?.position).toEqual({ x: 700, y: 800 });
    expect(serialized.nodes[0]?.size).toEqual({ width: 420, height: 210 });
  });

  it("persists insertion, reloads exact layout, and removes only the canonical node", async () => {
    const repository = new MemoryCanvasRepository();
    const controller = new LocalCanvasShellController(
      controllerOptions(repository),
    );
    const created = await controller.createCanvas("Images");
    await repository.storeImage({
      id: "inserted",
      workspaceId: WORKSPACE_A,
      blob: new Blob(["jpeg"], { type: "image/jpeg" }),
      mimeType: "image/jpeg",
      byteSize: 4,
      width: 800,
      height: 400,
    });
    const { registry } = urlRegistry();
    const inserted = await restoreCanvasImageNodes(
      parseCanvasDocumentV1({ schemaVersion: 1, nodes: [], edges: [] }),
      {
        assetRepository: repository,
        objectUrls: registry,
        workspaceId: WORKSPACE_A,
      },
    );
    const node: CanvasImageFlowNode = {
      id: "inserted",
      type: "canvasImage",
      position: { x: 9, y: 11 },
      style: { width: 300, height: 150 },
      data: {
        assetId: "inserted",
        mimeType: "image/jpeg",
        intrinsicWidth: 800,
        intrinsicHeight: 400,
        objectUrl: "blob:inserted",
        source: "file-picker",
      },
    };
    expect(inserted.nodes).toHaveLength(0);
    controller.insertImageNodes([node]);
    await controller.save();
    const opened = new LocalCanvasShellController(
      controllerOptions(repository),
    );
    const reloaded = await opened.openCanvas(created.canvasId!);
    expect(reloaded.document.nodes[0]).toEqual(
      expect.objectContaining({
        id: "inserted",
        assetId: "inserted",
        position: { x: 9, y: 11 },
        size: { width: 300, height: 150 },
      }),
    );
    opened.removeImageNodes(["inserted"]);
    await opened.save();
    expect(
      (
        await repository.loadCanvas({
          workspaceId: WORKSPACE_A,
          canvasId: created.canvasId!,
        })
      )?.document.nodes,
    ).toEqual([]);
  });

  it("keeps viewport separate from Canvas revision and restores it", async () => {
    const repository = new MemoryCanvasRepository();
    const controller = new LocalCanvasShellController(
      controllerOptions(repository),
    );
    const created = await controller.createCanvas("Viewport");
    const revision = created.revision;
    await controller.saveViewport({ x: 120, y: -40, zoom: 1.75 });
    const loaded = await repository.loadCanvas({
      workspaceId: WORKSPACE_A,
      canvasId: created.canvasId!,
    });
    expect(loaded?.revision).toBe(revision);
    const reopened = new LocalCanvasShellController(
      controllerOptions(repository),
    );
    expect((await reopened.openCanvas(created.canvasId!)).viewport).toEqual({
      x: 120,
      y: -40,
      zoom: 1.75,
    });
  });

  it("does not save during initial hydration and advances CAS revision only on save", async () => {
    const repository = new MemoryCanvasRepository();
    const canvas = await canvasWithImage(repository);
    const controller = new LocalCanvasShellController(
      controllerOptions(repository),
    );
    await controller.openCanvas(canvas!.id);
    expect(repository.saveCalls).toBe(1);
    controller.setDocument(documentWithImage({ position: { x: 1, y: 2 } }));
    const result = await controller.save();
    expect(result).toEqual({ status: "saved", revision: 3 });
  });

  it("blocks stale CAS retries and preserves the losing editor state", async () => {
    const repository = new MemoryCanvasRepository();
    const canvas = await repository.createCanvas({
      workspaceId: WORKSPACE_A,
      title: "Shared",
    });
    const first = new LocalCanvasShellController(controllerOptions(repository));
    const second = new LocalCanvasShellController(
      controllerOptions(repository),
    );
    await first.openCanvas(canvas.id);
    await second.openCanvas(canvas.id);
    first.setDocument(documentWithImage({ position: { x: 50, y: 60 } }));
    expect(await first.save()).toEqual({ status: "saved", revision: 2 });
    second.setDocument(documentWithImage({ position: { x: 900, y: 901 } }));
    expect(await second.save()).toEqual({ status: "conflict", revision: 2 });
    expect(second.state.status).toBe("conflict");
    expect(second.state.autosaveBlocked).toBe(true);
    expect(second.state.document.nodes[0]?.position).toEqual({
      x: 900,
      y: 901,
    });
    const calls = repository.saveCalls;
    expect(await second.save()).toBeNull();
    expect(repository.saveCalls).toBe(calls);
    expect(
      (
        await repository.loadCanvas({
          workspaceId: WORKSPACE_A,
          canvasId: canvas.id,
        })
      )?.document.nodes[0]?.position,
    ).toEqual({ x: 50, y: 60 });
  });

  it("restores assets progressively with bounded reads and cancels stale work", async () => {
    const repository = new MemoryCanvasRepository();
    const nodes = Array.from({ length: 8 }, (_, index) => ({
      id: `node-${index}`,
      kind: "image" as const,
      assetId: `asset-${index}`,
      position: { x: index, y: index },
      size: { width: 100, height: 80 },
      zIndex: index,
      aspectRatioLocked: true,
    }));
    const document = parseCanvasDocumentV1({
      schemaVersion: 1,
      nodes,
      edges: [],
    });
    for (const node of nodes)
      await repository.storeImage({
        id: node.assetId,
        workspaceId: WORKSPACE_A,
        blob: new Blob([node.id], { type: "image/png" }),
        mimeType: "image/png",
        byteSize: node.id.length,
        width: 100,
        height: 80,
      });
    repository.delayMs = 4;
    const { registry } = urlRegistry();
    const seen: string[] = [];
    const result = await restoreCanvasImageNodes(
      document,
      {
        assetRepository: repository,
        objectUrls: registry,
        workspaceId: WORKSPACE_A,
      },
      { concurrency: 3, onNode: (node) => seen.push(node.id) },
    );
    expect(result.nodes).toHaveLength(8);
    expect(result.maxConcurrentAssetReads).toBeLessThanOrEqual(3);
    expect(result.assetReadCount).toBe(8);
    expect(seen.length).toBe(8);
    const controller = new AbortController();
    repository.delayMs = 20;
    const pending = restoreCanvasImageNodes(
      document,
      {
        assetRepository: repository,
        objectUrls: registry,
        workspaceId: WORKSPACE_A,
      },
      { signal: controller.signal, concurrency: 2 },
    );
    controller.abort();
    const cancelled = await pending;
    expect(cancelled.staleIgnored).toBe(true);
  });

  it("keeps Object URLs stable until explicit switch cleanup", () => {
    const { registry, revoked } = urlRegistry();
    const first = registry.create(new Blob(["one"]));
    const second = registry.create(new Blob(["two"]));
    expect(registry.count()).toBe(2);
    registry.revoke(first);
    expect(registry.count()).toBe(1);
    registry.revokeAll();
    expect(registry.count()).toBe(0);
    expect(revoked).toEqual([first, second]);
  });

  it("preserves duplicate clipboard semantics and editable-surface guard", () => {
    const file = new File(["png"], "capture.png", { type: "image/png" });
    const payload: CanvasImageTransferPayload = {
      items: [{ kind: "file", type: file.type, getAsFile: () => file }],
      files: [file],
      types: ["Files", "image/png"],
    };
    expect(
      extractCanvasImageTransfer(payload, "clipboard").candidates,
    ).toHaveLength(1);
    const input = { tagName: "INPUT" };
    expect(
      eventTouchesEditingSurface({
        target: input,
        composedPath: () => [input],
      } as unknown as Event),
    ).toBe(true);
  });

  it("keeps workspace isolation and surfaces invalid canonical documents", async () => {
    const repository = new MemoryCanvasRepository();
    const a = await repository.createCanvas({
      workspaceId: WORKSPACE_A,
      title: "A",
    });
    await repository.createCanvas({ workspaceId: WORKSPACE_B, title: "B" });
    expect(
      (await repository.listCanvases(WORKSPACE_A)).map((canvas) => canvas.id),
    ).toEqual([a.id]);
    expect(() =>
      parseCanvasDocumentV1({
        schemaVersion: 1,
        nodes: [
          {
            id: "bad",
            kind: "image",
            assetId: "asset",
            position: { x: 0, y: 0 },
            size: { width: 0, height: 20 },
            zIndex: 0,
            aspectRatioLocked: true,
          },
        ],
        edges: [],
      }),
    ).toThrow();
  });

  it("keeps repository reads immutable and never uses a snapshot manifest as canonical persistence", async () => {
    const repository = new MemoryCanvasRepository();
    const canvas = await canvasWithImage(repository);
    const loaded = await repository.loadCanvas({
      workspaceId: WORKSPACE_A,
      canvasId: canvas!.id,
    });
    loaded!.document.nodes[0]!.position.x = 9999;
    const reread = await repository.loadCanvas({
      workspaceId: WORKSPACE_A,
      canvasId: canvas!.id,
    });
    expect(reread!.document.nodes[0]!.position.x).toBe(120);
    expect(JSON.stringify(reread!.document)).not.toContain("localStorage");
    expect(JSON.stringify(reread!.document)).not.toContain("objectUrl");
  });

  it("ingests a PNG through the shared service and persists only its assetId", async () => {
    const repository = new MemoryCanvasRepository();
    const canvas = await repository.createCanvas({
      workspaceId: WORKSPACE_A,
      title: "Ingest",
    });
    const { registry } = urlRegistry();
    const file = new File(["png"], "capture.png", { type: "image/png" });
    const result = await ingestCanvasImageTransferToNodes(
      {
        items: [{ kind: "file", type: file.type, getAsFile: () => file }],
        files: [file],
        types: ["Files"],
      },
      "clipboard",
      { x: 10, y: 20 },
      {
        assetRepository: repository,
        objectUrls: registry,
        workspaceId: WORKSPACE_A,
        decodeImageDimensions: async () => ({ width: 640, height: 360 }),
        idGenerator: () => "asset-ingested",
      },
    );
    const controller = new LocalCanvasShellController(
      controllerOptions(repository),
    );
    await controller.openCanvas(canvas.id);
    controller.insertImageNodes(result.nodes);
    await controller.save();
    expect(result.nodes).toHaveLength(1);
    expect(
      (
        await repository.loadCanvas({
          workspaceId: WORKSPACE_A,
          canvasId: canvas.id,
        })
      )?.document.nodes[0],
    ).toEqual(
      expect.objectContaining({
        assetId: "asset-ingested",
        position: { x: 10, y: 20 },
      }),
    );
  });

  it("preserves non-image canonical nodes and edges while editing an image", () => {
    const source = parseCanvasDocumentV1({
      schemaVersion: 1,
      nodes: [
        {
          id: "text-1",
          kind: "text",
          markdown: "Keep me",
          position: { x: 0, y: 0 },
          size: { width: 100, height: 100 },
          zIndex: 0,
        },
        {
          id: "image-1",
          kind: "image",
          assetId: "asset-1",
          position: { x: 10, y: 20 },
          size: { width: 100, height: 50 },
          zIndex: 1,
          aspectRatioLocked: true,
        },
      ],
      edges: [
        { id: "edge-1", sourceNodeId: "text-1", targetNodeId: "image-1" },
      ],
    });
    const runtime = canvasDocumentToImageNodes(source)[0];
    runtime.position = { x: 99, y: 101 };
    const next = imageNodesToCanvasDocument(source, [runtime]);
    expect(next.nodes[0]).toEqual(source.nodes[0]);
    expect(next.edges).toEqual(parseCanvasDocumentV2(source).edges);
    expect(next.nodes[1]?.position).toEqual({ x: 99, y: 101 });
  });

  it("does not decode intrinsic dimensions during canonical restoration", async () => {
    const repository = new MemoryCanvasRepository();
    await repository.storeImage({
      id: "asset-1",
      workspaceId: WORKSPACE_A,
      blob: new Blob(["x"]),
      mimeType: "image/png",
      byteSize: 1,
      width: 123,
      height: 45,
    });
    const decode = vi.fn(async () => ({ width: 1, height: 1 }));
    const { registry } = urlRegistry();
    await restoreCanvasImageNodes(documentWithImage(), {
      assetRepository: repository,
      objectUrls: registry,
      workspaceId: WORKSPACE_A,
      decodeImageDimensions: decode,
    });
    expect(decode).not.toHaveBeenCalled();
  });

  it("reports stale restoration after a Canvas switch abort", async () => {
    const repository = new MemoryCanvasRepository();
    await repository.storeImage({
      id: "asset-1",
      workspaceId: WORKSPACE_A,
      blob: new Blob(["x"]),
      mimeType: "image/png",
      byteSize: 1,
      width: 123,
      height: 45,
    });
    repository.delayMs = 25;
    const { registry } = urlRegistry();
    const abort = new AbortController();
    const pending = restoreCanvasImageNodes(
      documentWithImage(),
      {
        assetRepository: repository,
        objectUrls: registry,
        workspaceId: WORKSPACE_A,
      },
      { signal: abort.signal },
    );
    abort.abort();
    expect((await pending).staleIgnored).toBe(true);
  });

  it("creates one Object URL per restored asset and allows deterministic switch cleanup", async () => {
    const repository = new MemoryCanvasRepository();
    await repository.storeImage({
      id: "asset-1",
      workspaceId: WORKSPACE_A,
      blob: new Blob(["x"]),
      mimeType: "image/png",
      byteSize: 1,
      width: 123,
      height: 45,
    });
    const { registry, revoked } = urlRegistry();
    await restoreCanvasImageNodes(documentWithImage(), {
      assetRepository: repository,
      objectUrls: registry,
      workspaceId: WORKSPACE_A,
    });
    expect(registry.count()).toBe(1);
    registry.revokeAll();
    expect(revoked).toHaveLength(1);
  });

  it("isolates personal viewport state by user", async () => {
    const repository = new MemoryCanvasRepository();
    const canvas = await repository.createCanvas({
      workspaceId: WORKSPACE_A,
      title: "Views",
    });
    const first = new LocalCanvasShellController({
      repository,
      workspaceId: WORKSPACE_A,
      userId: "user-a",
    });
    const second = new LocalCanvasShellController({
      repository,
      workspaceId: WORKSPACE_A,
      userId: "user-b",
    });
    await first.openCanvas(canvas.id);
    await second.openCanvas(canvas.id);
    await first.saveViewport({ x: 1, y: 2, zoom: 1.2 });
    expect((await second.openCanvas(canvas.id)).viewport).toEqual({
      x: 0,
      y: 0,
      zoom: 1,
    });
  });

  it("renames a Canvas through the same CAS stream", async () => {
    const repository = new MemoryCanvasRepository();
    const controller = new LocalCanvasShellController(
      controllerOptions(repository),
    );
    const created = await controller.createCanvas("Before");
    controller.setTitle("After");
    expect(await controller.save()).toEqual({ status: "saved", revision: 2 });
    expect(
      (
        await repository.loadCanvas({
          workspaceId: WORKSPACE_A,
          canvasId: created.canvasId!,
        })
      )?.title,
    ).toBe("After");
  });

  it("soft-deletes a Canvas without exposing it in the isolated list", async () => {
    const repository = new MemoryCanvasRepository();
    const created = await repository.createCanvas({
      workspaceId: WORKSPACE_A,
      title: "Delete me",
    });
    await repository.softDeleteCanvas({
      workspaceId: WORKSPACE_A,
      canvasId: created.id,
    });
    expect(await repository.listCanvases(WORKSPACE_A)).toEqual([]);
  });

  it("does not autosave when runtime nodes are changed until lifecycle save", async () => {
    const repository = new MemoryCanvasRepository();
    const controller = new LocalCanvasShellController(
      controllerOptions(repository),
    );
    await controller.createCanvas("Lifecycle");
    const runtime = canvasDocumentToImageNodes(documentWithImage())[0];
    controller.setImageNodes([runtime]);
    expect(repository.saveCalls).toBe(0);
    await controller.save();
    expect(repository.saveCalls).toBe(1);
  });

  it("preserves an asset when its only node is deleted", async () => {
    const repository = new MemoryCanvasRepository();
    const canvas = await repository.createCanvas({
      workspaceId: WORKSPACE_A,
      title: "Asset policy",
    });
    await repository.storeImage({
      id: "asset-1",
      workspaceId: WORKSPACE_A,
      blob: new Blob(["x"]),
      mimeType: "image/png",
      byteSize: 1,
      width: 123,
      height: 45,
    });
    const controller = new LocalCanvasShellController(
      controllerOptions(repository),
    );
    await controller.openCanvas(canvas.id);
    controller.removeImageNodes(["missing-node"]);
    expect(
      await repository.loadAsset({
        workspaceId: WORKSPACE_A,
        assetId: "asset-1",
      }),
    ).not.toBeNull();
  });

  it("does not create an empty node for ordinary clipboard text", () => {
    const extracted = extractCanvasImageTransfer(
      {
        items: [{ kind: "string", type: "text/plain" }],
        files: [],
        types: ["text/plain"],
      },
      "clipboard",
    );
    expect(extracted.candidates).toEqual([]);
  });

  it("rejects an editable paste target while accepting a canvas target", () => {
    const input = { tagName: "TEXTAREA" };
    const canvas = { tagName: "DIV", dataset: {} };
    expect(
      eventTouchesEditingSurface({
        target: input,
        composedPath: () => [input],
      } as unknown as Event),
    ).toBe(true);
    expect(
      eventTouchesEditingSurface({
        target: canvas,
        composedPath: () => [canvas],
      } as unknown as Event),
    ).toBe(false);
  });

  it("round-trips task references while excluding runtime task state", () => {
    const source = parseCanvasDocumentV1({
      schemaVersion: 1,
      nodes: [
        {
          id: "task-node-1",
          kind: "task",
          taskId: "task-1",
          lastKnownTitle: "Fallback title",
          position: { x: 20, y: 30 },
          size: { width: 300, height: 150 },
          zIndex: 4,
        },
      ],
      edges: [],
    });
    const runtime = canvasDocumentToTaskNodes(source)[0]!;
    runtime.position = { x: 80, y: 90 };
    runtime.style = { width: 360, height: 180 };
    runtime.data.lastKnownTitle = "A newer display fallback";
    const serialized = runtimeNodesToCanvasDocument(source, [runtime]);

    expect(serialized.nodes[0]).toEqual({
      id: "task-node-1",
      kind: "task",
      taskId: "task-1",
      lastKnownTitle: "Fallback title",
      position: { x: 80, y: 90 },
      size: { width: 360, height: 180 },
      zIndex: 4,
    });
    expect(JSON.stringify(serialized)).not.toContain("completed");
    expect(JSON.stringify(serialized)).not.toContain("taskBridge");
  });

  it("persists and reloads only the task reference and layout through Canvas CAS", async () => {
    const repository = new MemoryCanvasRepository();
    const controller = new LocalCanvasShellController(
      controllerOptions(repository),
    );
    const created = await controller.createCanvas("Tasks");
    const node = createCanvasTaskFlowNode({
      id: "task-node-1",
      taskId: "task-1",
      lastKnownTitle: "Task title",
      position: { x: 44, y: 55 },
      size: { width: 320, height: 160 },
      zIndex: 2,
    });

    controller.insertTaskNode(node);
    await controller.save();
    const reloaded = new LocalCanvasShellController(
      controllerOptions(repository),
    );
    const reopened = await reloaded.openCanvas(created.canvasId!);

    expect(reopened.document.nodes).toEqual([
      {
        id: "task-node-1",
        kind: "task",
        taskId: "task-1",
        lastKnownTitle: "Task title",
        position: { x: 44, y: 55 },
        size: { width: 320, height: 160 },
        zIndex: 2,
      },
    ]);
    expect(JSON.stringify(reopened.document)).not.toContain("completed");
  });

  it("restores task nodes with the current bridge context after reload", () => {
    const source = parseCanvasDocumentV1({
      schemaVersion: 1,
      nodes: [
        {
          id: "task-node-1",
          kind: "task",
          taskId: "task-1",
          lastKnownTitle: "Task title",
          position: { x: 1, y: 2 },
          size: { width: 300, height: 150 },
          zIndex: 1,
        },
      ],
      edges: [],
    });
    const bridge = {} as CanvasTaskBridge;
    const onContentHeightChange = vi.fn();
    const restored = canvasDocumentToTaskNodes(source, {
      onContentHeightChange,
      taskBridge: bridge,
      taskWorkspaceId: "project-1",
    });

    expect(restored[0]?.data).toEqual({
      taskId: "task-1",
      lastKnownTitle: "Task title",
      taskBridge: bridge,
      taskWorkspaceId: "project-1",
      onContentHeightChange,
    });
    expect(
      JSON.stringify(runtimeNodesToCanvasDocument(source, restored)),
    ).not.toContain("onContentHeightChange");
  });
  it("reuses a cached Object URL without changing canonical image geometry", async () => {
    const repository = new MemoryCanvasRepository();
    const { registry } = urlRegistry();
    const document = documentWithImage();
    const restored = await restoreCanvasImageNodes(
      document,
      {
        assetRepository: repository,
        objectUrls: registry,
        workspaceId: WORKSPACE_A,
      },
      {
        cachedAssetPayloads: new Map([
          [
            "asset-1",
            {
              objectUrl: "blob:cached-image",
              mimeType: "image/png",
              intrinsicWidth: 4000,
              intrinsicHeight: 3000,
              source: "restored",
            },
          ],
        ]),
      },
    );

    expect(repository.assetLoadCalls).toBe(0);
    expect(restored.nodes[0]).toMatchObject({
      position: { x: 120, y: 240 },
      width: 320,
      height: 180,
      style: { width: 320, height: 180 },
      data: { objectUrl: "blob:cached-image" },
    });
    expect(
      runtimeNodesToCanvasDocument(document, restored.nodes).nodes,
    ).toEqual(document.nodes);
  });
});

describe("C6 Canvas groups sidebar composition", () => {
  const source = (path: string): string =>
    readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

  it("projects nested groups and Canvas rows through the shared shell", () => {
    const sidebar = source("src/prototype/canvases/canvas-groups-sidebar.tsx");
    const shell = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
    );
    expect(sidebar).toContain("buildTree");
    expect(sidebar).toContain("group.children.map");
    expect(sidebar).toContain("group.canvases.map");
    expect(shell).toContain("groupRepository?: CanvasGroupRepository");
    expect(shell).toContain("listCanvasGroups");
    expect(shell).toContain("onSelectCanvas");
  });

  it("wires group CRUD, move, nesting, menu dismissal, and collapse controls", () => {
    const sidebar = source("src/prototype/canvases/canvas-groups-sidebar.tsx");
    const shell = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
    );
    expect(sidebar).toContain("onCreateGroup");
    expect(sidebar).toContain("onRenameGroup");
    expect(sidebar).toContain("onDeleteGroup");
    expect(sidebar).toContain("onMoveGroup");
    expect(sidebar).toContain('event.key === "Escape"');
    expect(sidebar).toContain('document.addEventListener("pointerdown"');
    expect(sidebar).toContain("toggleAll");
    expect(shell).toContain("createCanvasGroup");
    expect(shell).toContain("renameCanvasGroup");
    expect(shell).toContain("moveCanvasToGroup");
  });
});
