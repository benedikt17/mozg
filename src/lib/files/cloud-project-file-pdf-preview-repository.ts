import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import { PROJECT_FILES_BUCKET } from "./project-file-repository";
import {
  PROJECT_FILE_PDF_COVER_KIND,
  PROJECT_FILE_PDF_COVER_MAX_BYTES,
  PROJECT_FILE_PDF_COVER_MAX_DIMENSION,
  PROJECT_FILE_PDF_COVER_MIME_TYPE,
} from "./project-file-pdf-preview";
import type {
  ProjectFilePdfCoverMetadata,
  ProjectFilePdfCoverRecord,
  ProjectFilePdfPreviewRepository,
  StoreProjectFilePdfCoverInput,
} from "./project-file-pdf-preview-repository";
import {
  CloudProjectFileRepositoryError,
  projectFileProjectId,
  projectFileRepositoryError,
  projectFileScope,
  projectFileUuid,
} from "./project-file-runtime";

type ProjectFileVariantRow =
  Database["public"]["Tables"]["file_variants"]["Row"];

const PROJECT_FILE_PDF_COVER_SELECT =
  "workspace_id,project_id,file_id,kind,storage_path,mime_type,byte_size,pixel_width,pixel_height,target_max_edge,created_at,ready_at,processing_error";

function statusCode(cause: unknown): string | undefined {
  if (typeof cause !== "object" || cause === null) return undefined;
  const value = cause as { status?: unknown; statusCode?: unknown };
  if (typeof value.statusCode === "string") return value.statusCode;
  if (typeof value.statusCode === "number") return String(value.statusCode);
  if (typeof value.status === "number") return String(value.status);
  return undefined;
}

function coverStoragePath(workspaceId: string, fileId: string): string {
  return `${workspaceId}/${fileId}/variants/${PROJECT_FILE_PDF_COVER_KIND}.webp`;
}

function mapPdfCover(
  row: ProjectFileVariantRow,
  expected: { workspaceId: string; projectId: string; fileId: string },
): ProjectFilePdfCoverMetadata {
  const workspaceId = projectFileUuid(row.workspace_id, "pdfCover.workspaceId");
  const projectId = projectFileProjectId(row.project_id);
  const fileId = projectFileUuid(row.file_id, "pdfCover.fileId");
  if (
    workspaceId !== expected.workspaceId ||
    projectId !== expected.projectId ||
    fileId !== expected.fileId ||
    row.kind !== PROJECT_FILE_PDF_COVER_KIND ||
    row.storage_path !== coverStoragePath(workspaceId, fileId) ||
    row.mime_type !== PROJECT_FILE_PDF_COVER_MIME_TYPE ||
    !Number.isSafeInteger(row.byte_size) ||
    row.byte_size <= 0 ||
    row.byte_size > PROJECT_FILE_PDF_COVER_MAX_BYTES ||
    !Number.isSafeInteger(row.pixel_width) ||
    !Number.isSafeInteger(row.pixel_height) ||
    (row.pixel_width ?? 0) <= 0 ||
    (row.pixel_height ?? 0) <= 0 ||
    (row.pixel_width ?? 0) > PROJECT_FILE_PDF_COVER_MAX_DIMENSION ||
    (row.pixel_height ?? 0) > PROJECT_FILE_PDF_COVER_MAX_DIMENSION ||
    row.target_max_edge !==
      Math.max(row.pixel_width ?? 0, row.pixel_height ?? 0)
  ) {
    throw new CloudProjectFileRepositoryError(
      "invalid-server-metadata",
      "Project File PDF cover metadata is invalid.",
    );
  }
  return {
    workspaceId,
    projectId,
    fileId,
    kind: PROJECT_FILE_PDF_COVER_KIND,
    storagePath: row.storage_path,
    mimeType: PROJECT_FILE_PDF_COVER_MIME_TYPE,
    byteSize: row.byte_size,
    pixelWidth: row.pixel_width as number,
    pixelHeight: row.pixel_height as number,
    createdAt: row.created_at,
    readyAt: row.ready_at,
    processingError: row.processing_error,
  };
}

export class SupabaseProjectFilePdfPreviewRepository implements ProjectFilePdfPreviewRepository {
  private authenticatedUserId: string | null = null;
  private authenticationPromise: Promise<void> | null = null;
  private authenticationGeneration = 0;

  constructor(private readonly supabase: SupabaseClient<Database>) {}

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

  async getPdfCover(input: {
    workspaceId: string;
    projectId: string;
    fileId: string;
  }): Promise<ProjectFilePdfCoverMetadata | null> {
    try {
      await this.assertAuthenticated();
      const scope = projectFileScope(input);
      const fileId = projectFileUuid(input.fileId, "fileId");
      const { data, error } = await this.supabase
        .from("file_variants")
        .select(PROJECT_FILE_PDF_COVER_SELECT)
        .eq("workspace_id", scope.workspaceId)
        .eq("project_id", scope.projectId)
        .eq("file_id", fileId)
        .eq("kind", PROJECT_FILE_PDF_COVER_KIND)
        .maybeSingle();
      if (error) throw error;
      return data === null ? null : mapPdfCover(data, { ...scope, fileId });
    } catch (cause) {
      throw projectFileRepositoryError(cause, "metadata");
    }
  }

  async loadPdfCover(input: {
    workspaceId: string;
    projectId: string;
    fileId: string;
  }): Promise<ProjectFilePdfCoverRecord | null> {
    try {
      const metadata = await this.getPdfCover(input);
      if (metadata === null || metadata.readyAt === null) return null;
      const { data: blob, error } = await this.supabase.storage
        .from(PROJECT_FILES_BUCKET)
        .download(metadata.storagePath);
      if (error) throw error;
      if (
        !(blob instanceof Blob) ||
        blob.type !== PROJECT_FILE_PDF_COVER_MIME_TYPE
      ) {
        throw new CloudProjectFileRepositoryError(
          "invalid-server-metadata",
          "Project File PDF cover download returned invalid binary content.",
        );
      }
      return { ...metadata, blob, readyAt: metadata.readyAt };
    } catch (cause) {
      throw projectFileRepositoryError(cause, "download");
    }
  }

  async markPdfCoverFailed(input: {
    workspaceId: string;
    projectId: string;
    fileId: string;
    error: string;
  }): Promise<void> {
    try {
      await this.assertAuthenticated();
      const scope = projectFileScope(input);
      const fileId = projectFileUuid(input.fileId, "fileId");
      const { error } = await this.supabase.rpc("fail_project_file_pdf_cover", {
        target_workspace_id: scope.workspaceId,
        target_project_id: scope.projectId,
        target_file_id: fileId,
        target_error: input.error,
      });
      if (error) throw error;
    } catch (cause) {
      throw projectFileRepositoryError(cause, "metadata");
    }
  }

  async storePdfCover(
    input: StoreProjectFilePdfCoverInput,
  ): Promise<ProjectFilePdfCoverMetadata> {
    let scope: { workspaceId: string; projectId: string } | null = null;
    let fileId: string | null = null;
    try {
      await this.assertAuthenticated();
      scope = projectFileScope(input);
      fileId = projectFileUuid(input.fileId, "fileId");
      if (
        !(input.blob instanceof Blob) ||
        input.blob.type !== PROJECT_FILE_PDF_COVER_MIME_TYPE ||
        input.byteSize !== input.blob.size ||
        !Number.isSafeInteger(input.byteSize) ||
        input.byteSize <= 0 ||
        input.byteSize > PROJECT_FILE_PDF_COVER_MAX_BYTES ||
        !Number.isSafeInteger(input.pixelWidth) ||
        !Number.isSafeInteger(input.pixelHeight) ||
        input.pixelWidth <= 0 ||
        input.pixelHeight <= 0 ||
        input.pixelWidth > PROJECT_FILE_PDF_COVER_MAX_DIMENSION ||
        input.pixelHeight > PROJECT_FILE_PDF_COVER_MAX_DIMENSION
      ) {
        throw new CloudProjectFileRepositoryError(
          "invalid-input",
          "Project File PDF cover input is invalid.",
        );
      }
      const { data: reservedData, error: reserveError } =
        await this.supabase.rpc("reserve_project_file_pdf_cover", {
          target_workspace_id: scope.workspaceId,
          target_project_id: scope.projectId,
          target_file_id: fileId,
          target_byte_size: input.byteSize,
          target_pixel_width: input.pixelWidth,
          target_pixel_height: input.pixelHeight,
        });
      if (reserveError) throw reserveError;
      if (!reservedData || reservedData.length !== 1) {
        throw new CloudProjectFileRepositoryError(
          "invalid-server-metadata",
          "Project File PDF cover reserve returned invalid metadata.",
        );
      }
      const reserved = mapPdfCover(reservedData[0], { ...scope, fileId });
      if (reserved.readyAt !== null) return reserved;

      const { error: removeError } = await this.supabase.storage
        .from(PROJECT_FILES_BUCKET)
        .remove([reserved.storagePath]);
      if (removeError && statusCode(removeError) !== "404") throw removeError;

      const { error: uploadError } = await this.supabase.storage
        .from(PROJECT_FILES_BUCKET)
        .upload(reserved.storagePath, input.blob, {
          cacheControl: "31536000",
          contentType: PROJECT_FILE_PDF_COVER_MIME_TYPE,
          upsert: false,
          metadata: { fileId, projectId: scope.projectId, kind: reserved.kind },
        });
      if (uploadError && statusCode(uploadError) !== "409") throw uploadError;

      const { data: finalizedData, error: finalizeError } =
        await this.supabase.rpc("finalize_project_file_pdf_cover", {
          target_workspace_id: scope.workspaceId,
          target_project_id: scope.projectId,
          target_file_id: fileId,
        });
      if (finalizeError) throw finalizeError;
      if (!finalizedData || finalizedData.length !== 1) {
        throw new CloudProjectFileRepositoryError(
          "invalid-server-metadata",
          "Project File PDF cover finalize returned invalid metadata.",
        );
      }
      return mapPdfCover(finalizedData[0], { ...scope, fileId });
    } catch (cause) {
      if (scope && fileId) {
        try {
          await this.markPdfCoverFailed({
            ...scope,
            fileId,
            error: cause instanceof Error ? cause.message : "render-failed",
          });
        } catch {
          // A retry status is helpful, but never masks the original failure.
        }
      }
      throw projectFileRepositoryError(cause, "upload");
    }
  }
}
