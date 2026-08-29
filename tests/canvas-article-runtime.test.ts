import { describe, expect, it } from "vitest";
import { parseCanvasDocumentV2 } from "@/lib/canvas/canvas-document";
import {
  CANVAS_ARTICLE_NODE_TYPE,
  canvasDocumentToArticleNodes,
  runtimeNodesToCanvasDocument,
} from "@/lib/canvas/react-flow-canvas-adapter";
import { canvasDocumentToRuntimeSkeleton } from "@/lib/canvas/canvas-runtime-skeleton";
import { DEFAULT_CANVAS_ARTICLE_STYLE } from "@/lib/canvas/canvas-article-style";

describe("Canvas article nodes", () => {
  it("restores article nodes and preserves their geometry independently of reader state", () => {
    const source = parseCanvasDocumentV2({
      schemaVersion: 2,
      nodes: [
        {
          id: "article-node-1",
          kind: "article",
          articleId: "knowledge-1",
          lastKnownTitle: "Карта островов",
          position: { x: 120, y: 240 },
          size: { width: 300, height: 120 },
          zIndex: 4,
        },
      ],
      edges: [],
    });

    const article = canvasDocumentToArticleNodes(source)[0]!;
    expect(article).toMatchObject({
      id: "article-node-1",
      type: CANVAS_ARTICLE_NODE_TYPE,
      data: {
        articleId: "knowledge-1",
        lastKnownTitle: "Карта островов",
      },
    });
    expect(canvasDocumentToRuntimeSkeleton(source)).toContainEqual(article);

    const moved = {
      ...article,
      position: { x: 360, y: 480 },
      width: 420,
      height: 200,
      style: { width: 420, height: 200 },
      data: { ...article.data, readerOpen: true },
    };
    const serialized = runtimeNodesToCanvasDocument(source, [moved]);

    expect(serialized.nodes[0]).toMatchObject({
      kind: "article",
      articleId: "knowledge-1",
      lastKnownTitle: "Карта островов",
      position: { x: 360, y: 480 },
      size: { width: 420, height: 200 },
    });
    expect(serialized.nodes[0]).not.toHaveProperty("readerOpen");
  });

  it("projects legacy article nodes with a default style and persists edited presentation", () => {
    const source = parseCanvasDocumentV2({
      schemaVersion: 2,
      nodes: [
        {
          id: "article-node-1",
          kind: "article",
          articleId: "knowledge-1",
          position: { x: 120, y: 240 },
          size: { width: 300, height: 120 },
          zIndex: 4,
        },
      ],
      edges: [],
    });
    const article = canvasDocumentToArticleNodes(source)[0]!;
    const style = {
      badgeColor: "#112233",
      titleColor: "#445566",
      backgroundColor: "#778899",
      titleFontSize: 36 as const,
    };
    const serialized = runtimeNodesToCanvasDocument(source, [
      { ...article, data: { ...article.data, style } },
    ]);

    expect(article.data.style).toEqual(DEFAULT_CANVAS_ARTICLE_STYLE);
    expect(serialized.nodes[0]).toMatchObject({ style });
  });

  it("rejects incomplete or unsupported article styles", () => {
    expect(() =>
      parseCanvasDocumentV2({
        schemaVersion: 2,
        nodes: [
          {
            id: "article-node-1",
            kind: "article",
            articleId: "knowledge-1",
            position: { x: 120, y: 240 },
            size: { width: 300, height: 120 },
            zIndex: 4,
            style: { ...DEFAULT_CANVAS_ARTICLE_STYLE, titleFontSize: 13 },
          },
        ],
        edges: [],
      }),
    ).toThrow();
  });
});
