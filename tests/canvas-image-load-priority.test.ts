import { describe, expect, it } from "vitest";
import { imageLoadOrder } from "@/lib/canvas/canvas-image-load-priority";

const image = (x: number, y: number) => ({
  position: { x, y },
  size: { width: 100, height: 80 },
});

describe("Canvas image load priority", () => {
  it("loads visible images before earlier offscreen images", () => {
    const images = [
      image(10_000, 0),
      image(300, 100),
      image(-4_000, 0),
      image(30, 50),
    ];
    expect(
      imageLoadOrder(images, { x: 0, y: 0, width: 800, height: 600 }),
    ).toEqual([1, 3, 2, 0]);
    expect(images[0]?.position.x).toBe(10_000);
  });

  it("keeps document order when the viewport is not measured yet", () => {
    expect(imageLoadOrder([image(400, 0), image(0, 0)])).toEqual([0, 1]);
  });
});
