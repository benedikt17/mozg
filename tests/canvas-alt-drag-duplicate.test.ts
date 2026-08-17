import { describe, expect, it } from "vitest";
import {
  createCanvasAltDragDuplicate,
  createCanvasAltDragRuntimeNode,
  finalizeCanvasAltDragDuplicate,
  redirectCanvasAltDragNodeChanges,
  type CanvasAltDragDuplicateSession,
} from "@/lib/canvas/canvas-alt-drag-duplicate";
import type { CanvasTextNode } from "@/lib/canvas/canvas-document";
import { createCanvasTextFlowNode } from "@/lib/canvas/react-flow-canvas-adapter";

const source: CanvasTextNode = {
  id: "text-source",
  kind: "text",
  markdown: "Смысловой блок",
  style: {
    fontFamily: "system",
    fontSize: 18,
    bold: true,
    italic: false,
    underline: false,
    strikethrough: false,
    color: "#112233",
    backgroundColor: "#ffee88",
    textAlign: "center",
  },
  position: { x: 120, y: 240 },
  size: { width: 300, height: 120 },
  zIndex: 7,
};

describe("Canvas Alt-drag duplication", () => {
  it("duplicates a copyable canonical node in place with a new identity", () => {
    const duplicate = createCanvasAltDragDuplicate(source, {
      zIndex: 8,
      idGenerator: () => "copy-id",
    });

    expect(duplicate).toEqual({
      ...source,
      id: "text-copy-id",
      position: { x: 120, y: 240 },
      size: { width: 300, height: 120 },
      zIndex: 8,
    });
    expect(duplicate).not.toBe(source);
    expect(duplicate?.position).not.toBe(source.position);
  });

  it("does not duplicate unsupported article nodes", () => {
    expect(
      createCanvasAltDragDuplicate(
        {
          id: "article-1",
          kind: "article",
          articleId: "knowledge-1",
          position: { x: 0, y: 0 },
          size: { width: 200, height: 100 },
          zIndex: 1,
        },
        { zIndex: 2 },
      ),
    ).toBeNull();
  });

  it("creates a transient runtime clone without carrying text edit mode", () => {
    const canonical = createCanvasAltDragDuplicate(source, {
      zIndex: 9,
      idGenerator: () => "runtime-copy",
    });
    expect(canonical).not.toBeNull();
    const runtime = createCanvasTextFlowNode({
      id: source.id,
      markdown: source.markdown,
      position: source.position,
      size: source.size,
      zIndex: source.zIndex,
      style: source.style,
      isEditing: true,
    });
    const duplicate = createCanvasAltDragRuntimeNode(runtime, canonical!);

    expect(duplicate.id).toBe("text-runtime-copy");
    expect(duplicate.position).toEqual(source.position);
    expect(duplicate.zIndex).toBe(9);
    expect(duplicate.selected).toBe(false);
    expect(duplicate.type).toBe("canvasText");
    if (duplicate.type === "canvasText") {
      expect(duplicate.data.markdown).toBe(source.markdown);
      expect(duplicate.data.style).toEqual(source.style);
      expect(duplicate.data.style).not.toBe(runtime.data.style);
      expect(duplicate.data.isEditing).toBe(false);
    }
  });

  it("redirects only dragged source position changes to the transient copy", () => {
    const duplicate = createCanvasAltDragDuplicate(source, {
      zIndex: 8,
      idGenerator: () => "drag-copy",
    })!;
    const session: CanvasAltDragDuplicateSession = {
      sourceNodeId: source.id,
      duplicateNodeId: duplicate.id,
      duplicate,
      finalPosition: { ...source.position },
    };
    const changes = redirectCanvasAltDragNodeChanges(
      [
        {
          type: "position",
          id: source.id,
          position: { x: 400, y: 500 },
          dragging: true,
        },
        { type: "select", id: source.id, selected: true },
        {
          type: "position",
          id: "text-other",
          position: { x: 50, y: 60 },
          dragging: true,
        },
      ],
      session,
    );

    expect(changes[0]).toMatchObject({
      type: "position",
      id: duplicate.id,
      position: { x: 400, y: 500 },
      dragging: true,
    });
    expect(changes[1]).toEqual({
      type: "select",
      id: source.id,
      selected: true,
    });
    expect(changes[2]).toMatchObject({ id: "text-other" });
    expect(session.finalPosition).toEqual({ x: 400, y: 500 });
  });

  it("finalizes the canonical duplicate only at the final drag position", () => {
    const duplicate = createCanvasAltDragDuplicate(source, {
      zIndex: 8,
      idGenerator: () => "final-copy",
    })!;
    const session: CanvasAltDragDuplicateSession = {
      sourceNodeId: source.id,
      duplicateNodeId: duplicate.id,
      duplicate,
      finalPosition: { x: 777, y: 888 },
    };

    expect(finalizeCanvasAltDragDuplicate(session)).toEqual({
      ...duplicate,
      position: { x: 777, y: 888 },
    });
    expect(duplicate.position).toEqual(source.position);
  });
});
