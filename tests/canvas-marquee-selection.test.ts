import { describe, expect, it } from "vitest";

import { canvasNodeIntersectsMarquee } from "@/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell";

function node(id: string, x: number, y: number, width = 120, height = 48) {
  return {
    id,
    position: { x, y },
    width,
    height,
  } as Parameters<typeof canvasNodeIntersectsMarquee>[0];
}

describe("Canvas marquee selection", () => {
  it("keeps only nodes that truly intersect the rectangle", () => {
    const marquee = { x: 950, y: 270, width: 202, height: 314 };

    expect(
      canvasNodeIntersectsMarquee(node("green-1", 930, 350), marquee),
    ).toBe(true);
    expect(
      canvasNodeIntersectsMarquee(node("green-2", 930, 445), marquee),
    ).toBe(true);
    expect(
      canvasNodeIntersectsMarquee(node("green-3", 930, 530), marquee),
    ).toBe(true);
    expect(canvasNodeIntersectsMarquee(node("yellow", 490, 100), marquee)).toBe(
      false,
    );
  });

  it("does not select an unmeasured node merely because React Flow is hydrating", () => {
    expect(
      canvasNodeIntersectsMarquee(
        { id: "unmeasured", position: { x: 0, y: 0 } } as Parameters<
          typeof canvasNodeIntersectsMarquee
        >[0],
        { x: 900, y: 300, width: 200, height: 200 },
      ),
    ).toBe(false);
  });
});
