export const PROJECT_FILES_BUCKET = "project-files";
export const PROJECT_FILE_MAX_BYTES = 50 * 1024 * 1024;
export const PROJECT_FILE_MAX_NAME_LENGTH = 255;
export const PROJECT_FILE_MAX_CHECKSUM_LENGTH = 256;
export const PROJECT_FILE_MAX_IMAGE_DIMENSION = 50_000;
export const PROJECT_FILE_MAX_IMAGE_PIXELS = 250_000_000;

export const PROJECT_FILE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;

export type ProjectFileMimeType = (typeof PROJECT_FILE_MIME_TYPES)[number];

export type ProjectFolderRecord = {
  id: string;
  workspaceId: string;
  projectId: string;
  parentFolderId: string | null;
  name: string;
  sortOrder: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ProjectFileRecord = {
  id: string;
  workspaceId: string;
  projectId: string;
  folderId: string | null;
  name: string;
  originalName: string;
  storageKey: string;
  mimeType: ProjectFileMimeType;
  byteSize: number;
  checksum: string | null;
  width: number | null;
  height: number | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  readyAt: string | null;
  deletedAt: string | null;
};

export type ProjectFileDownload = ProjectFileRecord & {
  blob: Blob;
};

export type ProjectFileScope = {
  workspaceId: string;
  projectId: string;
};

export type CreateProjectFolderInput = ProjectFileScope & {
  name: string;
  parentFolderId?: string | null;
};

export type MoveProjectFolderInput = {
  folderId: string;
  parentFolderId: string | null;
};

export type UploadProjectFileInput = ProjectFileScope & {
  fileId?: string;
  folderId?: string | null;
  name: string;
  originalName: string;
  blob: Blob;
  mimeType: ProjectFileMimeType;
  byteSize: number;
  checksum?: string | null;
  width?: number | null;
  height?: number | null;
};

export type ListProjectFilesInput = ProjectFileScope & {
  folderId?: string | null;
  query?: string;
  includeDeleted?: boolean;
};

export interface ProjectFileRepository {
  listFolders(scope: ProjectFileScope): Promise<ProjectFolderRecord[]>;
  createFolder(input: CreateProjectFolderInput): Promise<ProjectFolderRecord>;
  renameFolder(input: {
    folderId: string;
    name: string;
  }): Promise<ProjectFolderRecord>;
  moveFolder(input: MoveProjectFolderInput): Promise<ProjectFolderRecord>;

  listFiles(input: ListProjectFilesInput): Promise<ProjectFileRecord[]>;
  getFile(
    input: ProjectFileScope & { fileId: string },
  ): Promise<ProjectFileRecord>;
  uploadFile(input: UploadProjectFileInput): Promise<ProjectFileRecord>;
  renameFile(input: {
    fileId: string;
    name: string;
  }): Promise<ProjectFileRecord>;
  moveFile(input: {
    fileId: string;
    folderId: string | null;
  }): Promise<ProjectFileRecord>;
  deleteFile(input: { fileId: string }): Promise<ProjectFileRecord>;
  restoreFile(input: { fileId: string }): Promise<ProjectFileRecord>;
  downloadFile(
    input: ProjectFileScope & { fileId: string },
  ): Promise<ProjectFileDownload>;

  invalidateAuthentication(): void;
}

export function projectFileStorageKey(input: {
  workspaceId: string;
  fileId: string;
}): string {
  return `${input.workspaceId}/${input.fileId}/original`;
}

export function isProjectFileMimeType(
  value: string,
): value is ProjectFileMimeType {
  return (PROJECT_FILE_MIME_TYPES as readonly string[]).includes(value);
}

export function isProjectFileImageMimeType(
  value: ProjectFileMimeType,
): boolean {
  return value.startsWith("image/");
}
