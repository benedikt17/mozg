import type { CanvasTextFontSize } from "@/lib/canvas/canvas-text-style";

/** Presentation of a Knowledge article node on Canvas, never its reader. */
export type CanvasArticleStyle = {
  badgeColor: string;
  titleColor: string;
  backgroundColor: string;
  titleFontSize: CanvasTextFontSize;
};

export const DEFAULT_CANVAS_ARTICLE_STYLE: CanvasArticleStyle = {
  badgeColor: "#9a3412",
  titleColor: "#24241f",
  backgroundColor: "#fbfbfa",
  titleFontSize: 18,
};
