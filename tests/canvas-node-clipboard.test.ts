import { describe, expect, it } from "vitest";
import {
  createCanvasNodeClipboardPayload,
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
  edges: [],
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
    expect(
      parseCanvasNodeClipboardPayload(
        serializeCanvasNodeClipboardPayload(payload!),
      ),
    ).toEqual(payload);
  });

  it("rejects malformed or unsupported clipboard JSON", () => {
    expect(parseCanvasNodeClipboardPayload("not-json")).toBeNull();
    expect(
      parseCanvasNodeClipboardPayload(
        JSON.stringify({ version: 99, nodes: document.nodes }),
      ),
    ).toBeNull();
  });

  it("creates fresh ids, keeps task/asset references and offsets the group equally", () => {
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
});
