import { describe, expect, it, vi } from "vitest";
import type { CanvasDocumentV2 } from "@/lib/canvas/canvas-document";
import {
  partitionCanvasDropFiles,
  resolveCanvasDropFlowPosition,
  runCanvasMixedDrop,
} from "@/lib/canvas/canvas-file-drop-routing";
import {
  canvasDocumentToRuntimeSkeleton,
} from "@/lib/canvas/canvas-runtime-skeleton";
import { CANVAS_PDF_NODE_TYPE } from "@/lib/canvas/react-flow-canvas-adapter";

describe("Canvas PDF runtime", () => {
  it("keeps PDF nodes in the runtime skeleton used by restores", () => {
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

    expect(canvasDocumentToRuntimeSkeleton(document)).toEqual([
      expect.objectContaining({
        id: "pdf-1",
        type: CANVAS_PDF_NODE_TYPE,
        position: { x: 42, y: 84 },
        width: 300,
        height: 180,
        zIndex: 7,
        data: {
          fileId: "file-1",
          lastKnownName: "brief.pdf",
        },
      }),
    ]);
  });

  it(
    "partitions mixed image and PDF drops without sending PDF files to image ingestion",
    () => {
      const image = { name: "photo.png", type: "image/png" };
      const pdfByMime = { name: "brief.bin", type: "application/pdf" };
      const pdfByExtension = {
        name: "scan.PDF",
        type: "application/octet-stream",
      };
      const unsupported = { name: "notes.txt", type: "text/plain" };

      expect(
        partitionCanvasDropFiles([
          image,
          pdfByMime,
          pdfByExtension,
          unsupported,
        ]),
      ).toEqual({
        imageFiles: [image],
        pdfFiles: [pdfByMime, pdfByExtension],
      });
    },
  );

  it("processes images before PDFs for a mixed drop", async () => {
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
    expect(ingestImages).toHaveBeenCalledWith([image]);
    expect(uploadPdfs).toHaveBeenCalledWith([pdf]);
  });

  it(
    "resolves the PDF node position from the original drop client point",
    () => {
      const screenToFlow = vi.fn(({ x, y }: { x: number; y: number }) => ({
        x: x - 100,
        y: y + 25,
      }));

      expect(
        resolveCanvasDropFlowPosition({ x: 320, y: 180 }, screenToFlow),
      ).toEqual({ x: 220, y: 205 });
      expect(screenToFlow).toHaveBeenCalledWith({ x: 320, y: 180 });
    },
  );
});
