import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { nextCanvasContentSize } from "@/lib/canvas/canvas-content-auto-size";

const shellSource = readFileSync(
  new URL(
    "../src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
    import.meta.url,
  ),
  "utf8",
);
const shellStyles = readFileSync(
  new URL(
    "../src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.module.css",
    import.meta.url,
  ),
  "utf8",
);

describe("Canvas text and shape content sizing", () => {
  it("fits free text to its content without changing its width", () => {
    expect(
      nextCanvasContentSize({
        kind: "text",
        currentWidth: 240,
        currentHeight: 56,
        contentHeight: 80,
      }),
    ).toEqual({ width: 240, height: 104 });
    expect(
      nextCanvasContentSize({
        kind: "text",
        currentWidth: 240,
        currentHeight: 160,
        contentHeight: 20,
      }),
    ).toEqual({ width: 240, height: 56 });
  });

  it("only grows rectangle shapes vertically", () => {
    expect(
      nextCanvasContentSize({
        kind: "shape",
        shape: "rectangle",
        currentWidth: 220,
        currentHeight: 120,
        contentHeight: 140,
      }),
    ).toEqual({ width: 220, height: 164 });
    expect(
      nextCanvasContentSize({
        kind: "shape",
        shape: "rectangle",
        currentWidth: 220,
        currentHeight: 180,
        contentHeight: 40,
      }),
    ).toEqual({ width: 220, height: 180 });
  });

  it("keeps circles square while making room for centered text", () => {
    expect(
      nextCanvasContentSize({
        kind: "shape",
        shape: "circle",
        currentWidth: 160,
        currentHeight: 160,
        contentHeight: 140,
      }),
    ).toEqual({ width: 219, height: 219 });
  });

  it("keeps the accepted editor alignment, measurement, wrapping, and save wiring", () => {
    expect(shellSource).toContain('textarea.style.height = "0px";');
    expect(shellSource).toContain("centerTextContent={false}");
    expect(shellSource).toContain("centerTextContent={!data.isEditing}");
    expect(shellSource).toContain("controller.setRuntimeNodes(nextNodes);");
    expect(shellSource).toContain("scheduleSave();");
    expect(shellStyles).toMatch(
      /\.textNodeContent\s*\{[^}]*padding:\s*12px;[^}]*overflow-wrap:\s*anywhere;[^}]*word-break:\s*break-word;/u,
    );
    expect(shellStyles).toMatch(
      /\.shapeNodeContent\s*\{[^}]*padding:\s*12px;[^}]*overflow-wrap:\s*anywhere;[^}]*word-break:\s*break-word;/u,
    );
  });
});
