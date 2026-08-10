export const CANVAS_TEXT_FONT_FAMILIES = [
  "system",
  "arial",
  "georgia",
  "times-new-roman",
  "courier-new",
  "verdana",
] as const;

export type CanvasTextFontFamily = (typeof CANVAS_TEXT_FONT_FAMILIES)[number];

export const CANVAS_TEXT_FONT_SIZES = [
  10, 12, 14, 18, 24, 36, 48, 64, 80, 144, 288,
] as const;

export type CanvasTextFontSize = (typeof CANVAS_TEXT_FONT_SIZES)[number];

export type CanvasTextStyle = {
  fontFamily: CanvasTextFontFamily;
  fontSize: CanvasTextFontSize;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  color: string;
  backgroundColor: string;
};

export const DEFAULT_CANVAS_TEXT_STYLE: CanvasTextStyle = {
  fontFamily: "system",
  fontSize: 18,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  color: "#292524",
  backgroundColor: "transparent",
};

export function canvasTextFontFamilyCss(
  fontFamily: CanvasTextFontFamily,
): string {
  switch (fontFamily) {
    case "arial":
      return "Arial, Helvetica, sans-serif";
    case "georgia":
      return "Georgia, 'Times New Roman', serif";
    case "times-new-roman":
      return "'Times New Roman', Times, serif";
    case "courier-new":
      return "'Courier New', Courier, monospace";
    case "verdana":
      return "Verdana, Geneva, sans-serif";
    default:
      return "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  }
}

export function previousCanvasTextFontSize(
  fontSize: CanvasTextFontSize,
): CanvasTextFontSize {
  const index = CANVAS_TEXT_FONT_SIZES.indexOf(fontSize);
  return CANVAS_TEXT_FONT_SIZES[Math.max(0, index - 1)];
}

export function nextCanvasTextFontSize(
  fontSize: CanvasTextFontSize,
): CanvasTextFontSize {
  const index = CANVAS_TEXT_FONT_SIZES.indexOf(fontSize);
  return CANVAS_TEXT_FONT_SIZES[
    Math.min(CANVAS_TEXT_FONT_SIZES.length - 1, index + 1)
  ];
}
