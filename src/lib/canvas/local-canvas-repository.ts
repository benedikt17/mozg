import {
  CANVAS_DOCUMENT_LIMITS,
  CANVAS_DOCUMENT_SCHEMA_VERSION,
  CANVAS_VIEWPORT_LIMITS,
  createEmptyCanvasDocumentV1,
  parseCanvasDocumentV1,
  type CanvasDocumentV1,
  type CanvasViewport,
} from "@/lib/canvas/canvas-document";
import {
  MOZG_CANVAS_ASSET_STORE,
  MOZG_CANVAS_STORE,
  MOZG_CANVAS_VIEW_STATE_STORE,
  MOZG_DESKTOP_DATABASE_NAME,
  MOZG_DESKTOP_DATABASE_VERSION,
  MOZG_DESKTOP_DOMAIN_STORE,
} from "@/prototype/persistence/indexeddb-adapter";

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const MAX_IMAGE_DIMENSION = 10_000;
const MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
const MAX_VIEWPORT = CANVAS_DOCUMENT_LIMITS.maxAbsoluteCoordinate;
type ImageMimeType = (typeof MIME_TYPES)[number];

export type CanvasRepositoryErrorCode =
  | "invalid-input"
  | "not-found"
  | "soft-deleted"
  | "workspace-mismatch"
  | "revision-conflict"
  | "invalid-stored-record"
  | "idb-unavailable"
  | "transaction-failed"
  | "asset-not-found"
  | "unsupported-mime"
  | "asset-too-large"
  | "invalid-image-dimensions";
export class CanvasRepositoryError extends Error {
  constructor(
    readonly code: CanvasRepositoryErrorCode,
    message: string,
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "CanvasRepositoryError";
  }
}

export type CanvasSummary = {
  id: string;
  workspaceId: string;
  title: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
export type LoadedCanvas = CanvasSummary & {
  schemaVersion: typeof CANVAS_DOCUMENT_SCHEMA_VERSION;
  document: CanvasDocumentV1;
};
export type CanvasSaveResult =
  | { status: "saved"; revision: number }
  | { status: "conflict"; revision: number };
export interface CanvasRepository {
  listCanvases(workspaceId: string): Promise<CanvasSummary[]>;
  createCanvas(input: {
    workspaceId: string;
    title: string;
  }): Promise<LoadedCanvas>;
  loadCanvas(input: {
    workspaceId: string;
    canvasId: string;
  }): Promise<LoadedCanvas | null>;
  saveCanvas(input: {
    workspaceId: string;
    canvasId: string;
    expectedRevision: number;
    title: string;
    document: CanvasDocumentV1;
  }): Promise<CanvasSaveResult>;
  softDeleteCanvas(input: {
    workspaceId: string;
    canvasId: string;
  }): Promise<{ status: "deleted" | "already-deleted" }>;
}
export type CanvasViewState = {
  canvasId: string;
  userId: string;
  viewportX: number;
  viewportY: number;
  zoom: number;
  updatedAt: string;
};
export interface CanvasViewStateRepository {
  loadViewState(input: {
    canvasId: string;
    userId: string;
  }): Promise<CanvasViewState | null>;
  saveViewState(input: CanvasViewState): Promise<void>;
  deleteViewState(input: { canvasId: string; userId: string }): Promise<void>;
}
export type CanvasAssetRecord = {
  id: string;
  workspaceId: string;
  blob: Blob;
  preview: Blob | null;
  mimeType: ImageMimeType;
  byteSize: number;
  width: number;
  height: number;
  checksum: string | null;
  createdAt: string;
  readyAt: string | null;
  deletedAt: string | null;
};
export type StoreLocalCanvasImageInput = {
  id?: string;
  workspaceId: string;
  blob: Blob;
  preview?: Blob | null;
  mimeType: ImageMimeType;
  byteSize: number;
  width: number;
  height: number;
  checksum?: string | null;
};
export interface CanvasAssetRepository {
  storeImage(input: StoreLocalCanvasImageInput): Promise<CanvasAssetRecord>;
  loadAsset(input: {
    workspaceId: string;
    assetId: string;
  }): Promise<CanvasAssetRecord | null>;
  markAssetDeleted(input: {
    workspaceId: string;
    assetId: string;
  }): Promise<void>;
}
export type LocalCanvasRepositoryOptions = {
  indexedDb?: IDBFactory;
  databaseName?: string;
  clock?: () => Date | string;
  idGenerator?: () => string;
};

type RecordValue = Record<string, unknown>;
type StoredViewState = CanvasViewState & { key: string };
function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function copy<T>(value: T): T {
  return structuredClone(value);
}
function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function completion(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
function identifier(value: string, field: string): string {
  if (
    typeof value !== "string" ||
    value.trim() === "" ||
    value.length > CANVAS_DOCUMENT_LIMITS.maxIdLength ||
    /[\u0000-\u001f\u007f]/u.test(value)
  )
    throw new CanvasRepositoryError("invalid-input", `${field} is invalid.`);
  return value;
}
function title(value: string): string {
  if (
    typeof value !== "string" ||
    value.trim() === "" ||
    value.length > CANVAS_DOCUMENT_LIMITS.maxTitleLength
  )
    throw new CanvasRepositoryError(
      "invalid-input",
      "Canvas title is invalid.",
    );
  return value;
}
function revision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new CanvasRepositoryError(
      "invalid-input",
      "Canvas revision is invalid.",
    );
  return value;
}
function timestamp(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    value === "" ||
    !Number.isFinite(Date.parse(value))
  )
    throw new CanvasRepositoryError(
      "invalid-stored-record",
      `${field} is invalid in stored data.`,
    );
  return value;
}
function inputTimestamp(value: unknown): string {
  if (
    typeof value !== "string" ||
    value === "" ||
    !Number.isFinite(Date.parse(value))
  )
    throw new CanvasRepositoryError(
      "invalid-input",
      "Canvas view timestamp is invalid.",
    );
  return value;
}
function now(clock: () => Date | string): string {
  const date = new Date(clock());
  if (!Number.isFinite(date.getTime()))
    throw new CanvasRepositoryError("transaction-failed", "Clock is invalid.");
  return date.toISOString();
}
function key(canvasId: string, userId: string): string {
  return `${canvasId}\u0000${userId}`;
}
function viewport(value: Pick<CanvasViewport, "x" | "y" | "zoom">): void {
  if (
    !Number.isFinite(value.x) ||
    !Number.isFinite(value.y) ||
    Math.abs(value.x) > MAX_VIEWPORT ||
    Math.abs(value.y) > MAX_VIEWPORT ||
    !Number.isFinite(value.zoom) ||
    value.zoom < CANVAS_VIEWPORT_LIMITS.minZoom ||
    value.zoom > CANVAS_VIEWPORT_LIMITS.maxZoom
  )
    throw new CanvasRepositoryError(
      "invalid-input",
      "Canvas viewport is invalid.",
    );
}
function supportedMime(value: unknown): value is ImageMimeType {
  return (
    typeof value === "string" &&
    (MIME_TYPES as readonly string[]).includes(value)
  );
}
function assetInput(input: StoreLocalCanvasImageInput): void {
  identifier(input.workspaceId, "workspaceId");
  if (input.id !== undefined) identifier(input.id, "assetId");
  if (!supportedMime(input.mimeType))
    throw new CanvasRepositoryError(
      "unsupported-mime",
      "Image MIME type is unsupported.",
    );
  if (!(input.blob instanceof Blob))
    throw new CanvasRepositoryError("invalid-input", "Image must be a Blob.");
  if (
    input.blob.type !== "" &&
    input.blob.type.toLowerCase() !== input.mimeType
  )
    throw new CanvasRepositoryError(
      "invalid-input",
      "Blob MIME type does not match metadata.",
    );
  if (
    !Number.isSafeInteger(input.byteSize) ||
    input.byteSize <= 0 ||
    input.blob.size !== input.byteSize
  )
    throw new CanvasRepositoryError(
      "invalid-input",
      "Image byte size is invalid.",
    );
  if (input.byteSize > MAX_BYTES)
    throw new CanvasRepositoryError(
      "asset-too-large",
      "Image exceeds the local size limit.",
    );
  if (
    !Number.isSafeInteger(input.width) ||
    !Number.isSafeInteger(input.height) ||
    input.width <= 0 ||
    input.height <= 0 ||
    input.width > MAX_IMAGE_DIMENSION ||
    input.height > MAX_IMAGE_DIMENSION ||
    input.width * input.height > MAX_PIXELS
  )
    throw new CanvasRepositoryError(
      "invalid-image-dimensions",
      "Image dimensions are invalid.",
    );
  if (
    input.preview !== undefined &&
    input.preview !== null &&
    (!(input.preview instanceof Blob) ||
      (input.preview.type !== "" &&
        !supportedMime(input.preview.type.toLowerCase())))
  )
    throw new CanvasRepositoryError(
      "unsupported-mime",
      "Image preview MIME type is unsupported.",
    );
  if (
    input.checksum !== undefined &&
    input.checksum !== null &&
    (input.checksum.trim() === "" || input.checksum.length > 256)
  )
    throw new CanvasRepositoryError(
      "invalid-input",
      "Image checksum is invalid.",
    );
}

function storedIdentifier(value: unknown, field: string): string {
  if (typeof value !== "string")
    throw new CanvasRepositoryError(
      "invalid-stored-record",
      `${field} is invalid in stored data.`,
    );
  try {
    return identifier(value, field);
  } catch (cause) {
    throw new CanvasRepositoryError(
      "invalid-stored-record",
      `${field} is invalid in stored data.`,
      { cause },
    );
  }
}
function storedTitle(value: unknown): string {
  if (typeof value !== "string")
    throw new CanvasRepositoryError(
      "invalid-stored-record",
      "title is invalid in stored data.",
    );
  try {
    return title(value);
  } catch (cause) {
    throw new CanvasRepositoryError(
      "invalid-stored-record",
      "title is invalid in stored data.",
      { cause },
    );
  }
}
function storedRevision(value: unknown): number {
  if (typeof value !== "number")
    throw new CanvasRepositoryError(
      "invalid-stored-record",
      "revision is invalid in stored data.",
    );
  try {
    return revision(value);
  } catch (cause) {
    throw new CanvasRepositoryError(
      "invalid-stored-record",
      "revision is invalid in stored data.",
      { cause },
    );
  }
}
function storedCanvas(value: unknown): LoadedCanvas {
  if (!isRecord(value))
    throw new CanvasRepositoryError(
      "invalid-stored-record",
      "Stored Canvas record is invalid.",
    );
  if (value.schemaVersion !== CANVAS_DOCUMENT_SCHEMA_VERSION)
    throw new CanvasRepositoryError(
      "invalid-stored-record",
      "Stored Canvas schema version is invalid.",
    );
  let document: CanvasDocumentV1;
  try {
    document = parseCanvasDocumentV1(value.document);
  } catch (cause) {
    throw new CanvasRepositoryError(
      "invalid-stored-record",
      "Stored Canvas document is invalid.",
      { cause },
    );
  }
  return {
    id: storedIdentifier(value.id, "id"),
    workspaceId: storedIdentifier(value.workspaceId, "workspaceId"),
    title: storedTitle(value.title),
    schemaVersion: 1,
    document,
    revision: storedRevision(value.revision),
    createdAt: timestamp(value.createdAt, "createdAt"),
    updatedAt: timestamp(value.updatedAt, "updatedAt"),
    deletedAt:
      value.deletedAt === null ? null : timestamp(value.deletedAt, "deletedAt"),
  };
}
function inputDocument(value: unknown): CanvasDocumentV1 {
  try {
    return parseCanvasDocumentV1(value);
  } catch (cause) {
    throw new CanvasRepositoryError(
      "invalid-input",
      "Canvas document is invalid.",
      { cause },
    );
  }
}
function storedViewState(value: unknown): StoredViewState {
  if (!isRecord(value))
    throw new CanvasRepositoryError(
      "invalid-stored-record",
      "Stored Canvas view state is invalid.",
    );
  const canvasId = storedIdentifier(value.canvasId, "canvasId");
  const userId = storedIdentifier(value.userId, "userId");
  if (value.key !== key(canvasId, userId))
    throw new CanvasRepositoryError(
      "invalid-stored-record",
      "Stored Canvas view state key is invalid.",
    );
  if (
    typeof value.viewportX !== "number" ||
    typeof value.viewportY !== "number" ||
    typeof value.zoom !== "number"
  )
    throw new CanvasRepositoryError(
      "invalid-stored-record",
      "Stored Canvas viewport is invalid.",
    );
  try {
    viewport({ x: value.viewportX, y: value.viewportY, zoom: value.zoom });
  } catch (cause) {
    throw new CanvasRepositoryError(
      "invalid-stored-record",
      "Stored Canvas viewport is invalid.",
      { cause },
    );
  }
  return {
    key: key(canvasId, userId),
    canvasId,
    userId,
    viewportX: value.viewportX,
    viewportY: value.viewportY,
    zoom: value.zoom,
    updatedAt: timestamp(value.updatedAt, "updatedAt"),
  };
}
function storedAsset(value: unknown): CanvasAssetRecord {
  if (!isRecord(value))
    throw new CanvasRepositoryError(
      "invalid-stored-record",
      "Stored Canvas asset is invalid.",
    );
  const id = storedIdentifier(value.id, "id");
  const workspaceId = storedIdentifier(value.workspaceId, "workspaceId");
  if (!supportedMime(value.mimeType) || !(value.blob instanceof Blob))
    throw new CanvasRepositoryError(
      "invalid-stored-record",
      "Stored Canvas asset metadata is invalid.",
    );
  if (
    value.blob.type !== "" &&
    value.blob.type.toLowerCase() !== value.mimeType
  )
    throw new CanvasRepositoryError(
      "invalid-stored-record",
      "Stored Canvas asset Blob MIME type is invalid.",
    );
  if (
    typeof value.byteSize !== "number" ||
    value.byteSize !== value.blob.size ||
    value.byteSize <= 0 ||
    value.byteSize > MAX_BYTES
  )
    throw new CanvasRepositoryError(
      "invalid-stored-record",
      "Stored Canvas asset size is invalid.",
    );
  if (
    typeof value.width !== "number" ||
    typeof value.height !== "number" ||
    !Number.isSafeInteger(value.width) ||
    !Number.isSafeInteger(value.height) ||
    value.width <= 0 ||
    value.height <= 0 ||
    value.width > MAX_IMAGE_DIMENSION ||
    value.height > MAX_IMAGE_DIMENSION ||
    value.width * value.height > MAX_PIXELS
  )
    throw new CanvasRepositoryError(
      "invalid-stored-record",
      "Stored Canvas asset dimensions are invalid.",
    );
  const preview =
    value.preview === null
      ? null
      : value.preview instanceof Blob
        ? value.preview
        : (() => {
            throw new CanvasRepositoryError(
              "invalid-stored-record",
              "Stored Canvas asset preview is invalid.",
            );
          })();
  if (
    preview !== null &&
    preview.type !== "" &&
    !supportedMime(preview.type.toLowerCase())
  )
    throw new CanvasRepositoryError(
      "invalid-stored-record",
      "Stored Canvas asset preview MIME type is invalid.",
    );
  return {
    id,
    workspaceId,
    blob: copy(value.blob),
    preview: preview === null ? null : copy(preview),
    mimeType: value.mimeType,
    byteSize: value.byteSize,
    width: value.width,
    height: value.height,
    checksum:
      value.checksum === null
        ? null
        : typeof value.checksum === "string" &&
            value.checksum.trim() !== "" &&
            value.checksum.length <= 256
          ? value.checksum
          : (() => {
              throw new CanvasRepositoryError(
                "invalid-stored-record",
                "Stored Canvas asset checksum is invalid.",
              );
            })(),
    createdAt: timestamp(value.createdAt, "createdAt"),
    readyAt:
      value.readyAt === null ? null : timestamp(value.readyAt, "readyAt"),
    deletedAt:
      value.deletedAt === null ? null : timestamp(value.deletedAt, "deletedAt"),
  };
}
function failed(cause: unknown): CanvasRepositoryError {
  return cause instanceof CanvasRepositoryError
    ? cause
    : new CanvasRepositoryError(
        "transaction-failed",
        "IndexedDB transaction failed.",
        { cause },
      );
}
function summary(canvas: LoadedCanvas): CanvasSummary {
  return {
    id: canvas.id,
    workspaceId: canvas.workspaceId,
    title: canvas.title,
    revision: canvas.revision,
    createdAt: canvas.createdAt,
    updatedAt: canvas.updatedAt,
    deletedAt: canvas.deletedAt,
  };
}

export class IndexedDbCanvasRepository
  implements CanvasRepository, CanvasViewStateRepository, CanvasAssetRepository
{
  private readonly factory?: IDBFactory;
  private readonly databaseName: string;
  private readonly clock: () => Date | string;
  private readonly idGenerator: () => string;
  private connection?: IDBDatabase;
  private opening?: Promise<IDBDatabase>;
  constructor(options: LocalCanvasRepositoryOptions = {}) {
    this.factory = options.indexedDb;
    this.databaseName = options.databaseName ?? MOZG_DESKTOP_DATABASE_NAME;
    this.clock = options.clock ?? (() => new Date());
    this.idGenerator = options.idGenerator ?? (() => crypto.randomUUID());
  }
  async listCanvases(workspaceId: string): Promise<CanvasSummary[]> {
    identifier(workspaceId, "workspaceId");
    const db = await this.open();
    const tx = db.transaction(MOZG_CANVAS_STORE, "readonly");
    const done = completion(tx);
    try {
      const rows = await requestResult(
        tx.objectStore(MOZG_CANVAS_STORE).getAll(),
      );
      await done;
      return rows
        .map(storedCanvas)
        .filter(
          (row) => row.workspaceId === workspaceId && row.deletedAt === null,
        )
        .sort(
          (a, b) =>
            Date.parse(b.updatedAt) - Date.parse(a.updatedAt) ||
            a.id.localeCompare(b.id),
        )
        .map(summary);
    } catch (cause) {
      void done.catch(() => undefined);
      throw failed(cause);
    }
  }
  async createCanvas(input: {
    workspaceId: string;
    title: string;
  }): Promise<LoadedCanvas> {
    const workspaceId = identifier(input.workspaceId, "workspaceId");
    const canvasTitle = title(input.title);
    const id = identifier(this.idGenerator(), "canvasId");
    const createdAt = now(this.clock);
    const row: LoadedCanvas = {
      id,
      workspaceId,
      title: canvasTitle,
      schemaVersion: 1,
      document: createEmptyCanvasDocumentV1(),
      revision: 1,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
    };
    const db = await this.open();
    const tx = db.transaction(MOZG_CANVAS_STORE, "readwrite");
    const done = completion(tx);
    try {
      await requestResult(tx.objectStore(MOZG_CANVAS_STORE).add(copy(row)));
      await done;
      return copy(row);
    } catch (cause) {
      void done.catch(() => undefined);
      throw failed(cause);
    }
  }
  async loadCanvas(input: {
    workspaceId: string;
    canvasId: string;
  }): Promise<LoadedCanvas | null> {
    identifier(input.workspaceId, "workspaceId");
    identifier(input.canvasId, "canvasId");
    const db = await this.open();
    const tx = db.transaction(MOZG_CANVAS_STORE, "readonly");
    const done = completion(tx);
    try {
      const raw = await requestResult(
        tx.objectStore(MOZG_CANVAS_STORE).get(input.canvasId),
      );
      await done;
      if (raw === undefined) return null;
      const row = storedCanvas(raw);
      if (row.workspaceId !== input.workspaceId)
        throw new CanvasRepositoryError(
          "workspace-mismatch",
          "Canvas belongs to another workspace.",
        );
      return row.deletedAt === null ? copy(row) : null;
    } catch (cause) {
      void done.catch(() => undefined);
      throw failed(cause);
    }
  }
  async saveCanvas(input: {
    workspaceId: string;
    canvasId: string;
    expectedRevision: number;
    title: string;
    document: CanvasDocumentV1;
  }): Promise<CanvasSaveResult> {
    const workspaceId = identifier(input.workspaceId, "workspaceId");
    identifier(input.canvasId, "canvasId");
    const expectedRevision = revision(input.expectedRevision);
    const canvasTitle = title(input.title);
    const document = copy(inputDocument(input.document));
    const db = await this.open();
    const tx = db.transaction(MOZG_CANVAS_STORE, "readwrite");
    const done = completion(tx);
    try {
      const store = tx.objectStore(MOZG_CANVAS_STORE);
      const raw = await requestResult(store.get(input.canvasId));
      if (raw === undefined) {
        tx.abort();
        void done.catch(() => undefined);
        throw new CanvasRepositoryError("not-found", "Canvas was not found.");
      }
      const current = storedCanvas(raw);
      if (current.workspaceId !== workspaceId) {
        tx.abort();
        void done.catch(() => undefined);
        throw new CanvasRepositoryError(
          "workspace-mismatch",
          "Canvas belongs to another workspace.",
        );
      }
      if (current.deletedAt !== null) {
        tx.abort();
        void done.catch(() => undefined);
        throw new CanvasRepositoryError(
          "soft-deleted",
          "Canvas is soft-deleted.",
        );
      }
      if (current.revision !== expectedRevision) {
        tx.abort();
        void done.catch(() => undefined);
        return { status: "conflict", revision: current.revision };
      }
      const nextRevision = current.revision + 1;
      await requestResult(
        store.put(
          copy({
            ...current,
            title: canvasTitle,
            document,
            revision: nextRevision,
            updatedAt: now(this.clock),
          }),
        ),
      );
      await done;
      return { status: "saved", revision: nextRevision };
    } catch (cause) {
      void done.catch(() => undefined);
      throw failed(cause);
    }
  }
  async softDeleteCanvas(input: {
    workspaceId: string;
    canvasId: string;
  }): Promise<{ status: "deleted" | "already-deleted" }> {
    const workspaceId = identifier(input.workspaceId, "workspaceId");
    identifier(input.canvasId, "canvasId");
    const db = await this.open();
    const tx = db.transaction(MOZG_CANVAS_STORE, "readwrite");
    const done = completion(tx);
    try {
      const store = tx.objectStore(MOZG_CANVAS_STORE);
      const raw = await requestResult(store.get(input.canvasId));
      if (raw === undefined) {
        tx.abort();
        void done.catch(() => undefined);
        throw new CanvasRepositoryError("not-found", "Canvas was not found.");
      }
      const current = storedCanvas(raw);
      if (current.workspaceId !== workspaceId) {
        tx.abort();
        void done.catch(() => undefined);
        throw new CanvasRepositoryError(
          "workspace-mismatch",
          "Canvas belongs to another workspace.",
        );
      }
      if (current.deletedAt !== null) {
        tx.abort();
        void done.catch(() => undefined);
        return { status: "already-deleted" };
      }
      await requestResult(
        store.put(
          copy({
            ...current,
            deletedAt: now(this.clock),
            updatedAt: now(this.clock),
          }),
        ),
      );
      await done;
      return { status: "deleted" };
    } catch (cause) {
      void done.catch(() => undefined);
      throw failed(cause);
    }
  }
  async loadViewState(input: {
    canvasId: string;
    userId: string;
  }): Promise<CanvasViewState | null> {
    identifier(input.canvasId, "canvasId");
    identifier(input.userId, "userId");
    const db = await this.open();
    const tx = db.transaction(
      [MOZG_CANVAS_STORE, MOZG_CANVAS_VIEW_STATE_STORE],
      "readonly",
    );
    const done = completion(tx);
    try {
      const canvas = await requestResult(
        tx.objectStore(MOZG_CANVAS_STORE).get(input.canvasId),
      );
      const state = await requestResult(
        tx
          .objectStore(MOZG_CANVAS_VIEW_STATE_STORE)
          .get(key(input.canvasId, input.userId)),
      );
      await done;
      if (canvas === undefined || storedCanvas(canvas).deletedAt !== null)
        return null;
      return state === undefined ? null : copy(storedViewState(state));
    } catch (cause) {
      void done.catch(() => undefined);
      throw failed(cause);
    }
  }
  async saveViewState(input: CanvasViewState): Promise<void> {
    identifier(input.canvasId, "canvasId");
    identifier(input.userId, "userId");
    viewport({ x: input.viewportX, y: input.viewportY, zoom: input.zoom });
    const updatedAt = inputTimestamp(input.updatedAt);
    const db = await this.open();
    const tx = db.transaction(
      [MOZG_CANVAS_STORE, MOZG_CANVAS_VIEW_STATE_STORE],
      "readwrite",
    );
    const done = completion(tx);
    try {
      const canvas = await requestResult(
        tx.objectStore(MOZG_CANVAS_STORE).get(input.canvasId),
      );
      if (canvas === undefined) {
        tx.abort();
        void done.catch(() => undefined);
        throw new CanvasRepositoryError("not-found", "Canvas was not found.");
      }
      if (storedCanvas(canvas).deletedAt !== null) {
        tx.abort();
        void done.catch(() => undefined);
        throw new CanvasRepositoryError(
          "soft-deleted",
          "Canvas is soft-deleted.",
        );
      }
      await requestResult(
        tx.objectStore(MOZG_CANVAS_VIEW_STATE_STORE).put(
          copy({
            ...input,
            key: key(input.canvasId, input.userId),
            updatedAt,
          }),
        ),
      );
      await done;
    } catch (cause) {
      void done.catch(() => undefined);
      throw failed(cause);
    }
  }
  async deleteViewState(input: {
    canvasId: string;
    userId: string;
  }): Promise<void> {
    identifier(input.canvasId, "canvasId");
    identifier(input.userId, "userId");
    const db = await this.open();
    const tx = db.transaction(MOZG_CANVAS_VIEW_STATE_STORE, "readwrite");
    const done = completion(tx);
    try {
      await requestResult(
        tx
          .objectStore(MOZG_CANVAS_VIEW_STATE_STORE)
          .delete(key(input.canvasId, input.userId)),
      );
      await done;
    } catch (cause) {
      void done.catch(() => undefined);
      throw failed(cause);
    }
  }
  async storeImage(
    input: StoreLocalCanvasImageInput,
  ): Promise<CanvasAssetRecord> {
    assetInput(input);
    const id = identifier(input.id ?? this.idGenerator(), "assetId");
    const createdAt = now(this.clock);
    const row: CanvasAssetRecord = {
      id,
      workspaceId: input.workspaceId,
      blob: copy(input.blob),
      preview:
        input.preview === undefined || input.preview === null
          ? null
          : copy(input.preview),
      mimeType: input.mimeType,
      byteSize: input.byteSize,
      width: input.width,
      height: input.height,
      checksum: input.checksum ?? null,
      createdAt,
      readyAt: createdAt,
      deletedAt: null,
    };
    const db = await this.open();
    const tx = db.transaction(MOZG_CANVAS_ASSET_STORE, "readwrite");
    const done = completion(tx);
    try {
      await requestResult(
        tx.objectStore(MOZG_CANVAS_ASSET_STORE).add(copy(row)),
      );
      await done;
      return copy(row);
    } catch (cause) {
      void done.catch(() => undefined);
      throw failed(cause);
    }
  }
  async loadAsset(input: {
    workspaceId: string;
    assetId: string;
  }): Promise<CanvasAssetRecord | null> {
    identifier(input.workspaceId, "workspaceId");
    identifier(input.assetId, "assetId");
    const db = await this.open();
    const tx = db.transaction(MOZG_CANVAS_ASSET_STORE, "readonly");
    const done = completion(tx);
    try {
      const raw = await requestResult(
        tx.objectStore(MOZG_CANVAS_ASSET_STORE).get(input.assetId),
      );
      await done;
      if (raw === undefined) return null;
      const row = storedAsset(raw);
      if (row.workspaceId !== input.workspaceId)
        throw new CanvasRepositoryError(
          "workspace-mismatch",
          "Asset belongs to another workspace.",
        );
      return row.deletedAt === null ? copy(row) : null;
    } catch (cause) {
      void done.catch(() => undefined);
      throw failed(cause);
    }
  }
  async markAssetDeleted(input: {
    workspaceId: string;
    assetId: string;
  }): Promise<void> {
    const workspaceId = identifier(input.workspaceId, "workspaceId");
    identifier(input.assetId, "assetId");
    const db = await this.open();
    const tx = db.transaction(MOZG_CANVAS_ASSET_STORE, "readwrite");
    const done = completion(tx);
    try {
      const store = tx.objectStore(MOZG_CANVAS_ASSET_STORE);
      const raw = await requestResult(store.get(input.assetId));
      if (raw === undefined) {
        tx.abort();
        void done.catch(() => undefined);
        throw new CanvasRepositoryError(
          "asset-not-found",
          "Canvas asset was not found.",
        );
      }
      const current = storedAsset(raw);
      if (current.workspaceId !== workspaceId) {
        tx.abort();
        void done.catch(() => undefined);
        throw new CanvasRepositoryError(
          "workspace-mismatch",
          "Asset belongs to another workspace.",
        );
      }
      if (current.deletedAt === null)
        await requestResult(
          store.put(copy({ ...current, deletedAt: now(this.clock) })),
        );
      await done;
    } catch (cause) {
      void done.catch(() => undefined);
      throw failed(cause);
    }
  }
  close(): void {
    this.connection?.close();
    this.connection = undefined;
    this.opening = undefined;
  }
  private async open(): Promise<IDBDatabase> {
    if (this.connection) return this.connection;
    if (this.opening) return this.opening;
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      let request: IDBOpenDBRequest;
      try {
        const factory = this.factory ?? globalThis.indexedDB;
        if (!factory)
          throw new CanvasRepositoryError(
            "idb-unavailable",
            "IndexedDB is unavailable.",
          );
        request = factory.open(
          this.databaseName,
          MOZG_DESKTOP_DATABASE_VERSION,
        );
      } catch (cause) {
        reject(
          cause instanceof CanvasRepositoryError
            ? cause
            : new CanvasRepositoryError(
                "idb-unavailable",
                "IndexedDB open failed.",
                { cause },
              ),
        );
        return;
      }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(MOZG_DESKTOP_DOMAIN_STORE))
          db.createObjectStore(MOZG_DESKTOP_DOMAIN_STORE, {
            keyPath: "storageKey",
          });
        if (!db.objectStoreNames.contains(MOZG_CANVAS_STORE))
          db.createObjectStore(MOZG_CANVAS_STORE, { keyPath: "id" });
        if (!db.objectStoreNames.contains(MOZG_CANVAS_VIEW_STATE_STORE))
          db.createObjectStore(MOZG_CANVAS_VIEW_STATE_STORE, {
            keyPath: "key",
          });
        if (!db.objectStoreNames.contains(MOZG_CANVAS_ASSET_STORE))
          db.createObjectStore(MOZG_CANVAS_ASSET_STORE, { keyPath: "id" });
      };
      request.onerror = () =>
        reject(
          new CanvasRepositoryError(
            "idb-unavailable",
            "IndexedDB open failed.",
            { cause: request.error },
          ),
        );
      request.onblocked = () =>
        reject(
          new CanvasRepositoryError(
            "idb-unavailable",
            "IndexedDB open was blocked.",
          ),
        );
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          if (this.connection === db) this.connection = undefined;
        };
        this.connection = db;
        resolve(db);
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
