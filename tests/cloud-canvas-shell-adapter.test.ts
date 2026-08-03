import { describe, expect, it } from "vitest";
import { createEmptyCanvasDocumentV2 } from "@/lib/canvas/canvas-document";
import type {
  CloudCanvasAssetRepository,
  CloudCanvasAssetMetadata,
} from "@/lib/canvas/cloud-canvas-asset-repository";
import { CloudCanvasShellRepository } from "@/lib/canvas/cloud-canvas-shell-adapter";
import type {
  CloudCanvasRepository,
  CloudCanvasSummary,
  CloudLoadedCanvas,
} from "@/lib/canvas/cloud-canvas-repository";

const workspaceId = "20000000-0000-0000-0000-000000000001";
const canvasId = "30000000-0000-0000-0000-000000000001";
const assetId = "40000000-0000-0000-0000-000000000001";
const userId = "50000000-0000-0000-0000-000000000001";
const now = "2026-08-01T00:00:00.000Z";
const document = createEmptyCanvasDocumentV2();

function summary(): CloudCanvasSummary {
  return {
    id: canvasId,
    workspaceId,
    title: "Cloud Canvas",
    revision: 1,
    schemaVersion: 2,
    createdAt: now,
    updatedAt: now,
  };
}

function loaded(): CloudLoadedCanvas {
  return { ...summary(), document };
}


function metadata(): CloudCanvasAssetMetadata {
  return {
    id: assetId,
    workspaceId,
    canvasId,
    storageKey: `${workspaceId}/${canvasId}/${assetId}/original`,
    previewStorageKey: null,
    mimeType: "image/png",
    byteSize: 5,
    width: 1,
    height: 1,
    checksum: null,
    createdBy: userId,
    createdAt: now,
    readyAt: now,
    deletedAt: null,
  };
}

function cloudCanvasRepository(): CloudCanvasRepository {
  return {
    listCanvases: async () => [summary()],
    createCanvas: async () => loaded(),
    loadCanvas: async () => loaded(),
    renameCanvas: async () => summary(),
    deleteCanvas: async () => undefined,
    saveCanvasDocument: async (input) => ({
      status: "saved",
      revision: input.expectedRevision + 1,
    }),
    loadCanvasViewState: async () => ({
      canvasId,
      userId,
      viewportX: 20,
      viewportY: 30,
      zoom: 1.2,
      updatedAt: now,
    }),
    saveCanvasViewState: async () => undefined,
  };
}

function cloudAssetRepository(blob: Blob): CloudCanvasAssetRepository {
  return {
    uploadAsset: async () => metadata(),
    getAssetMetadata: async () => metadata(),
    downloadAsset: async () => ({ ...metadata(), blob }),
    deleteAsset: async () => undefined,
  };
}

describe("CloudCanvasShellRepository", () => {
  it("maps cloud Canvas and asset contracts into the shared shell contract", async () => {
    const blob = new Blob(["image"], { type: "image/png" });
    const repository = new CloudCanvasShellRepository(
      workspaceId,
      cloudCanvasRepository(),
      cloudAssetRepository(blob),
    );

    repository.setActiveCanvas?.(canvasId);
    await expect(repository.listCanvases(workspaceId)).resolves.toEqual([
      expect.objectContaining({ id: canvasId, title: "Cloud Canvas" }),
    ]);
    await expect(
      repository.loadCanvas({ workspaceId, canvasId }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: canvasId,
        schemaVersion: 1,
        document: expect.objectContaining({ schemaVersion: 2 }),
      }),
    );
    await expect(
      repository.saveCanvas({
        workspaceId,
        canvasId,
        expectedRevision: 1,
        title: "Cloud Canvas",
        document,
      }),
    ).resolves.toEqual({ status: "saved", revision: 2 });
    await expect(
      repository.loadViewState({ canvasId, userId }),
    ).resolves.toEqual(expect.objectContaining({ viewportX: 20, zoom: 1.2 }));

    const stored = await repository.storeImage({
      id: assetId,
      workspaceId,
      blob,
      preview: null,
      mimeType: "image/png",
      byteSize: 5,
      width: 1,
      height: 1,
      checksum: null,
    });
    expect(stored).toEqual(
      expect.objectContaining({ id: assetId, workspaceId, blob }),
    );
    await expect(
      repository.loadAsset({ workspaceId, assetId }),
    ).resolves.toEqual(expect.objectContaining({ id: assetId, blob }));
    await expect(
      repository.markAssetDeleted({ workspaceId, assetId }),
    ).resolves.toBeUndefined();
  });

  it("lets the cloud asset repository allocate the canonical ID when omitted", async () => {
    const blob = new Blob(["image"], { type: "image/png" });
    const uploadedAssetIds: Array<string | undefined> = [];
    const assets: CloudCanvasAssetRepository = {
      ...cloudAssetRepository(blob),
      uploadAsset: async (input) => {
        uploadedAssetIds.push(input.assetId);
        return metadata();
      },
    };
    const repository = new CloudCanvasShellRepository(
      workspaceId,
      cloudCanvasRepository(),
      assets,
    );

    repository.setActiveCanvas?.(canvasId);
    await repository.storeImage({
      workspaceId,
      blob,
      preview: null,
      mimeType: "image/png",
      byteSize: 5,
      width: 1,
      height: 1,
      checksum: null,
    });

    expect(uploadedAssetIds).toEqual([undefined]);
  });
});
