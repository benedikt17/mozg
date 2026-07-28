import type { DesktopDomainSnapshot } from "@/prototype/persistence/domain-snapshot";
import {
  DesktopPersistenceError,
  type DesktopPersistenceAdapter,
} from "@/prototype/persistence/persistence-adapter";

export const DESKTOP_MVP_STORAGE_KEY = "desktop-mvp-workspace";
export const DESKTOP_AUTOSAVE_DEBOUNCE_MS = 600;

export type DesktopPersistenceLifecycle =
  | { status: "loading" }
  | { status: "ready"; revision: number; savedAt: string }
  | { status: "saving"; revision: number }
  | {
      status: "save-error";
      revision: number;
      error: DesktopPersistenceError;
    }
  | { status: "load-error"; error: DesktopPersistenceError };

export type DesktopPersistenceRuntimeOptions = {
  adapter: DesktopPersistenceAdapter;
  initialSnapshot: DesktopDomainSnapshot;
  onHydrate: (snapshot: DesktopDomainSnapshot) => void;
  onLifecycleChange: (lifecycle: DesktopPersistenceLifecycle) => void;
  storageKey?: string;
  debounceMs?: number;
};

export function fingerprintDesktopDomainSnapshot(
  snapshot: DesktopDomainSnapshot,
): string {
  return JSON.stringify(snapshot);
}

function persistenceError(error: unknown): DesktopPersistenceError {
  return error instanceof DesktopPersistenceError
    ? error
    : new DesktopPersistenceError("unknown", "Desktop persistence failed.", {
        cause: error,
      });
}

function requireHydratableSnapshot(snapshot: DesktopDomainSnapshot): void {
  if (snapshot.projects.length === 0) {
    throw new DesktopPersistenceError(
      "corrupt-data",
      "Stored desktop workspace has no project and cannot be hydrated.",
    );
  }
}

export class DesktopPersistenceRuntime {
  private readonly adapter: DesktopPersistenceAdapter;
  private readonly initialSnapshot: DesktopDomainSnapshot;
  private readonly onHydrate: (snapshot: DesktopDomainSnapshot) => void;
  private readonly onLifecycleChange: (
    lifecycle: DesktopPersistenceLifecycle,
  ) => void;
  private readonly storageKey: string;
  private readonly debounceMs: number;

  private lifecycleValue: DesktopPersistenceLifecycle = { status: "loading" };
  private revision?: number;
  private savedAt?: string;
  private persistedFingerprint?: string;
  private latestSnapshot: DesktopDomainSnapshot;
  private latestFingerprint: string;
  private pendingSnapshot?: DesktopDomainSnapshot;
  private pendingFingerprint?: string;
  private debounceTimer?: ReturnType<typeof setTimeout>;
  private startupPromise?: Promise<void>;
  private savePromise?: Promise<void>;
  private disposed = false;

  constructor(options: DesktopPersistenceRuntimeOptions) {
    this.adapter = options.adapter;
    this.initialSnapshot = options.initialSnapshot;
    this.latestSnapshot = options.initialSnapshot;
    this.latestFingerprint = fingerprintDesktopDomainSnapshot(
      options.initialSnapshot,
    );
    this.onHydrate = options.onHydrate;
    this.onLifecycleChange = options.onLifecycleChange;
    this.storageKey = options.storageKey ?? DESKTOP_MVP_STORAGE_KEY;
    this.debounceMs = options.debounceMs ?? DESKTOP_AUTOSAVE_DEBOUNCE_MS;
  }

  get lifecycle(): DesktopPersistenceLifecycle {
    return this.lifecycleValue;
  }

  start(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.startupPromise !== undefined) return this.startupPromise;
    this.setLifecycle({ status: "loading" });
    const startup = this.loadOrInitialize();
    this.startupPromise = startup;
    return startup;
  }

  observeSnapshot(snapshot: DesktopDomainSnapshot): void {
    if (this.disposed) return;
    const fingerprint = fingerprintDesktopDomainSnapshot(snapshot);
    this.latestSnapshot = snapshot;
    this.latestFingerprint = fingerprint;
    if (
      this.persistedFingerprint === undefined ||
      fingerprint === this.persistedFingerprint
    ) {
      if (this.savePromise === undefined) {
        this.pendingSnapshot = undefined;
        this.pendingFingerprint = undefined;
        this.clearDebounce();
      }
      return;
    }
    this.pendingSnapshot = snapshot;
    this.pendingFingerprint = fingerprint;
    if (this.lifecycleValue.status !== "ready") return;
    this.scheduleSave();
  }

  async retryLoad(): Promise<void> {
    if (this.disposed || this.lifecycleValue.status !== "load-error") return;
    this.adapter.close();
    this.startupPromise = undefined;
    await this.start();
  }

  retrySave(): Promise<void> {
    if (this.disposed || this.lifecycleValue.status !== "save-error") {
      return Promise.resolve();
    }
    if (this.latestFingerprint === this.persistedFingerprint) {
      this.pendingSnapshot = undefined;
      this.pendingFingerprint = undefined;
      this.setReadyLifecycle();
      return Promise.resolve();
    }
    this.pendingSnapshot = this.latestSnapshot;
    this.pendingFingerprint = this.latestFingerprint;
    return this.beginSave();
  }

  flush(): Promise<void> {
    if (this.disposed) return this.savePromise ?? Promise.resolve();
    this.clearDebounce();
    if (
      this.savePromise === undefined &&
      this.pendingSnapshot !== undefined &&
      this.lifecycleValue.status === "ready"
    ) {
      return this.beginSave();
    }
    return this.savePromise ?? Promise.resolve();
  }

  dispose(): void {
    if (this.disposed) return;
    this.clearDebounce();
    const finalSave =
      this.savePromise === undefined &&
      this.pendingSnapshot !== undefined &&
      this.lifecycleValue.status === "ready"
        ? this.beginSave()
        : this.savePromise;
    this.disposed = true;
    if (finalSave === undefined) {
      this.adapter.close();
      return;
    }
    void finalSave.finally(() => this.adapter.close());
  }

  private async loadOrInitialize(): Promise<void> {
    try {
      const result = await this.adapter.loadWorkspace(this.storageKey);
      if (this.disposed) return;
      if (result.kind === "loaded") {
        this.acceptLoadedSnapshot(
          result.snapshot,
          result.revision,
          result.savedAt,
        );
        return;
      }
      await this.initializeEmptyWorkspace();
    } catch (error) {
      if (this.disposed) return;
      const typedError = persistenceError(error);
      if (typedError.code === "already-initialized") {
        await this.loadAfterInitializeRace();
        return;
      }
      this.setLifecycle({ status: "load-error", error: typedError });
    }
  }

  private async initializeEmptyWorkspace(): Promise<void> {
    try {
      const result = await this.adapter.initializeWorkspace(
        this.storageKey,
        this.initialSnapshot,
      );
      if (this.disposed) return;
      this.revision = result.revision;
      this.savedAt = result.savedAt;
      this.persistedFingerprint = fingerprintDesktopDomainSnapshot(
        this.initialSnapshot,
      );
      this.latestSnapshot = this.initialSnapshot;
      this.latestFingerprint = this.persistedFingerprint;
      this.setReadyLifecycle();
    } catch (error) {
      const typedError = persistenceError(error);
      if (!this.disposed && typedError.code === "already-initialized") {
        await this.loadAfterInitializeRace();
        return;
      }
      throw typedError;
    }
  }

  private async loadAfterInitializeRace(): Promise<void> {
    try {
      const result = await this.adapter.loadWorkspace(this.storageKey);
      if (this.disposed) return;
      if (result.kind !== "loaded") {
        throw new DesktopPersistenceError(
          "transaction-failed",
          "Workspace remained empty after an initialization race.",
        );
      }
      this.acceptLoadedSnapshot(
        result.snapshot,
        result.revision,
        result.savedAt,
      );
    } catch (error) {
      if (!this.disposed) {
        this.setLifecycle({
          status: "load-error",
          error: persistenceError(error),
        });
      }
    }
  }

  private acceptLoadedSnapshot(
    snapshot: DesktopDomainSnapshot,
    revision: number,
    savedAt: string,
  ): void {
    requireHydratableSnapshot(snapshot);
    this.onHydrate(snapshot);
    this.revision = revision;
    this.savedAt = savedAt;
    this.persistedFingerprint = fingerprintDesktopDomainSnapshot(snapshot);
    this.latestSnapshot = snapshot;
    this.latestFingerprint = this.persistedFingerprint;
    this.pendingSnapshot = undefined;
    this.pendingFingerprint = undefined;
    this.setReadyLifecycle();
  }

  private scheduleSave(): void {
    this.clearDebounce();
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      void this.beginSave();
    }, this.debounceMs);
  }

  private beginSave(): Promise<void> {
    if (
      this.disposed ||
      this.savePromise !== undefined ||
      this.pendingSnapshot === undefined ||
      this.pendingFingerprint === undefined ||
      this.revision === undefined
    ) {
      return this.savePromise ?? Promise.resolve();
    }
    const snapshot = this.pendingSnapshot;
    const fingerprint = this.pendingFingerprint;
    const expectedRevision = this.revision;
    this.pendingSnapshot = undefined;
    this.pendingFingerprint = undefined;
    this.setLifecycle({ status: "saving", revision: expectedRevision });
    const save = this.adapter
      .saveWorkspace(this.storageKey, snapshot, expectedRevision)
      .then((result) => {
        this.revision = result.revision;
        this.savedAt = result.savedAt;
        this.persistedFingerprint = fingerprint;
        if (this.disposed) return;
        if (this.latestFingerprint !== fingerprint) {
          this.pendingSnapshot = this.latestSnapshot;
          this.pendingFingerprint = this.latestFingerprint;
          return;
        }
        this.setReadyLifecycle();
      })
      .catch((error: unknown) => {
        if (this.disposed) return;
        this.pendingSnapshot = this.latestSnapshot;
        this.pendingFingerprint = this.latestFingerprint;
        this.setLifecycle({
          status: "save-error",
          revision: expectedRevision,
          error: persistenceError(error),
        });
      })
      .finally(() => {
        if (this.savePromise === save) this.savePromise = undefined;
        if (
          !this.disposed &&
          this.lifecycleValue.status === "saving" &&
          this.pendingSnapshot !== undefined
        ) {
          void this.beginSave();
        }
      });
    this.savePromise = save;
    return save;
  }

  private setReadyLifecycle(): void {
    if (this.revision === undefined || this.savedAt === undefined) return;
    this.setLifecycle({
      status: "ready",
      revision: this.revision,
      savedAt: this.savedAt,
    });
  }

  private setLifecycle(lifecycle: DesktopPersistenceLifecycle): void {
    if (this.disposed) return;
    this.lifecycleValue = lifecycle;
    this.onLifecycleChange(lifecycle);
  }

  private clearDebounce(): void {
    if (this.debounceTimer === undefined) return;
    clearTimeout(this.debounceTimer);
    this.debounceTimer = undefined;
  }
}
