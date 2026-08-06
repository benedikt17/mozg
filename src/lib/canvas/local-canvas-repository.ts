import {
  CANVAS_DOCUMENT_LIMITS,
  CANVAS_DOCUMENT_SCHEMA_VERSION,
  CANVAS_VIEWPORT_LIMITS,
  createEmptyCanvasDocumentV1,
  parseCanvasDocument,
  parseCanvasDocumentV1,
  type CanvasDocument,
  type CanvasDocumentV2,
  type CanvasViewport,
} from "@/lib/canvas/canvas-document";
import {
  MOZG_CANVAS_ASSET_STORE,
  MOZG_CANVAS_ASSET_VARIANT_STORE,
  MOZG_CANVAS_GROUP_STORE,
  MOZG_CANVAS_STORE,
  MOZG_CANVAS_VIEW_STATE_STORE,
  MOZG_DESKTOP_DATABASE_NAME,
  MOZG_DESKTOP_DATABASE_VERSION,
  MOZG_DESKTOP_DOMAIN_STORE,
} from "@/prototype/persistence/indexeddb-adapter";
import type {
  CanvasGroup,
  CanvasGroupRepository,
  CreateCanvasGroupInput,
  DeleteCanvasGroupInput,
  MoveCanvasGroupInput,
  MoveCanvasToGroupInput,
  RenameCanvasGroupInput,
} from "@/lib/canvas/canvas-group-repository";
import {
  CANVAS_IMAGE_PREVIEW_MAX_EDGE,
  CANVAS_IMAGE_THUMBNAIL_MAX_EDGE,
  isCanvasImageVariantDimensionContractValid,
} from "@/lib/canvas/canvas-image-variants";
import type {
  CanvasAssetVariantKind,
  CanvasAssetVariantMetadata,
  CanvasAssetVariantRecord,
  CanvasAssetVariantRepository,
  StoreCanvasAssetVariantInput,
} from "@/lib/canvas/canvas-image-variants";

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
  groupId?: string | null;
  sortOrder?: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
export type LoadedCanvas = CanvasSummary & {
  schemaVersion: typeof CANVAS_DOCUMENT_SCHEMA_VERSION;
  document: CanvasDocument;
};
export type CanvasSaveResult =
  | { status: "saved"; revision: number }
  | { status: "conflict"; revision: number };
export interface CanvasRepository {
  listCanvases(workspaceId: string): Promise<CanvasSummary[]>;
  createCanvas(input: {
    workspaceId: string;
    title: string;
    groupId?: string | null;
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
    document: CanvasDocument;
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
export type CanvasAssetMetadata = Omit<CanvasAssetRecord, "blob" | "preview">;
export type CanvasOriginalLoadReason =
  | "viewport-demand"
  | "derivative-fallback"
  | "ingestion-owned"
  | "explicit-maintenance";
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
    /** Required by production callers to classify every original download. */
    reason?: CanvasOriginalLoadReason;
  }): Promise<CanvasAssetRecord | null>;
  /** Optional remote-friendly metadata lookup that never downloads original binary. */
  getAssetMetadata?(input: {
    workspaceId: string;
    assetId: string;
  }): Promise<CanvasAssetMetadata | null>;
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
function sortOrder(value: unknown): number {
  if (value === undefined) return 0;
  if (!Number.isSafeInteger(value) || Number(value) < 0)
    throw new CanvasRepositoryError(
      "invalid-stored-record",
      "Canvas sort order is invalid.",
    );
  return Number(value);
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
function assetVariantKey(
  workspaceId: string,
  canvasId: string,
  assetId: string,
  kind: CanvasAssetVariantKind,
): string {
  return `${workspaceId}\u0000${canvasId}\u0000${assetId}\u0000${kind}`;
}
function inputAssetVariant(
  input: StoreCanvasAssetVariantInput,
  clock: () => Date | string,
): CanvasAssetVariantRecord & { key: string } {
  const workspaceId = identifier(input.workspaceId, "workspaceId");
  const canvasId = identifier(input.canvasId, "canvasId");
  const assetId = identifier(input.assetId, "assetId");
  if (input.kind !== "thumbnail" && input.kind !== "preview")
    throw new CanvasRepositoryError(
      "invalid-input",
      "Variant kind is invalid.",
    );
  if (!(input.blob instanceof Blob) || input.blob.type !== "image/webp")
    throw new CanvasRepositoryError(
      "invalid-input",
      "Canvas asset variants must be WebP Blobs.",
    );
  if (
    !Number.isSafeInteger(input.byteSize) ||
    input.byteSize <= 0 ||
    input.byteSize !== input.blob.size ||
    !Number.isSafeInteger(input.pixelWidth) ||
    !Number.isSafeInteger(input.pixelHeight) ||
    input.pixelWidth <= 0 ||
    input.pixelHeight <= 0 ||
    input.pixelWidth > CANVAS_IMAGE_PREVIEW_MAX_EDGE ||
    input.pixelHeight > CANVAS_IMAGE_PREVIEW_MAX_EDGE ||
    (input.kind === "thumbnail" &&
      (input.pixelWidth > CANVAS_IMAGE_THUMBNAIL_MAX_EDGE ||
        input.pixelHeight > CANVAS_IMAGE_THUMBNAIL_MAX_EDGE))
  )
    throw new CanvasRepositoryError(
      "invalid-input",
      "Canvas asset variant metadata is invalid.",
    );
  const storagePath = `${workspaceId}/${canvasId}/${assetId}/${input.kind}.webp`;
  if (input.storagePath !== storagePath)
    throw new CanvasRepositoryError(
      "invalid-input",
      "Canvas asset variant storage path is invalid.",
    );
  const createdAt = input.createdAt || now(clock);
  if (!Number.isFinite(Date.parse(createdAt)))
    throw new CanvasRepositoryError(
      "invalid-input",
      "Canvas asset variant timestamp is invalid.",
    );
  return {
    key: assetVariantKey(workspaceId, canvasId, assetId, input.kind),
    workspaceId,
    canvasId,
    assetId,
    kind: input.kind,
    storagePath,
    mimeType: "image/webp",
    byteSize: input.byteSize,
    pixelWidth: input.pixelWidth,
    pixelHeight: input.pixelHeight,
    createdAt,
    blob: copy(input.blob),
  };
}
function storedAssetVariant(value: unknown): CanvasAssetVariantRecord & {
  key: string;
} {
  if (!isRecord(value))
    throw new CanvasRepositoryError(
      "invalid-stored-record",
      "Stored Canvas asset variant is invalid.",
    );
  const input = value as Partial<CanvasAssetVariantRecord & { key: string }>;
  const byteSize = input.byteSize;
  const pixelWidth = input.pixelWidth;
  const pixelHeight = input.pixelHeight;
  if (
    typeof byteSize !== "number" ||
    typeof pixelWidth !== "number" ||
    typeof pixelHeight !== "number"
  )
    throw new CanvasRepositoryError(
      "invalid-stored-record",
      "Stored Canvas asset variant metadata is invalid.",
    );
  if (
    typeof input.key !== "string" ||
    typeof input.workspaceId !== "string" ||
    typeof input.canvasId !== "string" ||
    typeof input.assetId !== "string" ||
    (input.kind !== "thumbnail" && input.kind !== "preview") ||
    input.storagePath !==
      `${input.workspaceId}/${input.canvasId}/${input.assetId}/${input.kind}.webp` ||
    input.mimeType !== "image/webp" ||
    !(input.blob instanceof Blob) ||
    !Number.isSafeInteger(byteSize) ||
    byteSize <= 0 ||
    input.blob.size !== byteSize ||
    !Number.isSafeInteger(pixelWidth) ||
    pixelWidth <= 0 ||
    !Number.isSafeInteger(pixelHeight) ||
    pixelHeight <= 0 ||
    pixelWidth > CANVAS_IMAGE_PREVIEW_MAX_EDGE ||
    pixelHeight > CANVAS_IMAGE_PREVIEW_MAX_EDGE ||
    (input.kind === "thumbnail" &&
      (pixelWidth > CANVAS_IMAGE_THUMBNAIL_MAX_EDGE ||
        pixelHeight > CANVAS_IMAGE_THUMBNAIL_MAX_EDGE)) ||
    typeof input.createdAt !== "string" ||
    !Number.isFinite(Date.parse(input.createdAt))
  )
    throw new CanvasRepositoryError(
      "invalid-stored-record",
      "Stored Canvas asset variant metadata is invalid.",
    );
  return copy(input as CanvasAssetVariantRecord & { key: string });
}
function variantMetadata(
  row: CanvasAssetVariantRecord,
): CanvasAssetVariantMetadata {
  return {
    workspaceId: row.workspaceId,
    canvasId: row.canvasId,
    assetId: row.assetId,
    kind: row.kind,
    storagePath: row.storagePath,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    pixelWidth: row.pixelWidth,
    pixelHeight: row.pixelHeight,
    createdAt: row.createdAt,
  };
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
  let document: CanvasDocument;
  try {
    document =
      isRecord(value.document) &&
      value.document.schemaVersion === CANVAS_DOCUMENT_SCHEMA_VERSION
        ? parseCanvasDocumentV1(value.document)
        : parseCanvasDocument(value.document);
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
    groupId:
      value.groupId === undefined || value.groupId === null
        ? null
        : storedIdentifier(value.groupId, "groupId"),
    sortOrder: sortOrder(value.sortOrder),
    schemaVersion: 1,
    document,
    revision: storedRevision(value.revision),
    createdAt: timestamp(value.createdAt, "createdAt"),
    updatedAt: timestamp(value.updatedAt, "updatedAt"),
    deletedAt:
      value.deletedAt === null ? null : timestamp(value.deletedAt, "deletedAt"),
  };
}
function storedCanvasGroup(value: unknown): CanvasGroup {
  if (!isRecord(value))
    throw new CanvasRepositoryError(
      "invalid-stored-record",
      "Stored Canvas group record is invalid.",
    );
  return {
    id: storedIdentifier(value.id, "groupId"),
    workspaceId: storedIdentifier(value.workspaceId, "workspaceId"),
    parentGroupId:
      value.parentGroupId === undefined || value.parentGroupId === null
        ? null
        : storedIdentifier(value.parentGroupId, "parentGroupId"),
    title: storedTitle(value.title),
    sortOrder: sortOrder(value.sortOrder),
    createdAt: timestamp(value.createdAt, "createdAt"),
    updatedAt: timestamp(value.updatedAt, "updatedAt"),
    deletedAt:
      value.deletedAt === null ? null : timestamp(value.deletedAt, "deletedAt"),
  };
}
function inputDocument(value: unknown): CanvasDocumentV2 {
  try {
    return parseCanvasDocument(value);
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
function nextSortOrder(
  records: readonly {
    workspaceId: string;
    sortOrder?: number;
    parentGroupId?: string | null;
    groupId?: string | null;
  }[],
  workspaceId: string,
  parentGroupId: string | null,
): number {
  return (
    records
      .filter(
        (record) =>
          record.workspaceId === workspaceId &&
          (record.parentGroupId ?? record.groupId ?? null) === parentGroupId,
      )
      .reduce(
        (maximum, record) => Math.max(maximum, record.sortOrder ?? 0),
        -1,
      ) + 1
  );
}
function isDescendant(
  groups: readonly CanvasGroup[],
  groupId: string,
  candidateParentId: string | null,
): boolean {
  let current = candidateParentId;
  const seen = new Set<string>();
  while (current) {
    if (current === groupId) return true;
    if (seen.has(current)) return true;
    seen.add(current);
    current =
      groups.find((group) => group.id === current)?.parentGroupId ?? null;
  }
  return false;
}
function summary(canvas: LoadedCanvas): CanvasSummary {
  return {
    id: canvas.id,
    workspaceId: canvas.workspaceId,
    title: canvas.title,
    groupId: canvas.groupId,
    sortOrder: canvas.sortOrder,
    revision: canvas.revision,
    createdAt: canvas.createdAt,
    updatedAt: canvas.updatedAt,
    deletedAt: canvas.deletedAt,
  };
}

export class IndexedDbCanvasRepository
  implements
    CanvasRepository,
    CanvasViewStateRepository,
    CanvasAssetRepository,
    CanvasAssetVariantRepository,
    CanvasGroupRepository
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
            (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
            Date.parse(a.updatedAt) - Date.parse(b.updatedAt) ||
            a.id.localeCompare(b.id),
        )
        .map(summary);
    } catch (cause) {
      void done.catch(() => undefined);
      throw failed(cause);
    }
  }
  async listCanvasGroups(workspaceId: string): Promise<CanvasGroup[]> {
    identifier(workspaceId, "workspaceId");
    const db = await this.open();
    const tx = db.transaction(MOZG_CANVAS_GROUP_STORE, "readonly");
    const done = completion(tx);
    try {
      const rows = await requestResult(
        tx.objectStore(MOZG_CANVAS_GROUP_STORE).getAll(),
      );
      await done;
      return rows
        .map(storedCanvasGroup)
        .filter(
          (group) => group.workspaceId === workspaceId && !group.deletedAt,
        )
        .sort(
          (a, b) =>
            (a.parentGroupId ?? "").localeCompare(b.parentGroupId ?? "") ||
            a.sortOrder - b.sortOrder ||
            a.title.localeCompare(b.title) ||
            a.id.localeCompare(b.id),
        );
    } catch (cause) {
      void done.catch(() => undefined);
      throw failed(cause);
    }
  }
  async createCanvasGroup(input: CreateCanvasGroupInput): Promise<CanvasGroup> {
    const workspaceId = identifier(input.workspaceId, "workspaceId");
    const groupTitle = title(input.title);
    const parentGroupId = input.parentGroupId ?? null;
    const id = identifier(this.idGenerator(), "groupId");
    const createdAt = now(this.clock);
    const db = await this.open();
    const tx = db.transaction(MOZG_CANVAS_GROUP_STORE, "readwrite");
    const done = completion(tx);
    try {
      const store = tx.objectStore(MOZG_CANVAS_GROUP_STORE);
      await this.assertGroupReference(store, workspaceId, parentGroupId);
      const groups = await this.readGroups(store);
      const row: CanvasGroup = {
        id,
        workspaceId,
        parentGroupId,
        title: groupTitle,
        sortOrder: nextSortOrder(groups, workspaceId, parentGroupId),
        createdAt,
        updatedAt: createdAt,
        deletedAt: null,
      };
      await requestResult(store.add(copy(row)));
      await done;
      return copy(row);
    } catch (cause) {
      void done.catch(() => undefined);
      throw failed(cause);
    }
  }
  async renameCanvasGroup(input: RenameCanvasGroupInput): Promise<CanvasGroup> {
    const workspaceId = identifier(input.workspaceId, "workspaceId");
    const groupId = identifier(input.groupId, "groupId");
    const groupTitle = title(input.title);
    const db = await this.open();
    const tx = db.transaction(MOZG_CANVAS_GROUP_STORE, "readwrite");
    const done = completion(tx);
    try {
      const store = tx.objectStore(MOZG_CANVAS_GROUP_STORE);
      const group = await this.loadActiveGroup(store, workspaceId, groupId);
      const next = { ...group, title: groupTitle, updatedAt: now(this.clock) };
      await requestResult(store.put(copy(next)));
      await done;
      return copy(next);
    } catch (cause) {
      void done.catch(() => undefined);
      throw failed(cause);
    }
  }
  async softDeleteCanvasGroup(
    input: DeleteCanvasGroupInput,
  ): Promise<{ status: "deleted" | "already-deleted" }> {
    const workspaceId = identifier(input.workspaceId, "workspaceId");
    const groupId = identifier(input.groupId, "groupId");
    const db = await this.open();
    const tx = db.transaction(
      [MOZG_CANVAS_GROUP_STORE, MOZG_CANVAS_STORE],
      "readwrite",
    );
    const done = completion(tx);
    try {
      const groupStore = tx.objectStore(MOZG_CANVAS_GROUP_STORE);
      const group = await this.loadGroup(groupStore, groupId);
      if (!group)
        throw new CanvasRepositoryError(
          "not-found",
          "Canvas group was not found.",
        );
      if (group.workspaceId !== workspaceId)
        throw new CanvasRepositoryError(
          "workspace-mismatch",
          "Canvas group belongs to another workspace.",
        );
      if (group.deletedAt) {
        await done;
        return { status: "already-deleted" };
      }
      const deletedAt = now(this.clock);
      const groups = await this.readGroups(groupStore);
      for (const child of groups) {
        if (
          child.workspaceId === workspaceId &&
          child.parentGroupId === groupId
        ) {
          await requestResult(
            groupStore.put(
              copy({
                ...child,
                parentGroupId: group.parentGroupId,
                updatedAt: deletedAt,
              }),
            ),
          );
        }
      }
      const canvasStore = tx.objectStore(MOZG_CANVAS_STORE);
      const canvases = (await requestResult(canvasStore.getAll())).map(
        storedCanvas,
      );
      for (const canvas of canvases) {
        if (canvas.workspaceId === workspaceId && canvas.groupId === groupId) {
          await requestResult(
            canvasStore.put(
              copy({
                ...canvas,
                groupId: group.parentGroupId,
                updatedAt: deletedAt,
              }),
            ),
          );
        }
      }
      await requestResult(
        groupStore.put(copy({ ...group, deletedAt, updatedAt: deletedAt })),
      );
      await done;
      return { status: "deleted" };
    } catch (cause) {
      void done.catch(() => undefined);
      throw failed(cause);
    }
  }
  async moveCanvasGroup(input: MoveCanvasGroupInput): Promise<CanvasGroup> {
    const workspaceId = identifier(input.workspaceId, "workspaceId");
    const groupId = identifier(input.groupId, "groupId");
    const parentGroupId = input.parentGroupId;
    const db = await this.open();
    const tx = db.transaction(MOZG_CANVAS_GROUP_STORE, "readwrite");
    const done = completion(tx);
    try {
      const store = tx.objectStore(MOZG_CANVAS_GROUP_STORE);
      const group = await this.loadActiveGroup(store, workspaceId, groupId);
      await this.assertGroupReference(store, workspaceId, parentGroupId);
      const groups = await this.readGroups(store);
      if (
        parentGroupId === groupId ||
        isDescendant(groups, groupId, parentGroupId)
      )
        throw new CanvasRepositoryError(
          "invalid-input",
          "Canvas group cycle is not allowed.",
        );
      const next = {
        ...group,
        parentGroupId,
        sortOrder: nextSortOrder(groups, workspaceId, parentGroupId),
        updatedAt: now(this.clock),
      };
      await requestResult(store.put(copy(next)));
      await done;
      return copy(next);
    } catch (cause) {
      void done.catch(() => undefined);
      throw failed(cause);
    }
  }
  async moveCanvasToGroup(input: MoveCanvasToGroupInput): Promise<void> {
    const workspaceId = identifier(input.workspaceId, "workspaceId");
    const canvasId = identifier(input.canvasId, "canvasId");
    const db = await this.open();
    const tx = db.transaction(
      [MOZG_CANVAS_STORE, MOZG_CANVAS_GROUP_STORE],
      "readwrite",
    );
    const done = completion(tx);
    try {
      const groupStore = tx.objectStore(MOZG_CANVAS_GROUP_STORE);
      await this.assertGroupReference(groupStore, workspaceId, input.groupId);
      const canvasStore = tx.objectStore(MOZG_CANVAS_STORE);
      const raw = await requestResult(canvasStore.get(canvasId));
      if (raw === undefined)
        throw new CanvasRepositoryError("not-found", "Canvas was not found.");
      const canvas = storedCanvas(raw);
      if (canvas.workspaceId !== workspaceId)
        throw new CanvasRepositoryError(
          "workspace-mismatch",
          "Canvas belongs to another workspace.",
        );
      const canvases = (await requestResult(canvasStore.getAll())).map(
        storedCanvas,
      );
      const next = {
        ...canvas,
        groupId: input.groupId,
        sortOrder: nextSortOrder(
          canvases.filter((item) => item.id !== canvasId),
          workspaceId,
          input.groupId,
        ),
        updatedAt: now(this.clock),
      };
      await requestResult(canvasStore.put(copy(next)));
      await done;
    } catch (cause) {
      void done.catch(() => undefined);
      throw failed(cause);
    }
  }
  async createCanvas(input: {
    workspaceId: string;
    title: string;
    groupId?: string | null;
  }): Promise<LoadedCanvas> {
    const workspaceId = identifier(input.workspaceId, "workspaceId");
    const canvasTitle = title(input.title);
    const groupId = input.groupId ?? null;
    const id = identifier(this.idGenerator(), "canvasId");
    const createdAt = now(this.clock);
    const row: LoadedCanvas = {
      id,
      workspaceId,
      title: canvasTitle,
      groupId,
      sortOrder: 0,
      schemaVersion: 1,
      document: createEmptyCanvasDocumentV1(),
      revision: 1,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
    };
    const db = await this.open();
    const tx = db.transaction(
      [MOZG_CANVAS_STORE, MOZG_CANVAS_GROUP_STORE],
      "readwrite",
    );
    const done = completion(tx);
    try {
      await this.assertGroupReference(
        tx.objectStore(MOZG_CANVAS_GROUP_STORE),
        workspaceId,
        groupId,
      );
      row.sortOrder = await this.nextCanvasSortOrder(
        tx.objectStore(MOZG_CANVAS_STORE),
        workspaceId,
        groupId,
      );
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
    document: CanvasDocument;
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
    reason?: CanvasOriginalLoadReason;
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
  async listVariants(input: {
    workspaceId: string;
    canvasId: string;
    assetId: string;
  }): Promise<CanvasAssetVariantMetadata[]> {
    const workspaceId = identifier(input.workspaceId, "workspaceId");
    const canvasId = identifier(input.canvasId, "canvasId");
    const assetId = identifier(input.assetId, "assetId");
    const db = await this.open();
    const tx = db.transaction(MOZG_CANVAS_ASSET_VARIANT_STORE, "readonly");
    const done = completion(tx);
    try {
      const rows = await requestResult(
        tx.objectStore(MOZG_CANVAS_ASSET_VARIANT_STORE).getAll(),
      );
      await done;
      return rows
        .map(storedAssetVariant)
        .filter(
          (row) =>
            row.workspaceId === workspaceId &&
            row.canvasId === canvasId &&
            row.assetId === assetId,
        )
        .map(variantMetadata);
    } catch (cause) {
      void done.catch(() => undefined);
      throw failed(cause);
    }
  }
  async loadVariant(input: {
    workspaceId: string;
    canvasId: string;
    assetId: string;
    kind: CanvasAssetVariantKind;
  }): Promise<CanvasAssetVariantRecord | null> {
    const workspaceId = identifier(input.workspaceId, "workspaceId");
    const canvasId = identifier(input.canvasId, "canvasId");
    const assetId = identifier(input.assetId, "assetId");
    const db = await this.open();
    const tx = db.transaction(MOZG_CANVAS_ASSET_VARIANT_STORE, "readonly");
    const done = completion(tx);
    try {
      const raw = await requestResult(
        tx
          .objectStore(MOZG_CANVAS_ASSET_VARIANT_STORE)
          .get(assetVariantKey(workspaceId, canvasId, assetId, input.kind)),
      );
      await done;
      if (raw === undefined) return null;
      const row = storedAssetVariant(raw);
      return row.workspaceId === workspaceId &&
        row.canvasId === canvasId &&
        row.assetId === assetId
        ? copy(row)
        : null;
    } catch (cause) {
      void done.catch(() => undefined);
      throw failed(cause);
    }
  }
  async storeVariant(
    input: StoreCanvasAssetVariantInput,
  ): Promise<CanvasAssetVariantMetadata> {
    const row = inputAssetVariant(input, this.clock);
    const original = await this.loadAsset({
      workspaceId: row.workspaceId,
      assetId: row.assetId,
      reason: "explicit-maintenance",
    });
    if (
      !original ||
      !isCanvasImageVariantDimensionContractValid({
        kind: row.kind,
        pixelWidth: row.pixelWidth,
        pixelHeight: row.pixelHeight,
        originalWidth: original.width,
        originalHeight: original.height,
      })
    )
      throw new CanvasRepositoryError(
        "invalid-input",
        "Canvas asset variant dimensions do not match the original asset.",
      );
    const db = await this.open();
    const tx = db.transaction(MOZG_CANVAS_ASSET_VARIANT_STORE, "readwrite");
    const done = completion(tx);
    try {
      await requestResult(
        tx.objectStore(MOZG_CANVAS_ASSET_VARIANT_STORE).put(copy(row)),
      );
      await done;
      return copy(variantMetadata(row));
    } catch (cause) {
      void done.catch(() => undefined);
      throw failed(cause);
    }
  }
  async deleteVariants(input: {
    workspaceId: string;
    canvasId: string;
    assetId: string;
  }): Promise<void> {
    const variants = await this.listVariants(input);
    const db = await this.open();
    const tx = db.transaction(MOZG_CANVAS_ASSET_VARIANT_STORE, "readwrite");
    const done = completion(tx);
    try {
      const store = tx.objectStore(MOZG_CANVAS_ASSET_VARIANT_STORE);
      for (const variant of variants)
        await requestResult(
          store.delete(
            assetVariantKey(
              variant.workspaceId,
              variant.canvasId,
              variant.assetId,
              variant.kind,
            ),
          ),
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
        if (!db.objectStoreNames.contains(MOZG_CANVAS_GROUP_STORE))
          db.createObjectStore(MOZG_CANVAS_GROUP_STORE, { keyPath: "id" });
        if (!db.objectStoreNames.contains(MOZG_CANVAS_VIEW_STATE_STORE))
          db.createObjectStore(MOZG_CANVAS_VIEW_STATE_STORE, {
            keyPath: "key",
          });
        if (!db.objectStoreNames.contains(MOZG_CANVAS_ASSET_STORE))
          db.createObjectStore(MOZG_CANVAS_ASSET_STORE, { keyPath: "id" });
        if (!db.objectStoreNames.contains(MOZG_CANVAS_ASSET_VARIANT_STORE))
          db.createObjectStore(MOZG_CANVAS_ASSET_VARIANT_STORE, {
            keyPath: "key",
          });
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

  private async readGroups(store: IDBObjectStore): Promise<CanvasGroup[]> {
    return (await requestResult(store.getAll())).map(storedCanvasGroup);
  }

  private async loadGroup(
    store: IDBObjectStore,
    groupId: string,
  ): Promise<CanvasGroup | null> {
    const raw = await requestResult(store.get(groupId));
    return raw === undefined ? null : storedCanvasGroup(raw);
  }

  private async loadActiveGroup(
    store: IDBObjectStore,
    workspaceId: string,
    groupId: string,
  ): Promise<CanvasGroup> {
    const group = await this.loadGroup(store, groupId);
    if (!group)
      throw new CanvasRepositoryError(
        "not-found",
        "Canvas group was not found.",
      );
    if (group.workspaceId !== workspaceId)
      throw new CanvasRepositoryError(
        "workspace-mismatch",
        "Canvas group belongs to another workspace.",
      );
    if (group.deletedAt)
      throw new CanvasRepositoryError(
        "soft-deleted",
        "Canvas group is archived.",
      );
    return group;
  }

  private async assertGroupReference(
    store: IDBObjectStore,
    workspaceId: string,
    groupId: string | null,
  ): Promise<void> {
    if (groupId === null) return;
    identifier(groupId, "groupId");
    await this.loadActiveGroup(store, workspaceId, groupId);
  }

  private async nextCanvasSortOrder(
    store: IDBObjectStore,
    workspaceId: string,
    groupId: string | null,
  ): Promise<number> {
    const canvases = (await requestResult(store.getAll())).map(storedCanvas);
    return nextSortOrder(canvases, workspaceId, groupId);
  }
}
