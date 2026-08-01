import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CanvasVisibleEdge } from "@/lib/canvas/canvas-visible-edge";

function renderVisibleEdge(markerStart?: string, markerEnd?: string): string {
  return renderToStaticMarkup(
    createElement(CanvasVisibleEdge, {
      id: "edge-rendering-test",
      path: "M 100,100 L 300,100",
      markerStart,
      markerEnd,
    }),
  );
}

describe("CanvasVisibleEdge marker props", () => {
  it.each([
    ["none", undefined, undefined],
    ["start", "url('#start-marker')", undefined],
    ["end", undefined, "url('#end-marker')"],
    ["both", "url('#start-marker')", "url('#end-marker')"],
  ] as const)(
    "forwards %s markers to the visible BaseEdge path",
    (_mode, markerStart, markerEnd) => {
      const markup = renderVisibleEdge(markerStart, markerEnd);

      expect(
        markup.includes(
          `marker-start="${markerStart?.replaceAll("'", "&#x27;") ?? ""}"`,
        ),
      ).toBe(markerStart !== undefined);
      expect(
        markup.includes(
          `marker-end="${markerEnd?.replaceAll("'", "&#x27;") ?? ""}"`,
        ),
      ).toBe(markerEnd !== undefined);
    },
  );
});
