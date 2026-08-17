import { describe, expect, it } from "vitest";
import {
  canvasHexToHsv,
  canvasHsvToHex,
  normalizeCanvasHexColor,
} from "@/lib/canvas/canvas-color";

describe("Canvas color helpers", () => {
  it("normalizes long and short HEX values", () => {
    expect(normalizeCanvasHexColor("#A1B2C3")).toBe("#a1b2c3");
    expect(normalizeCanvasHexColor("abc")).toBe("#aabbcc");
    expect(normalizeCanvasHexColor("#12xz90")).toBeNull();
  });

  it("converts primary colors to HSV", () => {
    expect(canvasHexToHsv("#ff0000")).toEqual({
      hue: 0,
      saturation: 1,
      value: 1,
    });
    expect(canvasHexToHsv("#00ff00")).toEqual({
      hue: 120,
      saturation: 1,
      value: 1,
    });
    expect(canvasHexToHsv("#0000ff")).toEqual({
      hue: 240,
      saturation: 1,
      value: 1,
    });
  });

  it("round-trips representative HEX colors", () => {
    for (const color of ["#292524", "#ffffff", "#0f766e", "#e11d48"]) {
      const hsv = canvasHexToHsv(color);
      expect(hsv).not.toBeNull();
      expect(canvasHsvToHex(hsv!)).toBe(color);
    }
  });

  it("clamps HSV channels while converting to HEX", () => {
    expect(canvasHsvToHex({ hue: 360, saturation: 2, value: 2 })).toBe(
      "#ff0000",
    );
    expect(canvasHsvToHex({ hue: 0, saturation: -1, value: 0.5 })).toBe(
      "#808080",
    );
  });
});
