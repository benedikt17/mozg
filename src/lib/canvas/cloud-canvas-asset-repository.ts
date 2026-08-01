import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CANVAS_IMAGE_INPUT_MAX_BYTES,
  CANVAS_IMAGE_INPUT_MAX_PIXELS,
  CANVAS_IMAGE_INPUT_MIME_TYPES,
  type CanvasImageMimeType,
} from "@/lib/canvas/canvas-image-ingestion";
import type { Database } from "@/lib/supabase/database.types";

export const CANVAS_ASSET_BUCKET = "canvas-assets";
export const CANVAS_ASSET_MAX_DIMENSION = 10_000;
export const CANVAS_ASSET_MAX_CHECKSUM_LENGTH = 256;

export type CloudCanvasAssetRepositoryErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not-found"
  | "invalid-input"
  | "unsupported-mime"
  | "file-too-large"
  | "invalid-dimensions"
  | "invalid-server-metadata"
  | "workspace-mismatch"
  | "canvas-mismatch"
  | "upload-failure"
  | "download-failure"
  | "delete-failure"
  | "partial-cleanup-failure"
  | "conflict"
  | "unexpected";

export class CloudCanvasAssetRepositoryError extends Error {
  constructor(
    readonly code: CloudCanvasAssetRepositoryErrorCode,
    message: string,
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "CloudCanvasAssetRepositoryError";
  }
}

export type CloudCanvasAssetMetadata = {
  id: string;
  workspaceId: string;
  canvasId: string;
  storageKey: string;
  previewStorageKey: string | null;
  mimeType: CanvasImageMimeType;
  byteSize: number;
  width: number;
  height: number;
  checksum: string | null;
  createdBy: string;
  createdAt: string;
  readyAt: string | null;
  deletedAt: string | null;
};

export type CloudCanvasAsset = CloudCanvasAssetMetadata & {
  blob: Blob;
};

export type UploadCloudCanvasAssetInput = {
  workspaceId: string;
  canvasId: string;
  assetId?: string;
  blob: Blob;
  mimeType: CanvasImageMimeType;
  byteSize: number;
  width: number;
  height: number;
  checksum?: string | null;
};

export interface CloudCanvasAssetRepository {
  uploadAsset(
    input: UploadCloudCanvasAssetInput,
  ): Promise<CloudCanvasAssetMetadata>;
  getAssetMetadata(input: {
    workspaceId: string;
    canvasId: string;
    assetId: string;
  }): Promise<CloudCanvasAssetMetadata>;
  downloadAsset(input: {
    workspaceId: string;
    canvasId: string;
    assetId: string;
  }): Promise<CloudCanvasAsset>;
  deleteAsset(input: {
    workspaceId: string;
    canvasId: string;
    assetId: string;
  }): Promise<void>;
}

export type CloudCanvasAssetRepositoryOptions = {
  supabase: SupabaseClient<Database>;
  idGenerator?: () => string;
};

type RecordValue = Record<string, unknown>;

const ASSET_SELECT =
  "id,workspace_id,canvas_id,storage_key,preview_storage_key,mime_type,byte_size,width,height,checksum,created_by,created_at,ready_at,deleted_at";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function inputUuid(value: string, field: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new CloudCanvasAssetRepositoryError(
      "invalid-input",
      `${field} is invalid.`,
    );
  }
  return value;
}

function inputMime(value: string): CanvasImageMimeType {
  if (!(CANVAS_IMAGE_INPUT_MIME_TYPES as readonly string[]).includes(value)) {
    throw new CloudCanvasAssetRepositoryError(
      "unsupported-mime",
      "Image MIME type is unsupported.",
    );
  }
  return value as CanvasImageMimeType;
}

function inputUpload(
  input: UploadCloudCanvasAssetInput,
  idGenerator: () => string,
): UploadCloudCanvasAssetInput & {
  assetId: string;
  mimeType: CanvasImageMimeType;
} {
  const workspaceId = inputUuid(input.workspaceId, "workspaceId");
  const canvasId = inputUuid(input.canvasId, "canvasId");
  const assetId = inputUuid(input.assetId ?? idGenerator(), "assetId");
  const mimeType = inputMime(input.mimeType);

  if (!(input.blob instanceof Blob)) {
    throw new CloudCanvasAssetRepositoryError(
      "invalid-input",
      "Image content must be a Blob.",
    );
  }
  if (input.blob.type !== "" && input.blob.type.toLowerCase() !== mimeType) {
    throw new CloudCanvasAssetRepositoryError(
      "invalid-input",
      "Blob MIME type does not match metadata.",
    );
  }
  if (
    !Number.isSafeInteger(input.byteSize) ||
    input.byteSize <= 0 ||
    input.blob.size !== input.byteSize
  ) {
    throw new CloudCanvasAssetRepositoryError(
      "invalid-input",
      "Image byte size is invalid.",
    );
  }
  if (input.byteSize > CANVAS_IMAGE_INPUT_MAX_BYTES) {
    throw new CloudCanvasAssetRepositoryError(
      "file-too-large",
      "Image exceeds the allowed file size.",
    );
  }
  if (
    !Number.isSafeInteger(input.width) ||
    !Number.isSafeInteger(input.height) ||
    input.width <= 0 ||
    input.height <= 0 ||
    input.width > CANVAS_ASSET_MAX_DIMENSION ||
    input.height > CANVAS_ASSET_MAX_DIMENSION ||
    input.width * input.height > CANVAS_IMAGE_INPUT_MAX_PIXELS
  ) {
    throw new CloudCanvasAssetRepositoryError(
      "invalid-dimensions",
      "Image dimensions are invalid.",
    );
  }
  if (
    input.checksum !== undefined &&
    input.checksum !== null &&
    (input.checksum.trim() === "" ||
      input.checksum.length > CANVAS_ASSET_MAX_CHECKSUM_LENGTH)
  ) {
    throw new CloudCanvasAssetRepositoryError(
      "invalid-input",
      "Image checksum is invalid.",
    );
  }
  return { ...input, workspaceId, canvasId, assetId, mimeType };
}

function serverString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new CloudCanvasAssetRepositoryError(
      "invalid-server-metadata",
      `Cloud asset metadata has an invalid ${field}.`,
    );
  }
  return value;
}

function serverUuid(value: unknown, field: string): string {
  const result = serverString(value, field);
  if (!UUID_PATTERN.test(result)) {
    throw new CloudCanvasAssetRepositoryError(
      "invalid-server-metadata",
      `Cloud asset metadata has an invalid ${field}.`,
    );
  }
  return result;
}

function serverTimestamp(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new CloudCanvasAssetRepositoryError(
      "invalid-server-metadata",
      `Cloud asset metadata has an invalid ${field}.`,
    );
  }
  return value;
}

function serverNullableTimestamp(value: unknown, field: string): string | null {
  return value === null ? null : serverTimestamp(value, field);
}

function serverMime(value: unknown): CanvasImageMimeType {
  if (typeof value !== "string") {
    throw new CloudCanvasAssetRepositoryError(
      "invalid-server-metadata",
      "Cloud asset metadata has an invalid MIME type.",
    );
  }
  try {
    return inputMime(value);
  } catch {
    throw new CloudCanvasAssetRepositoryError(
      "invalid-server-metadata",
      "Cloud asset metadata has an unsupported MIME type.",
    );
  }
}

function serverPositiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new CloudCanvasAssetRepositoryError(
      "invalid-server-metadata",
      `Cloud asset metadata has an invalid ${field}.`,
    );
  }
  return value;
}

function mapAssetMetadata(
  value: unknown,
  expected: { workspaceId: string; canvasId: string; assetId: string },
  allowPending: boolean,
): CloudCanvasAssetMetadata {
  if (!isRecord(value)) {
    throw new CloudCanvasAssetRepositoryError(
      "invalid-server-metadata",
      "Cloud asset metadata is not an object.",
    );
  }
  const workspaceId = serverUuid(value.workspace_id, "workspace_id");
  const canvasId = serverUuid(value.canvas_id, "canvas_id");
  const id = serverUuid(value.id, "id");
  if (workspaceId !== expected.workspaceId) {
    throw new CloudCanvasAssetRepositoryError(
      "workspace-mismatch",
      "Cloud asset belongs to another workspace.",
    );
  }
  if (canvasId !== expected.canvasId) {
    throw new CloudCanvasAssetRepositoryError(
      "canvas-mismatch",
      "Cloud asset belongs to another Canvas.",
    );
  }
  if (id !== expected.assetId) {
    throw new CloudCanvasAssetRepositoryError(
      "invalid-server-metadata",
      "Cloud asset response returned another asset.",
    );
  }
  const storageKey = serverString(value.storage_key, "storage_key");
  const expectedStorageKey = `${workspaceId}/${canvasId}/${id}/original`;
  if (storageKey !== expectedStorageKey) {
    throw new CloudCanvasAssetRepositoryError(
      "invalid-server-metadata",
      "Cloud asset storage path is invalid.",
    );
  }
  const previewStorageKey =
    value.preview_storage_key === null
      ? null
      : serverString(value.preview_storage_key, "preview_storage_key");
  if (
    previewStorageKey !== null &&
    previewStorageKey !== `${workspaceId}/${canvasId}/${id}/preview.webp`
  ) {
    throw new CloudCanvasAssetRepositoryError(
      "invalid-server-metadata",
      "Cloud asset preview path is invalid.",
    );
  }
  const readyAt = serverNullableTimestamp(value.ready_at, "ready_at");
  if (!allowPending && readyAt === null) {
    throw new CloudCanvasAssetRepositoryError(
      "invalid-server-metadata",
      "Cloud asset is not finalized.",
    );
  }
  const deletedAt = serverNullableTimestamp(value.deleted_at, "deleted_at");
  if (deletedAt !== null) {
    throw new CloudCanvasAssetRepositoryError(
      "not-found",
      "Cloud asset was deleted.",
    );
  }
  const byteSize = serverPositiveInteger(value.byte_size, "byte_size");
  const width = serverPositiveInteger(value.width, "width");
  const height = serverPositiveInteger(value.height, "height");
  if (
    byteSize > CANVAS_IMAGE_INPUT_MAX_BYTES ||
    width > CANVAS_ASSET_MAX_DIMENSION ||
    height > CANVAS_ASSET_MAX_DIMENSION ||
    width * height > CANVAS_IMAGE_INPUT_MAX_PIXELS
  ) {
    throw new CloudCanvasAssetRepositoryError(
      "invalid-server-metadata",
      "Cloud asset metadata exceeds the supported limits.",
    );
  }
  const checksum =
    value.checksum === null ? null : serverString(value.checksum, "checksum");
  if (checksum !== null && checksum.length > CANVAS_ASSET_MAX_CHECKSUM_LENGTH) {
    throw new CloudCanvasAssetRepositoryError(
      "invalid-server-metadata",
      "Cloud asset checksum exceeds the supported limit.",
    );
  }
  return {
    id,
    workspaceId,
    canvasId,
    storageKey,
    previewStorageKey,
    mimeType: serverMime(value.mime_type),
    byteSize,
    width,
    height,
    checksum,
    createdBy: serverUuid(value.created_by, "created_by"),
    createdAt: serverTimestamp(value.created_at, "created_at"),
    readyAt,
    deletedAt,
  };
}

function rpcRow(data: unknown, operation: string): RecordValue {
  if (!Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) {
    throw new CloudCanvasAssetRepositoryError(
      "invalid-server-metadata",
      `Cloud asset ${operation} returned an invalid result.`,
    );
  }
  return data[0];
}

function errorCode(cause: unknown): string | undefined {
  return isRecord(cause) && typeof cause.code === "string"
    ? cause.code
    : undefined;
}

function statusCode(cause: unknown): string | undefined {
  if (!isRecord(cause)) return undefined;
  if (typeof cause.statusCode === "string") return cause.statusCode;
  if (typeof cause.status === "number") return String(cause.status);
  return undefined;
}

function isNotFound(cause: unknown): boolean {
  return errorCode(cause) === "PGRST116" || statusCode(cause) === "404";
}

function projectError(
  cause: unknown,
  operation: "upload" | "download" | "delete" | "metadata" | "cleanup",
): CloudCanvasAssetRepositoryError {
  if (cause instanceof CloudCanvasAssetRepositoryError) return cause;
  const code = errorCode(cause);
  const status = statusCode(cause);
  if (code === "PGRST301" || code === "401") {
    return new CloudCanvasAssetRepositoryError(
      "unauthenticated",
      "Canvas asset access requires an authenticated session.",
      { operation, code },
    );
  }
  if (code === "42501" || code === "403") {
    return new CloudCanvasAssetRepositoryError(
      "forbidden",
      "Canvas asset access is forbidden.",
      { operation, code },
    );
  }
  if (code === "23505") {
    return new CloudCanvasAssetRepositoryError(
      "conflict",
      "Canvas asset identity already exists.",
      { operation, code },
    );
  }
  if (code === "22023") {
    return new CloudCanvasAssetRepositoryError(
      operation === "metadata" || operation === "cleanup"
        ? "invalid-server-metadata"
        : "invalid-input",
      "Canvas asset metadata was rejected.",
      { operation, code },
    );
  }
  if (code === "PGRST116" || status === "404") {
    return new CloudCanvasAssetRepositoryError(
      "not-found",
      "Canvas asset was not found.",
      { operation, code, status },
    );
  }
  if (cause instanceof TypeError || cause instanceof DOMException) {
    return new CloudCanvasAssetRepositoryError(
      operation === "upload"
        ? "upload-failure"
        : operation === "download"
          ? "download-failure"
          : operation === "delete" || operation === "cleanup"
            ? "delete-failure"
            : "unexpected",
      "Canvas asset transport failed.",
      { operation, code, status },
    );
  }
  return new CloudCanvasAssetRepositoryError(
    operation === "upload"
      ? "upload-failure"
      : operation === "download"
        ? "download-failure"
        : operation === "delete" || operation === "cleanup"
          ? "delete-failure"
          : "unexpected",
    "Canvas asset operation failed.",
    { operation, code, status },
  );
}

async function assertAuthenticated(
  supabase: SupabaseClient<Database>,
): Promise<void> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) {
    throw new CloudCanvasAssetRepositoryError(
      "unauthenticated",
      "Canvas asset access requires an authenticated session.",
    );
  }
}

function defaultIdGenerator(): string {
  if (
    typeof crypto === "undefined" ||
    typeof crypto.randomUUID !== "function"
  ) {
    throw new CloudCanvasAssetRepositoryError(
      "unexpected",
      "Canvas asset ID generation is unavailable.",
    );
  }
  return crypto.randomUUID();
}

export class SupabaseCloudCanvasAssetRepository implements CloudCanvasAssetRepository {
  private readonly supabase: SupabaseClient<Database>;
  private readonly idGenerator: () => string;

  constructor(options: CloudCanvasAssetRepositoryOptions) {
    this.supabase = options.supabase;
    this.idGenerator = options.idGenerator ?? defaultIdGenerator;
  }

  async uploadAsset(
    input: UploadCloudCanvasAssetInput,
  ): Promise<CloudCanvasAssetMetadata> {
    let reserved: CloudCanvasAssetMetadata | undefined;
    try {
      await assertAuthenticated(this.supabase);
      const validated = inputUpload(input, this.idGenerator);
      const reserveParams = {
        target_workspace_id: validated.workspaceId,
        target_canvas_id: validated.canvasId,
        target_asset_id: validated.assetId,
        target_mime_type: validated.mimeType,
        target_byte_size: validated.byteSize,
        target_width: validated.width,
        target_height: validated.height,
        ...(validated.checksum === undefined || validated.checksum === null
          ? {}
          : { target_checksum: validated.checksum }),
      };
      const { data, error } = await this.supabase.rpc(
        "reserve_canvas_asset",
        reserveParams,
      );
      if (error) throw error;
      reserved = mapAssetMetadata(rpcRow(data, "reserve"), validated, true);
      const { error: uploadError } = await this.supabase.storage
        .from(CANVAS_ASSET_BUCKET)
        .upload(reserved.storageKey, validated.blob, {
          cacheControl: "3600",
          contentType: validated.mimeType,
          upsert: false,
          metadata: {
            assetId: reserved.id,
            canvasId: reserved.canvasId,
            width: String(reserved.width),
            height: String(reserved.height),
          },
        });
      if (uploadError) throw uploadError;
      const { data: finalizedData, error: finalizeError } =
        await this.supabase.rpc("finalize_canvas_asset", {
          target_workspace_id: validated.workspaceId,
          target_canvas_id: validated.canvasId,
          target_asset_id: validated.assetId,
        });
      if (finalizeError) throw finalizeError;
      return mapAssetMetadata(
        rpcRow(finalizedData, "finalize"),
        validated,
        false,
      );
    } catch (cause) {
      if (reserved) {
        const cleanupError = await this.cleanupReservedAsset(reserved);
        if (cleanupError) throw cleanupError;
      }
      throw projectError(cause, "upload");
    }
  }

  async getAssetMetadata(input: {
    workspaceId: string;
    canvasId: string;
    assetId: string;
  }): Promise<CloudCanvasAssetMetadata> {
    try {
      await assertAuthenticated(this.supabase);
      const workspaceId = inputUuid(input.workspaceId, "workspaceId");
      const canvasId = inputUuid(input.canvasId, "canvasId");
      const assetId = inputUuid(input.assetId, "assetId");
      const { data, error } = await this.supabase
        .from("canvas_assets")
        .select(ASSET_SELECT)
        .eq("workspace_id", workspaceId)
        .eq("canvas_id", canvasId)
        .eq("id", assetId)
        .is("deleted_at", null)
        .not("ready_at", "is", null)
        .maybeSingle();
      if (error) throw error;
      if (data === null) {
        throw new CloudCanvasAssetRepositoryError(
          "not-found",
          "Canvas asset was not found.",
        );
      }
      return mapAssetMetadata(data, { workspaceId, canvasId, assetId }, false);
    } catch (cause) {
      throw projectError(cause, "metadata");
    }
  }

  async downloadAsset(input: {
    workspaceId: string;
    canvasId: string;
    assetId: string;
  }): Promise<CloudCanvasAsset> {
    try {
      const metadata = await this.getAssetMetadata(input);
      const { data, error } = await this.supabase.storage
        .from(CANVAS_ASSET_BUCKET)
        .download(metadata.storageKey);
      if (error) throw error;
      if (!(data instanceof Blob)) {
        throw new CloudCanvasAssetRepositoryError(
          "invalid-server-metadata",
          "Canvas asset download did not return binary content.",
        );
      }
      return { ...metadata, blob: data };
    } catch (cause) {
      throw projectError(cause, "download");
    }
  }

  async deleteAsset(input: {
    workspaceId: string;
    canvasId: string;
    assetId: string;
  }): Promise<void> {
    let metadata: CloudCanvasAssetMetadata;
    try {
      metadata = await this.getAssetMetadata(input);
    } catch (cause) {
      throw projectError(cause, "delete");
    }

    let storageError: CloudCanvasAssetRepositoryError | undefined;
    try {
      const { error } = await this.supabase.storage
        .from(CANVAS_ASSET_BUCKET)
        .remove([metadata.storageKey]);
      if (error && !isNotFound(error)) throw error;
    } catch (cause) {
      storageError = projectError(cause, "delete");
    }

    let metadataError: CloudCanvasAssetRepositoryError | undefined;
    try {
      const { data, error } = await this.supabase.rpc("delete_canvas_asset", {
        target_workspace_id: metadata.workspaceId,
        target_canvas_id: metadata.canvasId,
        target_asset_id: metadata.id,
      });
      if (error) throw error;
      const row = rpcRow(data, "delete");
      if (row.deleted !== true) {
        throw new CloudCanvasAssetRepositoryError(
          "invalid-server-metadata",
          "Canvas asset delete was not confirmed.",
        );
      }
    } catch (cause) {
      metadataError = projectError(cause, "delete");
    }

    if (storageError || metadataError) {
      throw new CloudCanvasAssetRepositoryError(
        "partial-cleanup-failure",
        "Canvas asset cleanup was incomplete.",
        {
          storage: storageError?.code ?? null,
          metadata: metadataError?.code ?? null,
        },
      );
    }
  }

  private async cleanupReservedAsset(
    metadata: CloudCanvasAssetMetadata,
  ): Promise<CloudCanvasAssetRepositoryError | null> {
    let storageError: CloudCanvasAssetRepositoryError | undefined;
    try {
      const { error } = await this.supabase.storage
        .from(CANVAS_ASSET_BUCKET)
        .remove([metadata.storageKey]);
      if (error && !isNotFound(error)) throw error;
    } catch (cause) {
      storageError = projectError(cause, "cleanup");
    }

    let metadataError: CloudCanvasAssetRepositoryError | undefined;
    try {
      const { error } = await this.supabase.rpc("delete_canvas_asset", {
        target_workspace_id: metadata.workspaceId,
        target_canvas_id: metadata.canvasId,
        target_asset_id: metadata.id,
      });
      if (error) throw error;
    } catch (cause) {
      metadataError = projectError(cause, "cleanup");
    }

    if (!storageError && !metadataError) return null;
    return new CloudCanvasAssetRepositoryError(
      "partial-cleanup-failure",
      "Canvas asset cleanup was incomplete.",
      {
        storage: storageError?.code ?? null,
        metadata: metadataError?.code ?? null,
      },
    );
  }
}

export function createCloudCanvasAssetRepository(
  options: CloudCanvasAssetRepositoryOptions,
): CloudCanvasAssetRepository {
  return new SupabaseCloudCanvasAssetRepository(options);
}
