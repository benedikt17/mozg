import {
  DESKTOP_DOMAIN_SCHEMA_VERSION,
  parseDesktopDomainSnapshot,
  type DesktopDomainSnapshot,
} from "@/prototype/persistence/domain-snapshot";
import {
  DesktopPersistenceError,
  type DesktopPersistenceAdapter,
  type DesktopPersistenceLoadResult,
  type DesktopPersistenceSaveResult,
} from "@/prototype/persistence/persistence-adapter";

export const MOZG_DESKTOP_DATABASE_NAME = "mozg-desktop-prototype";
export const MOZG_DESKTOP_DATABASE_VERSION = 1;
export const MOZG_DESKTOP_DOMAIN_STORE = "domain-snapshots";
export const MOZG_DESKTOP_STORAGE_VERSION = 1 as const;

export type IndexedDbDesktopDomainEnvelope = {
  storageVersion: typeof MOZG_DESKTOP_STORAGE_VERSION;
  storageKey: string;
  revision: number;
  savedAt: string;
  snapshot: DesktopDomainSnapshot;
};

export type IndexedDbDesktopPersistenceOptions = {
  indexedDb?: IDBFactory;
  databaseName?: string;
  clock?: () => Date | string;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireStorageKey(storageKey: string): void {
  if (typeof storageKey !== "string" || storageKey.trim().length === 0) {
    throw new DesktopPersistenceError(
      "invalid-storage-key",
      "Storage key must be a non-empty string.",
    );
  }
}

function requireExpectedRevision(revision: number): void {
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new DesktopPersistenceError(
      "conflict",
      "Expected revision must be a positive integer.",
      { expectedRevision: revision },
    );
  }
}

function validateSnapshotForWrite(
  snapshot: DesktopDomainSnapshot,
): DesktopDomainSnapshot {
  const parsed = parseDesktopDomainSnapshot(snapshot);
  if (!parsed.ok) {
    throw new DesktopPersistenceError(
      "invalid-snapshot",
      "Desktop domain snapshot validation failed.",
      { validationErrors: parsed.errors },
    );
  }
  return parsed.snapshot;
}

function parseStoredEnvelope(
  value: unknown,
  requestedStorageKey: string,
): IndexedDbDesktopDomainEnvelope {
  if (!isRecord(value)) {
    throw new DesktopPersistenceError(
      "corrupt-data",
      "Stored desktop domain envelope is not an object.",
    );
  }
  if (
    "storageVersion" in value &&
    value.storageVersion !== MOZG_DESKTOP_STORAGE_VERSION
  ) {
    throw new DesktopPersistenceError(
      "unsupported-version",
      "Stored desktop persistence version is not supported.",
    );
  }
  if (value.storageVersion !== MOZG_DESKTOP_STORAGE_VERSION) {
    throw new DesktopPersistenceError(
      "corrupt-data",
      "Stored desktop persistence version is missing.",
    );
  }
  if (value.storageKey !== requestedStorageKey) {
    throw new DesktopPersistenceError(
      "corrupt-data",
      "Stored desktop domain envelope has a mismatched storage key.",
    );
  }
  if (!Number.isSafeInteger(value.revision) || Number(value.revision) < 1) {
    throw new DesktopPersistenceError(
      "corrupt-data",
      "Stored desktop domain envelope has an invalid revision.",
    );
  }
  if (
    typeof value.savedAt !== "string" ||
    value.savedAt.length === 0 ||
    !Number.isFinite(Date.parse(value.savedAt))
  ) {
    throw new DesktopPersistenceError(
      "corrupt-data",
      "Stored desktop domain envelope has an invalid savedAt value.",
    );
  }
  const parsed = parseDesktopDomainSnapshot(value.snapshot);
  if (!parsed.ok) {
    const unsupportedDomainVersion =
      isRecord(value.snapshot) &&
      "schemaVersion" in value.snapshot &&
      value.snapshot.schemaVersion !== DESKTOP_DOMAIN_SCHEMA_VERSION;
    throw new DesktopPersistenceError(
      unsupportedDomainVersion ? "unsupported-version" : "corrupt-data",
      unsupportedDomainVersion
        ? `Desktop domain schema version ${DESKTOP_DOMAIN_SCHEMA_VERSION} is required.`
        : "Stored desktop domain snapshot is invalid.",
      { validationErrors: parsed.errors },
    );
  }
  return {
    storageVersion: MOZG_DESKTOP_STORAGE_VERSION,
    storageKey: requestedStorageKey,
    revision: Number(value.revision),
    savedAt: value.savedAt,
    snapshot: parsed.snapshot,
  };
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionCompletion(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function transactionError(cause: unknown): DesktopPersistenceError {
  return cause instanceof DesktopPersistenceError
    ? cause
    : new DesktopPersistenceError(
        "transaction-failed",
        "IndexedDB transaction failed.",
        { cause },
      );
}

export class IndexedDbDesktopPersistenceAdapter implements DesktopPersistenceAdapter {
  private readonly injectedFactory?: IDBFactory;
  private readonly databaseName: string;
  private readonly clock: () => Date | string;
  private connection?: IDBDatabase;
  private opening?: Promise<IDBDatabase>;

  constructor(options: IndexedDbDesktopPersistenceOptions = {}) {
    this.injectedFactory = options.indexedDb;
    this.databaseName = options.databaseName ?? MOZG_DESKTOP_DATABASE_NAME;
    this.clock = options.clock ?? (() => new Date());
  }

  async loadWorkspace(
    storageKey: string,
  ): Promise<DesktopPersistenceLoadResult> {
    requireStorageKey(storageKey);
    const database = await this.openDatabase();
    const transaction = database.transaction(
      MOZG_DESKTOP_DOMAIN_STORE,
      "readonly",
    );
    const completion = transactionCompletion(transaction);
    try {
      const value = await requestResult(
        transaction.objectStore(MOZG_DESKTOP_DOMAIN_STORE).get(storageKey),
      );
      await completion;
      if (value === undefined) return { kind: "empty" };
      const envelope = parseStoredEnvelope(value, storageKey);
      return {
        kind: "loaded",
        snapshot: envelope.snapshot,
        revision: envelope.revision,
        savedAt: envelope.savedAt,
      };
    } catch (error) {
      void completion.catch(() => undefined);
      throw transactionError(error);
    }
  }

  async initializeWorkspace(
    storageKey: string,
    snapshot: DesktopDomainSnapshot,
  ): Promise<DesktopPersistenceSaveResult> {
    requireStorageKey(storageKey);
    const validatedSnapshot = validateSnapshotForWrite(snapshot);
    const database = await this.openDatabase();
    const transaction = database.transaction(
      MOZG_DESKTOP_DOMAIN_STORE,
      "readwrite",
    );
    const completion = transactionCompletion(transaction);
    try {
      const store = transaction.objectStore(MOZG_DESKTOP_DOMAIN_STORE);
      const existing = await requestResult(store.get(storageKey));
      if (existing !== undefined) {
        transaction.abort();
        void completion.catch(() => undefined);
        throw new DesktopPersistenceError(
          "already-initialized",
          "Desktop workspace is already initialized.",
        );
      }
      const savedAt = this.currentTimestamp();
      const envelope: IndexedDbDesktopDomainEnvelope = {
        storageVersion: MOZG_DESKTOP_STORAGE_VERSION,
        storageKey,
        revision: 1,
        savedAt,
        snapshot: validatedSnapshot,
      };
      await requestResult(store.add(envelope));
      await completion;
      return { revision: 1, savedAt };
    } catch (error) {
      void completion.catch(() => undefined);
      throw transactionError(error);
    }
  }

  async saveWorkspace(
    storageKey: string,
    snapshot: DesktopDomainSnapshot,
    expectedRevision: number,
  ): Promise<DesktopPersistenceSaveResult> {
    requireStorageKey(storageKey);
    requireExpectedRevision(expectedRevision);
    const validatedSnapshot = validateSnapshotForWrite(snapshot);
    const database = await this.openDatabase();
    const transaction = database.transaction(
      MOZG_DESKTOP_DOMAIN_STORE,
      "readwrite",
    );
    const completion = transactionCompletion(transaction);
    try {
      const store = transaction.objectStore(MOZG_DESKTOP_DOMAIN_STORE);
      const stored = await requestResult(store.get(storageKey));
      if (stored === undefined) {
        transaction.abort();
        void completion.catch(() => undefined);
        throw new DesktopPersistenceError(
          "not-initialized",
          "Desktop workspace is not initialized.",
        );
      }
      const current = parseStoredEnvelope(stored, storageKey);
      if (current.revision !== expectedRevision) {
        transaction.abort();
        void completion.catch(() => undefined);
        throw new DesktopPersistenceError(
          "conflict",
          "Desktop workspace revision does not match.",
          {
            expectedRevision,
            actualRevision: current.revision,
          },
        );
      }
      const savedAt = this.currentTimestamp();
      const revision = current.revision + 1;
      const envelope: IndexedDbDesktopDomainEnvelope = {
        storageVersion: MOZG_DESKTOP_STORAGE_VERSION,
        storageKey,
        revision,
        savedAt,
        snapshot: validatedSnapshot,
      };
      await requestResult(store.put(envelope));
      await completion;
      return { revision, savedAt };
    } catch (error) {
      void completion.catch(() => undefined);
      throw transactionError(error);
    }
  }

  close(): void {
    this.connection?.close();
    this.connection = undefined;
    this.opening = undefined;
  }

  private currentTimestamp(): string {
    const value = this.clock();
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) {
      throw new DesktopPersistenceError(
        "unknown",
        "Clock returned an invalid date.",
      );
    }
    return date.toISOString();
  }

  private factory(): IDBFactory {
    const factory = this.injectedFactory ?? globalThis.indexedDB;
    if (factory === undefined) {
      throw new DesktopPersistenceError(
        "unavailable",
        "IndexedDB is unavailable in this environment.",
      );
    }
    return factory;
  }

  private async openDatabase(): Promise<IDBDatabase> {
    if (this.connection !== undefined) return this.connection;
    if (this.opening !== undefined) return this.opening;
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      let request: IDBOpenDBRequest;
      try {
        request = this.factory().open(
          this.databaseName,
          MOZG_DESKTOP_DATABASE_VERSION,
        );
      } catch (cause) {
        reject(
          new DesktopPersistenceError("unavailable", "IndexedDB open failed.", {
            cause,
          }),
        );
        return;
      }
      let settled = false;
      request.onupgradeneeded = () => {
        if (
          !request.result.objectStoreNames.contains(MOZG_DESKTOP_DOMAIN_STORE)
        ) {
          request.result.createObjectStore(MOZG_DESKTOP_DOMAIN_STORE, {
            keyPath: "storageKey",
          });
        }
      };
      request.onerror = () => {
        settled = true;
        reject(
          new DesktopPersistenceError("unavailable", "IndexedDB open failed.", {
            cause: request.error,
          }),
        );
      };
      request.onblocked = () => {
        settled = true;
        reject(
          new DesktopPersistenceError(
            "blocked",
            "IndexedDB open was blocked by another connection.",
          ),
        );
      };
      request.onsuccess = () => {
        const database = request.result;
        if (settled) {
          database.close();
          return;
        }
        database.onversionchange = () => {
          database.close();
          if (this.connection === database) this.connection = undefined;
        };
        this.connection = database;
        resolve(database);
      };
    });
    this.opening = opening;
    try {
      return await opening;
    } finally {
      if (this.opening === opening) this.opening = undefined;
    }
  }
}
