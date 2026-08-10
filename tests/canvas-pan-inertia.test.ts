import { describe, expect, it } from "vitest";
import {
  advanceCanvasPanInertia,
  canvasPanReleaseVelocity,
  type CanvasPanVelocity,
} from "@/lib/canvas/canvas-pan-inertia";

function stoppingDistance(initialVelocity: CanvasPanVelocity): number {
  let viewport = { x: 0, y: 0, zoom: 1 };
  let velocity = initialVelocity;
  for (let frame = 0; frame < 120; frame += 1) {
    const step = advanceCanvasPanInertia({
      viewport,
      velocity,
      elapsedMs: 1000 / 60,
    });
    viewport = step.viewport;
    velocity = step.velocity;
    if (step.done) break;
  }
  return Math.hypot(viewport.x, viewport.y);
}

describe("Canvas pan inertia", () => {
  it("does not start inertia without meaningful release speed", () => {
    expect(canvasPanReleaseVelocity([{ x: 0, y: 0, at: 0 }])).toBeNull();
    expect(
      canvasPanReleaseVelocity([
        { x: 0, y: 0, at: 0 },
        { x: 3, y: 0, at: 100 },
      ]),
    ).toBeNull();
  });

  it("uses recent movement to derive release velocity and caps extreme throws", () => {
    const velocity = canvasPanReleaseVelocity([
      { x: 0, y: 0, at: 0 },
      { x: 100, y: 0, at: 80 },
      { x: 500, y: 0, at: 100 },
    ]);

    expect(velocity).not.toBeNull();
    expect(Math.hypot(velocity!.x, velocity!.y)).toBeCloseTo(3.2, 5);
  });

  it("moves in the release direction while velocity decays", () => {
    const step = advanceCanvasPanInertia({
      viewport: { x: 10, y: 20, zoom: 1.5 },
      velocity: { x: 1, y: -0.5 },
      elapsedMs: 16,
    });

    expect(step.viewport.x).toBeGreaterThan(10);
    expect(step.viewport.y).toBeLessThan(20);
    expect(step.viewport.zoom).toBe(1.5);
    expect(Math.hypot(step.velocity.x, step.velocity.y)).toBeLessThan(
      Math.hypot(1, -0.5),
    );
  });

  it("travels farther when the release speed is higher", () => {
    expect(stoppingDistance({ x: 2.4, y: 0 })).toBeGreaterThan(
      stoppingDistance({ x: 0.6, y: 0 }),
    );
  });
});
