import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const framePath = path.resolve(
  process.cwd(),
  "src/prototype/infinite-canvas-local-shell/canvas-node-frame.tsx",
);
const viewportPath = path.resolve(
  process.cwd(),
  "src/lib/canvas/canvas-visible-edge.tsx",
);
const stylePath = path.resolve(
  process.cwd(),
  "src/lib/canvas/canvas-text-style.ts",
);

describe("Canvas Miro UX follow-up runtime", () => {
  it(
    "keeps the standard arrow cursor across Canvas node hover and selection",
    () => {
      const source = fs.readFileSync(framePath, "utf8");

      expect(source).toContain('style={{ cursor: "default" }}');
    },
  );

  it(
    "centers text vertically and exposes persistent left/center/right alignment",
    () => {
      const frame = fs.readFileSync(framePath, "utf8");
      const style = fs.readFileSync(stylePath, "utf8");

      expect(style).toContain(
        'CANVAS_TEXT_ALIGNMENTS = ["left", "center", "right"]',
      );
      expect(style).toContain('textAlign: "center"');
      expect(frame).toContain('new CustomEvent("mozg:canvas-text-style"');
      expect(frame).toContain(
        'data-canvas-text-align={isTextFrame ? textAlign : undefined}',
      );
      expect(frame).toContain('alignItems: "center"');
      expect(frame).toContain('fieldSizing: "content"');
    },
  );

  it(
    "binds React Flow runtime zoom to the Canvas 10-400 percent contract and smooths wheel transforms",
    () => {
      const source = fs.readFileSync(viewportPath, "utf8");

      expect(source).toContain("CANVAS_VIEWPORT_LIMITS.minZoom");
      expect(source).toContain("CANVAS_VIEWPORT_LIMITS.maxZoom");
      expect(source).toContain("store.setState({");
      expect(source).toContain(
        'viewport.style.transition = "transform 55ms linear"',
      );
    },
  );
});
