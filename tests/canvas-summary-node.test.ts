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
  it("orders sources by vertical position and then horizontal position", () => {
    const document = documentWithSummary();

    expect(canvasSummaryEntries(document, "summary-1")).toEqual([
      { nodeId: "text-1", markdown: "Первый абзац", order: 4 },
      { nodeId: "shape-1", markdown: "Второй абзац", order: 1 },
    ]);
    expect(nextCanvasSummaryOrder(document, "summary-1")).toBe(5);
  });

  it("updates ordering when a block moves above another block", () => {
    const document = documentWithSummary();
    document.nodes.find((node) => node.id === "shape-1")!.position.y = -100;
    expect(
      canvasSummaryEntries(document, "summary-1").map((entry) => entry.nodeId),
    ).toEqual(["shape-1", "text-1"]);
  });

  it("breaks equal-position ties by horizontal position and then ID", () => {
    const document = documentWithSummary();
    const text = document.nodes.find((node) => node.id === "text-1")!;
    const shape = document.nodes.find((node) => node.id === "shape-1")!;
    text.position = { x: 300, y: 0 };
    shape.position = { x: 300, y: 0 };

    expect(
      canvasSummaryEntries(document, "summary-1").map((entry) => entry.nodeId),
    ).toEqual(["shape-1", "text-1"]);
  });

  it("emits a shared textual parent once as a heading", () => {
    const document = documentWithSummary();
    document.nodes.push({
      id: "parent",
      kind: "text",
      markdown: "Заголовок",
      position: { x: 0, y: -200 },
      size: { width: 240, height: 80 },
      zIndex: 4,
    });
    for (const child of ["text-1", "shape-1"]) {
      document.edges.push({
        id: `parent-${child}`,
        sourceNodeId: "parent",
        targetNodeId: child,
        sourceHandle: "bottom",
        targetHandle: "top",
        routing: "curved",
        arrows: "none",
      });
    }
    const entries = canvasSummaryEntries(document, "summary-1");
    expect(entries.map((entry) => entry.nodeId)).toEqual([
      "parent",
      "text-1",
      "shape-1",
    ]);
    expect(entries[0]).toMatchObject({
      role: "heading",
      markdown: "Заголовок",
    });
  });

  it("uses the upper-left nonempty parent and does not repeat it as a paragraph", () => {
    const document = documentWithSummary();
    document.nodes.push(
      {
        id: "later-parent",
        kind: "text",
        markdown: "Поздний заголовок",
        position: { x: 20, y: -100 },
        size: { width: 240, height: 80 },
        zIndex: 4,
      },
      {
        id: "first-parent",
        kind: "text",
        markdown: "**Первый заголовок**",
        position: { x: 10, y: -100 },
        size: { width: 240, height: 80 },
        zIndex: 5,
      },
    );
    document.edges.push(
      {
        id: "later-parent-child",
        sourceNodeId: "later-parent",
        targetNodeId: "text-1",
        sourceHandle: "bottom",
        targetHandle: "top",
        routing: "curved",
        arrows: "none",
      },
      {
        id: "first-parent-child",
        sourceNodeId: "first-parent",
        targetNodeId: "text-1",
        sourceHandle: "bottom",
        targetHandle: "top",
        routing: "curved",
        arrows: "none",
      },
      {
        id: "first-parent-summary",
        sourceNodeId: "first-parent",
        targetNodeId: "summary-1",
        sourceHandle: "right",
        targetHandle: "left",
        routing: "curved",
        arrows: "none",
        summaryOrder: 8,
      },
    );

    expect(canvasSummaryEntries(document, "summary-1")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: "first-parent",
          markdown: "**Первый заголовок**",
          role: "heading",
        }),
      ]),
    );
    expect(
      canvasSummaryEntries(document, "summary-1").filter(
        (entry) => entry.nodeId === "first-parent",
      ),
    ).toHaveLength(1);
  });

  it("does not add a heading for an empty or cyclic parent relation", () => {
    const document = documentWithSummary();
    document.nodes.push({
      id: "empty-parent",
      kind: "text",
      markdown: " ",
      position: { x: 0, y: -100 },
      size: { width: 240, height: 80 },
      zIndex: 4,
    });
    document.edges.push(
      {
        id: "empty-parent-child",
        sourceNodeId: "empty-parent",
        targetNodeId: "text-1",
        sourceHandle: "bottom",
        targetHandle: "top",
        routing: "curved",
        arrows: "none",
      },
      {
        id: "cycle",
        sourceNodeId: "text-1",
        targetNodeId: "shape-1",
        sourceHandle: "right",
        targetHandle: "left",
        routing: "curved",
        arrows: "none",
      },
      {
        id: "cycle-return",
        sourceNodeId: "shape-1",
        targetNodeId: "text-1",
        sourceHandle: "right",
        targetHandle: "left",
        routing: "curved",
        arrows: "none",
      },
    );

    expect(() => canvasSummaryEntries(document, "summary-1")).not.toThrow();
    expect(
      canvasSummaryEntries(document, "summary-1").some(
        (entry) => entry.nodeId === "empty-parent",
      ),
    ).toBe(false);
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
