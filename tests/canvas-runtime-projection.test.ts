import { describe, expect, it } from "vitest";
import {
  isExplicitCanvasResize,
  projectExplicitCanvasResizes,
} from "@/lib/canvas/canvas-runtime-projection";
import { parseCanvasDocumentV2 } from "@/lib/canvas/canvas-document";
import {
  canvasDocumentToImageNodes,
  canvasDocumentToTaskNodes,
  canvasDocumentToTextNodes,
  runtimeNodesToCanvasDocument,
} from "@/lib/canvas/react-flow-canvas-adapter";

describe("Canvas runtime projection persistence boundary", () => {
  it("rejects mount-time measurement as a persisted resize", () => {
    expect(
      isExplicitCanvasResize({
        id: "image-1",
        type: "dimensions",
        dimensions: { width: 400, height: 300 },
      }),
    ).toBe(false);
  });

  it("accepts React Flow's completed NodeResizer event without setAttributes", () => {
    expect(
      isExplicitCanvasResize({
        id: "image-1",
        type: "dimensions",
        dimensions: { width: 400, height: 300 },
        resizing: false,
      }),
    ).toBe(true);
    expect(
      isExplicitCanvasResize({
        id: "image-1",
        type: "dimensions",
        dimensions: { width: 400, height: 300 },
        resizing: true,
        setAttributes: true,
      }),
    ).toBe(false);
  });

  it("projects final resize geometry for task, text, and image nodes before serialization", () => {
    const source = parseCanvasDocumentV2({
      schemaVersion: 2,
      nodes: [
        {
          id: "task-1",
          kind: "task",
          taskId: "mock-task-7",
          position: { x: 10, y: 20 },
          size: { width: 300, height: 150 },
          zIndex: 1,
        },
        {
          id: "text-1",
          kind: "text",
          markdown: "# Unchanged markdown",
          position: { x: 30, y: 40 },
          size: { width: 320, height: 220 },
          zIndex: 2,
        },
        {
          id: "image-1",
          kind: "image",
          assetId: "asset-1",
          aspectRatioLocked: true,
          position: { x: 50, y: 60 },
          size: { width: 320, height: 180 },
          zIndex: 3,
        },
      ],
      edges: [],
    });
    const runtime = [
      ...canvasDocumentToTaskNodes(source),
      ...canvasDocumentToTextNodes(source),
      ...canvasDocumentToImageNodes(source),
    ];

    const resized = projectExplicitCanvasResizes(runtime, [
      {
        id: "task-1",
        type: "dimensions",
        resizing: false,
        dimensions: { width: 420, height: 340 },
      },
      {
        id: "text-1",
        type: "dimensions",
        resizing: false,
        dimensions: { width: 450, height: 240 },
      },
      {
        id: "image-1",
        type: "dimensions",
        resizing: false,
        dimensions: { width: 480, height: 270 },
      },
    ]);
    const serialized = runtimeNodesToCanvasDocument(source, resized);

    expect(serialized.nodes.map((node) => node.size)).toEqual([
      { width: 420, height: 340 },
      { width: 450, height: 240 },
      { width: 480, height: 270 },
    ]);
    expect(serialized.nodes[1]).toMatchObject({
      kind: "text",
      markdown: "# Unchanged markdown",
    });
    expect(serialized.nodes[2]).toMatchObject({
      kind: "image",
      assetId: "asset-1",
      aspectRatioLocked: true,
    });
    expect(canvasDocumentToTaskNodes(serialized)[0]).toMatchObject({
      width: 420,
      height: 340,
    });
    expect(canvasDocumentToTextNodes(serialized)[0]).toMatchObject({
      width: 450,
      height: 240,
      data: { markdown: "# Unchanged markdown" },
    });
    expect(canvasDocumentToImageNodes(serialized)[0]).toMatchObject({
      width: 480,
      height: 270,
      data: { assetId: "asset-1" },
    });
  });
});
