import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import {
  canvasBranchDescendantNodeIds,
  canvasBranchCollapsedNodeIds,
  canvasBranchRuntimeState,
  projectCanvasBranchCollapse,
  translateCanvasBranchDescendants,
} from "@/lib/canvas/canvas-branch-collapse";
import { parseCanvasDocumentV2 } from "@/lib/canvas/canvas-document";
import {
  canvasDocumentToEdges,
  canvasDocumentToTextNodes,
  runtimeNodesToCanvasDocument,
} from "@/lib/canvas/react-flow-canvas-adapter";

function node(id: string): Node {
  return { id, position: { x: 0, y: 0 }, data: {} };
}

function edge(id: string, source: string, target: string): Edge {
  return { id, source, target };
}

describe("Canvas branch collapse projection", () => {
  it("hides the full descendant subtree while counting only direct children", () => {
    const projected = projectCanvasBranchCollapse(
      [node("root"), node("a"), node("b"), node("grandchild")],
      [
        edge("root-a", "root", "a"),
        edge("root-b", "root", "b"),
        edge("a-grandchild", "a", "grandchild"),
      ],
      "root",
    );

    expect(projected.nodes.find((item) => item.id === "root")?.hidden).toBe(
      false,
    );
    expect(
      projected.nodes
        .filter((item) => item.id !== "root")
        .every((item) => item.hidden),
    ).toBe(true);
    expect(projected.edges.every((item) => item.hidden)).toBe(true);
    expect(
      canvasBranchRuntimeState(
        projected.nodes.find((item) => item.id === "root")?.data,
      ),
    ).toMatchObject({ collapsed: true, directChildCount: 2 });
  });

  it("restores the branch when the same parent is expanded", () => {
    const collapsed = projectCanvasBranchCollapse(
      [node("root"), node("a"), node("b")],
      [edge("root-a", "root", "a"), edge("root-b", "root", "b")],
      "root",
    );
    const expanded = projectCanvasBranchCollapse(
      collapsed.nodes,
      collapsed.edges,
      "root",
    );

    expect(expanded.nodes.every((item) => !item.hidden)).toBe(true);
    expect(expanded.edges.every((item) => !item.hidden)).toBe(true);
    expect(
      canvasBranchRuntimeState(
        expanded.nodes.find((item) => item.id === "root")?.data,
      )?.collapsed,
    ).toBe(false);
  });

  it("preserves a nested collapsed branch after its ancestor is reopened", () => {
    const nodes = [node("root"), node("a"), node("grandchild")];
    const edges = [
      edge("root-a", "root", "a"),
      edge("a-grandchild", "a", "grandchild"),
    ];
    const childCollapsed = projectCanvasBranchCollapse(nodes, edges, "a");
    const rootCollapsed = projectCanvasBranchCollapse(
      childCollapsed.nodes,
      childCollapsed.edges,
      "root",
    );
    const rootExpanded = projectCanvasBranchCollapse(
      rootCollapsed.nodes,
      rootCollapsed.edges,
      "root",
    );

    expect(rootExpanded.nodes.find((item) => item.id === "a")?.hidden).toBe(
      false,
    );
    expect(
      rootExpanded.nodes.find((item) => item.id === "grandchild")?.hidden,
    ).toBe(true);
    expect(
      canvasBranchRuntimeState(
        rootExpanded.nodes.find((item) => item.id === "a")?.data,
      )?.collapsed,
    ).toBe(true);
  });

  it("does not hide the collapsed root when a directed cycle points back to it", () => {
    const projected = projectCanvasBranchCollapse(
      [node("root"), node("a")],
      [edge("root-a", "root", "a"), edge("a-root", "a", "root")],
      "root",
    );

    expect(projected.nodes.find((item) => item.id === "root")?.hidden).toBe(
      false,
    );
    expect(projected.nodes.find((item) => item.id === "a")?.hidden).toBe(true);
  });

  it("counts duplicate outgoing edges to the same child once", () => {
    const projected = projectCanvasBranchCollapse(
      [node("root"), node("child")],
      [edge("one", "root", "child"), edge("two", "root", "child")],
    );

    expect(
      canvasBranchRuntimeState(
        projected.nodes.find((item) => item.id === "root")?.data,
      )?.directChildCount,
    ).toBe(1);
  });

  it("moves every hidden descendant with its collapsed parent", () => {
    const nodes = [
      { ...node("root"), position: { x: 20, y: 30 } },
      { ...node("child"), position: { x: 170, y: 60 } },
      { ...node("grandchild"), position: { x: 360, y: 110 } },
      { ...node("unrelated"), position: { x: 20, y: 400 } },
    ];
    const edges = [
      edge("root-child", "root", "child"),
      edge("child-grandchild", "child", "grandchild"),
    ];

    const translated = translateCanvasBranchDescendants(
      nodes,
      canvasBranchDescendantNodeIds("root", edges),
      { x: 80, y: -25 },
    );

    expect(translated.find((item) => item.id === "child")?.position).toEqual({
      x: 250,
      y: 35,
    });
    expect(
      translated.find((item) => item.id === "grandchild")?.position,
    ).toEqual({ x: 440, y: 85 });
    expect(
      translated.find((item) => item.id === "unrelated")?.position,
    ).toEqual({ x: 20, y: 400 });
  });

  it("reapplies persisted collapse state after a document is restored", () => {
    const document = parseCanvasDocumentV2({
      schemaVersion: 2,
      nodes: [
        {
          id: "root",
          kind: "text",
          markdown: "Root",
          position: { x: 0, y: 0 },
          size: { width: 240, height: 56 },
          zIndex: 1,
          branchCollapsed: true,
        },
        {
          id: "child",
          kind: "text",
          markdown: "Child",
          position: { x: 320, y: 0 },
          size: { width: 240, height: 56 },
          zIndex: 2,
        },
      ],
      edges: [
        {
          id: "root-child",
          sourceNodeId: "root",
          sourceHandle: "right",
          targetNodeId: "child",
          targetHandle: "left",
          routing: "curved",
          arrows: "none",
        },
      ],
    });
    const projected = projectCanvasBranchCollapse(
      canvasDocumentToTextNodes(document),
      canvasDocumentToEdges(document),
      undefined,
      canvasBranchCollapsedNodeIds(document.nodes),
    );

    expect(projected.nodes.find((node) => node.id === "child")?.hidden).toBe(
      true,
    );
    expect(
      canvasBranchRuntimeState(
        projected.nodes.find((node) => node.id === "root")?.data,
      )?.collapsed,
    ).toBe(true);
    expect(
      runtimeNodesToCanvasDocument(document, projected.nodes).nodes[0],
    ).toMatchObject({ branchCollapsed: true });
  });
});
