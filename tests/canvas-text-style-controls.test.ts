import { describe, expect, it } from "vitest";
import {
  CANVAS_TEXT_FONT_SIZES,
  nextCanvasTextFontSize,
  previousCanvasTextFontSize,
} from "@/lib/canvas/canvas-text-style";

describe("Canvas text size controls", () => {
  it("keeps the exact Miro-style size scale", () => {
    expect(CANVAS_TEXT_FONT_SIZES).toEqual([
      10, 12, 14, 18, 24, 36, 48, 64, 80, 144, 288,
    ]);
  });

  it("steps down and up only through the canonical size scale", () => {
    expect(previousCanvasTextFontSize(18)).toBe(14);
    expect(nextCanvasTextFontSize(18)).toBe(24);
  });

  it("clamps size stepping at both ends", () => {
    expect(previousCanvasTextFontSize(10)).toBe(10);
    expect(nextCanvasTextFontSize(288)).toBe(288);
  });
});
