import { describe, expect, it } from "vitest";
import { CanvasDocumentHistory } from "@/lib/canvas/canvas-document-history";
import type { CanvasDocumentV2 } from "@/lib/canvas/canvas-document";

function document(markdown: string): CanvasDocumentV2 {
  return {
    schemaVersion: 2,
    nodes: [
      {
        id: "text-1",
        kind: "text",
        markdown,
        position: { x: 10, y: 20 },
        size: { width: 240, height: 56 },
        zIndex: 1,
      },
    ],
    edges: [],
  };
}

describe("Canvas document history", () => {
  it("undoes and redoes canonical Canvas document mutations", () => {
    const history = new CanvasDocumentHistory();
    const first = document("First");
    const second = document("Second");

    expect(history.commit(first, second)).toBe(true);
    expect(history.canUndo).toBe(true);
    expect(history.undo(second)?.nodes[0]).toMatchObject({ markdown: "First" });
    expect(history.canRedo).toBe(true);
    expect(history.redo(first)?.nodes[0]).toMatchObject({ markdown: "Second" });
  });

  it("ignores identical commits and clears redo after a fresh mutation", () => {
    const history = new CanvasDocumentHistory();
    const first = document("First");
    const second = document("Second");
    const third = document("Third");

    expect(history.commit(first, first)).toBe(false);
    history.commit(first, second);
    expect(history.undo(second)).toEqual(first);
    expect(history.canRedo).toBe(true);
    history.commit(first, third);
    expect(history.canRedo).toBe(false);
    expect(history.undo(third)).toEqual(first);
  });

  it("resets history when the active Canvas lifecycle changes", () => {
    const history = new CanvasDocumentHistory();
    history.commit(document("First"), document("Second"));
    history.reset();

    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
  });
});
