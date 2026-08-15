import { describe, expect, it } from "vitest";

import { createCanvasProjectFileImageNode } from "@/lib/canvas/project-file-canvas-image-adapter";
import { parseCanvasDocumentV2 } from "@/lib/canvas/canvas-document";
import type { ProjectFileRecord } from "@/lib/files/project-file-repository";

const file: ProjectFileRecord = {
  id: "63000000-0000-0000-0000-000000000001",
  workspaceId: "23000000-0000-0000-0000-000000000001",
  projectId: "project-a",
  folderId: null,
  name: "image.png",
  originalName: "image.png",
  storageKey:
    "23000000-0000-0000-0000-000000000001/63000000-0000-0000-0000-000000000001/original",
  mimeType: "image/png",
  byteSize: 1024,
  checksum: null,
  width: 1200,
  height: 800,
  createdBy: "13000000-0000-0000-0000-000000000001",
  createdAt: "2026-08-15T00:00:00.000Z",
  updatedAt: "2026-08-15T00:00:00.000Z",
  readyAt: "2026-08-15T00:00:00.000Z",
  deletedAt: null,
};

describe("Project File Canvas image identity", () => {
  it("allows the same File on Canvas more than once without copying it", () => {
    const first = createCanvasProjectFileImageNode({
      file,
      position: { x: 10, y: 20 },
      zIndex: 1,
      idGenerator: () => "first",
    });
    const second = createCanvasProjectFileImageNode({
      file,
      position: { x: 30, y: 40 },
      zIndex: 2,
      idGenerator: () => "second",
    });

    expect(first.id).toBe("file-node-first");
    expect(second.id).toBe("file-node-second");
    expect(first.fileId).toBe(file.id);
    expect(second.fileId).toBe(file.id);
    expect("assetId" in first).toBe(false);
  });

  it("accepts fileId and keeps legacy assetId backward compatible", () => {
    const shared = parseCanvasDocumentV2({
      schemaVersion: 2,
      nodes: [
        {
          id: "file-node",
          kind: "image",
          fileId: file.id,
          position: { x: 0, y: 0 },
          size: { width: 400, height: 300 },
          zIndex: 1,
          aspectRatioLocked: true,
        },
      ],
      edges: [],
    });
    expect(shared.nodes[0]).toMatchObject({ kind: "image", fileId: file.id });

    const legacy = parseCanvasDocumentV2({
      schemaVersion: 2,
      nodes: [
        {
          id: "legacy-node",
          kind: "image",
          assetId: "legacy-asset",
          position: { x: 0, y: 0 },
          size: { width: 400, height: 300 },
          zIndex: 1,
          aspectRatioLocked: true,
        },
      ],
      edges: [],
    });
    expect(legacy.nodes[0]).toMatchObject({
      kind: "image",
      assetId: "legacy-asset",
    });

    expect(() =>
      parseCanvasDocumentV2({
        schemaVersion: 2,
        nodes: [
          {
            id: "invalid-node",
            kind: "image",
            assetId: "legacy-asset",
            fileId: file.id,
            position: { x: 0, y: 0 },
            size: { width: 400, height: 300 },
            zIndex: 1,
            aspectRatioLocked: true,
          },
        ],
        edges: [],
      }),
    ).toThrow(/exactly one assetId or fileId/);
  });
});
