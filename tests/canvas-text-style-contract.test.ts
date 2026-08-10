import { describe, expect, it } from "vitest";
import {
  parseCanvasDocumentV2,
  type CanvasDocumentV2,
} from "@/lib/canvas/canvas-document";
import {
  DEFAULT_CANVAS_TEXT_STYLE,
  type CanvasTextStyle,
} from "@/lib/canvas/canvas-text-style";
import {
  canvasDocumentToTextNodes,
  runtimeNodesToCanvasDocument,
} from "@/lib/canvas/react-flow-canvas-adapter";

const styledText: CanvasTextStyle = {
  ...DEFAULT_CANVAS_TEXT_STYLE,
  fontFamily: "georgia",
  fontSize: 36,
  bold: true,
  italic: true,
  color: "#123456",
  backgroundColor: "#fedcba",
  textAlign: "right",
};

function document(style?: CanvasTextStyle): CanvasDocumentV2 {
  return {
    schemaVersion: 2,
    nodes: [
      {
        id: "text-1",
        kind: "text",
        markdown: "Hello",
        position: { x: 10, y: 20 },
        size: { width: 240, height: 56 },
        zIndex: 1,
        ...(style ? { style } : {}),
      },
    ],
    edges: [],
  };
}

describe("Canvas text style contract", () => {
  it("keeps legacy text nodes without style valid and projects defaults at runtime", () => {
    const parsed = parseCanvasDocumentV2(document());
    const [runtime] = canvasDocumentToTextNodes(parsed);

    expect(parsed.nodes[0]).not.toHaveProperty("style");
    expect(runtime.data.style).toEqual(DEFAULT_CANVAS_TEXT_STYLE);
  });

  it("accepts pre-alignment styled text and defaults it to centered alignment", () => {
    const { textAlign, ...legacyStyle } = styledText;
    void textAlign;
    const parsed = parseCanvasDocumentV2({
      ...document(),
      nodes: [
        {
          ...document().nodes[0],
          style: legacyStyle,
        },
      ],
    });

    expect(parsed.nodes[0]).toMatchObject({
      style: { ...legacyStyle, textAlign: "center" },
    });
  });

  it("round-trips a styled text node through runtime projection", () => {
    const parsed = parseCanvasDocumentV2(document(styledText));
    const [runtime] = canvasDocumentToTextNodes(parsed);
    const roundTrip = runtimeNodesToCanvasDocument(parsed, [runtime]);

    expect(runtime.data.style).toEqual(styledText);
    expect(roundTrip.nodes[0]).toMatchObject({ style: styledText });
  });

  it("rejects unsupported persisted font sizes", () => {
    expect(() =>
      parseCanvasDocumentV2({
        ...document(styledText),
        nodes: [
          {
            ...document(styledText).nodes[0],
            style: { ...styledText, fontSize: 13 },
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects unsupported text alignment", () => {
    expect(() =>
      parseCanvasDocumentV2({
        ...document(styledText),
        nodes: [
          {
            ...document(styledText).nodes[0],
            style: { ...styledText, textAlign: "justify" },
          },
        ],
      }),
    ).toThrow();
  });
});
