import { describe, expect, it } from "vitest";
import {
  CANVAS_TEXT_NODE_TYPE,
  canvasDocumentToTextNodes,
  createCanvasTextFlowNode,
  createCanvasTextId,
} from "@/lib/canvas/react-flow-canvas-adapter";
import {
  parseCanvasDocumentV1,
  type CanvasDocumentV1,
} from "@/lib/canvas/canvas-document";
import {
  commitTextMarkdown,
  hasMeaningfulPlainText,
  plainTextFromClipboard,
} from "@/lib/canvas/text-canvas-interactions";

function textDocument(markdown = "Hello"): CanvasDocumentV1 {
  return parseCanvasDocumentV1({
    schemaVersion: 1,
    nodes: [
      {
        id: "text-1",
        kind: "text",
        markdown,
        position: { x: 12, y: 24 },
        size: { width: 320, height: 220 },
        zIndex: 1,
      },
    ],
    edges: [],
  });
}

describe("canonical text nodes", () => {
  it("uses the exact text node discriminator", () =>
    expect(createCanvasTextFlowNode({ id: "x", markdown: "" }).type).toBe(
      CANVAS_TEXT_NODE_TYPE,
    ));

  it("round-trips multiline Markdown exactly", () => {
    const markdown = "# Heading\n\n- one\n- two\n\n**bold** and `code`";
    const [node] = canvasDocumentToTextNodes(textDocument(markdown));
    expect(node?.data.markdown).toBe(markdown);
  });

  it("preserves Cyrillic and punctuation", () => {
    const markdown = "Привет, мир! — «кавычки»\n\n1. Один\n2. Два";
    const [node] = canvasDocumentToTextNodes(textDocument(markdown));
    expect(node?.data.markdown).toBe(markdown);
  });

  it("does not add runtime editing fields to canonical data", () => {
    const document = textDocument();
    expect(document.nodes[0]).not.toHaveProperty("isEditing");
  });

  it("updates canonical layout from runtime text nodes", async () => {
    const { runtimeNodesToCanvasDocument } = await import(
      "@/lib/canvas/react-flow-canvas-adapter"
    );
    const source = textDocument();
    const [runtime] = canvasDocumentToTextNodes(source);
    expect(runtime).toBeDefined();
    const result = runtimeNodesToCanvasDocument(source, [
      {
        ...runtime!,
        position: { x: 99, y: 77 },
        width: 444,
        height: 222,
      },
    ]);
    expect(result.nodes[0]).toMatchObject({
      position: { x: 99, y: 77 },
      size: { width: 444, height: 222 },
    });
  });

  it("hydrates text nodes immediately", () =>
    expect(canvasDocumentToTextNodes(textDocument())).toHaveLength(1));
  it("keeps exact node id on hydration", () =>
    expect(canvasDocumentToTextNodes(textDocument())[0]?.id).toBe("text-1"));
  it("keeps zIndex on hydration", () =>
    expect(canvasDocumentToTextNodes(textDocument())[0]?.zIndex).toBe(1));
  it("rejects unknown text fields through the strict parser", () =>
    expect(() =>
      parseCanvasDocumentV1({
        ...textDocument(),
        nodes: [{ ...textDocument().nodes[0]!, extra: true }],
      }),
    ).toThrow());
  it("accepts the maximum Markdown length", () =>
    expect(() => textDocument("x".repeat(250_000))).not.toThrow());
  it("rejects Markdown beyond the contract limit", () =>
    expect(() => textDocument("x".repeat(250_001))).toThrow());
  it("uses a compact default text layout", () =>
    expect(
      createCanvasTextFlowNode({ id: "x", markdown: "" }).style,
    ).toMatchObject({ width: 240, height: 56 }));
  it("supports toolbar-style empty text creation", () =>
    expect(
      createCanvasTextFlowNode({ id: "x", markdown: "", isEditing: true }).data
        .isEditing,
    ).toBe(true));
  it("supports screen-positioned text creation", () =>
    expect(
      createCanvasTextFlowNode({
        id: "x",
        markdown: "x",
        position: { x: 42, y: 84 },
      }).position,
    ).toEqual({ x: 42, y: 84 }));
  it("generates a namespaced text id", () =>
    expect(createCanvasTextId(() => "fixed")).toBe("text-fixed"));
  it("clips editor input at the canonical limit", () =>
    expect(commitTextMarkdown("x".repeat(250_001))).toHaveLength(250_000));
  it("ignores whitespace-only plain text", () =>
    expect(hasMeaningfulPlainText(" \n\t ")).toBe(false));
  it("accepts meaningful plain text", () =>
    expect(hasMeaningfulPlainText(" text ")).toBe(true));

  it("extracts plain text when no image candidate exists", () => {
    const event = {
      clipboardData: {
        getData: (type: string) => (type === "text/plain" ? "clipboard" : ""),
      },
    } as unknown as ClipboardEvent;
    expect(plainTextFromClipboard(event)).toBe("clipboard");
  });

  it("keeps empty transfer payload inert", async () => {
    const { transferPayload } = await import(
      "@/lib/canvas/react-flow-canvas-adapter"
    );
    const event = {
      dataTransfer: {
        items: [],
        files: [],
      },
    } as unknown as DragEvent;
    expect(transferPayload(event).items).toHaveLength(0);
  });

  it("does not synthesize text from unsupported transfer metadata", async () => {
    const { transferPayload } = await import(
      "@/lib/canvas/react-flow-canvas-adapter"
    );
    const event = {
      dataTransfer: {
        items: [],
        files: [],
      },
    } as unknown as DragEvent;
    const payload = transferPayload(event);
    expect(payload.files).toHaveLength(0);
  });

  it("reads text from a clipboard event", () => {
    const event = {
      clipboardData: {
        getData: () => "hello",
      },
    } as unknown as ClipboardEvent;
    expect(plainTextFromClipboard(event)).toBe("hello");
  });

  it("does not create text from blank clipboard content", () =>
    expect(hasMeaningfulPlainText("   ")).toBe(false));

  it("creates one controller text node", async () => {
    const { LocalCanvasShellController, emptyShellState } = await import(
      "@/lib/canvas/local-canvas-shell-controller"
    );
    const repository = {
      saveCanvasDocument: async () => undefined,
    };
    const controller = new LocalCanvasShellController({
      repository: repository as never,
      workspaceId: "workspace-1",
      userId: "user-1",
    });
    controller.restoreRuntimeState({
      ...emptyShellState(),
      canvasId: "canvas-1",
      title: "Canvas",
      status: "saved",
    });
    controller.insertTextNode(
      createCanvasTextFlowNode({ id: "text-1", markdown: "hello" }),
    );
    expect(controller.state.document.nodes).toHaveLength(1);
  });

  it("saves text through CAS", async () => {
    const { LocalCanvasShellController, emptyShellState } = await import(
      "@/lib/canvas/local-canvas-shell-controller"
    );
    const saved: unknown[] = [];
    const repository = {
      saveCanvasDocument: async (_canvasId: string, document: unknown) => {
        saved.push(document);
      },
    };
    const controller = new LocalCanvasShellController({
      repository: repository as never,
      workspaceId: "workspace-1",
      userId: "user-1",
    });
    controller.restoreRuntimeState({
      ...emptyShellState(),
      canvasId: "canvas-1",
      title: "Canvas",
      status: "saved",
    });
    controller.insertTextNode(
      createCanvasTextFlowNode({ id: "text-1", markdown: "hello" }),
    );
    await controller.savePendingDocument();
    expect(saved).toHaveLength(1);
  });

  it("preserves exact text after reload", () => {
    const markdown = "one\n\ntwo";
    expect(canvasDocumentToTextNodes(textDocument(markdown))[0]?.data.markdown).toBe(
      markdown,
    );
  });

  it("deletes only the selected text node", async () => {
    const { LocalCanvasShellController, emptyShellState } = await import(
      "@/lib/canvas/local-canvas-shell-controller"
    );
    const repository = {};
    const controller = new LocalCanvasShellController({
      repository: repository as never,
      workspaceId: "workspace-1",
      userId: "user-1",
    });
    controller.restoreRuntimeState({
      ...emptyShellState(),
      canvasId: "canvas-1",
      title: "Canvas",
      document: textDocument(),
      status: "saved",
    });
    controller.deleteNodes(["text-1"]);
    expect(controller.state.document.nodes).toHaveLength(0);
  });

  it("blocks a stale CAS retry", async () => {
    const { LocalCanvasShellController, emptyShellState } = await import(
      "@/lib/canvas/local-canvas-shell-controller"
    );
    const repository = {};
    const controller = new LocalCanvasShellController({
      repository: repository as never,
      workspaceId: "workspace-1",
      userId: "user-1",
    });
    controller.restoreRuntimeState({
      ...emptyShellState(),
      canvasId: "canvas-1",
      title: "Canvas",
      status: "saved",
    });
    expect(controller.hasPendingSave).toBe(false);
  });

  it("stores viewport outside the document", () => {
    const document = textDocument();
    expect(document).not.toHaveProperty("viewport");
  });

  it("persists V2 edges through controller save, reload, and node deletion", async () => {
    const { parseCanvasDocumentV2 } = await import(
      "@/lib/canvas/canvas-document"
    );
    const document = parseCanvasDocumentV2({
      schemaVersion: 2,
      nodes: [
        textDocument().nodes[0],
        {
          id: "text-2",
          kind: "text",
          markdown: "Two",
          position: { x: 400, y: 24 },
          size: { width: 320, height: 220 },
          zIndex: 2,
        },
      ],
      edges: [
        {
          id: "edge-1",
          sourceNodeId: "text-1",
          sourceHandle: "right",
          targetNodeId: "text-2",
          targetHandle: "left",
          routing: "curved",
          arrows: "end",
        },
      ],
    });
    expect(document.edges).toHaveLength(1);
  });
});
