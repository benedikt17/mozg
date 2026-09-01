import type { CanvasShapeVariant } from "@/lib/canvas/canvas-document";

export type CanvasContentAutoSizeKind = "text" | "shape";

export type CanvasContentAutoSizeDetail = {
  id: string;
  kind: CanvasContentAutoSizeKind;
  contentHeight: number;
};

const CONTENT_VERTICAL_PADDING = 24;
const CIRCLE_CONTENT_RATIO = 0.64;

export const CANVAS_CONTENT_AUTO_SIZE_EVENT = "mozg:canvas-content-auto-size";

export function nextCanvasContentSize(input: {
  kind: CanvasContentAutoSizeKind;
  shape?: CanvasShapeVariant;
  currentWidth: number;
  currentHeight: number;
  contentHeight: number;
}): { width: number; height: number } {
  const currentWidth = Math.max(1, Math.ceil(input.currentWidth));
  const currentHeight = Math.max(1, Math.ceil(input.currentHeight));
  const contentHeight = Math.max(0, Math.ceil(input.contentHeight));

  if (input.kind === "shape" && input.shape === "circle") {
    const diameter = Math.max(
      currentWidth,
      currentHeight,
      80,
      Math.ceil(contentHeight / CIRCLE_CONTENT_RATIO),
    );
    return { width: diameter, height: diameter };
  }

  const contentFitHeight = Math.max(
    input.kind === "text" ? 56 : 60,
    contentHeight + CONTENT_VERTICAL_PADDING,
  );

  return {
    width: currentWidth,
    height:
      input.kind === "text"
        ? contentFitHeight
        : Math.max(currentHeight, contentFitHeight),
  };
}
