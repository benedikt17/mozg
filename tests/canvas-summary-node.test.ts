import { describe, expect, it } from "vitest";
import {
  parseCanvasDocumentV2,
  type CanvasSummaryNode,
} from "@/lib/canvas/canvas-document";
import {
  CANVAS_SUMMARY_NODE_TYPE,
  canvasDocumentToSummaryNodes,
  createCanvasSummaryFlowNode,
  runtimeNodesToCanvasDocument,
} from "@/lib/canvas/react-flow-canvas-adapter";
import {
  canvasSummaryEntries,
  nextCanvasSummaryOrder,
} from "@/lib/canvas/canvas-summary";

function summaryNode(
  overrides: Partial<CanvasSummaryNode> = {},
): CanvasSummaryNode {
  return {
    id: "summary-1",
    kind: "summary",
    title: "Сумма",
    position: { x: 600, y: 20 },
    size: { width: 156, height: 96 },
    zIndex: 3,
    ...overrides,
  };
}

function documentWithSummary() {
  return parseCanvasDocumentV2({
    schemaVersion: 2,
    nodes: [
      {
        id: "text-1",
        kind: "text",
        markdown: "Первый абзац",
        position: { x: 0, y: 0 },
        size: { width: 240, height: 80 },
        zIndex: 1,
      },
      {
        id: "shape-1",
        kind: "shape",
        shape: "rectangle",
        markdown: "Второй абзац",
        position: { x: 300, y: 0 },
        size: { width: 220, height: 120 },
        zIndex: 2,
        style: {
          fontFamily: "system",
          fontSize: 18,
          bold: false,
          italic: false,
          underline: false,
          strikethrough: false,
          color: "#292524",
          fillColor: "#F5DE47",
          textAlign: "center",
        },
      },
      summaryNode(),
    ],
    edges: [
      {
        id: "second-connected-first",
        sourceNodeId: "shape-1",
        sourceHandle: "right",
        targetNodeId: "summary-1",
        targetHandle: "left",
        routing: "curved",
        arrows: "none",
        summaryOrder: 1,
      },
      {
        id: "first-connected-second",
        sourceNodeId: "text-1",
        sourceHandle: "right",
        targetNodeId: "summary-1",
        targetHandle: "left",
        routing: "curved",
        arrows: "none",
        summaryOrder: 4,
      },
    ],
  });
}

describe("Canvas summary nodes", () => {
  it("keeps a connection's persistent insertion order while presenting sequential entries", () => {
    const document = documentWithSummary();

    expect(canvasSummaryEntries(document, "summary-1")).toEqual([
      { nodeId: "shape-1", markdown: "Второй абзац", order: 1 },
      { nodeId: "text-1", markdown: "Первый абзац", order: 4 },
    ]);
    expect(nextCanvasSummaryOrder(document, "summary-1")).toBe(5);
  });

  it("projects summaries to React Flow and preserves their geometry", () => {
    const document = documentWithSummary();
    const [runtime] = canvasDocumentToSummaryNodes(document);
    expect(runtime.type).toBe(CANVAS_SUMMARY_NODE_TYPE);
    expect(runtime.data.title).toBe("Сумма");

    const moved = createCanvasSummaryFlowNode({
      id: runtime.id,
      title: runtime.data.title,
      position: { x: 720, y: 140 },
      size: { width: 180, height: 100 },
      zIndex: runtime.zIndex,
    });
    const projected = runtimeNodesToCanvasDocument(document, [moved]);
    expect(
      projected.nodes.find((node) => node.id === runtime.id),
    ).toMatchObject({
      kind: "summary",
      position: { x: 720, y: 140 },
      size: { width: 180, height: 100 },
    });
  });

  it("rejects a summary connection from a non-text node", () => {
    const document = documentWithSummary();
    expect(() =>
      parseCanvasDocumentV2({
        ...document,
        nodes: [
          ...document.nodes,
          {
            id: "task-1",
            kind: "task",
            taskId: "task-1",
            position: { x: 0, y: 240 },
            size: { width: 240, height: 120 },
            zIndex: 4,
          },
        ],
        edges: [
          ...document.edges,
          {
            id: "task-summary",
            sourceNodeId: "task-1",
            sourceHandle: "right",
            targetNodeId: "summary-1",
            targetHandle: "left",
            routing: "curved",
            arrows: "none",
            summaryOrder: 5,
          },
        ],
      }),
    ).toThrow(/summar/i);
  });
});
