import { describe, expect, it, vi } from "vitest";
import type { CanvasDocumentV2 } from "@/lib/canvas/canvas-document";
import {
  partitionCanvasDropFiles,
  resolveCanvasDropFlowPosition,
  runCanvasMixedDrop,
} from "@/lib/canvas/canvas-file-drop-routing";
import * as runtime from "@/lib/canvas/canvas-runtime-skeleton";
import { CANVAS_PDF_NODE_TYPE } from "@/lib/canvas/react-flow-canvas-adapter";

describe("Canvas PDF runtime", () => {
  it("restores PDF nodes from cache", () => {
    const document: CanvasDocumentV2 = {
      schemaVersion: 2,
      nodes: [
        {
          id: "pdf-1",
          kind: "pdf",
          fileId: "file-1",
          lastKnownName: "brief.pdf",
          position: { x: 42, y: 84 },
          size: { width: 300, height: 180 },
          zIndex: 7,
        },
      ],
      edges: [],
    };

    const nodes = runtime.canvasDocumentToRuntimeSkeleton(document);

    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.id).toBe("pdf-1");
    expect(nodes[0]?.type).toBe(CANVAS_PDF_NODE_TYPE);
  });

  it("separates PDF drops from image drops", () => {
    const image = { name: "photo.png", type: "image/png" };
    const pdf = { name: "brief.pdf", type: "application/pdf" };
    const result = partitionCanvasDropFiles([image, pdf]);

    expect(result.imageFiles).toEqual([image]);
    expect(result.pdfFiles).toEqual([pdf]);
  });

  it("detects PDF drops by file extension", () => {
    const pdf = { name: "scan.PDF", type: "application/octet-stream" };
    const result = partitionCanvasDropFiles([pdf]);

    expect(result.imageFiles).toEqual([]);
    expect(result.pdfFiles).toEqual([pdf]);
  });

  it("runs image ingestion before PDF upload", async () => {
    const calls: string[] = [];
    const image = { name: "photo.webp", type: "image/webp" };
    const pdf = { name: "brief.pdf", type: "application/pdf" };
    const ingestImages = vi.fn(async () => {
      calls.push("images");
    });
    const uploadPdfs = vi.fn(async () => {
      calls.push("pdfs");
    });

    await runCanvasMixedDrop(
      { imageFiles: [image], pdfFiles: [pdf] },
      { ingestImages, uploadPdfs },
    );

    expect(calls).toEqual(["images", "pdfs"]);
  });

  it("uses the original drop point", () => {
    const convert = vi.fn((point: { x: number; y: number }) => point);
    const point = { x: 320, y: 180 };

    expect(resolveCanvasDropFlowPosition(point, convert)).toEqual(point);
    expect(convert).toHaveBeenCalledWith(point);
  });
});
