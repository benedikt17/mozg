import { describe, expect, it } from "vitest";
import { canvasMiniMapNodeColor } from "@/lib/canvas/canvas-minimap";
import { parseCanvasDocumentV2 } from "@/lib/canvas/canvas-document";
import {
  CANVAS_IMAGE_NODE_TYPE,
  CANVAS_TASK_NODE_TYPE,
  CANVAS_TEXT_NODE_TYPE,
  canvasDocumentToImageNodes,
  canvasDocumentToTaskNodes,
  canvasDocumentToTextNodes,
} from "@/lib/canvas/react-flow-canvas-adapter";

describe("canvasMiniMapNodeColor", () => {
  it("keeps every persisted Canvas node type visible against the MiniMap surface", () => {
    const colors = [
      canvasMiniMapNodeColor({ type: CANVAS_TEXT_NODE_TYPE }),
      canvasMiniMapNodeColor({ type: CANVAS_TASK_NODE_TYPE }),
      canvasMiniMapNodeColor({ type: CANVAS_IMAGE_NODE_TYPE }),
    ];

    expect(colors).toEqual(["#57534e", "#0f766e", "#9a3412"]);
    expect(new Set(colors)).toHaveLength(3);
  });

  it("projects persisted canonical bounds into the node fields consumed by React Flow MiniMap", () => {
    const document = parseCanvasDocumentV2({
      schemaVersion: 2,
      nodes: [
        {
          id: "text-1",
          kind: "text",
          markdown: "Text",
          position: { x: 10, y: 20 },
          size: { width: 320, height: 180 },
          zIndex: 1,
        },
        {
          id: "task-1",
          kind: "task",
          taskId: "task-a",
          position: { x: 30, y: 40 },
          size: { width: 300, height: 150 },
          zIndex: 2,
        },
        {
          id: "image-1",
          kind: "image",
          assetId: "asset-a",
          position: { x: 50, y: 60 },
          size: { width: 640, height: 360 },
          zIndex: 3,
          aspectRatioLocked: true,
        },
      ],
      edges: [],
    });
    const nodes = [
      ...canvasDocumentToTextNodes(document),
      ...canvasDocumentToTaskNodes(document),
      ...canvasDocumentToImageNodes(document),
    ];

    expect(nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "text-1",
          width: 320,
          height: 180,
          style: { width: 320, height: 180 },
        }),
        expect.objectContaining({
          id: "task-1",
          width: 300,
          height: 150,
          style: { width: 300, height: 150 },
        }),
        expect.objectContaining({
          id: "image-1",
          width: 640,
          height: 360,
          style: { width: 640, height: 360 },
        }),
      ]),
    );
  });
});
