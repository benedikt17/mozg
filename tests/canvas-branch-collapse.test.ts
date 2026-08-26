import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import {
  canvasBranchRuntimeState,
  projectCanvasBranchCollapse,
} from "@/lib/canvas/canvas-branch-collapse";

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
});
