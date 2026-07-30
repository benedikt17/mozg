import { beforeEach, describe, expect, it } from "vitest";
import v1Fixture from "./fixtures/desktop-domain-snapshot-v1.json";
import { initialDesktopPrototypeState } from "@/prototype/desktop-state";
import {
  IndexedDbDesktopPersistenceAdapter,
  MOZG_DESKTOP_DOMAIN_STORE,
  MOZG_DESKTOP_STORAGE_VERSION,
} from "@/prototype/persistence/indexeddb-adapter";
import { createDesktopDomainSnapshot } from "@/prototype/persistence/domain-snapshot";
import { DesktopPersistenceError } from "@/prototype/persistence/persistence-adapter";

type StoredDatabase = {
  version: number;
  stores: Map<string, Map<IDBValidKey, unknown>>;
  writeTail: Promise<void>;
};

function event(): Event {
  return { type: "fake-indexeddb" } as Event;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

class FakeRequest<T> {
  result!: T;
  error: DOMException | null = null;
  onsuccess: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  succeed(value: T): void {
    this.result = value;
    queueMicrotask(() => this.onsuccess?.(event()));
  }

  fail(error: DOMException): void {
    this.error = error;
    queueMicrotask(() => this.onerror?.(event()));
  }
}

class FakeTransaction {
  error: DOMException | null = null;
  oncomplete: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onabort: ((event: Event) => void) | null = null;

  private readonly ready: Promise<void>;
  private readonly workingStores = new Map<string, Map<IDBValidKey, unknown>>();
  private releaseWrite?: () => void;
  private pending = 0;
  private completionTimer?: ReturnType<typeof setTimeout>;
  private finished = false;

  constructor(
    private readonly database: StoredDatabase,
    private readonly mode: IDBTransactionMode,
  ) {
    if (mode === "readwrite") {
      let release: (() => void) | undefined;
      const previous = database.writeTail;
      database.writeTail = new Promise<void>((resolve) => {
        release = resolve;
      });
      this.releaseWrite = release;
      this.ready = previous.then(() => {
        for (const [name, store] of database.stores) {
          this.workingStores.set(name, clone(store));
        }
      });
    } else {
      this.ready = Promise.resolve();
    }
  }

  objectStore(name: string): IDBObjectStore {
    if (!this.database.stores.has(name)) {
      throw new DOMException("Object store not found", "NotFoundError");
    }
    return new FakeObjectStore(this, name) as unknown as IDBObjectStore;
  }

  abort(): void {
    if (this.finished) return;
    this.finished = true;
    if (this.completionTimer !== undefined) clearTimeout(this.completionTimer);
    this.releaseWrite?.();
    queueMicrotask(() => this.onabort?.(event()));
  }

  request<T>(operation: () => T): IDBRequest<T> {
    const request = new FakeRequest<T>();
    this.pending += 1;
    void this.ready.then(() => {
      if (this.finished) return;
      try {
        request.succeed(operation());
      } catch (error) {
        const domError =
          error instanceof DOMException
            ? error
            : new DOMException("Request failed", "UnknownError");
        request.fail(domError);
      } finally {
        this.pending -= 1;
        this.scheduleCompletion();
      }
    });
    return request as unknown as IDBRequest<T>;
  }

  store(name: string): Map<IDBValidKey, unknown> {
    const stores =
      this.mode === "readwrite" ? this.workingStores : this.database.stores;
    const store = stores.get(name);
    if (store === undefined)
      throw new DOMException("Missing store", "NotFoundError");
    return store;
  }

  private scheduleCompletion(): void {
    if (this.finished || this.pending !== 0) return;
    if (this.completionTimer !== undefined) clearTimeout(this.completionTimer);
    this.completionTimer = setTimeout(() => {
      if (this.finished || this.pending !== 0) return;
      this.finished = true;
      if (this.mode === "readwrite") {
        this.database.stores = this.workingStores;
        this.releaseWrite?.();
      }
      this.oncomplete?.(event());
    }, 0);
  }
}

class FakeObjectStore {
  constructor(
    private readonly transaction: FakeTransaction,
    private readonly name: string,
  ) {}

  get(key: IDBValidKey): IDBRequest<unknown> {
    return this.transaction.request(() => {
      const value = this.transaction.store(this.name).get(key);
      return value === undefined ? undefined : clone(value);
    });
  }

  add(value: unknown): IDBRequest<IDBValidKey> {
    return this.write(value, true);
  }

  put(value: unknown): IDBRequest<IDBValidKey> {
    return this.write(value, false);
  }

  private write(value: unknown, addOnly: boolean): IDBRequest<IDBValidKey> {
    return this.transaction.request(() => {
      if (
        typeof value !== "object" ||
        value === null ||
        !("storageKey" in value)
      ) {
        throw new DOMException("Missing key", "DataError");
      }
      const key = (value as { storageKey: IDBValidKey }).storageKey;
      const store = this.transaction.store(this.name);
      if (addOnly && store.has(key)) {
        throw new DOMException("Key exists", "ConstraintError");
      }
      store.set(key, clone(value));
      return key;
    });
  }
}

class FakeDatabase {
  onversionchange: ((event: Event) => void) | null = null;
  readonly objectStoreNames: DOMStringList;

  constructor(private readonly stored: StoredDatabase) {
    this.objectStoreNames = {
      contains: (name: string) => stored.stores.has(name),
    } as DOMStringList;
  }

  createObjectStore(name: string): IDBObjectStore {
    if (!this.stored.stores.has(name)) this.stored.stores.set(name, new Map());
    return {} as IDBObjectStore;
  }

  transaction(_name: string, mode: IDBTransactionMode): IDBTransaction {
    const transaction = new FakeTransaction(this.stored, mode);
    return transaction as unknown as IDBTransaction;
  }

  close(): void {}
}

class FakeOpenRequest extends FakeRequest<IDBDatabase> {
  onupgradeneeded: ((event: IDBVersionChangeEvent) => void) | null = null;
  onblocked: ((event: IDBVersionChangeEvent) => void) | null = null;
}

class FocusedIndexedDbFactory {
  private readonly databases = new Map<string, StoredDatabase>();

  open(name: string, version = 1): IDBOpenDBRequest {
    const request = new FakeOpenRequest();
    queueMicrotask(() => {
      let stored = this.databases.get(name);
      const upgrade = stored === undefined || stored.version < version;
      if (stored === undefined) {
        stored = { version, stores: new Map(), writeTail: Promise.resolve() };
        this.databases.set(name, stored);
      } else {
        stored.version = version;
      }
      const database = new FakeDatabase(stored);
      request.result = database as unknown as IDBDatabase;
      if (upgrade) request.onupgradeneeded?.(event() as IDBVersionChangeEvent);
      request.succeed(database as unknown as IDBDatabase);
    });
    return request as unknown as IDBOpenDBRequest;
  }

  seed(databaseName: string, storageKey: string, value: unknown): void {
    const database = this.databases.get(databaseName);
    if (database === undefined)
      throw new Error("Database must be opened first.");
    const store = database.stores.get(MOZG_DESKTOP_DOMAIN_STORE);
    if (store === undefined) throw new Error("Object store must exist.");
    store.set(storageKey, clone(value));
  }

  raw(databaseName: string, storageKey: string): unknown {
    return clone(
      this.databases
        .get(databaseName)
        ?.stores.get(MOZG_DESKTOP_DOMAIN_STORE)
        ?.get(storageKey),
    );
  }
}

const DATABASE_NAME = "desktop-indexeddb-adapter-tests";
const STORAGE_KEY = "local-workspace";
const SAVED_AT = "2026-07-23T08:00:00.000Z";

function snapshot() {
  return createDesktopDomainSnapshot(initialDesktopPrototypeState);
}

function changedSnapshot(title = "Persisted title") {
  const value = snapshot();
  if (value.tasks[0]) value.tasks[0].title = title;
  return value;
}

function expectPersistenceError(
  error: unknown,
  code: DesktopPersistenceError["code"],
): boolean {
  expect(error).toBeInstanceOf(DesktopPersistenceError);
  expect(error).toMatchObject({ code });
  return true;
}

describe("IndexedDbDesktopPersistenceAdapter", () => {
  let factory: FocusedIndexedDbFactory;
  let adapter: IndexedDbDesktopPersistenceAdapter;

  beforeEach(() => {
    factory = new FocusedIndexedDbFactory();
    adapter = new IndexedDbDesktopPersistenceAdapter({
      indexedDb: factory as unknown as IDBFactory,
      databaseName: DATABASE_NAME,
      clock: () => SAVED_AT,
    });
  });

  it("returns empty for a missing workspace", async () => {
    await expect(adapter.loadWorkspace(STORAGE_KEY)).resolves.toEqual({
      kind: "empty",
    });
  });

  it("initializes revision 1 and loads the validated snapshot", async () => {
    const value = snapshot();
    await expect(
      adapter.initializeWorkspace(STORAGE_KEY, value),
    ).resolves.toEqual({
      revision: 1,
      savedAt: SAVED_AT,
    });
    await expect(adapter.loadWorkspace(STORAGE_KEY)).resolves.toEqual({
      kind: "loaded",
      snapshot: value,
      revision: 1,
      savedAt: SAVED_AT,
    });
  });

  it("does not overwrite an initialized workspace", async () => {
    const original = snapshot();
    await adapter.initializeWorkspace(STORAGE_KEY, original);
    await expect(
      adapter.initializeWorkspace(STORAGE_KEY, changedSnapshot()),
    ).rejects.toSatisfy((error: unknown) =>
      expectPersistenceError(error, "already-initialized"),
    );
    await expect(adapter.loadWorkspace(STORAGE_KEY)).resolves.toMatchObject({
      snapshot: original,
      revision: 1,
    });
  });

  it("isolates multiple storage keys", async () => {
    await adapter.initializeWorkspace("first", changedSnapshot("First"));
    await adapter.initializeWorkspace("second", changedSnapshot("Second"));
    const first = await adapter.loadWorkspace("first");
    const second = await adapter.loadWorkspace("second");
    expect(first.kind === "loaded" && first.snapshot.tasks[0]?.title).toBe(
      "First",
    );
    expect(second.kind === "loaded" && second.snapshot.tasks[0]?.title).toBe(
      "Second",
    );
  });

  it("saves a new snapshot and increments revisions monotonically", async () => {
    await adapter.initializeWorkspace(STORAGE_KEY, snapshot());
    await expect(
      adapter.saveWorkspace(STORAGE_KEY, changedSnapshot("Revision 2"), 1),
    ).resolves.toMatchObject({ revision: 2 });
    await expect(
      adapter.saveWorkspace(STORAGE_KEY, changedSnapshot("Revision 3"), 2),
    ).resolves.toMatchObject({ revision: 3 });
    const loaded = await adapter.loadWorkspace(STORAGE_KEY);
    expect(loaded).toMatchObject({ revision: 3 });
    expect(loaded.kind === "loaded" && loaded.snapshot.tasks[0]?.title).toBe(
      "Revision 3",
    );
  });

  it("rejects a stale revision without changing stored data", async () => {
    await adapter.initializeWorkspace(STORAGE_KEY, snapshot());
    await adapter.saveWorkspace(STORAGE_KEY, changedSnapshot("Winner"), 1);
    await expect(
      adapter.saveWorkspace(STORAGE_KEY, changedSnapshot("Stale"), 1),
    ).rejects.toSatisfy((error: unknown) => {
      expectPersistenceError(error, "conflict");
      expect(error).toMatchObject({ expectedRevision: 1, actualRevision: 2 });
      return true;
    });
    const loaded = await adapter.loadWorkspace(STORAGE_KEY);
    expect(loaded).toMatchObject({ revision: 2 });
    expect(loaded.kind === "loaded" && loaded.snapshot.tasks[0]?.title).toBe(
      "Winner",
    );
  });

  it("rejects save before initialization", async () => {
    await expect(
      adapter.saveWorkspace(STORAGE_KEY, snapshot(), 1),
    ).rejects.toSatisfy((error: unknown) =>
      expectPersistenceError(error, "not-initialized"),
    );
  });

  it("serializes two adapters and detects their revision conflict", async () => {
    const second = new IndexedDbDesktopPersistenceAdapter({
      indexedDb: factory as unknown as IDBFactory,
      databaseName: DATABASE_NAME,
      clock: () => SAVED_AT,
    });
    await adapter.initializeWorkspace(STORAGE_KEY, snapshot());
    const [firstLoad, secondLoad] = await Promise.all([
      adapter.loadWorkspace(STORAGE_KEY),
      second.loadWorkspace(STORAGE_KEY),
    ]);
    expect(firstLoad).toMatchObject({ revision: 1 });
    expect(secondLoad).toMatchObject({ revision: 1 });
    await adapter.saveWorkspace(
      STORAGE_KEY,
      changedSnapshot("First adapter"),
      1,
    );
    await expect(
      second.saveWorkspace(STORAGE_KEY, changedSnapshot("Second adapter"), 1),
    ).rejects.toSatisfy((error: unknown) =>
      expectPersistenceError(error, "conflict"),
    );
    const winner = await second.loadWorkspace(STORAGE_KEY);
    expect(winner).toMatchObject({ revision: 2 });
    expect(winner.kind === "loaded" && winner.snapshot.tasks[0]?.title).toBe(
      "First adapter",
    );
  });

  it.each(["", "   "])("rejects invalid storage key %j", async (storageKey) => {
    await expect(adapter.loadWorkspace(storageKey)).rejects.toSatisfy(
      (error: unknown) => expectPersistenceError(error, "invalid-storage-key"),
    );
  });

  it("validates snapshots before opening or writing", async () => {
    const invalid = snapshot();
    invalid.projects = [];
    await expect(
      adapter.initializeWorkspace(STORAGE_KEY, invalid),
    ).rejects.toSatisfy((error: unknown) =>
      expectPersistenceError(error, "invalid-snapshot"),
    );
    await expect(adapter.loadWorkspace(STORAGE_KEY)).resolves.toEqual({
      kind: "empty",
    });
  });

  it("reports corrupt envelopes without deleting them", async () => {
    await adapter.loadWorkspace(STORAGE_KEY);
    const corrupt = { storageKey: STORAGE_KEY, storageVersion: 1 };
    factory.seed(DATABASE_NAME, STORAGE_KEY, corrupt);
    await expect(adapter.loadWorkspace(STORAGE_KEY)).rejects.toSatisfy(
      (error: unknown) => expectPersistenceError(error, "corrupt-data"),
    );
    expect(factory.raw(DATABASE_NAME, STORAGE_KEY)).toEqual(corrupt);
  });

  it("distinguishes unsupported storage versions", async () => {
    await adapter.loadWorkspace(STORAGE_KEY);
    factory.seed(DATABASE_NAME, STORAGE_KEY, {
      storageVersion: 2,
      storageKey: STORAGE_KEY,
      revision: 1,
      savedAt: SAVED_AT,
      snapshot: snapshot(),
    });
    await expect(adapter.loadWorkspace(STORAGE_KEY)).rejects.toSatisfy(
      (error: unknown) => expectPersistenceError(error, "unsupported-version"),
    );
  });

  it("distinguishes unsupported domain schema versions", async () => {
    await adapter.loadWorkspace(STORAGE_KEY);
    factory.seed(DATABASE_NAME, STORAGE_KEY, {
      storageVersion: MOZG_DESKTOP_STORAGE_VERSION,
      storageKey: STORAGE_KEY,
      revision: 1,
      savedAt: SAVED_AT,
      snapshot: { ...snapshot(), schemaVersion: 3 },
    });
    await expect(adapter.loadWorkspace(STORAGE_KEY)).rejects.toSatisfy(
      (error: unknown) => expectPersistenceError(error, "unsupported-version"),
    );
  });

  it("loads a v1 envelope as v2 and writes the next save in v2", async () => {
    await adapter.loadWorkspace(STORAGE_KEY);
    factory.seed(DATABASE_NAME, STORAGE_KEY, {
      storageVersion: MOZG_DESKTOP_STORAGE_VERSION,
      storageKey: STORAGE_KEY,
      revision: 1,
      savedAt: SAVED_AT,
      snapshot: v1Fixture,
    });

    const loaded = await adapter.loadWorkspace(STORAGE_KEY);
    expect(loaded).toMatchObject({ kind: "loaded", revision: 1 });
    if (loaded.kind !== "loaded") return;
    expect(loaded.snapshot.schemaVersion).toBe(2);
    expect(loaded.snapshot.tasks[0]?.subtasks[0]?.detailsMarkdown).toBe("");

    await adapter.saveWorkspace(STORAGE_KEY, loaded.snapshot, 1);
    expect(factory.raw(DATABASE_NAME, STORAGE_KEY)).toMatchObject({
      revision: 2,
      snapshot: {
        schemaVersion: 2,
        tasks: [{ subtasks: [{ detailsMarkdown: "" }] }],
      },
    });
  });

  it("reports invalid stored relations as corrupt data", async () => {
    await adapter.loadWorkspace(STORAGE_KEY);
    const invalid = snapshot();
    if (invalid.tasks[0]) invalid.tasks[0].projectId = "missing-project";
    factory.seed(DATABASE_NAME, STORAGE_KEY, {
      storageVersion: MOZG_DESKTOP_STORAGE_VERSION,
      storageKey: STORAGE_KEY,
      revision: 1,
      savedAt: SAVED_AT,
      snapshot: invalid,
    });
    await expect(adapter.loadWorkspace(STORAGE_KEY)).rejects.toSatisfy(
      (error: unknown) => expectPersistenceError(error, "corrupt-data"),
    );
  });

  it("isolates initialized and saved inputs from later mutation", async () => {
    const initial = snapshot();
    await adapter.initializeWorkspace(STORAGE_KEY, initial);
    if (initial.tasks[0]) initial.tasks[0].title = "Mutated input";
    const afterInitialize = await adapter.loadWorkspace(STORAGE_KEY);
    expect(
      afterInitialize.kind === "loaded" &&
        afterInitialize.snapshot.tasks[0]?.title,
    ).not.toBe("Mutated input");
    const saved = changedSnapshot("Saved copy");
    await adapter.saveWorkspace(STORAGE_KEY, saved, 1);
    if (saved.tasks[0]) saved.tasks[0].title = "Mutated saved input";
    const afterSave = await adapter.loadWorkspace(STORAGE_KEY);
    expect(
      afterSave.kind === "loaded" && afterSave.snapshot.tasks[0]?.title,
    ).toBe("Saved copy");
  });

  it("isolates loaded snapshots from subsequent loads", async () => {
    await adapter.initializeWorkspace(STORAGE_KEY, snapshot());
    const loaded = await adapter.loadWorkspace(STORAGE_KEY);
    if (loaded.kind === "loaded" && loaded.snapshot.tasks[0]) {
      loaded.snapshot.tasks[0].title = "Mutated load";
    }
    const reloaded = await adapter.loadWorkspace(STORAGE_KEY);
    expect(
      reloaded.kind === "loaded" && reloaded.snapshot.tasks[0]?.title,
    ).not.toBe("Mutated load");
  });

  it("allows close before open, repeated close, and reopening", async () => {
    adapter.close();
    adapter.close();
    await adapter.initializeWorkspace(STORAGE_KEY, snapshot());
    adapter.close();
    adapter.close();
    await expect(adapter.loadWorkspace(STORAGE_KEY)).resolves.toMatchObject({
      kind: "loaded",
      revision: 1,
    });
  });

  it("reports unavailable IndexedDB only when used", async () => {
    const unavailable = new IndexedDbDesktopPersistenceAdapter({
      databaseName: "unavailable",
    });
    unavailable.close();
    await expect(unavailable.loadWorkspace(STORAGE_KEY)).rejects.toSatisfy(
      (error: unknown) => expectPersistenceError(error, "unavailable"),
    );
  });

  it("maps a blocked database open to a typed error", async () => {
    const blockedFactory = {
      open: () => {
        const request = new FakeOpenRequest();
        queueMicrotask(() =>
          request.onblocked?.(event() as IDBVersionChangeEvent),
        );
        return request as unknown as IDBOpenDBRequest;
      },
    } as unknown as IDBFactory;
    const blocked = new IndexedDbDesktopPersistenceAdapter({
      indexedDb: blockedFactory,
      databaseName: "blocked",
    });

    await expect(blocked.loadWorkspace(STORAGE_KEY)).rejects.toSatisfy(
      (error: unknown) => expectPersistenceError(error, "blocked"),
    );
  });

  it("stores a versioned envelope rather than a bare snapshot", async () => {
    await adapter.initializeWorkspace(STORAGE_KEY, snapshot());
    expect(factory.raw(DATABASE_NAME, STORAGE_KEY)).toMatchObject({
      storageVersion: 1,
      storageKey: STORAGE_KEY,
      revision: 1,
      savedAt: SAVED_AT,
      snapshot: { schemaVersion: 2 },
    });
  });
});
