import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import {
  ensureProjectFileSearchIndex,
  indexProjectFileForSearch,
} from "./project-file-search-client";
import {
  PROJECT_FILES_BUCKET,
  type CreateProjectFolderInput,
  type ListProjectFilesInput,
  type MoveProjectFolderInput,
  type ProjectFileDownload,
  type ProjectFileRecord,
  type ProjectFileRepository,
  type ProjectFileScope,
  type ProjectFolderRecord,
  type UploadProjectFileInput,
} from "./project-file-repository";
import {
  CloudProjectFileRepositoryError,
  defaultProjectFileId,
  mapProjectFile,
  mapProjectFolder,
  PROJECT_FILE_SELECT,
  PROJECT_FOLDER_SELECT,
  projectFileFolderId,
  projectFileName,
  projectFileRepositoryError,
  projectFileRpcRow,
  projectFileScope,
  projectFileUuid,
  validateProjectFileUpload,
} from "./project-file-runtime";
import {
  getProjectFileResumableReservationStorage,
  projectFileResumableReservationKey,
  projectFileTusFingerprint,
  ProjectFileUploadCancelledError,
  uploadProjectFileResumable,
  type ProjectFileResumableReservationStorage,
} from "./project-file-resumable-upload";
import { projectFileUploadTransport } from "./project-file-upload-limit";

export type CloudProjectFileRepositoryOptions = {
  supabase: SupabaseClient<Database>;
  idGenerator?: () => string;
  resumableUploadEndpoint?: string | null;
  resumableReservationStorage?: ProjectFileResumableReservationStorage | null;
};

function projectFileReservationMatches(
  record: ProjectFileRecord,
  input: UploadProjectFileInput & { folderId: string | null },
): boolean {
  return (
    record.folderId === input.folderId &&
    record.name === input.name &&
    record.originalName === input.originalName &&
    record.mimeType === input.mimeType &&
    record.byteSize === input.byteSize &&
    record.checksum === (input.checksum ?? null) &&
    record.width === (input.width ?? null) &&
    record.height === (input.height ?? null)
  );
}

export class SupabaseProjectFileRepository implements ProjectFileRepository {
  private readonly supabase: SupabaseClient<Database>;
  private readonly idGenerator: () => string;
  private readonly resumableUploadEndpoint: string | null;
  private readonly resumableReservationStorage: ProjectFileResumableReservationStorage | null;
  private authenticatedUserId: string | null = null;
  private authenticationPromise: Promise<void> | null = null;
  private authenticationGeneration = 0;

  constructor(options: CloudProjectFileRepositoryOptions) {
    this.supabase = options.supabase;
    this.idGenerator = options.idGenerator ?? defaultProjectFileId;
    this.resumableUploadEndpoint = options.resumableUploadEndpoint ?? null;
    this.resumableReservationStorage =
      options.resumableReservationStorage === undefined
        ? getProjectFileResumableReservationStorage()
        : options.resumableReservationStorage;
  }

  invalidateAuthentication(): void {
    this.authenticationGeneration += 1;
    this.authenticatedUserId = null;
    this.authenticationPromise = null;
  }

  private assertAuthenticated(): Promise<void> {
    if (this.authenticatedUserId) return Promise.resolve();
    if (this.authenticationPromise) return this.authenticationPromise;
    const generation = this.authenticationGeneration;
    const pending = this.supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (error) throw error;
        if (!data.user?.id) {
          throw new CloudProjectFileRepositoryError(
            "unauthenticated",
            "Project Files requires an authenticated session.",
          );
        }
        if (generation === this.authenticationGeneration) {
          this.authenticatedUserId = data.user.id;
        }
      })
      .finally(() => {
        if (this.authenticationPromise === pending) {
          this.authenticationPromise = null;
        }
      });
    this.authenticationPromise = pending;
    return pending;
  }

  private async getAccessToken(): Promise<string> {
    const { data, error } = await this.supabase.auth.getSession();
    if (error) throw error;
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      throw new CloudProjectFileRepositoryError(
        "unauthenticated",
        "Project Files requires an authenticated session.",
      );
    }
    return accessToken;
  }

  private readResumableFileId(key: string): string | null {
    try {
      const value = this.resumableReservationStorage?.getItem(key);
      if (!value) return null;
      return projectFileUuid(value, "resumableFileId");
    } catch {
      this.removeResumableFileId(key);
      return null;
    }
  }

  private writeResumableFileId(key: string, fileId: string): void {
    try {
      this.resumableReservationStorage?.setItem(key, fileId);
    } catch {
      // Network retries still work even when browser persistence is unavailable.
    }
  }

  private removeResumableFileId(key: string): void {
    try {
      this.resumableReservationStorage?.removeItem(key);
    } catch {
      // Best-effort cleanup for privacy modes and restricted Storage contexts.
    }
  }

  private async findProjectFileReservation(
    scope: ProjectFileScope,
    fileId: string,
  ): Promise<ProjectFileRecord | null> {
    const { data, error } = await this.supabase
      .from("project_files")
      .select(PROJECT_FILE_SELECT)
      .eq("workspace_id", scope.workspaceId)
      .eq("project_id", scope.projectId)
      .eq("id", fileId)
      .maybeSingle();
    if (error) throw error;
    return data === null ? null : mapProjectFile(data, { ...scope, fileId });
  }

  async listFolders(
    scopeInput: ProjectFileScope,
  ): Promise<ProjectFolderRecord[]> {
    try {
      await this.assertAuthenticated();
      const scope = projectFileScope(scopeInput);
      const { data, error } = await this.supabase
        .from("project_folders")
        .select(PROJECT_FOLDER_SELECT)
        .eq("workspace_id", scope.workspaceId)
        .eq("project_id", scope.projectId)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => mapProjectFolder(row, scope));
    } catch (cause) {
      throw projectFileRepositoryError(cause, "metadata");
    }
  }

  async createFolder(
    input: CreateProjectFolderInput,
  ): Promise<ProjectFolderRecord> {
    try {
      await this.assertAuthenticated();
      const scope = projectFileScope(input);
      const name = projectFileName(input.name, "name");
      const parentFolderId = projectFileFolderId(input.parentFolderId);
      const { data, error } = await this.supabase.rpc("create_project_folder", {
        target_workspace_id: scope.workspaceId,
        target_project_id: scope.projectId,
        target_name: name,
        ...(parentFolderId === null
          ? {}
          : { target_parent_folder_id: parentFolderId }),
      });
      if (error) throw error;
      return mapProjectFolder(projectFileRpcRow(data, "create folder"), scope);
    } catch (cause) {
      throw projectFileRepositoryError(cause, "metadata");
    }
  }

  async renameFolder(
    input: ProjectFileScope & { folderId: string; name: string },
  ): Promise<ProjectFolderRecord> {
    try {
      await this.assertAuthenticated();
      const scope = projectFileScope(input);
      const folderId = projectFileUuid(input.folderId, "folderId");
      const name = projectFileName(input.name, "name");
      const { data, error } = await this.supabase.rpc("rename_project_folder", {
        target_workspace_id: scope.workspaceId,
        target_project_id: scope.projectId,
        target_folder_id: folderId,
        target_name: name,
      });
      if (error) throw error;
      return mapProjectFolder(projectFileRpcRow(data, "rename folder"), {
        ...scope,
        folderId,
      });
    } catch (cause) {
      throw projectFileRepositoryError(cause, "metadata");
    }
  }

  async moveFolder(
    input: MoveProjectFolderInput,
  ): Promise<ProjectFolderRecord> {
    try {
      await this.assertAuthenticated();
      const scope = projectFileScope(input);
      const folderId = projectFileUuid(input.folderId, "folderId");
      const parentFolderId = projectFileFolderId(input.parentFolderId);
      const { data, error } = await this.supabase.rpc("move_project_folder", {
        target_workspace_id: scope.workspaceId,
        target_project_id: scope.projectId,
        target_folder_id: folderId,
        ...(parentFolderId === null
          ? {}
          : { target_parent_folder_id: parentFolderId }),
      });
      if (error) throw error;
      return mapProjectFolder(projectFileRpcRow(data, "move folder"), {
        ...scope,
        folderId,
      });
    } catch (cause) {
      throw projectFileRepositoryError(cause, "metadata");
    }
  }

  async listFiles(input: ListProjectFilesInput): Promise<ProjectFileRecord[]> {
    try {
      await this.assertAuthenticated();
      const scope = projectFileScope(input);
      const search = input.query?.trim();
      if (search) {
        try {
          await ensureProjectFileSearchIndex(scope);
        } catch {
          // Search remains available from existing metadata/index rows even if
          // best-effort extraction is temporarily unavailable.
        }
        const { data, error } = await this.supabase.rpc(
          "search_project_files",
          {
            target_workspace_id: scope.workspaceId,
            target_project_id: scope.projectId,
            target_query: search,
            target_limit: 200,
          },
        );
        if (error) throw error;
        return (data ?? []).map((row) => mapProjectFile(row, scope));
      }

      let query = this.supabase
        .from("project_files")
        .select(PROJECT_FILE_SELECT)
        .eq("workspace_id", scope.workspaceId)
        .eq("project_id", scope.projectId)
        .not("ready_at", "is", null);
      if (!input.includeDeleted) query = query.is("deleted_at", null);
      if (input.folderId !== undefined) {
        const folderId = projectFileFolderId(input.folderId);
        query =
          folderId === null
            ? query.is("folder_id", null)
            : query.eq("folder_id", folderId);
      }
      const { data, error } = await query.order("created_at", {
        ascending: false,
      });
      if (error) throw error;
      return (data ?? []).map((row) => mapProjectFile(row, scope));
    } catch (cause) {
      throw projectFileRepositoryError(cause, "metadata");
    }
  }

  async listPendingFiles(
    input: ProjectFileScope & { folderId?: string | null },
  ): Promise<ProjectFileRecord[]> {
    try {
      await this.assertAuthenticated();
      const userId = this.authenticatedUserId;
      if (!userId) {
        throw new CloudProjectFileRepositoryError(
          "unauthenticated",
          "Project Files requires an authenticated session.",
        );
      }
      const scope = projectFileScope(input);
      let query = this.supabase
        .from("project_files")
        .select(PROJECT_FILE_SELECT)
        .eq("workspace_id", scope.workspaceId)
        .eq("project_id", scope.projectId)
        .eq("created_by", userId)
        .is("ready_at", null)
        .is("deleted_at", null);
      if (input.folderId !== undefined) {
        const folderId = projectFileFolderId(input.folderId);
        query =
          folderId === null
            ? query.is("folder_id", null)
            : query.eq("folder_id", folderId);
      }
      const { data, error } = await query.order("created_at", {
        ascending: false,
      });
      if (error) throw error;
      return (data ?? []).map((row) => mapProjectFile(row, scope));
    } catch (cause) {
      throw projectFileRepositoryError(cause, "metadata");
    }
  }

  async getFile(
    input: ProjectFileScope & { fileId: string },
  ): Promise<ProjectFileRecord> {
    try {
      await this.assertAuthenticated();
      const scope = projectFileScope(input);
      const fileId = projectFileUuid(input.fileId, "fileId");
      const { data, error } = await this.supabase
        .from("project_files")
        .select(PROJECT_FILE_SELECT)
        .eq("workspace_id", scope.workspaceId)
        .eq("project_id", scope.projectId)
        .eq("id", fileId)
        .is("deleted_at", null)
        .not("ready_at", "is", null)
        .maybeSingle();
      if (error) throw error;
      if (data === null) {
        throw new CloudProjectFileRepositoryError(
          "not-found",
          "Project file was not found.",
        );
      }
      return mapProjectFile(data, { ...scope, fileId });
    } catch (cause) {
      throw projectFileRepositoryError(cause, "metadata");
    }
  }

  async uploadFile(input: UploadProjectFileInput): Promise<ProjectFileRecord> {
    let resumableReservationKey: string | null = null;
    let reservedForCancellation: ProjectFileRecord | null = null;

    try {
      await this.assertAuthenticated();
      const validated = validateProjectFileUpload(input, this.idGenerator);
      const transport = projectFileUploadTransport(validated.byteSize);
      const scope = {
        workspaceId: validated.workspaceId,
        projectId: validated.projectId,
      };

      if (input.signal?.aborted) {
        throw new ProjectFileUploadCancelledError();
      }

      let reserved: ProjectFileRecord | null = null;
      if (transport === "resumable") {
        const resumeKey = validated.resumeKey?.trim();
        if (!this.resumableUploadEndpoint || !resumeKey) {
          throw new CloudProjectFileRepositoryError(
            "invalid-input",
            "Resumable Project file upload is not configured.",
          );
        }

        resumableReservationKey = projectFileResumableReservationKey({
          ...scope,
          folderId: validated.folderId,
          resumeKey,
        });

        if (input.fileId) {
          const explicitReservation = await this.findProjectFileReservation(
            scope,
            validated.fileId,
          );
          if (explicitReservation) {
            if (
              !projectFileReservationMatches(explicitReservation, validated)
            ) {
              throw new CloudProjectFileRepositoryError(
                "invalid-input",
                "The selected file does not match the pending upload.",
              );
            }
            if (explicitReservation.deletedAt !== null) {
              throw new CloudProjectFileRepositoryError(
                "invalid-input",
                "The pending upload is no longer active.",
              );
            }
            if (explicitReservation.readyAt !== null) {
              this.removeResumableFileId(resumableReservationKey);
              return explicitReservation;
            }
            reserved = explicitReservation;
          }
        }

        if (!reserved) {
          const previousFileId = this.readResumableFileId(
            resumableReservationKey,
          );
          if (previousFileId) {
            const previous = await this.findProjectFileReservation(
              scope,
              previousFileId,
            );
            if (
              previous &&
              projectFileReservationMatches(previous, validated)
            ) {
              if (previous.readyAt !== null && previous.deletedAt === null) {
                this.removeResumableFileId(resumableReservationKey);
                return previous;
              }
              if (previous.readyAt === null && previous.deletedAt === null) {
                reserved = previous;
              }
            }
            if (!reserved) {
              this.removeResumableFileId(resumableReservationKey);
            }
          }
        }
      }

      if (!reserved) {
        const { data: reservedData, error: reserveError } =
          await this.supabase.rpc("reserve_project_file", {
            target_workspace_id: validated.workspaceId,
            target_project_id: validated.projectId,
            target_file_id: validated.fileId,
            target_name: validated.name,
            target_original_name: validated.originalName,
            target_mime_type: validated.mimeType,
            target_byte_size: validated.byteSize,
            ...(validated.folderId === null
              ? {}
              : { target_folder_id: validated.folderId }),
            ...(validated.width == null
              ? {}
              : { target_width: validated.width }),
            ...(validated.height == null
              ? {}
              : { target_height: validated.height }),
            ...(validated.checksum == null
              ? {}
              : { target_checksum: validated.checksum }),
          });
        if (reserveError) throw reserveError;
        reserved = mapProjectFile(
          projectFileRpcRow(reservedData, "reserve file"),
          { ...scope, fileId: validated.fileId },
        );
        if (reserved.readyAt !== null || reserved.deletedAt !== null) {
          throw new CloudProjectFileRepositoryError(
            "invalid-server-metadata",
            "Reserved Project file metadata is invalid.",
          );
        }
        if (resumableReservationKey) {
          this.writeResumableFileId(resumableReservationKey, reserved.id);
        }
      }

      if (resumableReservationKey) {
        this.writeResumableFileId(resumableReservationKey, reserved.id);
      }

      reservedForCancellation = reserved;
      const expected = { ...scope, fileId: reserved.id };

      if (transport === "standard") {
        input.onProgress?.({
          transport,
          bytesUploaded: 0,
          bytesTotal: validated.byteSize,
          percentage: 0,
        });
        const { error: uploadError } = await this.supabase.storage
          .from(PROJECT_FILES_BUCKET)
          .upload(reserved.storageKey, validated.blob, {
            cacheControl: "3600",
            contentType: validated.mimeType,
            upsert: false,
            metadata: {
              fileId: reserved.id,
              projectId: reserved.projectId,
              originalName: reserved.originalName,
            },
          });
        if (uploadError) throw uploadError;
        input.onProgress?.({
          transport,
          bytesUploaded: validated.byteSize,
          bytesTotal: validated.byteSize,
          percentage: 100,
        });
      } else {
        const resumeKey = validated.resumeKey?.trim();
        if (!resumeKey || !this.resumableUploadEndpoint) {
          throw new CloudProjectFileRepositoryError(
            "invalid-input",
            "Resumable Project file upload is not configured.",
          );
        }
        await uploadProjectFileResumable({
          blob: validated.blob,
          endpoint: this.resumableUploadEndpoint,
          storageKey: reserved.storageKey,
          mimeType: validated.mimeType,
          fingerprint: projectFileTusFingerprint({
            workspaceId: validated.workspaceId,
            fileId: reserved.id,
            resumeKey,
          }),
          getAccessToken: () => this.getAccessToken(),
          signal: input.signal,
          onProgress: input.onProgress,
          onResume: input.onResume,
          onRetry: input.onRetry,
        });
        if (input.signal?.aborted) {
          throw new ProjectFileUploadCancelledError();
        }
      }

      const { data: finalizedData, error: finalizeError } =
        await this.supabase.rpc("finalize_project_file", {
          target_workspace_id: validated.workspaceId,
          target_project_id: validated.projectId,
          target_file_id: reserved.id,
        });
      if (finalizeError) throw finalizeError;
      const finalized = mapProjectFile(
        projectFileRpcRow(finalizedData, "finalize file"),
        expected,
      );
      if (finalized.readyAt === null || finalized.deletedAt !== null) {
        throw new CloudProjectFileRepositoryError(
          "invalid-server-metadata",
          "Finalized Project file metadata is invalid.",
        );
      }
      if (resumableReservationKey) {
        this.removeResumableFileId(resumableReservationKey);
      }
      void indexProjectFileForSearch({
        workspaceId: finalized.workspaceId,
        projectId: finalized.projectId,
        fileId: finalized.id,
      }).catch(() => {
        // Derived search indexing must never turn a successful upload into a failure.
      });
      return finalized;
    } catch (cause) {
      if (
        cause instanceof ProjectFileUploadCancelledError ||
        input.signal?.aborted
      ) {
        if (resumableReservationKey) {
          this.removeResumableFileId(resumableReservationKey);
        }
        if (reservedForCancellation?.readyAt === null) {
          try {
            await this.supabase.rpc("delete_project_file", {
              target_workspace_id: reservedForCancellation.workspaceId,
              target_project_id: reservedForCancellation.projectId,
              target_file_id: reservedForCancellation.id,
            });
          } catch {
            // Cancellation should remain responsive even if metadata cleanup fails.
          }
        }
        throw new CloudProjectFileRepositoryError(
          "cancelled",
          "Project file upload was cancelled.",
        );
      }
      throw projectFileRepositoryError(cause, "upload");
    }
  }

  async renameFile(
    input: ProjectFileScope & { fileId: string; name: string },
  ): Promise<ProjectFileRecord> {
    try {
      await this.assertAuthenticated();
      const scope = projectFileScope(input);
      const fileId = projectFileUuid(input.fileId, "fileId");
      const name = projectFileName(input.name, "name");
      const { data, error } = await this.supabase.rpc("rename_project_file", {
        target_workspace_id: scope.workspaceId,
        target_project_id: scope.projectId,
        target_file_id: fileId,
        target_name: name,
      });
      if (error) throw error;
      return mapProjectFile(projectFileRpcRow(data, "rename file"), {
        ...scope,
        fileId,
      });
    } catch (cause) {
      throw projectFileRepositoryError(cause, "metadata");
    }
  }

  async moveFile(
    input: ProjectFileScope & { fileId: string; folderId: string | null },
  ): Promise<ProjectFileRecord> {
    try {
      await this.assertAuthenticated();
      const scope = projectFileScope(input);
      const fileId = projectFileUuid(input.fileId, "fileId");
      const folderId = projectFileFolderId(input.folderId);
      const { data, error } = await this.supabase.rpc("move_project_file", {
        target_workspace_id: scope.workspaceId,
        target_project_id: scope.projectId,
        target_file_id: fileId,
        ...(folderId === null ? {} : { target_folder_id: folderId }),
      });
      if (error) throw error;
      return mapProjectFile(projectFileRpcRow(data, "move file"), {
        ...scope,
        fileId,
      });
    } catch (cause) {
      throw projectFileRepositoryError(cause, "metadata");
    }
  }

  async deleteFile(
    input: ProjectFileScope & { fileId: string },
  ): Promise<ProjectFileRecord> {
    try {
      await this.assertAuthenticated();
      const scope = projectFileScope(input);
      const fileId = projectFileUuid(input.fileId, "fileId");
      const { data, error } = await this.supabase.rpc("delete_project_file", {
        target_workspace_id: scope.workspaceId,
        target_project_id: scope.projectId,
        target_file_id: fileId,
      });
      if (error) throw error;
      return mapProjectFile(projectFileRpcRow(data, "delete file"), {
        ...scope,
        fileId,
      });
    } catch (cause) {
      throw projectFileRepositoryError(cause, "metadata");
    }
  }

  async restoreFile(
    input: ProjectFileScope & { fileId: string },
  ): Promise<ProjectFileRecord> {
    try {
      await this.assertAuthenticated();
      const scope = projectFileScope(input);
      const fileId = projectFileUuid(input.fileId, "fileId");
      const { data, error } = await this.supabase.rpc("restore_project_file", {
        target_workspace_id: scope.workspaceId,
        target_project_id: scope.projectId,
        target_file_id: fileId,
      });
      if (error) throw error;
      return mapProjectFile(projectFileRpcRow(data, "restore file"), {
        ...scope,
        fileId,
      });
    } catch (cause) {
      throw projectFileRepositoryError(cause, "metadata");
    }
  }

  async downloadFile(
    input: ProjectFileScope & { fileId: string },
  ): Promise<ProjectFileDownload> {
    try {
      const metadata = await this.getFile(input);
      const { data, error } = await this.supabase.storage
        .from(PROJECT_FILES_BUCKET)
        .download(metadata.storageKey);
      if (error) throw error;
      if (!(data instanceof Blob)) {
        throw new CloudProjectFileRepositoryError(
          "invalid-server-metadata",
          "Project file download did not return binary content.",
        );
      }
      return { ...metadata, blob: data };
    } catch (cause) {
      throw projectFileRepositoryError(cause, "download");
    }
  }
}
