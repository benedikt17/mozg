import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { autoLayoutCanvasNodes } from "@/lib/canvas/canvas-auto-layout";

function node(id: string, x = 0, y = 0): Node {
  return {
    id,
    position: { x, y },
    data: {},
    style: { width: 200, height: 80 },
  };
}

function edge(id: string, source: string, target: string): Edge {
  return { id, source, target };
}

describe("Canvas auto layout", () => {
  it("places directed generations from left to right", () => {
    const positions = autoLayoutCanvasNodes(
      [node("root"), node("child-a"), node("child-b"), node("grandchild")],
      [
        edge("root-a", "root", "child-a"),
        edge("root-b", "root", "child-b"),
        edge("a-grandchild", "child-a", "grandchild"),
      ],
    );

    expect(positions.get("root")?.x).toBeLessThan(
      positions.get("child-a")?.x ?? 0,
    );
    expect(positions.get("child-a")?.x).toBe(positions.get("child-b")?.x);
    expect(positions.get("child-a")?.x ?? 0).toBeLessThan(
      positions.get("grandchild")?.x ?? 0,
    );
  });

  it("keeps peers in the same generation vertically separated", () => {
    const positions = autoLayoutCanvasNodes(
      [node("root"), node("a"), node("b")],
      [edge("root-a", "root", "a"), edge("root-b", "root", "b")],
    );
    const a = positions.get("a");
    const b = positions.get("b");
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(Math.abs((a?.y ?? 0) - (b?.y ?? 0))).toBeGreaterThanOrEqual(160);
  });

  it("handles directed cycles without producing invalid coordinates", () => {
    const positions = autoLayoutCanvasNodes(
      [node("a"), node("b"), node("c")],
      [edge("a-b", "a", "b"), edge("b-a", "b", "a"), edge("b-c", "b", "c")],
    );

    expect(positions.get("a")?.x).toBe(positions.get("b")?.x);
    expect(positions.get("a")?.x ?? 0).toBeLessThan(positions.get("c")?.x ?? 0);
    for (const position of positions.values()) {
      expect(Number.isFinite(position.x)).toBe(true);
      expect(Number.isFinite(position.y)).toBe(true);
    }
  });

  it("separates disconnected components and arranges isolated nodes in a grid", () => {
    const positions = autoLayoutCanvasNodes(
      [
        node("a"),
        node("b"),
        node("c"),
        node("d"),
        node("isolated-1"),
        node("isolated-2"),
      ],
      [edge("a-b", "a", "b"), edge("c-d", "c", "d")],
    );

    expect(positions.get("c")?.y ?? 0).toBeGreaterThan(
      positions.get("a")?.y ?? 0,
    );
    expect(positions.get("isolated-1")?.y ?? 0).toBeGreaterThan(
      positions.get("c")?.y ?? 0,
    );
    expect(positions.get("isolated-1")?.x).not.toBe(
      positions.get("isolated-2")?.x,
    );
  });

  it("is deterministic and does not mutate the source nodes", () => {
    const nodes = [node("root", 910, 420), node("child", 100, 900)];
    const before = structuredClone(nodes);
    const edges = [edge("root-child", "root", "child")];

    const first = [...autoLayoutCanvasNodes(nodes, edges).entries()];
    const second = [...autoLayoutCanvasNodes(nodes, edges).entries()];

    expect(first).toEqual(second);
    expect(nodes).toEqual(before);
  });
});
