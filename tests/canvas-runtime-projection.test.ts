import { describe, expect, it } from "vitest";
import { isExplicitCanvasResize } from "@/lib/canvas/canvas-runtime-projection";

describe("Canvas runtime projection persistence boundary", () => {
  it("rejects mount-time measurement as a persisted resize", () => {
    expect(
      isExplicitCanvasResize({
        id: "image-1",
        type: "dimensions",
        dimensions: { width: 400, height: 300 },
      }),
    ).toBe(false);
  });

  it("accepts only a completed explicit NodeResizer change", () => {
    expect(
      isExplicitCanvasResize({
        id: "image-1",
        type: "dimensions",
        dimensions: { width: 400, height: 300 },
        resizing: false,
        setAttributes: true,
      }),
    ).toBe(true);
    expect(
      isExplicitCanvasResize({
        id: "image-1",
        type: "dimensions",
        dimensions: { width: 400, height: 300 },
        resizing: false,
        setAttributes: false,
      }),
    ).toBe(false);
  });
});
