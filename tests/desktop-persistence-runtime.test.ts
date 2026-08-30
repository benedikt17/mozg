import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialDesktopPrototypeState } from "@/prototype/desktop-state";
import {
  DESKTOP_AUTOSAVE_DEBOUNCE_MS,
  DESKTOP_MVP_STORAGE_KEY,
  DesktopPersistenceRuntime,
  fingerprintDesktopDomainSnapshot,
  type DesktopPersistenceLifecycle,
} from "@/prototype/persistence/desktop-persistence-runtime";
import {
  createDesktopDomainSnapshot,
  type DesktopDomainSnapshot,
} from "@/prototype/persistence/domain-snapshot";
import {
  DesktopPersistenceError,
  type DesktopPersistenceAdapter,
  type DesktopPersistenceLoadResult,
  type DesktopPersistenceSaveResult,
} from "@/prototype/persistence/persistence-adapter";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

class FakeDesktopPersistenceAdapter implements DesktopPersistenceAdapter {
  readonly loadCalls: string[] = [];
  readonly initializeCalls: Array<{
    storageKey: string;
    snapshot: DesktopDomainSnapshot;
  }> = [];
  readonly saveCalls: Array<{
    storageKey: string;
    snapshot: DesktopDomainSnapshot;
    expectedRevision: number;
  }> = [];
  closeCalls = 0;
  concurrentSaves = 0;
  maximumConcurrentSaves = 0;

  private readonly loads: Array<() => Promise<DesktopPersistenceLoadResult>> =
    [];
  private readonly initializations: Array<
    () => Promise<DesktopPersistenceSaveResult>
  > = [];
  private readonly saves: Array<() => Promise<DesktopPersistenceSaveResult>> =
    [];

  queueLoad(
    result:
      DesktopPersistenceLoadResult | Promise<DesktopPersistenceLoadResult>,
  ): void {
    this.loads.push(() => Promise.resolve(result));
  }

  queueLoadError(error: unknown): void {
    this.loads.push(() => Promise.reject(error));
  }

  queueInitialize(
    result:
      DesktopPersistenceSaveResult | Promise<DesktopPersistenceSaveResult>,
  ): void {
    this.initializations.push(() => Promise.resolve(result));
  }

  queueInitializeError(error: unknown): void {
    this.initializations.push(() => Promise.reject(error));
  }

  queueSave(
    result:
      DesktopPersistenceSaveResult | Promise<DesktopPersistenceSaveResult>,
  ): void {
    this.saves.push(() => Promise.resolve(result));
  }

  queueSaveError(error: unknown): void {
    this.saves.push(() => Promise.reject(error));
  }

  loadWorkspace(storageKey: string): Promise<DesktopPersistenceLoadResult> {
    this.loadCalls.push(storageKey);
    return (this.loads.shift() ?? (() => Promise.resolve({ kind: "empty" })))();
  }

  initializeWorkspace(
    storageKey: string,
    snapshot: DesktopDomainSnapshot,
  ): Promise<DesktopPersistenceSaveResult> {
    this.initializeCalls.push({
      storageKey,
      snapshot: structuredClone(snapshot),
    });
    return (
      this.initializations.shift() ??
      (() => Promise.resolve({ revision: 1, savedAt: "seeded" }))
    )();
  }

  async saveWorkspace(
    storageKey: string,
    snapshot: DesktopDomainSnapshot,
    expectedRevision: number,
  ): Promise<DesktopPersistenceSaveResult> {
    this.saveCalls.push({
      storageKey,
      snapshot: structuredClone(snapshot),
      expectedRevision,
    });
    this.concurrentSaves += 1;
    this.maximumConcurrentSaves = Math.max(
      this.maximumConcurrentSaves,
      this.concurrentSaves,
    );
    try {
      return await (
        this.saves.shift() ??
        (() =>
          Promise.resolve({
            revision: expectedRevision + 1,
            savedAt: `saved-${expectedRevision + 1}`,
          }))
      )();
    } finally {
      this.concurrentSaves -= 1;
    }
  }

  close(): void {
    this.closeCalls += 1;
  }
}

class SharedCasStore {
  snapshot = initialSnapshot();
  revision = 9;
  readonly saveCalls: Array<{ expectedRevision: number; title: string }> = [];
}

class SharedCasAdapter implements DesktopPersistenceAdapter {
  constructor(private readonly store: SharedCasStore) {}

  loadWorkspace(): Promise<DesktopPersistenceLoadResult> {
    return Promise.resolve({
      kind: "loaded",
      snapshot: structuredClone(this.store.snapshot),
      revision: this.store.revision,
      savedAt: `revision-${this.store.revision}`,
    });
  }

  loadLatestWorkspace(): Promise<DesktopPersistenceLoadResult> {
    return this.loadWorkspace();
  }

  initializeWorkspace(): Promise<DesktopPersistenceSaveResult> {
    throw new Error("The shared CAS test starts from an existing snapshot.");
  }

  saveWorkspace(
    _storageKey: string,
    snapshot: DesktopDomainSnapshot,
    expectedRevision: number,
  ): Promise<DesktopPersistenceSaveResult> {
    this.store.saveCalls.push({
      expectedRevision,
      title: snapshot.tasks[0]?.title ?? "",
    });
    if (expectedRevision !== this.store.revision) {
      return Promise.reject(
        new DesktopPersistenceError("conflict", "stale revision", {
          expectedRevision,
          actualRevision: this.store.revision,
        }),
      );
    }
    this.store.snapshot = structuredClone(snapshot);
    this.store.revision += 1;
    return Promise.resolve({
      revision: this.store.revision,
      savedAt: `revision-${this.store.revision}`,
    });
  }

  close(): void {}
}

function initialSnapshot(): DesktopDomainSnapshot {
  return createDesktopDomainSnapshot(initialDesktopPrototypeState);
}

function changedSnapshot(title: string): DesktopDomainSnapshot {
  const snapshot = initialSnapshot();
  if (snapshot.tasks[0]) snapshot.tasks[0].title = title;
  return snapshot;
}

function createRuntime(
  adapter: DesktopPersistenceAdapter,
  options: {
    hydrate?: (snapshot: DesktopDomainSnapshot) => void;
    lifecycle?: (value: DesktopPersistenceLifecycle) => void;
  } = {},
): DesktopPersistenceRuntime {
  return new DesktopPersistenceRuntime({
    adapter,
    initialSnapshot: initialSnapshot(),
    onHydrate: options.hydrate ?? (() => undefined),
    onLifecycleChange: options.lifecycle ?? (() => undefined),
  });
}

describe("DesktopPersistenceRuntime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("hydrates loaded storage before enabling autosave", async () => {
    const adapter = new FakeDesktopPersistenceAdapter();
    const loaded = changedSnapshot("Loaded source of truth");
    const load = deferred<DesktopPersistenceLoadResult>();
    const events: string[] = [];
    adapter.queueLoad(load.promise);
    const runtime = createRuntime(adapter, {
      hydrate: () => events.push("hydrate"),
      lifecycle: (value) => events.push(value.status),
    });

    const startup = runtime.start();
    runtime.observeSnapshot(initialSnapshot());
    await vi.advanceTimersByTimeAsync(DESKTOP_AUTOSAVE_DEBOUNCE_MS);
    expect(adapter.saveCalls).toHaveLength(0);
    load.resolve({
      kind: "loaded",
      snapshot: loaded,
      revision: 7,
      savedAt: "loaded-at",
    });
    await startup;

    expect(events.indexOf("hydrate")).toBeLessThan(events.lastIndexOf("ready"));
    expect(runtime.lifecycle).toEqual({
      status: "ready",
      revision: 7,
      savedAt: "loaded-at",
    });
    expect(adapter.initializeCalls).toHaveLength(0);
    expect(adapter.saveCalls).toHaveLength(0);
  });

  it("initializes empty storage exactly once with revision 1", async () => {
    const adapter = new FakeDesktopPersistenceAdapter();
    adapter.queueLoad({ kind: "empty" });
    adapter.queueInitialize({ revision: 1, savedAt: "seeded-at" });
    const runtime = createRuntime(adapter);

    await Promise.all([runtime.start(), runtime.start()]);

    expect(adapter.loadCalls).toEqual([DESKTOP_MVP_STORAGE_KEY]);
    expect(adapter.initializeCalls).toHaveLength(1);
    expect(adapter.initializeCalls[0]?.snapshot).toEqual(initialSnapshot());
    expect(runtime.lifecycle).toEqual({
      status: "ready",
      revision: 1,
      savedAt: "seeded-at",
    });
  });

  it("reloads persisted data after an already-initialized race", async () => {
    const adapter = new FakeDesktopPersistenceAdapter();
    const winner = changedSnapshot("Other initializer won");
    const hydrated: DesktopDomainSnapshot[] = [];
    adapter.queueLoad({ kind: "empty" });
    adapter.queueInitializeError(
      new DesktopPersistenceError("already-initialized", "race"),
    );
    adapter.queueLoad({
      kind: "loaded",
      snapshot: winner,
      revision: 1,
      savedAt: "winner-at",
    });

    await createRuntime(adapter, {
      hydrate: (snapshot) => hydrated.push(snapshot),
    }).start();

    expect(adapter.initializeCalls).toHaveLength(1);
    expect(adapter.loadCalls).toHaveLength(2);
    expect(hydrated).toEqual([winner]);
  });

  it.each(["corrupt-data", "unsupported-version"] as const)(
    "does not seed after a %s load error",
    async (code) => {
      const adapter = new FakeDesktopPersistenceAdapter();
      adapter.queueLoadError(new DesktopPersistenceError(code, code));
      const runtime = createRuntime(adapter);

      await runtime.start();

      expect(runtime.lifecycle).toMatchObject({
        status: "load-error",
        error: { code },
      });
      expect(adapter.initializeCalls).toHaveLength(0);
    },
  );

  it("retries a temporary load error without reloading the page", async () => {
    const adapter = new FakeDesktopPersistenceAdapter();
    adapter.queueLoadError(new DesktopPersistenceError("unavailable", "down"));
    adapter.queueLoad({ kind: "empty" });
    adapter.queueInitialize({ revision: 1, savedAt: "recovered" });
    const runtime = createRuntime(adapter);
    await runtime.start();

    await runtime.retryLoad();

    expect(adapter.closeCalls).toBe(1);
    expect(adapter.loadCalls).toHaveLength(2);
    expect(runtime.lifecycle).toMatchObject({ status: "ready", revision: 1 });
  });

  it("blocks a structurally valid snapshot that hydration cannot apply", async () => {
    const adapter = new FakeDesktopPersistenceAdapter();
    const empty = initialSnapshot();
    empty.projects = [];
    adapter.queueLoad({
      kind: "loaded",
      snapshot: empty,
      revision: 2,
      savedAt: "empty-at",
    });
    const runtime = createRuntime(adapter);

    await runtime.start();

    expect(runtime.lifecycle).toMatchObject({
      status: "load-error",
      error: { code: "corrupt-data" },
    });
  });

  it("does not save an unchanged or session-only-equivalent snapshot", async () => {
    const adapter = new FakeDesktopPersistenceAdapter();
    adapter.queueLoad({
      kind: "loaded",
      snapshot: initialSnapshot(),
      revision: 3,
      savedAt: "loaded",
    });
    const runtime = createRuntime(adapter);
    await runtime.start();

    runtime.observeSnapshot(structuredClone(initialSnapshot()));
    await vi.advanceTimersByTimeAsync(DESKTOP_AUTOSAVE_DEBOUNCE_MS * 2);

    expect(adapter.saveCalls).toHaveLength(0);
  });

  it("debounces rapid domain changes and saves only the latest snapshot", async () => {
    const adapter = new FakeDesktopPersistenceAdapter();
    adapter.queueLoad({
      kind: "loaded",
      snapshot: initialSnapshot(),
      revision: 4,
      savedAt: "loaded",
    });
    const runtime = createRuntime(adapter);
    await runtime.start();

    runtime.observeSnapshot(changedSnapshot("First edit"));
    await vi.advanceTimersByTimeAsync(400);
    runtime.observeSnapshot(changedSnapshot("Latest edit"));
    await vi.advanceTimersByTimeAsync(599);
    expect(adapter.saveCalls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);

    expect(adapter.saveCalls).toHaveLength(1);
    expect(adapter.saveCalls[0]?.expectedRevision).toBe(4);
    expect(adapter.saveCalls[0]?.snapshot.tasks[0]?.title).toBe("Latest edit");
    expect(runtime.lifecycle).toMatchObject({ status: "ready", revision: 5 });
  });

  it("serializes a change made during an in-flight save", async () => {
    const adapter = new FakeDesktopPersistenceAdapter();
    const firstSave = deferred<DesktopPersistenceSaveResult>();
    adapter.queueLoad({
      kind: "loaded",
      snapshot: initialSnapshot(),
      revision: 1,
      savedAt: "loaded",
    });
    adapter.queueSave(firstSave.promise);
    adapter.queueSave({ revision: 3, savedAt: "third" });
    const runtime = createRuntime(adapter);
    await runtime.start();

    runtime.observeSnapshot(changedSnapshot("While idle"));
    await vi.advanceTimersByTimeAsync(DESKTOP_AUTOSAVE_DEBOUNCE_MS);
    expect(adapter.saveCalls).toHaveLength(1);
    runtime.observeSnapshot(changedSnapshot("While saving"));
    expect(adapter.saveCalls).toHaveLength(1);
    firstSave.resolve({ revision: 2, savedAt: "second" });
    await firstSave.promise;
    await vi.runAllTimersAsync();
    await Promise.resolve();

    expect(adapter.saveCalls).toHaveLength(2);
    expect(adapter.saveCalls.map((call) => call.expectedRevision)).toEqual([
      1, 2,
    ]);
    expect(adapter.saveCalls[1]?.snapshot.tasks[0]?.title).toBe("While saving");
    expect(adapter.maximumConcurrentSaves).toBe(1);
    expect(runtime.lifecycle).toMatchObject({ status: "ready", revision: 3 });
  });

  it("keeps the latest pending snapshot after a failed save and retries it", async () => {
    const adapter = new FakeDesktopPersistenceAdapter();
    adapter.queueLoad({
      kind: "loaded",
      snapshot: initialSnapshot(),
      revision: 5,
      savedAt: "loaded",
    });
    adapter.queueSaveError(
      new DesktopPersistenceError("transaction-failed", "disk"),
    );
    adapter.queueSave({ revision: 6, savedAt: "retried" });
    const runtime = createRuntime(adapter);
    await runtime.start();
    runtime.observeSnapshot(changedSnapshot("Failed version"));
    await vi.advanceTimersByTimeAsync(DESKTOP_AUTOSAVE_DEBOUNCE_MS);
    await Promise.resolve();

    expect(runtime.lifecycle).toMatchObject({
      status: "save-error",
      revision: 5,
      error: { code: "transaction-failed" },
    });
    runtime.observeSnapshot(changedSnapshot("Latest retry version"));
    await runtime.retrySave();

    expect(adapter.saveCalls).toHaveLength(2);
    expect(adapter.saveCalls[1]?.expectedRevision).toBe(5);
    expect(adapter.saveCalls[1]?.snapshot.tasks[0]?.title).toBe(
      "Latest retry version",
    );
    expect(runtime.lifecycle).toMatchObject({ status: "ready", revision: 6 });
  });

  it("stops automatic retries after a revision conflict", async () => {
    const adapter = new FakeDesktopPersistenceAdapter();
    adapter.queueLoad({
      kind: "loaded",
      snapshot: initialSnapshot(),
      revision: 2,
      savedAt: "loaded",
    });
    adapter.queueSaveError(new DesktopPersistenceError("conflict", "stale"));
    const runtime = createRuntime(adapter);
    await runtime.start();
    runtime.observeSnapshot(changedSnapshot("Local conflict"));
    await vi.advanceTimersByTimeAsync(DESKTOP_AUTOSAVE_DEBOUNCE_MS);
    await vi.advanceTimersByTimeAsync(DESKTOP_AUTOSAVE_DEBOUNCE_MS * 5);

    expect(adapter.saveCalls).toHaveLength(1);
    expect(runtime.lifecycle).toMatchObject({
      status: "conflict",
      error: { code: "conflict" },
    });
  });

  it("proves the two-runtime CAS winner and visible stale conflict lifecycle", async () => {
    const store = new SharedCasStore();
    const runtimeA = createRuntime(new SharedCasAdapter(store));
    const runtimeB = createRuntime(new SharedCasAdapter(store));

    await Promise.all([runtimeA.start(), runtimeB.start()]);
    expect(runtimeA.lifecycle).toMatchObject({ status: "ready", revision: 9 });
    expect(runtimeB.lifecycle).toMatchObject({ status: "ready", revision: 9 });

    runtimeA.observeSnapshot(changedSnapshot("Tab A winner"));
    await vi.advanceTimersByTimeAsync(DESKTOP_AUTOSAVE_DEBOUNCE_MS);
    expect(runtimeA.lifecycle).toMatchObject({ status: "ready", revision: 10 });

    runtimeB.observeSnapshot(changedSnapshot("Tab B stale local edit"));
    await vi.advanceTimersByTimeAsync(DESKTOP_AUTOSAVE_DEBOUNCE_MS);
    expect(runtimeB.lifecycle).toMatchObject({
      status: "conflict",
      revision: 9,
      error: { code: "conflict", expectedRevision: 9, actualRevision: 10 },
    });
    expect(store.saveCalls).toEqual([
      { expectedRevision: 9, title: "Tab A winner" },
      { expectedRevision: 9, title: "Tab B stale local edit" },
    ]);

    await runtimeB.retrySave();
    await vi.advanceTimersByTimeAsync(DESKTOP_AUTOSAVE_DEBOUNCE_MS * 2);
    expect(store.saveCalls).toHaveLength(2);
    expect(runtimeB.lifecycle).toMatchObject({ status: "conflict" });

    const reloaded = createRuntime(new SharedCasAdapter(store));
    await reloaded.start();
    expect(reloaded.lifecycle).toMatchObject({ status: "ready", revision: 10 });
    expect(store.snapshot.tasks[0]?.title).toBe("Tab A winner");
  });

  it("lets the losing editor explicitly save the preserved local snapshot", async () => {
    const store = new SharedCasStore();
    const runtimeA = createRuntime(new SharedCasAdapter(store));
    const runtimeB = createRuntime(new SharedCasAdapter(store));
    await Promise.all([runtimeA.start(), runtimeB.start()]);

    runtimeA.observeSnapshot(changedSnapshot("Tab A winner"));
    await vi.advanceTimersByTimeAsync(DESKTOP_AUTOSAVE_DEBOUNCE_MS);
    runtimeB.observeSnapshot(changedSnapshot("Tab B local work"));
    await vi.advanceTimersByTimeAsync(DESKTOP_AUTOSAVE_DEBOUNCE_MS);
    expect(runtimeB.lifecycle).toMatchObject({ status: "conflict" });

    await runtimeB.keepLocalChanges();

    expect(runtimeB.lifecycle).toMatchObject({ status: "ready", revision: 11 });
    expect(store.snapshot.tasks[0]?.title).toBe("Tab B local work");
    expect(store.saveCalls).toEqual([
      { expectedRevision: 9, title: "Tab A winner" },
      { expectedRevision: 9, title: "Tab B local work" },
      { expectedRevision: 10, title: "Tab B local work" },
    ]);
  });

  it("flushes a pending snapshot before the debounce expires", async () => {
    const adapter = new FakeDesktopPersistenceAdapter();
    adapter.queueLoad({
      kind: "loaded",
      snapshot: initialSnapshot(),
      revision: 1,
      savedAt: "loaded",
    });
    const runtime = createRuntime(adapter);
    await runtime.start();
    runtime.observeSnapshot(changedSnapshot("Flush now"));

    await runtime.flush();

    expect(adapter.saveCalls).toHaveLength(1);
    expect(adapter.saveCalls[0]?.snapshot.tasks[0]?.title).toBe("Flush now");
  });

  it("best-effort flushes on dispose, closes, and rejects later saves", async () => {
    const adapter = new FakeDesktopPersistenceAdapter();
    adapter.queueLoad({
      kind: "loaded",
      snapshot: initialSnapshot(),
      revision: 1,
      savedAt: "loaded",
    });
    const runtime = createRuntime(adapter);
    await runtime.start();
    runtime.observeSnapshot(changedSnapshot("Dispose flush"));

    runtime.dispose();
    await Promise.resolve();
    await Promise.resolve();
    runtime.observeSnapshot(changedSnapshot("After dispose"));
    await vi.runAllTimersAsync();

    expect(adapter.saveCalls).toHaveLength(1);
    expect(adapter.saveCalls[0]?.snapshot.tasks[0]?.title).toBe(
      "Dispose flush",
    );
    expect(adapter.closeCalls).toBe(1);
  });

  it("closes immediately when disposed without pending work", async () => {
    const adapter = new FakeDesktopPersistenceAdapter();
    adapter.queueLoad({
      kind: "loaded",
      snapshot: initialSnapshot(),
      revision: 1,
      savedAt: "loaded",
    });
    const runtime = createRuntime(adapter);
    await runtime.start();

    runtime.dispose();

    expect(adapter.closeCalls).toBe(1);
  });

  it("normalizes an unexpected adapter failure to a typed unknown error", async () => {
    const adapter = new FakeDesktopPersistenceAdapter();
    adapter.queueLoadError(new Error("unexpected"));
    const runtime = createRuntime(adapter);

    await runtime.start();

    expect(runtime.lifecycle).toMatchObject({
      status: "load-error",
      error: { code: "unknown" },
    });
  });

  it("uses a deterministic domain-only fingerprint", () => {
    expect(fingerprintDesktopDomainSnapshot(initialSnapshot())).toBe(
      fingerprintDesktopDomainSnapshot(structuredClone(initialSnapshot())),
    );
    expect(
      fingerprintDesktopDomainSnapshot(changedSnapshot("Changed")),
    ).not.toBe(fingerprintDesktopDomainSnapshot(initialSnapshot()));
  });
});
