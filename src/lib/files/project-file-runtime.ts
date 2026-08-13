import type { Database } from "@/lib/supabase/database.types";
import {
  PROJECT_FILE_MAX_BYTES,
  PROJECT_FILE_MAX_CHECKSUM_LENGTH,
  PROJECT_FILE_MAX_IMAGE_DIMENSION,
  PROJECT_FILE_MAX_IMAGE_PIXELS,
  PROJECT_FILE_MAX_NAME_LENGTH,
  isProjectFileImageMimeType,
  isProjectFileMimeType,
  projectFileStorageKey,
  type ProjectFileMimeType,
  type ProjectFileRecord,
  type ProjectFileScope,
  type ProjectFolderRecord,
  type UploadProjectFileInput,
} from "./project-file-repository";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const PROJECT_FILE_SELECT =
  "id,workspace_id,project_id,folder_id,name,original_name,storage_key,mime_type,byte_size,checksum,width,height,created_by,created_at,updated_at,ready_at,deleted_at";
export const PROJECT_FOLDER_SELECT =
  "id,workspace_id,project_id,parent_folder_id,name,sort_order,created_by,created_at,updated_at,deleted_at";

export type ProjectFileRow =
  Database["public"]["Tables"]["project_files"]["Row"];
export type ProjectFolderRow =
  Database["public"]["Tables"]["project_folders"]["Row"];

export type ProjectFileRepositoryErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "invalid-input"
  | "invalid-server-metadata"
  | "upload-failure"
  | "download-failure"
  | "unexpected";

export class CloudProjectFileRepositoryError extends Error {
  readonly code: ProjectFileRepositoryErrorCode;
  readonly details?: Readonly<Record<string, string | undefined>>;

  constructor(
    code: ProjectFileRepositoryErrorCode,
    message: string,
    details?: Readonly<Record<string, string | undefined>>,
  ) {
    super(message);
    this.name = "CloudProjectFileRepositoryError";
    this.code = code;
    this.details = details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

export function projectFileRepositoryError(
  cause: unknown,
  operation: "metadata" | "upload" | "download",
): CloudProjectFileRepositoryError {
  if (cause instanceof CloudProjectFileRepositoryError) return cause;
  const code = errorCode(cause);
  const status = statusCode(cause);
  if (code === "PGRST301" || code === "401" || status === "401") {
    return new CloudProjectFileRepositoryError(
      "unauthenticated",
      "Project Files requires an authenticated session.",
      { code, status },
    );
  }
  if (code === "42501" || code === "403" || status === "403") {
    return new CloudProjectFileRepositoryError(
      "forbidden",
      "Project Files access is forbidden.",
      { code, status },
    );
  }
  if (code === "23505") {
    return new CloudProjectFileRepositoryError(
      "conflict",
      "Project file or folder identity already exists.",
      { code, status },
    );
  }
  if (code === "22023" || code === "23514" || code === "23503") {
    return new CloudProjectFileRepositoryError(
      "invalid-input",
      "Project Files rejected invalid metadata.",
      { code, status },
    );
  }
  if (code === "PGRST116" || status === "404") {
    return new CloudProjectFileRepositoryError(
      "not-found",
      "Project file or folder was not found.",
      { code, status },
    );
  }
  return new CloudProjectFileRepositoryError(
    operation === "upload"
      ? "upload-failure"
      : operation === "download"
        ? "download-failure"
        : "unexpected",
    "Project Files operation failed.",
    { code, status },
  );
}

export function defaultProjectFileId(): string {
  if (
    typeof crypto === "undefined" ||
    typeof crypto.randomUUID !== "function"
  ) {
    throw new CloudProjectFileRepositoryError(
      "unexpected",
      "Project file ID generation is unavailable.",
    );
  }
  return crypto.randomUUID();
}

export function projectFileUuid(value: string, field: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new CloudProjectFileRepositoryError(
      "invalid-input",
      `${field} must be a UUID.`,
    );
  }
  return value.toLowerCase();
}

export function projectFileProjectId(value: string): string {
  if (value !== value.trim() || value.length < 1 || value.length > 128) {
    throw new CloudProjectFileRepositoryError(
      "invalid-input",
      "projectId is invalid.",
    );
  }
  return value;
}

export function projectFileScope(scope: ProjectFileScope): ProjectFileScope {
  return {
    workspaceId: projectFileUuid(scope.workspaceId, "workspaceId"),
    projectId: projectFileProjectId(scope.projectId),
  };
}

export function projectFileName(value: string, field: string): string {
  if (
    value !== value.trim() ||
    value.length < 1 ||
    value.length > PROJECT_FILE_MAX_NAME_LENGTH ||
    value.includes("/") ||
    value.includes("\\")
  ) {
    throw new CloudProjectFileRepositoryError(
      "invalid-input",
      `${field} is invalid.`,
    );
  }
  return value;
}

export function projectFileFolderId(
  value: string | null | undefined,
): string | null {
  return value == null ? null : projectFileUuid(value, "folderId");
}

export function validateProjectFileUpload(
  input: UploadProjectFileInput,
  idGenerator: () => string,
): UploadProjectFileInput & { fileId: string; folderId: string | null } {
  const scope = projectFileScope(input);
  const fileId = projectFileUuid(input.fileId ?? idGenerator(), "fileId");
  const folderId = projectFileFolderId(input.folderId);
  const name = projectFileName(input.name, "name");
  const originalName = projectFileName(input.originalName, "originalName");
  if (!isProjectFileMimeType(input.mimeType)) {
    throw new CloudProjectFileRepositoryError(
      "invalid-input",
      "Project file MIME type is unsupported.",
    );
  }
  if (
    !Number.isInteger(input.byteSize) ||
    input.byteSize <= 0 ||
    input.byteSize > PROJECT_FILE_MAX_BYTES ||
    input.blob.size !== input.byteSize
  ) {
    throw new CloudProjectFileRepositoryError(
      "invalid-input",
      "Project file byte size is invalid.",
    );
  }
  if (input.blob.type && input.blob.type.toLowerCase() !== input.mimeType) {
    throw new CloudProjectFileRepositoryError(
      "invalid-input",
      "Project file Blob MIME type does not match metadata.",
    );
  }
  if (
    input.checksum != null &&
    (input.checksum.trim().length < 1 ||
      input.checksum.length > PROJECT_FILE_MAX_CHECKSUM_LENGTH)
  ) {
    throw new CloudProjectFileRepositoryError(
      "invalid-input",
      "Project file checksum is invalid.",
    );
  }
  if (isProjectFileImageMimeType(input.mimeType)) {
    if (
      !Number.isInteger(input.width) ||
      !Number.isInteger(input.height) ||
      (input.width ?? 0) <= 0 ||
      (input.height ?? 0) <= 0 ||
      (input.width ?? 0) > PROJECT_FILE_MAX_IMAGE_DIMENSION ||
      (input.height ?? 0) > PROJECT_FILE_MAX_IMAGE_DIMENSION ||
      (input.width ?? 0) * (input.height ?? 0) >
        PROJECT_FILE_MAX_IMAGE_PIXELS
    ) {
      throw new CloudProjectFileRepositoryError(
        "invalid-input",
        "Project image dimensions are invalid.",
      );
    }
  } else if (input.width != null || input.height != null) {
    throw new CloudProjectFileRepositoryError(
      "invalid-input",
      "Non-image Project files cannot carry image dimensions.",
    );
  }
  return {
    ...input,
    ...scope,
    fileId,
    folderId,
    name,
    originalName,
  };
}

export function projectFileRpcRow<T>(data: T[] | null, operation: string): T {
  if (!data || data.length !== 1) {
    throw new CloudProjectFileRepositoryError(
      "invalid-server-metadata",
      `Project Files ${operation} returned invalid metadata.`,
    );
  }
  return data[0];
}

export function mapProjectFolder(
  row: ProjectFolderRow,
  expected?: ProjectFileScope & { folderId?: string },
): ProjectFolderRecord {
  const record: ProjectFolderRecord = {
    id: projectFileUuid(row.id, "folder.id"),
    workspaceId: projectFileUuid(row.workspace_id, "folder.workspaceId"),
    projectId: projectFileProjectId(row.project_id),
    parentFolderId:
      row.parent_folder_id === null
        ? null
        : projectFileUuid(row.parent_folder_id, "folder.parentFolderId"),
    name: projectFileName(row.name, "folder.name"),
    sortOrder: row.sort_order,
    createdBy: projectFileUuid(row.created_by, "folder.createdBy"),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
  if (
    expected &&
    (record.workspaceId !== expected.workspaceId ||
      record.projectId !== expected.projectId ||
      (expected.folderId !== undefined && record.id !== expected.folderId))
  ) {
    throw new CloudProjectFileRepositoryError(
      "invalid-server-metadata",
      "Project folder metadata escaped the requested scope.",
    );
  }
  return record;
}

export function mapProjectFile(
  row: ProjectFileRow,
  expected?: ProjectFileScope & { fileId?: string },
): ProjectFileRecord {
  if (!isProjectFileMimeType(row.mime_type)) {
    throw new CloudProjectFileRepositoryError(
      "invalid-server-metadata",
      "Project file MIME metadata is invalid.",
    );
  }
  const record: ProjectFileRecord = {
    id: projectFileUuid(row.id, "file.id"),
    workspaceId: projectFileUuid(row.workspace_id, "file.workspaceId"),
    projectId: projectFileProjectId(row.project_id),
    folderId:
      row.folder_id === null
        ? null
        : projectFileUuid(row.folder_id, "file.folderId"),
    name: projectFileName(row.name, "file.name"),
    originalName: projectFileName(row.original_name, "file.originalName"),
    storageKey: row.storage_key,
    mimeType: row.mime_type as ProjectFileMimeType,
    byteSize: row.byte_size,
    checksum: row.checksum,
    width: row.width,
    height: row.height,
    createdBy: projectFileUuid(row.created_by, "file.createdBy"),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    readyAt: row.ready_at,
    deletedAt: row.deleted_at,
  };
  if (
    record.storageKey !==
    projectFileStorageKey({ workspaceId: record.workspaceId, fileId: record.id })
  ) {
    throw new CloudProjectFileRepositoryError(
      "invalid-server-metadata",
      "Project file Storage key is invalid.",
    );
  }
  if (
    expected &&
    (record.workspaceId !== expected.workspaceId ||
      record.projectId !== expected.projectId ||
      (expected.fileId !== undefined && record.id !== expected.fileId))
  ) {
    throw new CloudProjectFileRepositoryError(
      "invalid-server-metadata",
      "Project file metadata escaped the requested scope.",
    );
  }
  return record;
}
