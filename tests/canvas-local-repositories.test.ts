import { beforeEach, describe, expect, it } from "vitest";
import { createEmptyCanvasDocumentV1 } from "@/lib/canvas/canvas-document";
import { IndexedDbCanvasRepository } from "@/lib/canvas/local-canvas-repository";
import { initialDesktopPrototypeState } from "@/prototype/desktop-state";
import { createDesktopDomainSnapshot } from "@/prototype/persistence/domain-snapshot";
import {
  IndexedDbDesktopPersistenceAdapter,
  MOZG_DESKTOP_DOMAIN_STORE,
} from "@/prototype/persistence/indexeddb-adapter";

type Store = { keyPath: string; values: Map<IDBValidKey, unknown> };
type Database = { version: number; stores: Map<string, Store> };
const evt = () => ({ type: "fake" }) as Event;

class Req<T> {
  result!: T;
  error: DOMException | null = null;
  onsuccess: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  ok(value: T): void {
    this.result = value;
    queueMicrotask(() => this.onsuccess?.(evt()));
  }
  fail(error: DOMException): void {
    this.error = error;
    queueMicrotask(() => this.onerror?.(evt()));
  }
}
class Tx {
  error: DOMException | null = null;
  oncomplete: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onabort: ((event: Event) => void) | null = null;
  private pending = 0;
  private aborted = false;
  private scheduled = false;
  private readonly working = new Map<string, Store>();
  constructor(
    private readonly db: Database,
    private readonly mode: IDBTransactionMode,
    names: string[],
  ) {
    for (const name of names) {
      const source = db.stores.get(name);
      if (!source) throw new DOMException("Missing store", "NotFoundError");
      this.working.set(name, {
        keyPath: source.keyPath,
        values:
          mode === "readwrite" ? structuredClone(source.values) : source.values,
      });
    }
  }
  objectStore(name: string): IDBObjectStore {
    return new Obj(this, name) as unknown as IDBObjectStore;
  }
  store(name: string): Store {
    const value = this.working.get(name);
    if (!value) throw new DOMException("Missing store", "NotFoundError");
    return value;
  }
  request<T>(run: () => T): IDBRequest<T> {
    const request = new Req<T>();
    this.pending += 1;
    queueMicrotask(() => {
      if (this.aborted) return;
      try {
        request.ok(run());
      } catch {
        request.fail(new DOMException("Request failed", "UnknownError"));
      } finally {
        this.pending -= 1;
        this.finish();
      }
    });
    return request as unknown as IDBRequest<T>;
  }
  abort(): void {
    this.aborted = true;
    queueMicrotask(() => this.onabort?.(evt()));
  }
  private finish(): void {
    if (this.scheduled || this.aborted || this.pending !== 0) return;
    this.scheduled = true;
    setTimeout(() => {
      if (this.mode === "readwrite" && !this.aborted)
        for (const [name, value] of this.working)
          this.db.stores.set(name, value);
      if (!this.aborted) this.oncomplete?.(evt());
    }, 0);
  }
}
class Obj {
  constructor(
    private readonly tx: Tx,
    private readonly name: string,
  ) {}
  get(key: IDBValidKey): IDBRequest<unknown> {
    return this.tx.request(() => {
      const value = this.tx.store(this.name).values.get(key);
      return value === undefined ? undefined : structuredClone(value);
    });
  }
  getAll(): IDBRequest<unknown[]> {
    return this.tx.request(() =>
      [...this.tx.store(this.name).values.values()].map((value) =>
        structuredClone(value),
      ),
    );
  }
  delete(key: IDBValidKey): IDBRequest<undefined> {
    return this.tx.request(() => {
      this.tx.store(this.name).values.delete(key);
      return undefined;
    });
  }
  add(value: unknown): IDBRequest<IDBValidKey> {
    return this.write(value, true);
  }
  put(value: unknown): IDBRequest<IDBValidKey> {
    return this.write(value, false);
  }
  private write(value: unknown, onlyAdd: boolean): IDBRequest<IDBValidKey> {
    return this.tx.request(() => {
      if (!value || typeof value !== "object")
        throw new DOMException("Value", "DataError");
      const store = this.tx.store(this.name);
      const key = (value as Record<string, IDBValidKey>)[store.keyPath];
      if (typeof key !== "string") throw new DOMException("Key", "DataError");
      if (onlyAdd && store.values.has(key))
        throw new DOMException("Exists", "ConstraintError");
      store.values.set(key, structuredClone(value));
      return key;
    }) as unknown as IDBRequest<IDBValidKey>;
  }
}
class Connection {
  onversionchange: ((event: Event) => void) | null = null;
  readonly objectStoreNames: DOMStringList;
  constructor(private readonly db: Database) {
    this.objectStoreNames = {
      contains: (name: string) => this.db.stores.has(name),
    } as DOMStringList;
  }
  createObjectStore(
    name: string,
    options: IDBObjectStoreParameters = {},
  ): IDBObjectStore {
    if (!this.db.stores.has(name))
      this.db.stores.set(name, {
        keyPath: String(options.keyPath ?? "id"),
        values: new Map(),
      });
    return {} as IDBObjectStore;
  }
  transaction(
    names: string | string[],
    mode: IDBTransactionMode,
  ): IDBTransaction {
    return new Tx(
      this.db,
      mode,
      typeof names === "string" ? [names] : names,
    ) as unknown as IDBTransaction;
  }
  close(): void {}
}
class Factory {
  private readonly databases = new Map<string, Database>();
  private interruptUpgrade = false;
  interruptNextUpgrade(): void {
    this.interruptUpgrade = true;
  }
  seedPreviousVersion(name: string, storageKey: string, value: unknown): void {
    this.databases.set(name, {
      version: 1,
      stores: new Map([
        [
          MOZG_DESKTOP_DOMAIN_STORE,
          { keyPath: "storageKey", values: new Map([[storageKey, value]]) },
        ],
      ]),
    });
  }
  storeNames(name: string): string[] {
    return [...(this.databases.get(name)?.stores.keys() ?? [])].sort();
  }
  read(name: string, storeName: string, key: IDBValidKey): unknown {
    return structuredClone(
      this.databases.get(name)?.stores.get(storeName)?.values.get(key),
    );
  }
  seedStore(
    name: string,
    storeName: string,
    key: IDBValidKey,
    value: unknown,
  ): void {
    const store = this.databases.get(name)?.stores.get(storeName);
    if (!store) throw new Error("Store must exist before seeding.");
    store.values.set(key, structuredClone(value));
  }
  open(name: string, version = 1): IDBOpenDBRequest {
    const request = new Req<IDBDatabase>() as unknown as IDBOpenDBRequest &
      Req<IDBDatabase>;
    queueMicrotask(() => {
      const current = this.databases.get(name);
      const upgrade = !current || current.version < version;
      const db: Database = upgrade
        ? {
            version,
            stores: new Map(
              [...(current?.stores.entries() ?? [])].map(
                ([storeName, store]) => [
                  storeName,
                  {
                    keyPath: store.keyPath,
                    values: structuredClone(store.values),
                  },
                ],
              ),
            ),
          }
        : current;
      const connection = new Connection(db);
      request.result = connection as unknown as IDBDatabase;
      if (upgrade && this.interruptUpgrade) {
        this.interruptUpgrade = false;
        request.error = new DOMException("Interrupted", "AbortError");
        request.onerror?.(evt());
        return;
      }
      if (upgrade) {
        request.onupgradeneeded?.({} as IDBVersionChangeEvent);
        if (current) {
          current.version = db.version;
          current.stores = db.stores;
        } else this.databases.set(name, db);
      }
      request.onsuccess?.(evt());
    });
    return request;
  }
}

describe("IndexedDbCanvasRepository", () => {
  let repository: IndexedDbCanvasRepository;
  let factory: Factory;
  let time: string;
  let id = 0;
  beforeEach(() => {
    factory = new Factory();
    time = "2026-07-31T10:00:00.000Z";
    id = 0;
    repository = new IndexedDbCanvasRepository({
      indexedDb: factory as unknown as IDBFactory,
      databaseName: "local-canvas-tests",
      clock: () => time,
      idGenerator: () => `id-${++id}`,
    });
  });
  it("creates, loads, lists, and returns immutable canonical documents", async () => {
    const canvas = await repository.createCanvas({
      workspaceId: "w1",
      title: "Board",
    });
    expect(factory.storeNames("local-canvas-tests")).toEqual([
      "canvas-assets",
      "canvas-groups",
      "canvas-view-states",
      "canvases",
      "domain-snapshots",
    ]);
    expect(canvas.document).toEqual(createEmptyCanvasDocumentV1());
    expect((await repository.listCanvases("w1"))[0]).not.toHaveProperty(
      "document",
    );
    const loaded = await repository.loadCanvas({
      workspaceId: "w1",
      canvasId: canvas.id,
    });
    expect(loaded).toEqual(canvas);
    canvas.document.nodes.push({
      id: "n",
      kind: "text",
      position: { x: 0, y: 0 },
      size: { width: 1, height: 1 },
      zIndex: 0,
      markdown: "x",
    });
    expect(
      (await repository.loadCanvas({ workspaceId: "w1", canvasId: canvas.id }))
        ?.document.nodes,
    ).toHaveLength(0);
  });
  it("saves with CAS and does not overwrite stale writers", async () => {
    const canvas = await repository.createCanvas({
      workspaceId: "w1",
      title: "Board",
    });
    const document = createEmptyCanvasDocumentV1();
    time = "2026-07-31T10:01:00.000Z";
    expect(
      await repository.saveCanvas({
        workspaceId: "w1",
        canvasId: canvas.id,
        expectedRevision: 1,
        title: "Renamed",
        document,
      }),
    ).toEqual({ status: "saved", revision: 2 });
    expect(
      await repository.saveCanvas({
        workspaceId: "w1",
        canvasId: canvas.id,
        expectedRevision: 1,
        title: "Lost",
        document,
      }),
    ).toEqual({ status: "conflict", revision: 2 });
    expect(
      (await repository.loadCanvas({ workspaceId: "w1", canvasId: canvas.id }))
        ?.title,
    ).toBe("Renamed");
  });
  it("soft deletes and isolates workspace access", async () => {
    const canvas = await repository.createCanvas({
      workspaceId: "w1",
      title: "Board",
    });
    await expect(
      repository.loadCanvas({ workspaceId: "w2", canvasId: canvas.id }),
    ).rejects.toMatchObject({ code: "workspace-mismatch" });
    await repository.softDeleteCanvas({
      workspaceId: "w1",
      canvasId: canvas.id,
    });
    expect(
      await repository.loadCanvas({ workspaceId: "w1", canvasId: canvas.id }),
    ).toBeNull();
    expect(await repository.listCanvases("w1")).toEqual([]);
  });
  it("stores personal view state outside the Canvas revision", async () => {
    const canvas = await repository.createCanvas({
      workspaceId: "w1",
      title: "Board",
    });
    await repository.saveViewState({
      canvasId: canvas.id,
      userId: "u1",
      viewportX: 4,
      viewportY: -2,
      zoom: 1.5,
      updatedAt: time,
    });
    expect(
      await repository.loadViewState({ canvasId: canvas.id, userId: "u1" }),
    ).toMatchObject({ viewportX: 4, zoom: 1.5 });
    expect(
      await repository.loadViewState({ canvasId: canvas.id, userId: "u2" }),
    ).toBeNull();
    expect(
      (await repository.loadCanvas({ workspaceId: "w1", canvasId: canvas.id }))
        ?.revision,
    ).toBe(1);
    await expect(
      repository.saveViewState({
        canvasId: canvas.id,
        userId: "u1",
        viewportX: 0,
        viewportY: 0,
        zoom: 5,
        updatedAt: time,
      }),
    ).rejects.toMatchObject({ code: "invalid-input" });
  });
  it("round-trips image Blobs and soft-deletes assets", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    const asset = await repository.storeImage({
      workspaceId: "w1",
      blob,
      mimeType: "image/png",
      byteSize: blob.size,
      width: 100,
      height: 100,
      checksum: "checksum",
    });
    expect(
      (await repository.loadAsset({ workspaceId: "w1", assetId: asset.id }))
        ?.blob,
    ).toBeInstanceOf(Blob);
    await expect(
      repository.storeImage({
        workspaceId: "w1",
        blob,
        mimeType: "image/gif" as unknown as "image/png",
        byteSize: blob.size,
        width: 1,
        height: 1,
      }),
    ).rejects.toMatchObject({ code: "unsupported-mime" });
    await expect(
      repository.storeImage({
        workspaceId: "w1",
        blob: new Blob([new Uint8Array(21 * 1024 * 1024)]),
        mimeType: "image/png",
        byteSize: 21 * 1024 * 1024,
        width: 1,
        height: 1,
      }),
    ).rejects.toMatchObject({ code: "asset-too-large" });
    await repository.markAssetDeleted({ workspaceId: "w1", assetId: asset.id });
    expect(
      await repository.loadAsset({ workspaceId: "w1", assetId: asset.id }),
    ).toBeNull();
  });
  it("preserves the existing workspace snapshot when Canvas stores are added", async () => {
    const desktop = new IndexedDbDesktopPersistenceAdapter({
      indexedDb: factory as unknown as IDBFactory,
      databaseName: "local-canvas-tests",
      clock: () => time,
    });
    await desktop.initializeWorkspace(
      "workspace-snapshot",
      createDesktopDomainSnapshot(initialDesktopPrototypeState),
    );
    const canvas = await repository.createCanvas({
      workspaceId: "w1",
      title: "Board",
    });
    expect(canvas.revision).toBe(1);
    expect((await desktop.loadWorkspace("workspace-snapshot")).kind).toBe(
      "loaded",
    );
    const freshFactory = new Factory();
    const freshRepository = new IndexedDbCanvasRepository({
      indexedDb: freshFactory as unknown as IDBFactory,
      databaseName: "fresh-local-canvas-tests",
      clock: () => time,
      idGenerator: () => "fresh-id",
    });
    await freshRepository.createCanvas({ workspaceId: "w1", title: "Fresh" });
    const freshDesktop = new IndexedDbDesktopPersistenceAdapter({
      indexedDb: freshFactory as unknown as IDBFactory,
      databaseName: "fresh-local-canvas-tests",
      clock: () => time,
    });
    await freshDesktop.initializeWorkspace(
      "fresh-workspace",
      createDesktopDomainSnapshot(initialDesktopPrototypeState),
    );
    expect((await freshDesktop.loadWorkspace("fresh-workspace")).kind).toBe(
      "loaded",
    );
  });
  it("creates every store, upgrades v1 without rewriting data, and reopens idempotently", async () => {
    const snapshot = createDesktopDomainSnapshot(initialDesktopPrototypeState);
    const envelope = {
      storageVersion: 1,
      storageKey: "legacy",
      revision: 7,
      savedAt: time,
      snapshot,
    };
    factory.seedPreviousVersion("upgrade-tests", "legacy", envelope);
    const upgraded = new IndexedDbCanvasRepository({
      indexedDb: factory as unknown as IDBFactory,
      databaseName: "upgrade-tests",
      clock: () => time,
      idGenerator: () => "upgrade-canvas",
    });
    await upgraded.createCanvas({ workspaceId: "w1", title: "Board" });
    expect(factory.storeNames("upgrade-tests")).toEqual([
      "canvas-assets",
      "canvas-groups",
      "canvas-view-states",
      "canvases",
      "domain-snapshots",
    ]);
    expect(
      factory.read("upgrade-tests", MOZG_DESKTOP_DOMAIN_STORE, "legacy"),
    ).toEqual(envelope);
    upgraded.close();
    const reopened = new IndexedDbCanvasRepository({
      indexedDb: factory as unknown as IDBFactory,
      databaseName: "upgrade-tests",
      clock: () => time,
      idGenerator: () => "second-canvas",
    });
    expect(await reopened.listCanvases("w1")).toHaveLength(1);
    expect(factory.storeNames("upgrade-tests")).toEqual([
      "canvas-assets",
      "canvas-groups",
      "canvas-view-states",
      "canvases",
      "domain-snapshots",
    ]);
  });
  it("does not partially commit an interrupted upgrade", async () => {
    factory.seedPreviousVersion("interrupted-upgrade", "legacy", {
      value: "preserve",
    });
    factory.interruptNextUpgrade();
    const interrupted = new IndexedDbCanvasRepository({
      indexedDb: factory as unknown as IDBFactory,
      databaseName: "interrupted-upgrade",
      clock: () => time,
    });
    await expect(interrupted.listCanvases("w1")).rejects.toMatchObject({
      code: "idb-unavailable",
    });
    expect(factory.storeNames("interrupted-upgrade")).toEqual([
      "domain-snapshots",
    ]);
    const retry = new IndexedDbCanvasRepository({
      indexedDb: factory as unknown as IDBFactory,
      databaseName: "interrupted-upgrade",
      clock: () => time,
      idGenerator: () => "retry",
    });
    await retry.createCanvas({ workspaceId: "w1", title: "Retry" });
    expect(factory.storeNames("interrupted-upgrade")).toHaveLength(5);
    expect(
      factory.read("interrupted-upgrade", MOZG_DESKTOP_DOMAIN_STORE, "legacy"),
    ).toEqual({ value: "preserve" });
  });
  it("keeps duplicate titles safe, scopes lists, orders deterministically, and isolates summaries", async () => {
    const first = await repository.createCanvas({
      workspaceId: "w1",
      title: "Same",
    });
    time = "2026-07-31T10:01:00.000Z";
    const second = await repository.createCanvas({
      workspaceId: "w1",
      title: "Same",
    });
    await repository.createCanvas({
      workspaceId: "w2",
      title: "Other workspace",
    });
    const list = await repository.listCanvases("w1");
    expect(list.map((item) => item.id)).toEqual([first.id, second.id]);
    expect(list.every((item) => !("document" in item))).toBe(true);
    list[0]!.title = "mutated summary";
    expect(
      (await repository.loadCanvas({ workspaceId: "w1", canvasId: second.id }))
        ?.title,
    ).toBe("Same");
  });
  it("protects two independent CAS writers and preserves exact Markdown", async () => {
    const firstRepository = repository;
    const secondRepository = new IndexedDbCanvasRepository({
      indexedDb: factory as unknown as IDBFactory,
      databaseName: "local-canvas-tests",
      clock: () => time,
      idGenerator: () => "other-id",
    });
    const canvas = await firstRepository.createCanvas({
      workspaceId: "w1",
      title: "Board",
    });
    expect(
      (
        await firstRepository.loadCanvas({
          workspaceId: "w1",
          canvasId: canvas.id,
        })
      )?.revision,
    ).toBe(1);
    expect(
      (
        await secondRepository.loadCanvas({
          workspaceId: "w1",
          canvasId: canvas.id,
        })
      )?.revision,
    ).toBe(1);
    const markdown = "  leading\ntrailing  ";
    const winningDocument = {
      schemaVersion: 1 as const,
      nodes: [
        {
          id: "text-1",
          kind: "text" as const,
          position: { x: 0, y: 0 },
          size: { width: 10, height: 10 },
          zIndex: 0,
          markdown,
        },
      ],
      edges: [],
    };
    expect(
      await firstRepository.saveCanvas({
        workspaceId: "w1",
        canvasId: canvas.id,
        expectedRevision: 1,
        title: "Winner",
        document: winningDocument,
      }),
    ).toEqual({ status: "saved", revision: 2 });
    expect(
      await secondRepository.saveCanvas({
        workspaceId: "w1",
        canvasId: canvas.id,
        expectedRevision: 1,
        title: "Loser",
        document: createEmptyCanvasDocumentV1(),
      }),
    ).toEqual({ status: "conflict", revision: 2 });
    const winner = await firstRepository.loadCanvas({
      workspaceId: "w1",
      canvasId: canvas.id,
    });
    expect(winner?.title).toBe("Winner");
    expect((winner?.document.nodes[0] as { markdown: string }).markdown).toBe(
      markdown,
    );
    await expect(
      firstRepository.saveCanvas({
        workspaceId: "w1",
        canvasId: canvas.id,
        expectedRevision: 2,
        title: "Invalid",
        document: {
          schemaVersion: 1,
          nodes: [{ bad: true }],
          edges: [],
        } as never,
      }),
    ).rejects.toMatchObject({ code: "invalid-input" });
    expect(
      (
        await firstRepository.loadCanvas({
          workspaceId: "w1",
          canvasId: canvas.id,
        })
      )?.revision,
    ).toBe(2);
    await expect(
      firstRepository.saveCanvas({
        workspaceId: "w2",
        canvasId: canvas.id,
        expectedRevision: 2,
        title: "Wrong workspace",
        document: winningDocument,
      }),
    ).rejects.toMatchObject({ code: "workspace-mismatch" });
    await firstRepository.softDeleteCanvas({
      workspaceId: "w1",
      canvasId: canvas.id,
    });
    await expect(
      firstRepository.saveCanvas({
        workspaceId: "w1",
        canvasId: canvas.id,
        expectedRevision: 2,
        title: "Deleted",
        document: winningDocument,
      }),
    ).rejects.toMatchObject({ code: "soft-deleted" });
  });
  it("keeps view states per user with last-write-wins and safe missing/deleted behavior", async () => {
    const canvas = await repository.createCanvas({
      workspaceId: "w1",
      title: "Board",
    });
    await repository.saveViewState({
      canvasId: canvas.id,
      userId: "u1",
      viewportX: 1,
      viewportY: 2,
      zoom: 1,
      updatedAt: time,
    });
    await repository.saveViewState({
      canvasId: canvas.id,
      userId: "u1",
      viewportX: 3,
      viewportY: 4,
      zoom: 2,
      updatedAt: "2026-07-31T10:01:00.000Z",
    });
    await repository.saveViewState({
      canvasId: canvas.id,
      userId: "u2",
      viewportX: -3,
      viewportY: -4,
      zoom: 0.5,
      updatedAt: time,
    });
    expect(
      await repository.loadViewState({ canvasId: canvas.id, userId: "u1" }),
    ).toMatchObject({ viewportX: 3, zoom: 2 });
    expect(
      await repository.loadViewState({ canvasId: canvas.id, userId: "u2" }),
    ).toMatchObject({ viewportX: -3, zoom: 0.5 });
    for (const invalid of [
      { viewportX: Number.NaN, viewportY: 0, zoom: 1 },
      { viewportX: 1_000_000_001, viewportY: 0, zoom: 1 },
      { viewportX: 0, viewportY: 0, zoom: 0.09 },
      { viewportX: 0, viewportY: 0, zoom: 4.01 },
    ])
      await expect(
        repository.saveViewState({
          canvasId: canvas.id,
          userId: "u1",
          ...invalid,
          updatedAt: time,
        }),
      ).rejects.toMatchObject({ code: "invalid-input" });
    expect(
      await repository.loadViewState({ canvasId: "missing", userId: "u1" }),
    ).toBeNull();
    await repository.softDeleteCanvas({
      workspaceId: "w1",
      canvasId: canvas.id,
    });
    expect(
      await repository.loadViewState({ canvasId: canvas.id, userId: "u1" }),
    ).toBeNull();
    await expect(
      repository.saveViewState({
        canvasId: canvas.id,
        userId: "u1",
        viewportX: 0,
        viewportY: 0,
        zoom: 1,
        updatedAt: time,
      }),
    ).rejects.toMatchObject({ code: "soft-deleted" });
  });
  it("round-trips PNG/JPEG/WebP bytes and validates isolated assets", async () => {
    const canvas = await repository.createCanvas({
      workspaceId: "w1",
      title: "Asset board",
    });
    const before = await repository.loadCanvas({
      workspaceId: "w1",
      canvasId: canvas.id,
    });
    for (const mimeType of ["image/png", "image/jpeg", "image/webp"] as const) {
      const bytes = new Uint8Array([1, 2, 3, mimeType.length]);
      const blob = new Blob([bytes], { type: mimeType });
      const preview = new Blob([bytes, bytes], { type: "image/webp" });
      const asset = await repository.storeImage({
        workspaceId: "w1",
        blob,
        preview,
        mimeType,
        byteSize: blob.size,
        width: 100,
        height: 200,
      });
      const loaded = await repository.loadAsset({
        workspaceId: "w1",
        assetId: asset.id,
      });
      expect(new Uint8Array(await loaded!.blob.arrayBuffer())).toEqual(bytes);
      expect(new Uint8Array(await loaded!.preview!.arrayBuffer())).toEqual(
        new Uint8Array([...bytes, ...bytes]),
      );
      expect(loaded?.mimeType).toBe(mimeType);
      await expect(
        repository.loadAsset({ workspaceId: "w2", assetId: asset.id }),
      ).rejects.toMatchObject({ code: "workspace-mismatch" });
      await repository.markAssetDeleted({
        workspaceId: "w1",
        assetId: asset.id,
      });
      expect(
        await repository.loadAsset({ workspaceId: "w1", assetId: asset.id }),
      ).toBeNull();
    }
    expect(
      (await repository.loadCanvas({ workspaceId: "w1", canvasId: canvas.id }))
        ?.revision,
    ).toBe(before?.revision);
    expect(
      (await repository.loadCanvas({ workspaceId: "w1", canvasId: canvas.id }))
        ?.document,
    ).toEqual(before?.document);
    await expect(
      repository.storeImage({
        workspaceId: "w1",
        blob: new Blob(["x"], { type: "image/gif" }),
        mimeType: "image/gif" as never,
        byteSize: 1,
        width: 1,
        height: 1,
      }),
    ).rejects.toMatchObject({ code: "unsupported-mime" });
    await expect(
      repository.storeImage({
        workspaceId: "w1",
        blob: new Blob([new Uint8Array(21 * 1024 * 1024)]),
        mimeType: "image/png",
        byteSize: 21 * 1024 * 1024,
        width: 1,
        height: 1,
      }),
    ).rejects.toMatchObject({ code: "asset-too-large" });
    for (const dimensions of [
      { width: 0, height: 1 },
      { width: -1, height: 1 },
      { width: 10_000, height: 4_001 },
    ])
      await expect(
        repository.storeImage({
          workspaceId: "w1",
          blob: new Blob(["x"], { type: "image/png" }),
          mimeType: "image/png",
          byteSize: 1,
          ...dimensions,
        }),
      ).rejects.toMatchObject({ code: "invalid-image-dimensions" });
    expect(JSON.stringify(before?.document)).not.toContain("base64");
  });
  it("differentiates repository errors and matches the cloud contract discriminants", async () => {
    await expect(
      repository.loadCanvas({ workspaceId: "w1", canvasId: "missing" }),
    ).resolves.toBeNull();
    await expect(
      repository.softDeleteCanvas({ workspaceId: "w1", canvasId: "missing" }),
    ).rejects.toMatchObject({ code: "not-found" });
    await expect(
      repository.markAssetDeleted({ workspaceId: "w1", assetId: "missing" }),
    ).rejects.toMatchObject({ code: "asset-not-found" });
    await expect(
      repository.createCanvas({ workspaceId: "w1", title: "   " }),
    ).rejects.toMatchObject({ code: "invalid-input" });
    const transactionFailure = new IndexedDbCanvasRepository({
      indexedDb: factory as unknown as IDBFactory,
      databaseName: "failure",
      clock: () => "not-a-date",
    });
    await expect(
      transactionFailure.createCanvas({ workspaceId: "w1", title: "Board" }),
    ).rejects.toMatchObject({ code: "transaction-failed" });
    const unavailable = new IndexedDbCanvasRepository({
      databaseName: "unavailable",
    });
    await expect(unavailable.listCanvases("w1")).rejects.toMatchObject({
      code: "idb-unavailable",
    });
    const canvas = await repository.createCanvas({
      workspaceId: "w1",
      title: "Board",
    });
    expect(canvas.schemaVersion).toBe(1);
    expect(canvas.document).toEqual(createEmptyCanvasDocumentV1());
    expect(canvas.revision).toBe(1);
    expect(
      await repository.saveCanvas({
        workspaceId: "w1",
        canvasId: canvas.id,
        expectedRevision: 1,
        title: "Saved",
        document: createEmptyCanvasDocumentV1(),
      }),
    ).toEqual({ status: "saved", revision: 2 });
    expect(
      await repository.saveCanvas({
        workspaceId: "w1",
        canvasId: canvas.id,
        expectedRevision: 1,
        title: "Stale",
        document: createEmptyCanvasDocumentV1(),
      }),
    ).toEqual({ status: "conflict", revision: 2 });
  });
  it("rejects corrupt stored Canvas records without silently normalizing them", async () => {
    const canvas = await repository.createCanvas({
      workspaceId: "w1",
      title: "Corruptible",
    });
    factory.seedStore("local-canvas-tests", "canvases", canvas.id, {
      ...canvas,
      document: { schemaVersion: 1, nodes: [{ invalid: true }], edges: [] },
    });
    await expect(
      repository.loadCanvas({ workspaceId: "w1", canvasId: canvas.id }),
    ).rejects.toMatchObject({ code: "invalid-stored-record" });
  });
  it("persists nested groups, supports moves, and promotes children on group archive", async () => {
    const parent = await repository.createCanvasGroup({
      workspaceId: "w1",
      title: "Projects",
    });
    const child = await repository.createCanvasGroup({
      workspaceId: "w1",
      title: "Launch",
      parentGroupId: parent.id,
    });
    const canvas = await repository.createCanvas({
      workspaceId: "w1",
      title: "Brief",
      groupId: child.id,
    });

    expect(await repository.listCanvasGroups("w1")).toEqual([parent, child]);
    expect((await repository.listCanvases("w1"))[0]).toMatchObject({
      id: canvas.id,
      groupId: child.id,
      sortOrder: 0,
    });

    await repository.renameCanvasGroup({
      workspaceId: "w1",
      groupId: child.id,
      title: "Launch renamed",
    });
    await repository.moveCanvasToGroup({
      workspaceId: "w1",
      canvasId: canvas.id,
      groupId: parent.id,
    });
    await expect(
      repository.moveCanvasGroup({
        workspaceId: "w1",
        groupId: parent.id,
        parentGroupId: child.id,
      }),
    ).rejects.toMatchObject({ code: "invalid-input" });

    await repository.softDeleteCanvasGroup({
      workspaceId: "w1",
      groupId: parent.id,
    });
    expect(await repository.listCanvasGroups("w1")).toEqual([
      expect.objectContaining({ id: child.id, parentGroupId: null }),
    ]);
    expect((await repository.listCanvases("w1"))[0]).toMatchObject({
      id: canvas.id,
      groupId: null,
    });

    repository.close();
    const reopened = new IndexedDbCanvasRepository({
      indexedDb: factory as unknown as IDBFactory,
      databaseName: "local-canvas-tests",
      clock: () => time,
      idGenerator: () => "reopened",
    });
    expect(await reopened.listCanvases("w1")).toHaveLength(1);
    expect(await reopened.listCanvasGroups("w1")).toEqual([
      expect.objectContaining({ id: child.id, parentGroupId: null }),
    ]);
  });
});
