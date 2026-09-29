import { describe, expect, it, vi } from "vitest";

import {
  canonicalizeCanvasProjectFileRuntimeReferences,
  createProjectFileBackedCanvasShellRepository,
  projectFileRuntimeAssetId,
} from "@/lib/canvas/project-file-backed-canvas-shell-repository";
import type { CloudCanvasShellRepository } from "@/lib/canvas/cloud-canvas-shell-adapter";
import type { ProjectFileRepository } from "@/lib/files/project-file-repository";
import type { ProjectFileImageVariantRepository } from "@/lib/files/project-file-image-variants";

const FILE_ID = "63000000-0000-0000-0000-000000000001";

describe("Project File-backed direct Canvas uploads", () => {
  it("canonicalizes only B4 runtime asset markers to durable fileId references", () => {
    const document = canonicalizeCanvasProjectFileRuntimeReferences({
      schemaVersion: 2,
      nodes: [
        {
          id: projectFileRuntimeAssetId(FILE_ID),
          kind: "image",
          assetId: projectFileRuntimeAssetId(FILE_ID),
          position: { x: 10, y: 20 },
          size: { width: 400, height: 300 },
          zIndex: 1,
          aspectRatioLocked: true,
        },
        {
          id: "legacy-node",
          kind: "image",
          assetId: "legacy-asset",
          position: { x: 30, y: 40 },
          size: { width: 320, height: 240 },
          zIndex: 2,
          aspectRatioLocked: true,
        },
      ],
      edges: [],
    });

    expect(document.nodes[0]).toMatchObject({
      kind: "image",
      fileId: FILE_ID,
    });
    expect("assetId" in document.nodes[0]!).toBe(false);
    expect(document.nodes[1]).toMatchObject({
      kind: "image",
      assetId: "legacy-asset",
    });
  });

  it("keeps legacy Canvas tier lookup batched alongside file-backed images", async () => {
    const batch = vi.fn(async () => new Map([["legacy-asset", []]]));
    const listImageVariants = vi.fn(async () => []);
    const repository = createProjectFileBackedCanvasShellRepository({
      repository: {
        listVariantTiersForAssets: batch,
      } as unknown as CloudCanvasShellRepository,
      projectFileRepository: {} as ProjectFileRepository,
      projectFileVariantRepository: {
        listImageVariants,
      } as unknown as ProjectFileImageVariantRepository,
      workspaceId: "workspace-1",
      projectId: "project-1",
    });

    const catalogue = await repository.listVariantTiersForAssets({
      workspaceId: "workspace-1",
      canvasId: "canvas-1",
      assetIds: ["legacy-asset", projectFileRuntimeAssetId(FILE_ID)],
    });

    expect(batch).toHaveBeenCalledOnce();
    expect(batch).toHaveBeenCalledWith(
      expect.objectContaining({ assetIds: ["legacy-asset"] }),
    );
    expect(listImageVariants).toHaveBeenCalledOnce();
    expect(catalogue.has("legacy-asset")).toBe(true);
    expect(catalogue.has(projectFileRuntimeAssetId(FILE_ID))).toBe(true);
  });
});
