import { describe, expect, it } from "vitest";
import type { CanvasDocumentV2 } from "@/lib/canvas/canvas-document";
import {
  canvasPortableBackupFileName,
  createCanvasPortableBackup,
  type CanvasPortableBackupSource,
} from "@/prototype/canvases/canvas-portable-export";

const source: CanvasPortableBackupSource = {
  canvasId: "canvas-yaga",
  document: {
    schemaVersion: 2,
    nodes: [
      {
        id: "text-1",
        kind: "text",
        markdown: "Царевич не может разбудить спящую красавицу поцелуем",
        position: { x: 80, y: 60 },
        size: { width: 240, height: 120 },
        zIndex: 1,
      },
      {
        id: "shape-2",
        kind: "shape",
        shape: "rectangle",
        markdown: "Проклятое зеркало — двойник царевича",
        position: { x: 80, y: 260 },
        size: { width: 240, height: 120 },
        zIndex: 2,
        style: {
          bold: false,
          color: "#1c1c1c",
          fillColor: "#ffef75",
          fontFamily: "system",
          fontSize: 18,
          italic: false,
          strikethrough: false,
          textAlign: "left",
          underline: false,
        },
      },
      {
        id: "summary",
        kind: "summary",
        title: "Сумма",
        position: { x: 450, y: 160 },
        size: { width: 150, height: 100 },
        zIndex: 3,
      },
      {
        id: "pdf",
        kind: "pdf",
        fileId: "file-pdf",
        lastKnownName: "Сценарий.pdf",
        position: { x: 700, y: 100 },
        size: { width: 220, height: 160 },
        zIndex: 4,
      },
    ],
    edges: [
      {
        id: "edge-1",
        sourceNodeId: "text-1",
        sourceHandle: "right",
        targetNodeId: "summary",
        targetHandle: "left",
        routing: "curved",
        arrows: "end",
        summaryOrder: 2,
      },
      {
        id: "edge-2",
        sourceNodeId: "shape-2",
        sourceHandle: "right",
        targetNodeId: "summary",
        targetHandle: "left",
        routing: "curved",
        arrows: "end",
        summaryOrder: 1,
      },
    ],
  } satisfies CanvasDocumentV2,
  files: [
    {
      id: "file-pdf",
      name: "Сценарий.pdf",
      originalName: "Сценарий.pdf",
      mimeType: "application/pdf",
      byteSize: 8_400_000,
      checksum: "sha256:test",
    },
  ],
  revision: 17,
  title: "Яга",
};

describe("Canvas portable export", () => {
  it("creates an offline viewer, canonical document and lightweight file placeholders", () => {
    const archive = createCanvasPortableBackup(
      source,
      new Date("2026-08-30T12:00:00.000Z"),
    );
    const files = readStoredZipFiles(archive.bytes);
    const viewer = files.get("index.html") ?? "";
    const manifest = JSON.parse(files.get("manifest.json") ?? "{}") as {
      files: Array<{ name: string; status: string }>;
    };

    expect(archive.fileName).toBe("MOZG-Canvas-Яга-2026-08-30.zip");
    expect(files.get("canvas.json")).toContain('"schemaVersion": 2');
    expect(viewer).toContain("Царевич не может разбудить");
    expect(viewer).toContain("Сценарий.pdf");
    expect(viewer).toContain("файл не вложен");
    expect(viewer).not.toContain("fetch(");
    expect(manifest.files).toMatchObject([
      { name: "Сценарий.pdf", status: "metadata-only" },
    ]);
  });

  it("keeps summary paragraphs in their connection order", () => {
    const archive = createCanvasPortableBackup(
      source,
      new Date("2026-08-30T12:00:00.000Z"),
    );
    const viewer = readStoredZipFiles(archive.bytes).get("index.html") ?? "";

    expect(viewer.lastIndexOf("Проклятое зеркало")).toBeLessThan(
      viewer.lastIndexOf("Царевич не может"),
    );
  });

  it("uses a safe stable filename", () => {
    expect(
      canvasPortableBackupFileName(
        "Яга: тест / версия",
        new Date("2026-08-30T12:00:00.000Z"),
      ),
    ).toBe("MOZG-Canvas-Яга- тест - версия-2026-08-30.zip");
  });
});

function readStoredZipFiles(bytes: Uint8Array): Map<string, string> {
  const files = new Map<string, string>();
  const decoder = new TextDecoder();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  while (offset + 30 <= bytes.byteLength) {
    if (view.getUint32(offset, true) !== 0x04034b50) break;
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLength;
    const contentStart = nameEnd + extraLength;
    const contentEnd = contentStart + compressedSize;
    files.set(
      decoder.decode(bytes.subarray(nameStart, nameEnd)),
      decoder.decode(bytes.subarray(contentStart, contentEnd)),
    );
    offset = contentEnd;
  }
  return files;
}
