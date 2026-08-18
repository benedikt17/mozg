import { describe, expect, it } from "vitest";
import { canCreateCanvasFromSidebar } from "@/prototype/canvases/canvas-create-readiness";

describe("Canvas create readiness", () => {
  it("blocks creation while an existing Canvas is still being resolved", () => {
    expect(canCreateCanvasFromSidebar("loading", null)).toBe(false);
    expect(canCreateCanvasFromSidebar("ready", null)).toBe(false);
  });

  it("allows creation after an active Canvas resolves", () => {
    expect(canCreateCanvasFromSidebar("ready", "canvas-a")).toBe(true);
  });

  it("allows creation in a confirmed empty project", () => {
    expect(canCreateCanvasFromSidebar("empty", null)).toBe(true);
  });

  it("does not open creation while the Canvas list is in error", () => {
    expect(canCreateCanvasFromSidebar("error", null)).toBe(false);
    expect(canCreateCanvasFromSidebar("error", "canvas-a")).toBe(false);
  });
});
