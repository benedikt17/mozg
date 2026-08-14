import { describe, expect, it } from "vitest";

import {
  chooseProjectFilePreviewVariant,
  planProjectFileImageVariants,
  projectFileImageVariantStoragePath,
  type ProjectFileImageVariantMetadata,
} from "./project-file-image-variants";

// Pure variant planning/selection lives here; browser encoding and Storage delivery
// are covered by the Files Playwright acceptance test.
function variant(targetMaxEdge: number): ProjectFileImageVariantMetadata {
  return {
    workspaceId: "86000000-0000-4000-8000-000000000001",
    projectId: "project-a",
    fileId: "87000000-0000-4000-8000-000000000001",
    kind: `edge-${targetMaxEdge}`,
    storagePath: `86000000-0000-4000-8000-000000000001/87000000-0000-4000-8000-000000000001/variants/edge-${targetMaxEdge}.webp`,
    mimeType: "image/webp",
    byteSize: 100,
    pixelWidth: targetMaxEdge,
    pixelHeight: Math.max(1, Math.round(targetMaxEdge / 2)),
    targetMaxEdge,
    createdAt: "2026-08-14T00:00:00.000Z",
    readyAt: "2026-08-14T00:00:01.000Z",
  };
}

describe("Project File image variants", () => {
  it("uses stable file-id based paths independent of display names and folders", () => {
    expect(
      projectFileImageVariantStoragePath({
        workspaceId: "86000000-0000-4000-8000-000000000001",
        fileId: "87000000-0000-4000-8000-000000000001",
        targetMaxEdge: 1024,
      }),
    ).toBe(
      "86000000-0000-4000-8000-000000000001/87000000-0000-4000-8000-000000000001/variants/edge-1024.webp",
    );
  });

  it("plans only useful pyramid tiers below the original max edge", () => {
    expect(planProjectFileImageVariants({ width: 3000, height: 2000 })).toEqual(
      [256, 512, 1024, 2048],
    );
    expect(
      planProjectFileImageVariants({
        width: 3000,
        height: 2000,
        readyTargetMaxEdges: [512, 2048],
      }),
    ).toEqual([256, 1024]);
  });

  it("prefers the smallest ready tier that covers the Files preview target", () => {
    expect(
      chooseProjectFilePreviewVariant([
        variant(2048),
        variant(512),
        variant(1024),
      ])?.targetMaxEdge,
    ).toBe(1024);
  });

  it("falls back to the largest available ready tier and ignores pending rows", () => {
    const pending = { ...variant(1024), readyAt: null };
    expect(
      chooseProjectFilePreviewVariant([variant(256), variant(512), pending])
        ?.targetMaxEdge,
    ).toBe(512);
  });
});
