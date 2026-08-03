import { describe, expect, it } from "vitest";
import type {
  CanvasAssetRecord,
  CanvasAssetRepository,
  StoreLocalCanvasImageInput,
} from "@/lib/canvas/local-canvas-repository";
import {
  CANVAS_IMAGE_INPUT_MAX_BYTES,
  CANVAS_IMAGE_INPUT_MAX_FILES,
  CANVAS_IMAGE_INPUT_MAX_PIXELS,
  CANVAS_IMAGE_LAB_WORKSPACE_ID,
  createCanvasImageLabManifestStore,
  createObjectUrlRegistry,
  attachCanvasImagePasteListener,
  eventTouchesEditingSurface,
  extractCanvasImageTransfer,
  ingestCanvasImageCandidates,
  restoreCanvasImageLabEntries,
  removeCanvasImageLabAsset,
  clearCanvasImageLabAssets,
  shouldPreventCanvasImagePaste,
  shouldPreventFileNavigation,
  type CanvasImageCandidate,
} from "@/lib/canvas/canvas-image-ingestion";

function makeFile(
  name: string,
  type: string,
  bytes: number[] = [1, 2, 3, 4],
): File {
  return new File([new Uint8Array(bytes)], name, { type, lastModified: 1 });
}

function candidates(
  files: File[],
  source: CanvasImageCandidate["source"] = "drop",
) {
  return files.map((file, inputIndex) => ({ file, source, inputIndex }));
}

function dimensions(width = 100, height = 50) {
  return async () => ({ width, height });
}

class MemoryAssetRepository implements CanvasAssetRepository {
  readonly records = new Map<string, CanvasAssetRecord>();
  storeCalls = 0;
  private sequence = 0;
  async storeImage(
    input: StoreLocalCanvasImageInput,
  ): Promise<CanvasAssetRecord> {
    this.storeCalls += 1;
    const id = input.id ?? `asset-${++this.sequence}`;
    const record: CanvasAssetRecord = {
      id,
      workspaceId: input.workspaceId,
      blob: input.blob.slice(0, input.blob.size, input.blob.type),
      preview: input.preview ?? null,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
      width: input.width,
      height: input.height,
      checksum: input.checksum ?? null,
      createdAt: "2026-07-31T10:00:00.000Z",
      readyAt: "2026-07-31T10:00:00.000Z",
      deletedAt: null,
    };
    this.records.set(id, record);
    return structuredClone(record);
  }
  async loadAsset(input: {
    workspaceId: string;
    assetId: string;
  }): Promise<CanvasAssetRecord | null> {
    const record = this.records.get(input.assetId);
    if (
      !record ||
      record.workspaceId !== input.workspaceId ||
      record.deletedAt !== null
    )
      return null;
    return structuredClone(record);
  }
  async markAssetDeleted(input: {
    workspaceId: string;
    assetId: string;
  }): Promise<void> {
    const record = this.records.get(input.assetId);
    if (!record || record.workspaceId !== input.workspaceId)
      throw new Error("not found");
    record.deletedAt = "2026-07-31T10:01:00.000Z";
  }
}

class CapturingAssetRepository extends MemoryAssetRepository {
  lastStoreInput: StoreLocalCanvasImageInput | null = null;

  override async storeImage(
    input: StoreLocalCanvasImageInput,
  ): Promise<CanvasAssetRecord> {
    this.lastStoreInput = input;
    return super.storeImage(input);
  }
}

function memoryStorage(): Storage {
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

function clipboardPayload(file?: File) {
  return {
    items: file
      ? [{ kind: "file", type: file.type, getAsFile: () => file }]
      : [],
    files: file ? [file] : [],
    types: file ? [file.type] : [],
  };
}

describe("standalone Canvas image ingestion boundary", () => {
  it("extracts clipboard item-only image", () => {
    const file = makeFile("shot.png", "image/png");
    const result = extractCanvasImageTransfer(
      { items: [{ kind: "file", getAsFile: () => file }] },
      "clipboard",
    );
    expect(result.candidates.map((candidate) => candidate.file)).toEqual([
      file,
    ]);
  });

  it("extracts clipboard files-only image", () => {
    const file = makeFile("shot.png", "image/png");
    expect(
      extractCanvasImageTransfer({ files: [file] }, "clipboard").candidates[0]
        .file,
    ).toBe(file);
  });

  it("deduplicates the same file exposed through items and files", () => {
    const file = makeFile("shot.png", "image/png");
    expect(
      extractCanvasImageTransfer(clipboardPayload(file), "clipboard")
        .candidates,
    ).toHaveLength(1);
  });

  it("treats usable clipboard items as canonical over populated files", () => {
    const itemFile = makeFile("item.png", "image/png");
    const filesFile = makeFile("files.png", "image/png");
    expect(
      extractCanvasImageTransfer(
        {
          items: [{ kind: "file", getAsFile: () => itemFile }],
          files: [filesFile],
        },
        "clipboard",
      ).candidates.map((candidate) => candidate.file.name),
    ).toEqual(["item.png"]);
  });

  it("falls back to clipboard files when items contain no usable image", () => {
    const fallbackFile = makeFile("fallback.png", "image/png");
    expect(
      extractCanvasImageTransfer(
        {
          items: [
            { kind: "string", type: "text/plain", getAsFile: () => null },
          ],
          files: [fallbackFile],
        },
        "clipboard",
      ).candidates.map((candidate) => candidate.file.name),
    ).toEqual(["fallback.png"]);
  });

  it("keeps distinct images from one canonical clipboard payload", () => {
    const first = makeFile("first.png", "image/png");
    const second = makeFile("second.jpeg", "image/jpeg");
    const duplicateRepresentations = [
      makeFile("first-from-files.png", "image/png"),
      makeFile("second-from-files.jpeg", "image/jpeg"),
    ];
    expect(
      extractCanvasImageTransfer(
        {
          items: [
            { kind: "file", getAsFile: () => first },
            { kind: "file", getAsFile: () => second },
          ],
          files: duplicateRepresentations,
        },
        "clipboard",
      ).candidates.map((candidate) => candidate.file.name),
    ).toEqual(["first.png", "second.jpeg"]);
  });

  it("extracts drop items", () => {
    const file = makeFile("drop.webp", "image/webp");
    expect(
      extractCanvasImageTransfer(
        { items: [{ kind: "file", getAsFile: () => file }] },
        "drop",
      ).candidates[0].source,
    ).toBe("drop");
  });

  it("falls back to drop files", () => {
    const file = makeFile("drop.jpeg", "image/jpeg");
    expect(
      extractCanvasImageTransfer({ files: [file] }, "drop").candidates[0].file
        .name,
    ).toBe("drop.jpeg");
  });

  it("preserves multiple input order", () => {
    const files = [
      makeFile("a.png", "image/png"),
      makeFile("b.jpeg", "image/jpeg"),
      makeFile("c.webp", "image/webp"),
    ];
    expect(
      extractCanvasImageTransfer({ files }, "drop").candidates.map(
        (candidate) => candidate.file.name,
      ),
    ).toEqual(["a.png", "b.jpeg", "c.webp"]);
  });

  it("reports unsupported MIME", async () => {
    const result = await ingestCanvasImageCandidates(
      candidates([makeFile("notes.txt", "text/plain")]),
      {
        repository: new MemoryAssetRepository(),
        decodeImageDimensions: dimensions(),
      },
    );
    expect(result.rejected[0].reason).toBe("unsupported-mime");
  });

  it("reports empty payload and empty file", async () => {
    expect(extractCanvasImageTransfer({}, "clipboard").candidates).toEqual([]);
    const result = await ingestCanvasImageCandidates(
      candidates([makeFile("empty.png", "image/png", [])]),
      {
        repository: new MemoryAssetRepository(),
        decodeImageDimensions: dimensions(),
      },
    );
    expect(result.rejected[0].reason).toBe("empty-file");
  });

  it("enforces the 20-image maximum as explicit rejections", async () => {
    const files = Array.from(
      { length: CANVAS_IMAGE_INPUT_MAX_FILES + 1 },
      (_, index) => makeFile(`${index}.png`, "image/png"),
    );
    const result = await ingestCanvasImageCandidates(candidates(files), {
      repository: new MemoryAssetRepository(),
      decodeImageDimensions: dimensions(),
    });
    expect(result.accepted).toHaveLength(CANVAS_IMAGE_INPUT_MAX_FILES);
    expect(result.rejected.at(-1)?.reason).toBe("too-many-images");
  });

  it("ignores input targets in the editing-surface guard", () => {
    const input = { tagName: "INPUT" };
    expect(
      eventTouchesEditingSurface({
        target: input,
        composedPath: () => [input],
      } as unknown as Event),
    ).toBe(true);
  });

  it("ignores textarea targets in the editing-surface guard", () => {
    const textarea = { tagName: "TEXTAREA" };
    expect(
      eventTouchesEditingSurface({
        target: textarea,
        composedPath: () => [textarea],
      } as unknown as Event),
    ).toBe(true);
  });

  it("ignores nested contenteditable targets", () => {
    const editable = { contentEditable: "true" };
    expect(
      eventTouchesEditingSurface({
        target: {},
        composedPath: () => [{}, editable],
      } as unknown as Event),
    ).toBe(true);
  });

  it("accepts a non-editing Canvas target", () => {
    const canvas = { tagName: "DIV", dataset: {} };
    expect(
      eventTouchesEditingSurface({
        target: canvas,
        composedPath: () => [canvas],
      } as unknown as Event),
    ).toBe(false);
  });

  it.each([
    ["image/png", "PNG"],
    ["image/jpeg", "JPEG"],
    ["image/webp", "WebP"],
  ])("accepts %s with decoded metadata", async (mimeType) => {
    const file = makeFile(`image.${mimeType.slice(6)}`, mimeType);
    const result = await ingestCanvasImageCandidates(
      candidates([file], "file-picker"),
      {
        repository: new MemoryAssetRepository(),
        decodeImageDimensions: dimensions(320, 180),
      },
    );
    expect(result.accepted[0]).toMatchObject({
      mimeType,
      byteSize: file.size,
      width: 320,
      height: 180,
      source: "file-picker",
    });
  });

  it("leaves the default canonical asset ID to the repository", async () => {
    const repository = new CapturingAssetRepository();
    const result = await ingestCanvasImageCandidates(
      candidates([makeFile("cloud.png", "image/png")]),
      { repository, decodeImageDimensions: dimensions() },
    );

    expect(repository.lastStoreInput?.id).toBeUndefined();
    expect(result.accepted[0]?.assetId).toBe("asset-1");
  });

  it("rejects an oversized Blob", async () => {
    const file = makeFile("large.png", "image/png", [1]);
    Object.defineProperty(file, "size", {
      value: CANVAS_IMAGE_INPUT_MAX_BYTES + 1,
    });
    const result = await ingestCanvasImageCandidates(candidates([file]), {
      repository: new MemoryAssetRepository(),
      decodeImageDimensions: dimensions(),
    });
    expect(result.rejected[0].reason).toBe("too-large");
  });

  it("rejects a zero-byte file before decoding", async () => {
    const result = await ingestCanvasImageCandidates(
      candidates([makeFile("zero.webp", "image/webp", [])]),
      {
        repository: new MemoryAssetRepository(),
        decodeImageDimensions: async () => {
          throw new Error("must not decode");
        },
      },
    );
    expect(result.rejected[0].reason).toBe("empty-file");
  });

  it("rejects an invalid decode", async () => {
    const result = await ingestCanvasImageCandidates(
      candidates([makeFile("bad.png", "image/png")]),
      {
        repository: new MemoryAssetRepository(),
        decodeImageDimensions: async () => {
          throw new Error("bad");
        },
      },
    );
    expect(result.rejected[0].reason).toBe("decode-failed");
  });

  it("rejects images over 40 megapixels", async () => {
    const result = await ingestCanvasImageCandidates(
      candidates([makeFile("huge.jpeg", "image/jpeg")]),
      {
        repository: new MemoryAssetRepository(),
        decodeImageDimensions: dimensions(10_000, 4_001),
      },
    );
    expect(result.rejected[0].reason).toBe("too-many-pixels");
    expect(CANVAS_IMAGE_INPUT_MAX_PIXELS).toBe(40_000_000);
  });

  it("reports a repository failure without exposing repository details", async () => {
    const repository: CanvasAssetRepository = {
      storeImage: async () => {
        throw new Error("private storage payload");
      },
      loadAsset: async () => null,
      markAssetDeleted: async () => undefined,
    };
    const result = await ingestCanvasImageCandidates(
      candidates([makeFile("write.png", "image/png")]),
      { repository, decodeImageDimensions: dimensions() },
    );
    expect(result.rejected).toMatchObject([
      { fileName: "write.png", reason: "repository-failure" },
    ]);
    expect(JSON.stringify(result)).not.toContain("private storage payload");
  });

  it("preserves exact width, height and byte size", async () => {
    const file = makeFile("exact.webp", "image/webp", [7, 8, 9]);
    const result = await ingestCanvasImageCandidates(candidates([file]), {
      repository: new MemoryAssetRepository(),
      decodeImageDimensions: dimensions(17, 19),
    });
    expect(result.accepted[0]).toMatchObject({
      byteSize: 3,
      width: 17,
      height: 19,
    });
  });

  it("persists one accepted asset for one physical clipboard payload", async () => {
    const repository = new MemoryAssetRepository();
    const fileFromItems = makeFile("clipboard.png", "image/png");
    const equivalentFileFromFiles = makeFile(
      "clipboard-from-files.png",
      "image/png",
    );
    const extracted = extractCanvasImageTransfer(
      {
        items: [{ kind: "file", getAsFile: () => fileFromItems }],
        files: [equivalentFileFromFiles],
      },
      "clipboard",
    );
    const result = await ingestCanvasImageCandidates(extracted.candidates, {
      repository,
      decodeImageDimensions: dimensions(),
    });
    expect(result.accepted).toHaveLength(1);
    expect(repository.storeCalls).toBe(1);
  });

  it("does not persistently deduplicate the same image across separate ingress calls", async () => {
    const repository = new MemoryAssetRepository();
    const file = makeFile("repeat.png", "image/png");
    let idSequence = 0;
    const options = {
      repository,
      decodeImageDimensions: dimensions(),
      idGenerator: () => `repeat-${++idSequence}`,
    };
    const first = await ingestCanvasImageCandidates(
      extractCanvasImageTransfer({ files: [file] }, "clipboard").candidates,
      options,
    );
    const second = await ingestCanvasImageCandidates(
      extractCanvasImageTransfer({ files: [file] }, "clipboard").candidates,
      options,
    );
    expect(first.accepted).toHaveLength(1);
    expect(second.accepted).toHaveLength(1);
    expect(first.accepted[0].assetId).not.toBe(second.accepted[0].assetId);
    expect(repository.storeCalls).toBe(2);
  });

  it("stores and loads accepted Blob metadata exactly", async () => {
    const repository = new MemoryAssetRepository();
    const file = makeFile("stored.png", "image/png", [11, 12]);
    const result = await ingestCanvasImageCandidates(candidates([file]), {
      repository,
      decodeImageDimensions: dimensions(12, 9),
      idGenerator: () => "lab-asset-1",
    });
    const loaded = await repository.loadAsset({
      workspaceId: CANVAS_IMAGE_LAB_WORKSPACE_ID,
      assetId: result.accepted[0].assetId,
    });
    expect(loaded).toMatchObject({
      id: "lab-asset-1",
      mimeType: "image/png",
      byteSize: 2,
      width: 12,
      height: 9,
    });
    expect(new Uint8Array(await loaded!.blob.arrayBuffer())).toEqual(
      new Uint8Array([11, 12]),
    );
  });

  it("round-trips Blob bytes without Base64 or data URLs", async () => {
    const repository = new MemoryAssetRepository();
    const result = await ingestCanvasImageCandidates(
      candidates([makeFile("bytes.jpeg", "image/jpeg", [4, 5, 6])]),
      { repository, decodeImageDimensions: dimensions() },
    );
    const loaded = await repository.loadAsset({
      workspaceId: CANVAS_IMAGE_LAB_WORKSPACE_ID,
      assetId: result.accepted[0].assetId,
    });
    expect(new Uint8Array(await loaded!.blob.arrayBuffer())).toEqual(
      new Uint8Array([4, 5, 6]),
    );
    expect(JSON.stringify(result)).not.toMatch(/base64|data:/i);
  });

  it("restores gallery entries from the laboratory manifest", async () => {
    const repository = new MemoryAssetRepository();
    const storage = memoryStorage();
    const manifest = createCanvasImageLabManifestStore(storage);
    const stored = await ingestCanvasImageCandidates(
      candidates([makeFile("reload.webp", "image/webp")]),
      {
        repository,
        decodeImageDimensions: dimensions(),
        idGenerator: () => "reload-1",
      },
    );
    manifest.add(stored.accepted[0].assetId);
    const urls = createObjectUrlRegistry({
      createObjectURL: () => "blob:reload",
      revokeObjectURL: () => undefined,
    });
    const restored = await restoreCanvasImageLabEntries(
      repository,
      manifest,
      urls,
    );
    expect(restored).toHaveLength(1);
    expect(restored[0].objectUrl).toBe("blob:reload");
    expect(urls.count()).toBe(1);
  });

  it("clears only laboratory assets and leaves a sentinel record untouched", async () => {
    const repository = new MemoryAssetRepository();
    const storage = memoryStorage();
    const manifest = createCanvasImageLabManifestStore(storage);
    const lab = await ingestCanvasImageCandidates(
      candidates([makeFile("lab.png", "image/png")]),
      {
        repository,
        decodeImageDimensions: dimensions(),
        idGenerator: () => "lab-only",
      },
    );
    const other = await repository.storeImage({
      id: "other",
      workspaceId: "real-workspace",
      blob: makeFile("other.png", "image/png"),
      mimeType: "image/png",
      byteSize: 4,
      width: 1,
      height: 1,
    });
    manifest.add(lab.accepted[0].assetId);
    const urls = createObjectUrlRegistry({
      createObjectURL: () => "blob:lab",
      revokeObjectURL: () => undefined,
    });
    await clearCanvasImageLabAssets(repository, manifest, urls, [
      { assetId: lab.accepted[0].assetId, objectUrl: "blob:lab" },
    ]);
    expect(
      await repository.loadAsset({
        workspaceId: CANVAS_IMAGE_LAB_WORKSPACE_ID,
        assetId: lab.accepted[0].assetId,
      }),
    ).toBeNull();
    expect(
      await repository.loadAsset({
        workspaceId: other.workspaceId,
        assetId: other.id,
      }),
    ).not.toBeNull();
    expect(manifest.list()).toEqual([]);
  });

  it("removes one laboratory image without affecting another", async () => {
    const repository = new MemoryAssetRepository();
    const manifest = createCanvasImageLabManifestStore(memoryStorage());
    const result = await ingestCanvasImageCandidates(
      candidates([
        makeFile("one.png", "image/png"),
        makeFile("two.png", "image/png"),
      ]),
      { repository, decodeImageDimensions: dimensions() },
    );
    for (const item of result.accepted) manifest.add(item.assetId);
    const revoked: string[] = [];
    const urls = createObjectUrlRegistry({
      createObjectURL: () => "blob:one",
      revokeObjectURL: (url) => revoked.push(url),
    });
    const oneUrl = urls.create(new Blob(["one"]));
    await removeCanvasImageLabAsset(repository, manifest, urls, {
      assetId: result.accepted[0].assetId,
      objectUrl: oneUrl,
    });
    expect(
      await repository.loadAsset({
        workspaceId: CANVAS_IMAGE_LAB_WORKSPACE_ID,
        assetId: result.accepted[1].assetId,
      }),
    ).not.toBeNull();
    expect(revoked).toEqual(["blob:one"]);
  });

  it("tracks Object URL create, revoke, replace-style cleanup and revokeAll", () => {
    const revoked: string[] = [];
    let sequence = 0;
    const registry = createObjectUrlRegistry({
      createObjectURL: () => `blob:${++sequence}`,
      revokeObjectURL: (url) => revoked.push(url),
    });
    const first = registry.create(new Blob(["a"]));
    const second = registry.create(new Blob(["b"]));
    expect(registry.count()).toBe(2);
    registry.revoke(first);
    expect(registry.count()).toBe(1);
    registry.revokeAll();
    expect(registry.count()).toBe(0);
    expect(revoked).toEqual([first, second]);
  });

  it("requests preventDefault for supported image paste", () => {
    const file = makeFile("paste.png", "image/png");
    const event = {
      target: { tagName: "DIV" },
      composedPath: () => [{ tagName: "DIV" }],
      clipboardData: {
        items: [{ kind: "file", type: file.type, getAsFile: () => file }],
        files: [file],
        types: [file.type],
      },
    } as unknown as ClipboardEvent;
    expect(shouldPreventCanvasImagePaste(event)).toBe(true);
  });

  it("does not prevent plain-text paste", () => {
    const event = {
      target: { tagName: "DIV" },
      composedPath: () => [{ tagName: "DIV" }],
      clipboardData: {
        items: [{ kind: "string", type: "text/plain" }],
        files: [],
        types: ["text/plain"],
      },
    } as unknown as ClipboardEvent;
    expect(shouldPreventCanvasImagePaste(event)).toBe(false);
  });

  it("requests navigation prevention for file dragover/drop", () => {
    const file = makeFile("drop.png", "image/png");
    expect(
      shouldPreventFileNavigation({
        items: [{ kind: "file", getAsFile: () => file }],
      }),
    ).toBe(true);
  });

  it("does not prevent ordinary text dragging", () => {
    expect(
      shouldPreventFileNavigation({
        items: [{ kind: "string", type: "text/plain" }],
      }),
    ).toBe(false);
  });

  it("sets up and cleans up exactly one capture listener per mount", () => {
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
      const cleanupFirst = attachCanvasImagePasteListener(listener);
      cleanupFirst();
      const cleanupSecond = attachCanvasImagePasteListener(listener);
      cleanupSecond();
      expect(added).toHaveLength(2);
      expect(removed).toHaveLength(2);
      expect(added[0]).toEqual(["paste", listener, true]);
      expect(removed[0]).toEqual(["paste", listener, true]);
    } finally {
      if (originalDocument) {
        Object.defineProperty(globalThis, "document", originalDocument);
      } else {
        Reflect.deleteProperty(globalThis, "document");
      }
    }
  });

  it("classifies an outside file drop as preventable without ingesting it", () => {
    const file = makeFile("outside.png", "image/png");
    const result = extractCanvasImageTransfer({ files: [file] }, "drop");
    expect(shouldPreventFileNavigation({ files: [file] })).toBe(true);
    expect(result.candidates[0].source).toBe("drop");
  });
});
