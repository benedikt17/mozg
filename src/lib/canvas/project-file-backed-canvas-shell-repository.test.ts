import { describe, expect, it } from "vitest";

import {
  canonicalizeCanvasProjectFileRuntimeReferences,
  projectFileRuntimeAssetId,
} from "@/lib/canvas/project-file-backed-canvas-shell-repository";

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
});
