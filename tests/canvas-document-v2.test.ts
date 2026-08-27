import { describe, expect, it } from "vitest";
import {
  parseCanvasDocumentV1,
  parseCanvasDocumentV2,
  validateCanvasDocumentV2,
} from "@/lib/canvas/canvas-document";

const nodes = [
  {
    id: "task-node",
    kind: "task" as const,
    taskId: "task-1",
    position: { x: 10, y: 20 },
    size: { width: 240, height: 120 },
    zIndex: 1,
  },
  {
    id: "text-node",
    kind: "text" as const,
    markdown: "# Notes",
    position: { x: 360, y: 20 },
    size: { width: 240, height: 120 },
    zIndex: 2,
  },
  {
    id: "image-node",
    kind: "image" as const,
    assetId: "asset-1",
    aspectRatioLocked: true,
    position: { x: 700, y: 20 },
    size: { width: 240, height: 120 },
    zIndex: 3,
  },
];

describe("CanvasDocumentV2", () => {
  it("migrates V1 edges in memory without mutating the V1 input", () => {
    const v1 = {
      schemaVersion: 1 as const,
      nodes,
      edges: [
        {
          id: "edge-v1",
          sourceNodeId: "task-node",
          targetNodeId: "text-node",
        },
      ],
    };
    const before = structuredClone(v1);
    const migrated = parseCanvasDocumentV2(v1);

    expect(migrated).toEqual({
      schemaVersion: 2,
      nodes,
      edges: [
        {
          id: "edge-v1",
          sourceNodeId: "task-node",
          sourceHandle: "right",
          targetNodeId: "text-node",
          targetHandle: "left",
          routing: "curved",
          arrows: "none",
        },
      ],
    });
    expect(v1).toEqual(before);
  });

  it("accepts exact V2 round-trips for all edge capabilities", () => {
    const document = {
      schemaVersion: 2 as const,
      nodes,
      edges: [
        {
          id: "task-to-text",
          sourceNodeId: "task-node",
          sourceHandle: "top" as const,
          targetNodeId: "text-node",
          targetHandle: "bottom" as const,
          routing: "orthogonal" as const,
          arrows: "start" as const,
        },
        {
          id: "text-to-image",
          sourceNodeId: "text-node",
          sourceHandle: "right" as const,
          targetNodeId: "image-node",
          targetHandle: "left" as const,
          routing: "curved" as const,
          arrows: "end" as const,
        },
      ],
    };
    expect(parseCanvasDocumentV2(document)).toEqual(document);
  });

  it.each([
    ["sourceHandle", "diagonal"],
    ["targetHandle", "diagonal"],
    ["routing", "elbow"],
    ["arrows", "middle"],
  ] as const)("rejects invalid %s", (field, value) => {
    const result = validateCanvasDocumentV2({
      schemaVersion: 2,
      nodes,
      edges: [
        {
          id: "edge-1",
          sourceNodeId: "task-node",
          sourceHandle: "right",
          targetNodeId: "text-node",
          targetHandle: "left",
          routing: "curved",
          arrows: "none",
          [field]: value,
        },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects dangling V2 edges", () => {
    const result = validateCanvasDocumentV2({
      schemaVersion: 2,
      nodes,
      edges: [
        {
          id: "edge-1",
          sourceNodeId: "task-node",
          sourceHandle: "right",
          targetNodeId: "missing-node",
          targetHandle: "left",
          routing: "straight",
          arrows: "both",
        },
      ],
    });
    expect(result).toMatchObject({
      ok: false,
      errors: [{ code: "dangling_edge" }],
    });
  });

  it("uses UTF-16 code units for identifier limits", () => {
    const acceptedId = "😀".repeat(128);
    const rejectedId = "😀".repeat(129);
    const accepted = validateCanvasDocumentV2({
      schemaVersion: 2,
      nodes: [
        {
          ...nodes[0],
          id: acceptedId,
        },
      ],
      edges: [],
    });
    const rejected = validateCanvasDocumentV2({
      schemaVersion: 2,
      nodes: [
        {
          ...nodes[0],
          id: rejectedId,
        },
      ],
      edges: [],
    });

    expect(accepted.ok).toBe(true);
    expect(rejected).toMatchObject({
      ok: false,
      errors: [{ code: "invalid_identifier" }],
    });
  });

  it("accepts first-class PDF nodes in V2 and keeps them out of V1", () => {
    const pdfNode = {
      id: "pdf-node",
      kind: "pdf" as const,
      fileId: "file-1",
      lastKnownName: "spec.pdf",
      position: { x: 20, y: 30 },
      size: { width: 300, height: 180 },
      zIndex: 4,
    };
    expect(
      parseCanvasDocumentV2({ schemaVersion: 2, nodes: [pdfNode], edges: [] }),
    ).toEqual({ schemaVersion: 2, nodes: [pdfNode], edges: [] });
    expect(() =>
      parseCanvasDocumentV1({ schemaVersion: 1, nodes: [pdfNode], edges: [] }),
    ).toThrow();
  });

  it("accepts only boolean persisted branch-collapse state", () => {
    const accepted = parseCanvasDocumentV2({
      schemaVersion: 2,
      nodes: [{ ...nodes[0], branchCollapsed: true }],
      edges: [],
    });
    expect(accepted.nodes[0]).toMatchObject({ branchCollapsed: true });
    expect(() =>
      parseCanvasDocumentV2({
        schemaVersion: 2,
        nodes: [{ ...nodes[0], branchCollapsed: "true" }],
        edges: [],
      }),
    ).toThrow();
  });

  it("keeps the dedicated V1 parser strict for legacy callers", () => {
    expect(() =>
      parseCanvasDocumentV1({ schemaVersion: 2, nodes: [], edges: [] }),
    ).toThrow();
  });
});
