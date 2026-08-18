import { describe, expect, it } from "vitest";
import {
  parseCanvasDocumentV2,
  type CanvasShapeNode,
} from "@/lib/canvas/canvas-document";
import {
  CANVAS_SHAPE_NODE_TYPE,
  canvasDocumentToShapeNodes,
  createCanvasShapeFlowNode,
  runtimeNodesToCanvasDocument,
} from "@/lib/canvas/react-flow-canvas-adapter";
import { DEFAULT_CANVAS_SHAPE_STYLE } from "@/lib/canvas/canvas-shape-style";
import {
  createCanvasNodeClipboardPayload,
  materializeCanvasNodeClipboardPaste,
} from "@/lib/canvas/canvas-node-clipboard";
import {
  createCanvasAltDragDuplicate,
  createCanvasAltDragRuntimeNode,
} from "@/lib/canvas/canvas-alt-drag-duplicate";

function shapeNode(overrides: Partial<CanvasShapeNode> = {}): CanvasShapeNode {
  return {
    id: "shape-1",
    kind: "shape",
    shape: "rectangle",
    markdown: "Идея",
    position: { x: 10, y: 20 },
    size: { width: 220, height: 120 },
    zIndex: 3,
    style: { ...DEFAULT_CANVAS_SHAPE_STYLE },
    ...overrides,
  };
}

describe("Canvas shape nodes", () => {
  it("parses rectangle and circle nodes as strict Canvas V2 nodes", () => {
    for (const shape of ["rectangle", "circle"] as const) {
      const node = shapeNode({ shape });
      const parsed = parseCanvasDocumentV2({
        schemaVersion: 2,
        nodes: [node],
        edges: [],
      });
      expect(parsed.nodes[0]).toEqual(node);
    }
  });

  it("rejects unsupported shape variants", () => {
    expect(() =>
      parseCanvasDocumentV2({
        schemaVersion: 2,
        nodes: [{ ...shapeNode(), shape: "triangle" }],
        edges: [],
      }),
    ).toThrowError(/shape/i);
  });

  it("projects shapes to React Flow and back without losing style", () => {
    const canonical = shapeNode({
      shape: "circle",
      size: { width: 160, height: 160 },
    });
    const document = parseCanvasDocumentV2({
      schemaVersion: 2,
      nodes: [canonical],
      edges: [],
    });
    const [runtime] = canvasDocumentToShapeNodes(document);
    expect(runtime.type).toBe(CANVAS_SHAPE_NODE_TYPE);
    expect(runtime.data.shape).toBe("circle");
    expect(runtime.data.style.fillColor).toBe(
      DEFAULT_CANVAS_SHAPE_STYLE.fillColor,
    );

    const nextRuntime = {
      ...runtime,
      position: { x: 80, y: 90 },
      data: {
        ...runtime.data,
        markdown: "Новая подпись",
        style: {
          ...runtime.data.style,
          fillColor: "#112233",
          color: "#ffffff",
        },
      },
    };
    const projected = runtimeNodesToCanvasDocument(document, [nextRuntime]);
    expect(projected.nodes[0]).toMatchObject({
      kind: "shape",
      position: { x: 80, y: 90 },
      markdown: "Новая подпись",
      style: { fillColor: "#112233", color: "#ffffff" },
    });
  });

  it("copies and pastes shapes as first-class Canvas nodes", () => {
    const document = parseCanvasDocumentV2({
      schemaVersion: 2,
      nodes: [shapeNode()],
      edges: [],
    });
    const payload = createCanvasNodeClipboardPayload(
      document,
      new Set(["shape-1"]),
    );
    expect(payload?.nodes).toHaveLength(1);
    const [pasted] = materializeCanvasNodeClipboardPaste(payload!, {
      target: { x: 400, y: 300 },
      zIndexStart: 10,
      idGenerator: () => "copy",
    });
    expect(pasted).toMatchObject({
      id: "shape-copy",
      kind: "shape",
      shape: "rectangle",
      markdown: "Идея",
      zIndex: 10,
    });
  });

  it("Alt-drag duplicates shape style without sharing nested runtime state", () => {
    const canonical = shapeNode();
    const duplicate = createCanvasAltDragDuplicate(canonical, {
      idGenerator: () => "duplicate",
      zIndex: 4,
    });
    expect(duplicate).toMatchObject({ id: "shape-duplicate", kind: "shape" });

    const runtime = createCanvasShapeFlowNode({
      id: canonical.id,
      shape: canonical.shape,
      markdown: canonical.markdown,
      position: canonical.position,
      size: canonical.size,
      zIndex: canonical.zIndex,
      style: canonical.style,
      isEditing: true,
    });
    const runtimeDuplicate = createCanvasAltDragRuntimeNode(
      runtime,
      duplicate!,
    );
    expect(runtimeDuplicate.type).toBe(CANVAS_SHAPE_NODE_TYPE);
    if (runtimeDuplicate.type !== CANVAS_SHAPE_NODE_TYPE) {
      throw new Error("Expected an Alt-dragged Canvas shape runtime node");
    }
    expect(runtimeDuplicate.data.isEditing).toBe(false);
    expect(runtimeDuplicate.data.style).not.toBe(runtime.data.style);
  });
});
