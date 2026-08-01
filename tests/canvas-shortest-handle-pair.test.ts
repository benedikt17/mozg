import { describe, expect, it } from "vitest";
import {
  findShortestCanvasHandlePair,
  getCanvasHandleCenter,
  recomputeCanvasRuntimeEdgeHandles,
  type CanvasNodeBounds,
} from "@/lib/canvas/canvas-shortest-handle-pair";
import type { CanvasHandleSide } from "@/lib/canvas/canvas-document";

const sides: CanvasHandleSide[] = ["top", "right", "bottom", "left"];

function bruteForceMinimum(
  sourceBounds: CanvasNodeBounds,
  targetBounds: CanvasNodeBounds,
): number {
  return Math.min(
    ...sides.flatMap((sourceSide) =>
      sides.map((targetSide) => {
        const source = getCanvasHandleCenter(sourceBounds, sourceSide);
        const target = getCanvasHandleCenter(targetBounds, targetSide);
        return (target.x - source.x) ** 2 + (target.y - source.y) ** 2;
      }),
    ),
  );
}

describe("shortest Canvas handle pair", () => {
  it.each([
    [
      "right",
      {
        source: { x: 0, y: 0, width: 100, height: 100 },
        target: { x: 300, y: 0, width: 100, height: 100 },
      },
    ],
    [
      "left",
      {
        source: { x: 300, y: 0, width: 100, height: 100 },
        target: { x: 0, y: 0, width: 100, height: 100 },
      },
    ],
    [
      "bottom",
      {
        source: { x: 0, y: 0, width: 100, height: 100 },
        target: { x: 0, y: 300, width: 100, height: 100 },
      },
    ],
    [
      "top",
      {
        source: { x: 0, y: 300, width: 100, height: 100 },
        target: { x: 0, y: 0, width: 100, height: 100 },
      },
    ],
  ] as const)("chooses the %s-facing source handle", (expected, layout) => {
    const pair = findShortestCanvasHandlePair(layout.source, layout.target);
    expect(pair.sourceHandle).toBe(expected);
    expect(pair.distanceSquared).toBe(
      bruteForceMinimum(layout.source, layout.target),
    );
    expect(pair.targetHandle).toBe(
      expected === "right"
        ? "left"
        : expected === "left"
          ? "right"
          : expected === "bottom"
            ? "top"
            : "bottom",
    );
  });

  it.each([
    {
      source: { x: 0, y: 0, width: 100, height: 100 },
      target: { x: 220, y: 180, width: 100, height: 100 },
    },
    {
      source: { x: 300, y: 220, width: 100, height: 100 },
      target: { x: 0, y: 0, width: 100, height: 100 },
    },
    {
      source: { x: 0, y: 0, width: 160, height: 100 },
      target: { x: 90, y: 240, width: 120, height: 160 },
    },
    {
      source: { x: 0, y: 0, width: 100, height: 160 },
      target: { x: 240, y: 80, width: 160, height: 120 },
    },
  ] as const)(
    "returns the actual minimum for diagonal and overlap layouts",
    (layout) => {
      const pair = findShortestCanvasHandlePair(layout.source, layout.target);
      expect(pair.distanceSquared).toBe(
        bruteForceMinimum(layout.source, layout.target),
      );
    },
  );

  it("keeps the deterministic first result for repeated equal layouts", () => {
    const source = { x: 0, y: 0, width: 100, height: 100 };
    const target = { x: 200, y: 200, width: 100, height: 100 };
    const first = findShortestCanvasHandlePair(source, target);
    for (let index = 0; index < 20; index += 1)
      expect(findShortestCanvasHandlePair(source, target)).toEqual(first);
  });

  it("recomputes runtime handles without changing edge identity or metadata", () => {
    const edges = [
      {
        id: "edge-1",
        source: "source",
        target: "target",
        sourceHandle: "top",
        targetHandle: "top",
        routing: "orthogonal",
        arrows: "both",
      },
    ];
    const next = recomputeCanvasRuntimeEdgeHandles(edges, [
      { id: "source", x: 0, y: 0, width: 100, height: 100 },
      { id: "target", x: 300, y: 0, width: 100, height: 100 },
    ]);
    expect(next[0]).toMatchObject({
      id: "edge-1",
      source: "source",
      target: "target",
      sourceHandle: "right",
      targetHandle: "left",
      routing: "orthogonal",
      arrows: "both",
    });
  });
});
