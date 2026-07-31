import { describe, expect, it } from "vitest";

import {
  CANVAS_DOCUMENT_LIMITS,
  CanvasDocumentValidationError,
  createEmptyCanvasDocumentV1,
  parseCanvasDocumentV1,
  validateCanvasDocumentV1,
} from "@/lib/canvas/canvas-document";
import {
  articleCanvasDocumentV1,
  emptyCanvasDocumentV1,
  imageCanvasDocumentV1,
  mixedCanvasDocumentV1,
  taskCanvasDocumentV1,
  textCanvasDocumentV1,
} from "@/../tests/fixtures/canvas-document-v1";

function expectRejected(input: unknown): void {
  expect(() => parseCanvasDocumentV1(input)).toThrow(
    CanvasDocumentValidationError,
  );
}

function node(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "node-1",
    kind: "text",
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 },
    zIndex: 0,
    markdown: "text",
    ...overrides,
  };
}

describe("CanvasDocumentV1", () => {
  it("accepts the canonical empty document", () => {
    expect(parseCanvasDocumentV1(emptyCanvasDocumentV1)).toEqual(
      createEmptyCanvasDocumentV1(),
    );
  });

  it.each([
    ["task", taskCanvasDocumentV1],
    ["article", articleCanvasDocumentV1],
    ["text", textCanvasDocumentV1],
    ["image", imageCanvasDocumentV1],
  ])("accepts a %s node", (_kind, document) => {
    expect(parseCanvasDocumentV1(document)).toEqual(document);
  });

  it("accepts a valid edge and mixed document", () => {
    expect(parseCanvasDocumentV1(mixedCanvasDocumentV1)).toEqual(
      mixedCanvasDocumentV1,
    );
  });

  it("preserves exact and empty Markdown", () => {
    const exact = parseCanvasDocumentV1(textCanvasDocumentV1);
    expect(exact.nodes[0]).toMatchObject({
      markdown: "  **exact Markdown**\n\n",
    });
    expect(
      parseCanvasDocumentV1({
        ...textCanvasDocumentV1,
        nodes: [{ ...textCanvasDocumentV1.nodes[0], markdown: "" }],
      }).nodes[0],
    ).toMatchObject({ markdown: "" });
  });

  it("rejects unsupported schema versions", () => {
    expectRejected({ ...emptyCanvasDocumentV1, schemaVersion: 2 });
  });

  it("rejects unknown top-level, node, and edge properties", () => {
    expectRejected({ ...emptyCanvasDocumentV1, future: true });
    expectRejected({
      ...emptyCanvasDocumentV1,
      nodes: [node({ future: true })],
    });
    expectRejected({
      ...mixedCanvasDocumentV1,
      edges: [{ ...mixedCanvasDocumentV1.edges[0], future: true }],
    });
  });

  it("rejects unsupported node kinds", () => {
    expectRejected({
      ...emptyCanvasDocumentV1,
      nodes: [node({ kind: "shape" })],
    });
  });

  it("rejects duplicate node and edge IDs", () => {
    expectRejected({
      ...emptyCanvasDocumentV1,
      nodes: [node(), node({ id: "node-1" })],
    });
    expectRejected({
      ...mixedCanvasDocumentV1,
      edges: [
        mixedCanvasDocumentV1.edges[0],
        { ...mixedCanvasDocumentV1.edges[0] },
      ],
    });
  });

  it("rejects duplicate edge endpoints", () => {
    expectRejected({
      ...mixedCanvasDocumentV1,
      edges: [
        mixedCanvasDocumentV1.edges[0],
        {
          ...mixedCanvasDocumentV1.edges[0],
          id: "edge-2",
        },
      ],
    });
  });

  it("rejects dangling and self-referencing edges", () => {
    expectRejected({
      ...emptyCanvasDocumentV1,
      nodes: [node()],
      edges: [
        { id: "edge-1", sourceNodeId: "node-1", targetNodeId: "missing" },
      ],
    });
    expectRejected({
      ...emptyCanvasDocumentV1,
      nodes: [node()],
      edges: [{ id: "edge-1", sourceNodeId: "node-1", targetNodeId: "node-1" }],
    });
  });

  it("rejects invalid dimensions and oversized dimensions", () => {
    expectRejected({
      ...emptyCanvasDocumentV1,
      nodes: [node({ size: { width: 0, height: 100 } })],
    });
    expectRejected({
      ...emptyCanvasDocumentV1,
      nodes: [
        node({
          size: {
            width: CANVAS_DOCUMENT_LIMITS.maxNodeDimension + 1,
            height: 100,
          },
        }),
      ],
    });
  });

  it("rejects non-finite coordinates and invalid zIndex", () => {
    expectRejected({
      ...emptyCanvasDocumentV1,
      nodes: [node({ position: { x: Number.NaN, y: 0 } })],
    });
    expectRejected({
      ...emptyCanvasDocumentV1,
      nodes: [node({ zIndex: 1.5 })],
    });
  });

  it("rejects empty stable references", () => {
    expectRejected({
      ...taskCanvasDocumentV1,
      nodes: [{ ...taskCanvasDocumentV1.nodes[0], taskId: " " }],
    });
    expectRejected({
      ...imageCanvasDocumentV1,
      nodes: [{ ...imageCanvasDocumentV1.nodes[0], assetId: "" }],
    });
  });

  it("rejects documents over node, edge, and Markdown limits", () => {
    expectRejected({
      ...emptyCanvasDocumentV1,
      nodes: Array.from(
        { length: CANVAS_DOCUMENT_LIMITS.maxNodes + 1 },
        (_, index) => node({ id: `node-${index}` }),
      ),
    });
    expectRejected({
      ...mixedCanvasDocumentV1,
      edges: Array.from(
        { length: CANVAS_DOCUMENT_LIMITS.maxEdges + 1 },
        (_, index) => ({
          id: `edge-${index}`,
          sourceNodeId: "node-1",
          targetNodeId: "article-node-1",
        }),
      ),
    });
    expectRejected({
      ...textCanvasDocumentV1,
      nodes: [
        {
          ...textCanvasDocumentV1.nodes[0],
          markdown: "x".repeat(CANVAS_DOCUMENT_LIMITS.maxMarkdownLength + 1),
        },
      ],
    });
  });

  it("does not mutate input and returns useful validation errors", () => {
    const input = structuredClone(mixedCanvasDocumentV1);
    const before = structuredClone(input);
    expect(validateCanvasDocumentV1(input).ok).toBe(true);
    expect(input).toEqual(before);
    const invalid = validateCanvasDocumentV1({ future: true });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.errors[0]?.code).toBe("unknown_property");
    }
  });
});
