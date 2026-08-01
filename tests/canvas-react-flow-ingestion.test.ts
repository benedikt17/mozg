import { describe, expect, it } from "vitest";
import type {
  CanvasAssetRecord,
  CanvasAssetRepository,
  StoreLocalCanvasImageInput,
} from "@/lib/canvas/local-canvas-repository";
import {
  attachCanvasImagePasteListener,
  createCanvasImageLabManifestStore,
  createObjectUrlRegistry,
  eventTouchesEditingSurface,
  shouldPreventCanvasImagePaste,
  shouldPreventFileNavigation,
  type CanvasImageTransferPayload,
} from "@/lib/canvas/canvas-image-ingestion";
import {
  CANVAS_IMAGE_NODE_TYPE,
  CANVAS_REACT_FLOW_WORKSPACE_ID,
  clearReactFlowImageAssets,
  createReactFlowRestorationCoordinator,
  ingestReactFlowTransfer,
  removeReactFlowImageNode,
  restoreReactFlowImageNodes,
  restoreReactFlowImageNodesProgressive,
  staggeredFlowPosition,
  type ReactFlowImageIngestionDependencies,
} from "@/prototype/canvas-react-flow-ingestion-spike/canvas-react-flow-ingestion";

function makeFile(name: string, type: string, bytes = [1, 2, 3]): File {
  return new File([new Uint8Array(bytes)], name, { type, lastModified: 1 });
}

function dimensions(width = 320, height = 180) {
  return async () => ({ width, height });
}

class MemoryAssetRepository implements CanvasAssetRepository {
  readonly records = new Map<string, CanvasAssetRecord>();
  readonly loadCalls: string[] = [];
  delayMs = 0;
  activeReads = 0;
  maxActiveReads = 0;
  private sequence = 0;

  async storeImage(
    input: StoreLocalCanvasImageInput,
  ): Promise<CanvasAssetRecord> {
    const record: CanvasAssetRecord = {
      id: input.id ?? `asset-${++this.sequence}`,
      workspaceId: input.workspaceId,
      blob: input.blob,
      preview: input.preview ?? null,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
      width: input.width,
      height: input.height,
      checksum: input.checksum ?? null,
      createdAt: "2026-08-01T10:00:00.000Z",
      readyAt: "2026-08-01T10:00:00.000Z",
      deletedAt: null,
    };
    this.records.set(record.id, record);
    return structuredClone(record);
  }

  async loadAsset(input: { workspaceId: string; assetId: string }) {
    this.loadCalls.push(input.assetId);
    this.activeReads += 1;
    this.maxActiveReads = Math.max(this.maxActiveReads, this.activeReads);
    try {
      if (this.delayMs > 0)
        await new Promise((resolve) => setTimeout(resolve, this.delayMs));
      const record = this.records.get(input.assetId);
      if (
        !record ||
        record.workspaceId !== input.workspaceId ||
        record.deletedAt !== null
      )
        return null;
      return structuredClone(record);
    } finally {
      this.activeReads -= 1;
    }
  }

  async markAssetDeleted(input: { workspaceId: string; assetId: string }) {
    const record = this.records.get(input.assetId);
    if (!record || record.workspaceId !== input.workspaceId)
      throw new Error("asset not found");
    record.deletedAt = "2026-08-01T10:01:00.000Z";
  }
}

function storage(): Storage {
  let value: string | null = null;
  return {
    getItem: () => value,
    setItem: (_key, next) => {
      value = next;
    },
    removeItem: () => {
      value = null;
    },
    clear: () => {
      value = null;
    },
    key: () => null,
    get length() {
      return value === null ? 0 : 1;
    },
  } as Storage;
}

function dependencies(repository = new MemoryAssetRepository()) {
  const revoked: string[] = [];
  const objectUrls = createObjectUrlRegistry({
    createObjectURL: (blob) => `blob:${blob.size}:${Math.random()}`,
    revokeObjectURL: (url) => revoked.push(url),
  });
  const manifest = createCanvasImageLabManifestStore(storage());
  return {
    repository,
    revoked,
    dependencies: {
      repository,
      manifest,
      objectUrls,
      workspaceId: CANVAS_REACT_FLOW_WORKSPACE_ID,
      decodeImageDimensions: dimensions(),
    } satisfies ReactFlowImageIngestionDependencies,
  };
}

function imagePayload(
  file: File,
  files: File[] = [file],
): CanvasImageTransferPayload {
  return {
    items: [{ kind: "file", type: file.type, getAsFile: () => file }],
    files,
    types: [file.type],
  };
}

async function seedAssets(repository: MemoryAssetRepository, count: number) {
  for (let index = 0; index < count; index += 1) {
    await repository.storeImage({
      id: `restore-${index}`,
      workspaceId: CANVAS_REACT_FLOW_WORKSPACE_ID,
      blob: makeFile(`restore-${index}.png`, "image/png"),
      mimeType: "image/png",
      byteSize: 3,
      width: 320,
      height: 180,
    });
  }
}

describe("React Flow Canvas image ingestion integration", () => {
  it("creates one persisted asset and one node for one accepted clipboard image", async () => {
    const context = dependencies();
    const response = await ingestReactFlowTransfer(
      imagePayload(makeFile("paste.png", "image/png")),
      "clipboard",
      { x: 40, y: 80 },
      context.dependencies,
    );
    expect(response.result.accepted).toHaveLength(1);
    expect(response.nodes).toHaveLength(1);
    expect(context.repository.records).toHaveLength(1);
  });

  it("does not duplicate Chrome items/files representations", async () => {
    const context = dependencies();
    const itemFile = makeFile("items.png", "image/png");
    const filesFile = makeFile("files.png", "image/png");
    const response = await ingestReactFlowTransfer(
      imagePayload(itemFile, [filesFile]),
      "clipboard",
      { x: 0, y: 0 },
      context.dependencies,
    );
    expect(response.extracted.candidates).toHaveLength(1);
    expect(response.nodes).toHaveLength(1);
  });

  it("allows a second separate paste to create a second node", async () => {
    const context = dependencies();
    const first = await ingestReactFlowTransfer(
      imagePayload(makeFile("first.png", "image/png")),
      "clipboard",
      { x: 0, y: 0 },
      context.dependencies,
    );
    const second = await ingestReactFlowTransfer(
      imagePayload(makeFile("second.png", "image/png")),
      "clipboard",
      { x: 200, y: 100 },
      context.dependencies,
    );
    expect(first.nodes).toHaveLength(1);
    expect(second.nodes).toHaveLength(1);
    expect(first.nodes[0].id).not.toBe(second.nodes[0].id);
  });

  it("places a dropped image at the converted flow position", async () => {
    const context = dependencies();
    const response = await ingestReactFlowTransfer(
      imagePayload(makeFile("drop.webp", "image/webp")),
      "drop",
      { x: 320, y: 240 },
      context.dependencies,
    );
    expect(response.nodes[0].position).toEqual({ x: 320, y: 240 });
    expect(response.nodes[0].data.source).toBe("drop");
  });

  it("fits large images while preserving their intrinsic aspect ratio", async () => {
    const context = dependencies();
    context.dependencies.decodeImageDimensions = dimensions(4_000, 2_000);
    const response = await ingestReactFlowTransfer(
      imagePayload(makeFile("large.png", "image/png")),
      "drop",
      { x: 0, y: 0 },
      context.dependencies,
    );
    expect(response.nodes[0].style).toMatchObject({ width: 640, height: 320 });
  });

  it("creates one staggered node per accepted dropped file", async () => {
    const context = dependencies();
    const first = makeFile("one.png", "image/png");
    const second = makeFile("two.jpeg", "image/jpeg");
    const response = await ingestReactFlowTransfer(
      {
        items: [],
        files: [first, second],
        types: [first.type, second.type],
      },
      "drop",
      { x: 10, y: 20 },
      context.dependencies,
    );
    expect(response.nodes).toHaveLength(2);
    expect(response.nodes.map((node) => node.position)).toEqual([
      { x: 10, y: 20 },
      staggeredFlowPosition({ x: 10, y: 20 }, 1),
    ]);
  });

  it("uses the same service for native file-picker ingestion", async () => {
    const context = dependencies();
    const response = await ingestReactFlowTransfer(
      { items: [], files: [makeFile("picker.jpeg", "image/jpeg")] },
      "file-picker",
      { x: 100, y: 100 },
      context.dependencies,
    );
    expect(response.result.accepted[0].source).toBe("file-picker");
    expect(response.nodes[0].data.source).toBe("file-picker");
  });

  it("does not create nodes for rejected files", async () => {
    const context = dependencies();
    const response = await ingestReactFlowTransfer(
      { items: [], files: [makeFile("bad.gif", "image/gif")] },
      "drop",
      { x: 0, y: 0 },
      context.dependencies,
    );
    expect(response.nodes).toEqual([]);
    expect(response.result.rejected[0].reason).toBe("unsupported-mime");
  });

  it("stores only asset identity and render URL in node data", async () => {
    const context = dependencies();
    const response = await ingestReactFlowTransfer(
      imagePayload(makeFile("metadata.png", "image/png")),
      "clipboard",
      { x: 0, y: 0 },
      context.dependencies,
    );
    const data = response.nodes[0].data;
    expect(data).toMatchObject({
      assetId: expect.any(String),
      mimeType: "image/png",
      intrinsicWidth: 320,
      intrinsicHeight: 180,
      objectUrl: expect.stringMatching(/^blob:/),
    });
    expect(data).not.toHaveProperty("blob");
    expect(JSON.stringify(data)).not.toMatch(/base64|data:/i);
  });

  it("resolves every accepted asset through the repository before rendering", async () => {
    const context = dependencies();
    const response = await ingestReactFlowTransfer(
      imagePayload(makeFile("resolve.png", "image/png")),
      "clipboard",
      { x: 0, y: 0 },
      context.dependencies,
    );
    expect(context.repository.loadCalls).toEqual([
      response.nodes[0].data.assetId,
    ]);
  });

  it("revokes the node URL on removal and all remaining URLs on clear", async () => {
    const context = dependencies();
    const response = await ingestReactFlowTransfer(
      {
        items: [],
        files: [
          makeFile("one.png", "image/png"),
          makeFile("two.png", "image/png"),
        ],
      },
      "drop",
      { x: 0, y: 0 },
      context.dependencies,
    );
    await removeReactFlowImageNode(response.nodes[0], context.dependencies);
    expect(context.dependencies.objectUrls.count()).toBe(1);
    await clearReactFlowImageAssets([response.nodes[1]], context.dependencies);
    expect(context.dependencies.objectUrls.count()).toBe(0);
    expect(context.revoked).toHaveLength(2);
  });

  it("supports StrictMode-style listener setup and cleanup without duplication", () => {
    const originalDocument = Object.getOwnPropertyDescriptor(
      globalThis,
      "document",
    );
    const added: unknown[][] = [];
    const removed: unknown[][] = [];
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        addEventListener: (...args: unknown[]) => added.push(args),
        removeEventListener: (...args: unknown[]) => removed.push(args),
      },
    });
    try {
      const listener = () => undefined;
      attachCanvasImagePasteListener(listener)();
      attachCanvasImagePasteListener(listener)();
      expect(added).toHaveLength(2);
      expect(removed).toHaveLength(2);
      expect(added[0]).toEqual(["paste", listener, true]);
    } finally {
      if (originalDocument)
        Object.defineProperty(globalThis, "document", originalDocument);
      else Reflect.deleteProperty(globalThis, "document");
    }
  });

  it("keeps outside file drops preventable without changing navigation", () => {
    const file = makeFile("outside.png", "image/png");
    expect(shouldPreventFileNavigation({ files: [file] })).toBe(true);
  });

  it("keeps editable-surface text paste normal", () => {
    const file = makeFile("editor.png", "image/png");
    const event = {
      target: { tagName: "TEXTAREA" },
      composedPath: () => [{ tagName: "TEXTAREA" }],
      clipboardData: {
        items: [{ kind: "file", getAsFile: () => file }],
        files: [file],
      },
    } as unknown as ClipboardEvent;
    expect(eventTouchesEditingSurface(event)).toBe(true);
    expect(shouldPreventCanvasImagePaste(event)).toBe(false);
  });

  it("deleting a spike node does not delete unrelated workspace data", async () => {
    const context = dependencies();
    const unrelated = await context.repository.storeImage({
      id: "unrelated",
      workspaceId: "real-workspace",
      blob: makeFile("unrelated.png", "image/png"),
      mimeType: "image/png",
      byteSize: 3,
      width: 1,
      height: 1,
    });
    const response = await ingestReactFlowTransfer(
      imagePayload(makeFile("spike.png", "image/png")),
      "clipboard",
      { x: 0, y: 0 },
      context.dependencies,
    );
    await removeReactFlowImageNode(response.nodes[0], context.dependencies);
    expect(
      await context.repository.loadAsset({
        workspaceId: "real-workspace",
        assetId: unrelated.id,
      }),
    ).not.toBeNull();
  });

  it("restores nodes progressively with bounded concurrent reads", async () => {
    const repository = new MemoryAssetRepository();
    repository.delayMs = 15;
    await seedAssets(repository, 7);
    const context = dependencies(repository);
    for (const assetId of repository.records.keys())
      context.dependencies.manifest.add(assetId);
    const emitted: string[] = [];
    const restored = await restoreReactFlowImageNodesProgressive(
      context.dependencies,
      { x: 0, y: 0 },
      { concurrency: 3, onNode: ({ node }) => emitted.push(node.data.assetId) },
    );
    expect(restored.nodes).toHaveLength(7);
    expect(emitted).toHaveLength(7);
    expect(repository.maxActiveReads).toBeLessThanOrEqual(3);
    expect(restored.timings?.assetReadCount).toBe(7);
    expect(restored.timings?.maxConcurrentAssetReads).toBeLessThanOrEqual(3);
  });

  it("lets a fast asset emit before a slower asset finishes", async () => {
    const repository = new MemoryAssetRepository();
    await seedAssets(repository, 2);
    const originalLoad = repository.loadAsset.bind(repository);
    repository.loadAsset = async (input) => {
      if (input.assetId === "restore-0")
        await new Promise((resolve) => setTimeout(resolve, 40));
      return originalLoad(input);
    };
    const context = dependencies(repository);
    context.dependencies.manifest.add("restore-0");
    context.dependencies.manifest.add("restore-1");
    const emitted: string[] = [];
    await restoreReactFlowImageNodesProgressive(
      context.dependencies,
      { x: 0, y: 0 },
      { concurrency: 2, onNode: ({ node }) => emitted.push(node.data.assetId) },
    );
    expect(emitted[0]).toBe("restore-1");
  });

  it("does not decode intrinsic dimensions again during restoration", async () => {
    const repository = new MemoryAssetRepository();
    await seedAssets(repository, 2);
    const context = dependencies(repository);
    for (const assetId of repository.records.keys())
      context.dependencies.manifest.add(assetId);
    let decodeCalls = 0;
    context.dependencies.decodeImageDimensions = async () => {
      decodeCalls += 1;
      throw new Error("restoration must use persisted dimensions");
    };
    await restoreReactFlowImageNodesProgressive(context.dependencies, {
      x: 0,
      y: 0,
    });
    expect(decodeCalls).toBe(0);
  });

  it("coalesces StrictMode-style setup/cleanup/setup asset reads", async () => {
    const repository = new MemoryAssetRepository();
    repository.delayMs = 20;
    await seedAssets(repository, 3);
    const context = dependencies(repository);
    for (const assetId of repository.records.keys())
      context.dependencies.manifest.add(assetId);
    const coordinator = createReactFlowRestorationCoordinator(repository);
    const shared = {
      ...context.dependencies,
      restorationCoordinator: coordinator,
    };
    const firstController = new AbortController();
    const first = restoreReactFlowImageNodesProgressive(
      shared,
      { x: 0, y: 0 },
      {
        signal: firstController.signal,
        concurrency: 3,
      },
    );
    firstController.abort();
    const second = restoreReactFlowImageNodesProgressive(
      shared,
      { x: 0, y: 0 },
      {
        runId: 2,
        concurrency: 3,
      },
    );
    await Promise.all([first, second]);
    expect(repository.loadCalls).toHaveLength(3);
  });

  it("ignores stale restoration after cleanup and revokes no leaked URLs", async () => {
    const repository = new MemoryAssetRepository();
    repository.delayMs = 30;
    await seedAssets(repository, 2);
    const context = dependencies(repository);
    for (const assetId of repository.records.keys())
      context.dependencies.manifest.add(assetId);
    const controller = new AbortController();
    const pending = restoreReactFlowImageNodesProgressive(
      context.dependencies,
      { x: 0, y: 0 },
      {
        signal: controller.signal,
        onNode: () => {
          throw new Error("stale node emitted");
        },
      },
    );
    controller.abort();
    const restored = await pending;
    expect(restored.nodes).toEqual([]);
    expect(restored.timings?.staleIgnored).toBe(true);
    expect(context.dependencies.objectUrls.count()).toBe(0);
  });

  it("restores persisted spike assets as nodes with fresh render URLs", async () => {
    const context = dependencies();
    const response = await ingestReactFlowTransfer(
      imagePayload(makeFile("restore.png", "image/png")),
      "clipboard",
      { x: 0, y: 0 },
      context.dependencies,
    );
    const restoredContext = dependencies(context.repository);
    restoredContext.dependencies.manifest.add(response.nodes[0].data.assetId);
    const restored = await restoreReactFlowImageNodes(
      restoredContext.dependencies,
      { x: 90, y: 90 },
    );
    expect(restored.nodes[0].type).toBe(CANVAS_IMAGE_NODE_TYPE);
    expect(restored.nodes[0].data.assetId).toBe(response.nodes[0].data.assetId);
    expect(restored.nodes[0].data.objectUrl).toMatch(/^blob:/);
  });
});
