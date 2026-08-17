import {
  DEFAULT_CANVAS_TEXT_STYLE,
  type CanvasTextStyle,
} from "@/lib/canvas/canvas-text-style";

export type CanvasShapeStyle = Omit<CanvasTextStyle, "backgroundColor"> & {
  fillColor: string;
};

export const DEFAULT_CANVAS_SHAPE_STYLE: CanvasShapeStyle = {
  fontFamily: DEFAULT_CANVAS_TEXT_STYLE.fontFamily,
  fontSize: DEFAULT_CANVAS_TEXT_STYLE.fontSize,
  bold: DEFAULT_CANVAS_TEXT_STYLE.bold,
  italic: DEFAULT_CANVAS_TEXT_STYLE.italic,
  underline: DEFAULT_CANVAS_TEXT_STYLE.underline,
  strikethrough: DEFAULT_CANVAS_TEXT_STYLE.strikethrough,
  color: DEFAULT_CANVAS_TEXT_STYLE.color,
  fillColor: "#f5de47",
  textAlign: "center",
};

export function canvasShapeStyleAsTextStyle(
  style: CanvasShapeStyle,
): CanvasTextStyle {
  return {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    bold: style.bold,
    italic: style.italic,
    underline: style.underline,
    strikethrough: style.strikethrough,
    color: style.color,
    backgroundColor: style.fillColor,
    textAlign: style.textAlign,
  };
}

export function canvasTextStylePatchToShapeStyle(
  patch: Partial<CanvasTextStyle>,
): Partial<CanvasShapeStyle> {
  const {
    backgroundColor,
    fontFamily,
    fontSize,
    bold,
    italic,
    underline,
    strikethrough,
    color,
    textAlign,
  } = patch;
  return {
    ...(fontFamily === undefined ? {} : { fontFamily }),
    ...(fontSize === undefined ? {} : { fontSize }),
    ...(bold === undefined ? {} : { bold }),
    ...(italic === undefined ? {} : { italic }),
    ...(underline === undefined ? {} : { underline }),
    ...(strikethrough === undefined ? {} : { strikethrough }),
    ...(color === undefined ? {} : { color }),
    ...(textAlign === undefined ? {} : { textAlign }),
    ...(backgroundColor === undefined ? {} : { fillColor: backgroundColor }),
  };
}
