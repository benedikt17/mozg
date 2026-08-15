import { describe, expect, it } from "vitest";

import type { CloudCanvasAssetRepository } from "@/lib/canvas/cloud-canvas-asset-repository";
import type { CloudCanvasRepository } from "@/lib/canvas/cloud-canvas-repository";
import {
  planLegacyCanvasAssetsMigration,
  LegacyCanvasAssetMigrationError,
} from "@/lib/files/legacy-canvas-assets-migration";
import type { ProjectFileRepository } from "@/lib/files/project-file-repository";
import { CloudProjectFileRepositoryError } from "@/lib/files/project-file-runtime";

const WORKSPACE_ID = "61000000-0000-4000-8000-000000000001";
const CANVAS_ID = "62000000-0000-4000-8000-000000000001";
const SECOND_CANVAS_ID = "62000000-0000-4000-8000-000000000002";
const ASSET_ID = "63000000-0000-4000-8000-000000000001";

function canvas(canvasId: string, assetId: string) {
  return {
    id: canvasId,
    workspaceId: WORKSPACE_ID,
    title: "Тестовый / холст",
    groupId: null,
    sortOrder: 0,
    revision: 7,
    createdAt: "2026-08-15T00:00:00.000Z",
    updatedAt: "2026-08-15T00:00:00.000Z",
    schemaVersion: 2 as const,
    document: {
      schemaVersion: 2 as const,
      nodes: [
        {
          id: "image-node",
          kind: "image" as const,
          assetId,
          position: { x: 10, y: 20 },
          size: { width: 400, height: 300 },
          zIndex: 1,
          aspectRatioLocked: true,
        },
      ],
      edges: [],
    },
  };
}

function canvasRepository(canvases: ReturnType<typeof canvas>[]) {
  return {
    listCanvases: async () =>
      canvases.map(
        ({ document: _document, schemaVersion: _schemaVersion, ...row }) => row,
      ),
    loadCanvas: async (_workspaceId: string, canvasId: string) => {
      const found = canvases.find((item) => item.id === canvasId);
      if (!found) throw new Error("missing canvas");
      return found;
    },
  } as unknown as CloudCanvasRepository;
}

const legacyAssetRepository = {
  getAssetMetadata: async (input: { canvasId: string; assetId: string }) => ({
    id: input.assetId,
    workspaceId: WORKSPACE_ID,
    canvasId: input.canvasId,
    storageKey: `${WORKSPACE_ID}/${input.canvasId}/${input.assetId}/original`,
    previewStorageKey: null,
    mimeType: "image/jpeg" as const,
    byteSize: 1234,
    width: 1600,
    height: 900,
    checksum: null,
    createdBy: "64000000-0000-4000-8000-000000000001",
    createdAt: "2026-08-15T00:00:00.000Z",
    readyAt: "2026-08-15T00:00:01.000Z",
    deletedAt: null,
  }),
} as unknown as CloudCanvasAssetRepository;

const missingProjectFiles = {
  getFile: async () => {
    throw new CloudProjectFileRepositoryError("not-found", "missing");
  },
} as unknown as ProjectFileRepository;

describe("legacy Canvas assets migration planning", () => {
  it("preserves the legacy UUID as target fileId and generates a safe Inbox name", async () => {
    const plan = await planLegacyCanvasAssetsMigration({
      workspaceId: WORKSPACE_ID,
      projectId: "lukomorie",
      canvasRepository: canvasRepository([canvas(CANVAS_ID, ASSET_ID)]),
      legacyAssetRepository,
      projectFileRepository: missingProjectFiles,
    });

    expect(plan).toMatchObject({
      canvasesScanned: 1,
      canvasesWithLegacyAssets: 1,
      legacyReferences: 1,
      distinctLegacyAssets: 1,
      alreadyMigratedAssets: 0,
    });
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]).toMatchObject({
      assetId: ASSET_ID,
      targetFileId: ASSET_ID,
      targetName: "Тестовый холст — изображение 01.jpg",
      alreadyMigrated: false,
    });
  });

  it("refuses a legacy UUID shared by multiple canvases", async () => {
    await expect(
      planLegacyCanvasAssetsMigration({
        workspaceId: WORKSPACE_ID,
        projectId: "lukomorie",
        canvasRepository: canvasRepository([
          canvas(CANVAS_ID, ASSET_ID),
          canvas(SECOND_CANVAS_ID, ASSET_ID),
        ]),
        legacyAssetRepository,
        projectFileRepository: missingProjectFiles,
      }),
    ).rejects.toBeInstanceOf(LegacyCanvasAssetMigrationError);
  });
});
