import { describe, expect, it } from "vitest";
import {
  createEmptyCanvasDocumentV1,
  parseCanvasDocumentV1,
  type CanvasDocumentV1,
} from "@/lib/canvas/canvas-document";
import {
  canvasDocumentToTextNodes,
  createCanvasTextFlowNode,
  runtimeNodesToCanvasDocument,
} from "@/lib/canvas/react-flow-canvas-adapter";
import {
  createCanvasTextId,
  extractCanvasPlainText,
  hasMeaningfulPlainText,
  plainTextFromClipboard,
  commitTextMarkdown,
} from "@/lib/canvas/text-canvas-interactions";
import {
  LocalCanvasShellController,
  type LocalCanvasShellControllerOptions,
} from "@/lib/canvas/local-canvas-shell-controller";
import type {
  CanvasRepository,
  CanvasSaveResult,
  CanvasSummary,
  CanvasViewState,
  CanvasViewStateRepository,
  LoadedCanvas,
} from "@/lib/canvas/local-canvas-repository";

function textDocument(markdown = "# Привет\n\nМир"): CanvasDocumentV1 {
  return parseCanvasDocumentV1({
    schemaVersion: 1,
    nodes: [
      {
        id: "text-1",
        kind: "text",
        markdown,
        position: { x: 10, y: 20 },
        size: { width: 320, height: 220 },
        zIndex: 1,
      },
    ],
    edges: [],
  });
}

class MemoryRepository implements CanvasRepository, CanvasViewStateRepository {
  canvas: LoadedCanvas | null = null;
  view: CanvasViewState | null = null;
  saves = 0;
  nextRevision = 1;
  async listCanvases(): Promise<CanvasSummary[]> {
    return this.canvas ? [this.canvas] : [];
  }
  async createCanvas(input: {
    workspaceId: string;
    title: string;
  }): Promise<LoadedCanvas> {
    const now = "2026-08-01T00:00:00.000Z";
    this.canvas = {
      id: "canvas-1",
      workspaceId: input.workspaceId,
      title: input.title,
      schemaVersion: 1,
      document: createEmptyCanvasDocumentV1(),
      revision: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    return structuredClone(this.canvas);
  }
  async loadCanvas(input: {
    workspaceId: string;
    canvasId: string;
  }): Promise<LoadedCanvas | null> {
    if (
      !this.canvas ||
      this.canvas.workspaceId !== input.workspaceId ||
      this.canvas.id !== input.canvasId
    )
      return null;
    return structuredClone(this.canvas);
  }
  async saveCanvas(input: {
    workspaceId: string;
    canvasId: string;
    expectedRevision: number;
    title: string;
    document: CanvasDocumentV1;
  }): Promise<CanvasSaveResult> {
    this.saves += 1;
    if (
      !this.canvas ||
      this.canvas.workspaceId !== input.workspaceId ||
      this.canvas.id !== input.canvasId
    )
      throw new Error("not found");
    if (this.canvas.revision !== input.expectedRevision)
      return { status: "conflict", revision: this.canvas.revision };
    this.canvas = {
      ...this.canvas,
      title: input.title,
      document: structuredClone(input.document),
      revision: ++this.nextRevision,
    };
    return { status: "saved", revision: this.canvas.revision };
  }
  async softDeleteCanvas(): Promise<{ status: "deleted" | "already-deleted" }> {
    return { status: "deleted" };
  }
  async loadViewState(): Promise<CanvasViewState | null> {
    return this.view ? structuredClone(this.view) : null;
  }
  async saveViewState(input: CanvasViewState): Promise<void> {
    this.view = structuredClone(input);
  }
  async deleteViewState(): Promise<void> {
    this.view = null;
  }
}

function controllerOptions(
  repository: MemoryRepository,
): LocalCanvasShellControllerOptions {
  return {
    repository,
    workspaceId: "workspace",
    userId: "user",
    clock: () => "2026-08-01T00:00:00.000Z",
  };
}

const emptyPayload = { items: [], files: [], types: [] };

describe("canonical text nodes", () => {
  it("uses the exact text node discriminator", () =>
    expect(textDocument().nodes[0]?.kind).toBe("text"));
  it("round-trips multiline Markdown exactly", () =>
    expect(canvasDocumentToTextNodes(textDocument())[0]?.data.markdown).toBe(
      "# Привет\n\nМир",
    ));
  it("preserves Cyrillic and punctuation", () =>
    expect(
      canvasDocumentToTextNodes(textDocument("Ёжик — [[ссылка]]")).at(0)?.data
        .markdown,
    ).toBe("Ёжик — [[ссылка]]"));
  it("does not add runtime editing fields to canonical data", () =>
    expect(
      runtimeNodesToCanvasDocument(textDocument(), [
        createCanvasTextFlowNode({
          id: "text-1",
          markdown: "draft",
          position: { x: 1, y: 2 },
          isEditing: true,
        }),
      ]).nodes[0],
    ).not.toHaveProperty("isEditing"));
  it("updates canonical layout from runtime text nodes", () => {
    const next = runtimeNodesToCanvasDocument(textDocument(), [
      createCanvasTextFlowNode({
        id: "text-1",
        markdown: "next",
        position: { x: 80, y: 90 },
        size: { width: 400, height: 240 },
      }),
    ]);
    expect(next.nodes[0]).toMatchObject({
      markdown: "next",
      position: { x: 80, y: 90 },
      size: { width: 400, height: 240 },
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
  it("uses a default text layout", () =>
    expect(
      createCanvasTextFlowNode({ id: "x", markdown: "" }).style,
    ).toMatchObject({ width: 320, height: 220 }));
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
    expect(hasMeaningfulPlainText(" \n\t")).toBe(false));
  it("accepts meaningful plain text", () =>
    expect(hasMeaningfulPlainText("hello")).toBe(true));
  it("extracts plain text when no image candidate exists", () =>
    expect(extractCanvasPlainText(emptyPayload, "hello\nworld")).toBe(
      "hello\nworld",
    ));
  it("keeps empty transfer payload inert", () =>
    expect(extractCanvasPlainText(emptyPayload, "")).toBe(""));
  it("does not synthesize text from unsupported transfer metadata", () =>
    expect(
      extractCanvasPlainText({ ...emptyPayload, types: ["text/plain"] }, ""),
    ).toBe(""));
  it("reads text from a clipboard event", () => {
    const event = {
      clipboardData: {
        items: [],
        files: [],
        types: ["text/plain"],
        getData: () => "clipboard",
      },
    } as unknown as ClipboardEvent;
    expect(plainTextFromClipboard(event)).toBe("clipboard");
  });
  it("does not create text from blank clipboard content", () =>
    expect(
      hasMeaningfulPlainText(
        plainTextFromClipboard({
          clipboardData: {
            items: [],
            files: [],
            types: [],
            getData: () => "   ",
          },
        } as unknown as ClipboardEvent),
      ),
    ).toBe(false));
  it("creates one controller text node", async () => {
    const repository = new MemoryRepository();
    const controller = new LocalCanvasShellController(
      controllerOptions(repository),
    );
    const canvas = await controller.createCanvas("Canvas");
    controller.insertTextNode(
      createCanvasTextFlowNode({
        id: "text-1",
        markdown: "one",
        position: { x: 1, y: 2 },
      }),
    );
    expect(controller.state.document.nodes).toHaveLength(1);
    expect(canvas.canvasId).toBe("canvas-1");
  });
  it("saves text through CAS", async () => {
    const repository = new MemoryRepository();
    const controller = new LocalCanvasShellController(
      controllerOptions(repository),
    );
    await controller.createCanvas("Canvas");
    controller.insertTextNode(
      createCanvasTextFlowNode({
        id: "text-1",
        markdown: "one",
        position: { x: 1, y: 2 },
      }),
    );
    expect((await controller.save())?.status).toBe("saved");
  });
  it("preserves exact text after reload", async () => {
    const repository = new MemoryRepository();
    const controller = new LocalCanvasShellController(
      controllerOptions(repository),
    );
    await controller.createCanvas("Canvas");
    controller.insertTextNode(
      createCanvasTextFlowNode({
        id: "text-1",
        markdown: "Привет\n\n# Заголовок",
        position: { x: 1, y: 2 },
      }),
    );
    await controller.save();
    const reloaded = await controller.reloadAfterConflict();
    expect(reloaded.document.nodes[0]).toMatchObject({
      kind: "text",
      markdown: "Привет\n\n# Заголовок",
    });
  });
  it("deletes only the selected text node", async () => {
    const repository = new MemoryRepository();
    const controller = new LocalCanvasShellController(
      controllerOptions(repository),
    );
    await controller.createCanvas("Canvas");
    controller.insertTextNode(
      createCanvasTextFlowNode({
        id: "text-1",
        markdown: "one",
        position: { x: 1, y: 2 },
      }),
    );
    controller.insertTextNode(
      createCanvasTextFlowNode({
        id: "text-2",
        markdown: "two",
        position: { x: 3, y: 4 },
      }),
    );
    controller.removeCanvasNodes(["text-1"]);
    expect(controller.state.document.nodes.map((node) => node.id)).toEqual([
      "text-2",
    ]);
  });
  it("blocks a stale CAS retry", async () => {
    const repository = new MemoryRepository();
    const controller = new LocalCanvasShellController(
      controllerOptions(repository),
    );
    await controller.createCanvas("Canvas");
    repository.canvas!.revision = 2;
    const result = await controller.save();
    expect(result).toEqual({ status: "conflict", revision: 2 });
    expect(await controller.save()).toBeNull();
  });
  it("stores viewport outside the document", async () => {
    const repository = new MemoryRepository();
    const controller = new LocalCanvasShellController(
      controllerOptions(repository),
    );
    await controller.createCanvas("Canvas");
    await controller.saveViewport({ x: 10, y: 20, zoom: 1.5 });
    expect(repository.view).toMatchObject({
      viewportX: 10,
      viewportY: 20,
      zoom: 1.5,
    });
    expect(controller.state.document).toEqual(createEmptyCanvasDocumentV1());
  });
});
