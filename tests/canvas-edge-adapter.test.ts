import { describe, expect, it, vi } from "vitest";
import {
  canvasDocumentToEdges,
  createCanvasEdgeFromConnection,
  runtimeEdgesToCanvasDocument,
  updateCanvasEdgeFlowRuntime,
} from "@/lib/canvas/react-flow-canvas-adapter";
import { parseCanvasDocumentV2 } from "@/lib/canvas/canvas-document";
import {
  CANVAS_EDGE_MARKER_END_ID,
  CANVAS_EDGE_MARKER_START_ID,
} from "@/lib/canvas/canvas-edge-markers";

const document = parseCanvasDocumentV2({
  schemaVersion: 2,
  nodes: [
    {
      id: "task-node",
      kind: "task",
      taskId: "task-1",
      position: { x: 0, y: 0 },
      size: { width: 200, height: 120 },
      zIndex: 1,
    },
    {
      id: "text-node",
      kind: "text",
      markdown: "Notes",
      position: { x: 300, y: 0 },
      size: { width: 200, height: 120 },
      zIndex: 2,
    },
    {
      id: "image-node",
      kind: "image",
      assetId: "asset-1",
      aspectRatioLocked: true,
      position: { x: 600, y: 0 },
      size: { width: 200, height: 120 },
      zIndex: 3,
    },
  ],
  edges: [
    {
      id: "task-text",
      sourceNodeId: "task-node",
      sourceHandle: "right",
      targetNodeId: "text-node",
      targetHandle: "left",
      routing: "orthogonal",
      arrows: "start",
    },
    {
      id: "text-image",
      sourceNodeId: "text-node",
      sourceHandle: "bottom",
      targetNodeId: "image-node",
      targetHandle: "top",
      routing: "curved",
      arrows: "end",
    },
  ],
});

describe("Canvas edge React Flow adapter", () => {
  it("projects canonical edges without persisting runtime marker objects", () => {
    const onUpdate = vi.fn();
    const edges = canvasDocumentToEdges(document, onUpdate);

    expect(edges).toHaveLength(2);
    expect(edges[0]).toMatchObject({
      id: "task-text",
      source: "task-node",
      sourceHandle: "right",
      target: "text-node",
      targetHandle: "left",
      data: { routing: "orthogonal", arrows: "start", onUpdate },
    });
    expect(edges[0].markerStart).toBe(CANVAS_EDGE_MARKER_START_ID);
    expect(edges[0].markerEnd).toBeUndefined();
    expect(edges[1].markerStart).toBeUndefined();
    expect(edges[1].markerEnd).toBe(CANVAS_EDGE_MARKER_END_ID);
    expect(JSON.stringify(document)).not.toContain("marker");
    expect(JSON.stringify(document)).not.toContain("canvasEdge");
  });

  it("creates connections for every supported node pairing and handle side", () => {
    expect(
      createCanvasEdgeFromConnection({
        source: "task-node",
        sourceHandle: "top",
        target: "text-node",
        targetHandle: "right",
        id: "task-text-new",
      }),
    ).toMatchObject({
      id: "task-text-new",
      sourceNodeId: "task-node",
      sourceHandle: "top",
      targetNodeId: "text-node",
      targetHandle: "right",
    });
    expect(
      createCanvasEdgeFromConnection({
        source: "text-node",
        sourceHandle: "bottom",
        target: "image-node",
        targetHandle: "left",
      }),
    ).not.toBeNull();
    expect(
      createCanvasEdgeFromConnection({
        source: "image-node",
        sourceHandle: "left",
        target: "task-node",
        targetHandle: "bottom",
      }),
    ).not.toBeNull();
    expect(
      createCanvasEdgeFromConnection({
        source: "task-node",
        sourceHandle: "bad",
        target: "text-node",
        targetHandle: "left",
      }),
    ).toBeNull();
  });

  it("maps runtime handle changes back while ignoring selection and callbacks", () => {
    const edges = canvasDocumentToEdges(document, vi.fn()).map((edge) => ({
      ...edge,
      selected: true,
      sourceHandle: edge.id === "task-text" ? "bottom" : edge.sourceHandle,
      targetHandle: edge.id === "task-text" ? "top" : edge.targetHandle,
    }));
    const next = runtimeEdgesToCanvasDocument(document, edges);
    expect(next.edges[0]).toMatchObject({
      id: "task-text",
      sourceHandle: "bottom",
      targetHandle: "top",
      routing: "orthogonal",
      arrows: "start",
    });
    expect(next.edges[0]).not.toHaveProperty("selected");
    expect(next.edges[0]).not.toHaveProperty("data");
  });

  it("refreshes runtime marker configuration when toolbar arrows change", () => {
    const [edge] = canvasDocumentToEdges(
      parseCanvasDocumentV2({
        ...document,
        edges: [
          {
            ...document.edges[0],
            arrows: "none",
          },
        ],
      }),
      vi.fn(),
    );
    const updated = updateCanvasEdgeFlowRuntime(edge, {
      routing: "orthogonal",
      arrows: "both",
    });

    expect(updated.id).toBe(edge.id);
    expect(updated.data).toMatchObject({
      routing: "orthogonal",
      arrows: "both",
    });
    expect(updated.markerStart).toBe(CANVAS_EDGE_MARKER_START_ID);
    expect(updated.markerEnd).toBe(CANVAS_EDGE_MARKER_END_ID);
  });
});
