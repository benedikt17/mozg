import { describe, expect, it } from "vitest";
import {
  createCanvasNodeClipboardPayload,
  materializeCanvasClipboardPaste,
  materializeCanvasNodeClipboardPaste,
  parseCanvasNodeClipboardPayload,
  serializeCanvasNodeClipboardPayload,
} from "@/lib/canvas/canvas-node-clipboard";
import type { CanvasDocumentV2 } from "@/lib/canvas/canvas-document";

const document: CanvasDocumentV2 = {
  schemaVersion: 2,
  nodes: [
    {
      id: "text-1",
      kind: "text",
      markdown: "Hello",
      position: { x: 10, y: 20 },
      size: { width: 200, height: 100 },
      zIndex: 1,
    },
    {
      id: "task-1",
      kind: "task",
      taskId: "task-source",
      lastKnownTitle: "Task",
      position: { x: 50, y: 70 },
      size: { width: 300, height: 150 },
      zIndex: 2,
    },
    {
      id: "image-1",
      kind: "image",
      assetId: "asset-1",
      aspectRatioLocked: true,
      position: { x: 90, y: 110 },
      size: { width: 320, height: 180 },
      zIndex: 3,
    },
  ],
  edges: [
    {
      id: "edge-1",
      sourceNodeId: "text-1",
      sourceHandle: "right",
      targetNodeId: "task-1",
      targetHandle: "left",
      routing: "curved",
      arrows: "end",
    },
  ],
};

describe("Canvas node clipboard", () => {
  it("copies only selected canonical nodes and round-trips the payload", () => {
    const payload = createCanvasNodeClipboardPayload(
      document,
      new Set(["text-1", "image-1"]),
    );

    expect(payload?.nodes.map((node) => node.id)).toEqual([
      "text-1",
      "image-1",
    ]);
    expect(payload?.edges).toEqual([]);
    expect(
      parseCanvasNodeClipboardPayload(
        serializeCanvasNodeClipboardPayload(payload!),
      ),
    ).toEqual(payload);
  });

  it("copies internal edges and remaps their node ids", () => {
    const payload = createCanvasNodeClipboardPayload(
      document,
      new Set(["text-1", "task-1"]),
      "canvas-a",
    )!;
    const ids = ["text-copy", "task-copy", "edge-copy"];
    const pasted = materializeCanvasClipboardPaste(payload, {
      targetCanvasId: "canvas-b",
      zIndexStart: 10,
      idGenerator: () => ids.shift()!,
    });

    expect(pasted.nodes.map((node) => node.id)).toEqual([
      "text-text-copy",
      "task-task-copy",
    ]);
    expect(pasted.edges).toEqual([
      expect.objectContaining({
        id: "edge-edge-copy",
        sourceNodeId: "text-text-copy",
        targetNodeId: "task-task-copy",
        routing: "curved",
        arrows: "end",
      }),
    ]);
  });

  it("does not carry Canvas-owned image assets into another Canvas", () => {
    const payload = createCanvasNodeClipboardPayload(
      document,
      new Set(["text-1", "image-1"]),
      "canvas-a",
    )!;
    const pasted = materializeCanvasClipboardPaste(payload, {
      targetCanvasId: "canvas-b",
      zIndexStart: 10,
      idGenerator: () => "copy",
    });

    expect(pasted.nodes.map((node) => node.kind)).toEqual(["text"]);
    expect(pasted.skippedCanvasAssetImages).toBe(1);
  });

  it("rejects malformed or unsupported clipboard JSON", () => {
    expect(parseCanvasNodeClipboardPayload("not-json")).toBeNull();
    expect(
      parseCanvasNodeClipboardPayload(
        JSON.stringify({ version: 99, nodes: document.nodes }),
      ),
    ).toBeNull();
  });

  it("creates fresh ids, keeps task/asset references and supports fallback offsets", () => {
    const payload = createCanvasNodeClipboardPayload(
      document,
      new Set(document.nodes.map((node) => node.id)),
    )!;
    const ids = ["a", "b", "c"];
    const pasted = materializeCanvasNodeClipboardPaste(payload, {
      offset: 24,
      zIndexStart: 10,
      idGenerator: () => ids.shift()!,
    });

    expect(pasted.map((node) => node.id)).toEqual([
      "text-a",
      "task-b",
      "image-c",
    ]);
    expect(pasted.map((node) => node.position)).toEqual([
      { x: 34, y: 44 },
      { x: 74, y: 94 },
      { x: 114, y: 134 },
    ]);
    expect(pasted.map((node) => node.zIndex)).toEqual([10, 11, 12]);
    expect(pasted[1]).toMatchObject({ kind: "task", taskId: "task-source" });
    expect(pasted[2]).toMatchObject({ kind: "image", assetId: "asset-1" });
  });

  it("centers the copied group on the requested Canvas cursor target", () => {
    const payload = createCanvasNodeClipboardPayload(
      document,
      new Set(document.nodes.map((node) => node.id)),
    )!;
    const pasted = materializeCanvasNodeClipboardPaste(payload, {
      target: { x: 1000, y: 800 },
      zIndexStart: 10,
      idGenerator: () => "copy",
    });

    const minX = Math.min(...pasted.map((node) => node.position.x));
    const minY = Math.min(...pasted.map((node) => node.position.y));
    const maxX = Math.max(
      ...pasted.map((node) => node.position.x + node.size.width),
    );
    const maxY = Math.max(
      ...pasted.map((node) => node.position.y + node.size.height),
    );

    expect((minX + maxX) / 2).toBe(1000);
    expect((minY + maxY) / 2).toBe(800);
    expect(pasted[1]!.position.x - pasted[0]!.position.x).toBe(40);
    expect(pasted[2]!.position.y - pasted[0]!.position.y).toBe(90);
  });
});
