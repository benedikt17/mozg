import { describe, expect, it } from "vitest";
import {
  CANVAS_DOCUMENT_SCHEMA_VERSION,
  createEmptyCanvasDocumentV2,
} from "@/lib/canvas/canvas-document";
import {
  ingestCanvasImageCandidates,
  type CanvasImageCandidate,
} from "@/lib/canvas/canvas-image-ingestion";
import { CloudCanvasShellRepository } from "@/lib/canvas/cloud-canvas-shell-adapter";
import { LocalCanvasShellController } from "@/lib/canvas/local-canvas-shell-controller";
import type {
  CanvasAssetRecord,
  CanvasAssetRepository,
  CanvasRepository,
  CanvasSummary,
  CanvasViewState,
  CanvasViewStateRepository,
  LoadedCanvas,
  StoreLocalCanvasImageInput,
} from "@/lib/canvas/local-canvas-repository";
import type {
  CloudCanvasAssetMetadata,
  CloudCanvasAssetRepository,
} from "@/lib/canvas/cloud-canvas-asset-repository";
import type {
  CloudCanvasRepository,
  CloudCanvasSummary,
  CloudLoadedCanvas,
} from "@/lib/canvas/cloud-canvas-repository";
import type { CanvasGroup } from "@/lib/canvas/canvas-group-repository";

const WORKSPACE = "20000000-0000-0000-0000-000000000001";
const CANVAS_A = "30000000-0000-0000-0000-000000000001";
const CANVAS_B = "30000000-0000-0000-0000-000000000002";
const ASSET = "40000000-0000-0000-0000-000000000001";
const USER = "50000000-0000-0000-0000-000000000001";
const NOW = "2026-08-09T00:00:00.000Z";

function file(): File {
  return new File([new Uint8Array([1, 2, 3])], "race.png", {
    type: "image/png",
    lastModified: 1,
  });
}

function candidate(): CanvasImageCandidate {
  return { file: file(), source: "drop", inputIndex: 0 };
}

function assetRecord(id = ASSET): CanvasAssetRecord {
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
  return {
    id,
    workspaceId: WORKSPACE,
    blob,
    preview: null,
    mimeType: "image/png",
    byteSize: blob.size,
    width: 1,
    height: 1,
    checksum: null,
    createdAt: NOW,
    readyAt: NOW,
    deletedAt: null,
  };
}

class ScopedIngestionRepository implements CanvasAssetRepository {
  current = true;
  storeCalls = 0;
  deleted: string[] = [];
  invalidateDuringStore = false;

  beginAssetScope() {
    return {
      storeImage: async (input: StoreLocalCanvasImageInput) => {
        this.storeCalls += 1;
        if (this.invalidateDuringStore) this.current = false;
        return { ...assetRecord(), blob: input.blob };
      },
      loadAsset: async () => null,
      markAssetDeleted: async (input: { workspaceId: string; assetId: string }) => {
        this.deleted.push(`${input.workspaceId}/${input.assetId}`);
      },
      isCurrent: () => this.current,
    } satisfies CanvasAssetRepository & { isCurrent: () => boolean };
  }

  async storeImage(): Promise<CanvasAssetRecord> {
    throw new Error("unscoped store must not be used");
  }
  async loadAsset(): Promise<CanvasAssetRecord | null> {
    return null;
  }
  async markAssetDeleted(): Promise<void> {}
}

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

class NavigationRepository
  implements CanvasRepository, CanvasViewStateRepository
{
  readonly events: string[] = [];
  private readonly canvases = new Map([
    [CANVAS_A, loadedCanvas(CANVAS_A, "A")],
    [CANVAS_B, loadedCanvas(CANVAS_B, "B")],
  ]);

  beginCanvasNavigation(canvasId: string | null): void {
    this.events.push(`navigate:${canvasId ?? "new"}`);
  }

  async listCanvases(): Promise<CanvasSummary[]> {
    return [...this.canvases.values()];
  }
  async createCanvas(): Promise<LoadedCanvas> {
    this.events.push("create");
    return loadedCanvas(CANVAS_B, "B");
  }
  async loadCanvas(input: {
    workspaceId: string;
    canvasId: string;
  }): Promise<LoadedCanvas | null> {
    this.events.push(`load:${input.canvasId}`);
    return structuredClone(this.canvases.get(input.canvasId) ?? null);
  }
  async saveCanvas(input: {
    workspaceId: string;
    canvasId: string;
    expectedRevision: number;
  }) {
    this.events.push(`save:${input.canvasId}`);
    const current = this.canvases.get(input.canvasId)!;
    current.revision += 1;
    return { status: "saved" as const, revision: current.revision };
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

function cloudSummary(id = CANVAS_A): CloudCanvasSummary {
  return {
    id,
    workspaceId: WORKSPACE,
    title: id === CANVAS_A ? "A" : "B",
    groupId: null,
    sortOrder: 0,
    revision: 1,
    schemaVersion: 2,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function cloudLoaded(id = CANVAS_A): CloudLoadedCanvas {
  return { ...cloudSummary(id), document: createEmptyCanvasDocumentV2() };
}

function group(): CanvasGroup {
  return {
    id: "60000000-0000-0000-0000-000000000001",
    workspaceId: WORKSPACE,
    parentGroupId: null,
    title: "Group",
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  };
}

function cloudCanvasRepository(): CloudCanvasRepository {
  return {
    listCanvases: async () => [cloudSummary(CANVAS_A), cloudSummary(CANVAS_B)],
    createCanvas: async () => cloudLoaded(CANVAS_B),
    loadCanvas: async (_workspaceId, canvasId) => cloudLoaded(canvasId),
    renameCanvas: async (_workspaceId, canvasId) => cloudSummary(canvasId),
    deleteCanvas: async () => undefined,
    saveCanvasDocument: async (input) => ({
      status: "saved",
      revision: input.expectedRevision + 1,
    }),
    loadCanvasViewState: async () => null,
    saveCanvasViewState: async () => undefined,
    listCanvasGroups: async () => [group()],
    createCanvasGroup: async () => group(),
    renameCanvasGroup: async () => group(),
    softDeleteCanvasGroup: async () => ({ status: "deleted" }),
    moveCanvasGroup: async () => group(),
    moveCanvasToGroup: async () => undefined,
  };
}

function metadata(canvasId: string): CloudCanvasAssetMetadata {
  return {
    id: ASSET,
    workspaceId: WORKSPACE,
    canvasId,
    storageKey: `${WORKSPACE}/${canvasId}/${ASSET}/original`,
    previewStorageKey: null,
    mimeType: "image/png",
    byteSize: 3,
    width: 1,
    height: 1,
    checksum: null,
    createdBy: USER,
    createdAt: NOW,
    readyAt: NOW,
    deletedAt: null,
  };
}

function cloudAssets(log: string[]): CloudCanvasAssetRepository {
  return {
    uploadAsset: async (input) => {
      log.push(`upload:${input.canvasId}`);
      return metadata(input.canvasId);
    },
    getAssetMetadata: async (input) => metadata(input.canvasId),
    downloadAsset: async (input) => ({
      ...metadata(input.canvasId),
      blob: assetRecord().blob,
    }),
    deleteAsset: async (input) => {
      log.push(`delete:${input.canvasId}`);
    },
    invalidateAuthentication: () => undefined,
    listVariants: async () => [],
    loadVariant: async () => null,
    listVariantTiers: async () => [],
    loadVariantTier: async () => null,
    storeVariant: async (input) => ({
      workspaceId: input.workspaceId,
      canvasId: input.canvasId,
      assetId: input.assetId,
      kind: input.kind,
      storagePath: input.storagePath,
      mimeType: "image/webp",
      byteSize: input.byteSize,
      pixelWidth: input.pixelWidth,
      pixelHeight: input.pixelHeight,
      createdAt: input.createdAt,
    }),
    storeVariantTier: async (input) => ({
      workspaceId: input.workspaceId,
      canvasId: input.canvasId,
      assetId: input.assetId,
      targetMaxEdge: input.targetMaxEdge,
      storagePath: input.storagePath,
      mimeType: "image/webp",
      byteSize: input.byteSize,
      pixelWidth: input.pixelWidth,
      pixelHeight: input.pixelHeight,
      createdAt: input.createdAt,
    }),
    deleteVariants: async () => undefined,
  };
}

describe("Stage 3.2 Canvas async isolation", () => {
  it("invalidates the old Canvas scope before pending-save and document awaits", async () => {
    const repository = new NavigationRepository();
    const controller = new LocalCanvasShellController({
      repository,
      workspaceId: WORKSPACE,
      userId: USER,
    });
    await controller.openCanvas(CANVAS_A);
    repository.events.length = 0;
    controller.setTitle("dirty A");

    await controller.openCanvas(CANVAS_B);

    expect(repository.events).toEqual([
      `navigate:${CANVAS_B}`,
      `save:${CANVAS_A}`,
      `load:${CANVAS_B}`,
    ]);
  });

  it("drops an image operation that becomes stale while decoding", async () => {
    const repository = new ScopedIngestionRepository();
    const result = await ingestCanvasImageCandidates([candidate()], {
      repository,
      workspaceId: WORKSPACE,
      decodeImageDimensions: async () => {
        repository.current = false;
        return { width: 1, height: 1 };
      },
    });

    expect(repository.storeCalls).toBe(0);
    expect(result.accepted).toEqual([]);
    expect(result.rejected).toMatchObject([{ reason: "repository-failure" }]);
  });

  it("deletes an uploaded asset when its Canvas scope becomes stale in-flight", async () => {
    const repository = new ScopedIngestionRepository();
    repository.invalidateDuringStore = true;

    const result = await ingestCanvasImageCandidates([candidate()], {
      repository,
      workspaceId: WORKSPACE,
      decodeImageDimensions: async () => ({ width: 1, height: 1 }),
    });

    expect(repository.storeCalls).toBe(1);
    expect(repository.deleted).toEqual([`${WORKSPACE}/${ASSET}`]);
    expect(result.accepted).toEqual([]);
    expect(result.rejected).toMatchObject([{ reason: "repository-failure" }]);
  });

  it("pins stale cloud cleanup to Canvas A after navigation toward Canvas B", async () => {
    const log: string[] = [];
    const repository = new CloudCanvasShellRepository(
      WORKSPACE,
      cloudCanvasRepository(),
      cloudAssets(log),
    );
    repository.setActiveCanvas(CANVAS_A);
    const scope = repository.beginAssetScope();

    repository.beginCanvasNavigation(CANVAS_B);
    expect(scope.isCurrent()).toBe(false);

    await scope.storeImage({
      id: ASSET,
      workspaceId: WORKSPACE,
      blob: assetRecord().blob,
      mimeType: "image/png",
      byteSize: 3,
      width: 1,
      height: 1,
    });
    repository.setActiveCanvas(CANVAS_B);
    await scope.markAssetDeleted({ workspaceId: WORKSPACE, assetId: ASSET });

    expect(log).toEqual([`upload:${CANVAS_A}`, `delete:${CANVAS_A}`]);
  });
});
