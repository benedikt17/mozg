import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import {
  PROJECT_FILE_IMAGE_VARIANT_MAX_BYTES,
  PROJECT_FILE_IMAGE_VARIANT_MAX_DIMENSION,
  PROJECT_FILE_IMAGE_VARIANT_MIME_TYPE,
  isProjectFileImageVariantTargetMaxEdge,
  projectFileImageVariantKind,
  projectFileImageVariantStoragePath,
  type ProjectFileImageVariantMetadata,
  type ProjectFileImageVariantRecord,
  type ProjectFileImageVariantRepository,
  type StoreProjectFileImageVariantInput,
} from "./project-file-image-variants";
import { PROJECT_FILES_BUCKET } from "./project-file-repository";
import {
  CloudProjectFileRepositoryError,
  projectFileProjectId,
  projectFileRepositoryError,
  projectFileScope,
  projectFileUuid,
} from "./project-file-runtime";

type ProjectFileVariantRow =
  Database["public"]["Tables"]["file_variants"]["Row"];

const PROJECT_FILE_VARIANT_SELECT =
  "workspace_id,project_id,file_id,kind,storage_path,mime_type,byte_size,pixel_width,pixel_height,target_max_edge,created_at,ready_at,processing_error";

function statusCode(cause: unknown): string | undefined {
  if (typeof cause !== "object" || cause === null) return undefined;
  const value = cause as { status?: unknown; statusCode?: unknown };
  if (typeof value.statusCode === "string") return value.statusCode;
  if (typeof value.statusCode === "number") return String(value.statusCode);
  if (typeof value.status === "number") return String(value.status);
  return undefined;
}

function mapVariant(
  row: ProjectFileVariantRow,
  expected: { workspaceId: string; projectId: string; fileId: string },
  allowPending: boolean,
): ProjectFileImageVariantMetadata {
  const workspaceId = projectFileUuid(row.workspace_id, "variant.workspaceId");
  const projectId = projectFileProjectId(row.project_id);
  const fileId = projectFileUuid(row.file_id, "variant.fileId");
  if (
    workspaceId !== expected.workspaceId ||
    projectId !== expected.projectId ||
    fileId !== expected.fileId
  ) {
    throw new CloudProjectFileRepositoryError(
      "invalid-server-metadata",
      "Project File image variant escaped the requested scope.",
    );
  }
  if (!isProjectFileImageVariantTargetMaxEdge(row.target_max_edge)) {
    throw new CloudProjectFileRepositoryError(
      "invalid-server-metadata",
      "Project File image variant target edge is invalid.",
    );
  }
  const targetMaxEdge = row.target_max_edge;
  if (
    row.kind !== projectFileImageVariantKind(targetMaxEdge) ||
    row.storage_path !==
      projectFileImageVariantStoragePath({
        workspaceId,
        fileId,
        targetMaxEdge,
      }) ||
    row.mime_type !== PROJECT_FILE_IMAGE_VARIANT_MIME_TYPE ||
    !Number.isSafeInteger(row.byte_size) ||
    row.byte_size <= 0 ||
    row.byte_size > PROJECT_FILE_IMAGE_VARIANT_MAX_BYTES ||
    !Number.isSafeInteger(row.pixel_width) ||
    !Number.isSafeInteger(row.pixel_height) ||
    (row.pixel_width ?? 0) <= 0 ||
    (row.pixel_height ?? 0) <= 0 ||
    (row.pixel_width ?? 0) > PROJECT_FILE_IMAGE_VARIANT_MAX_DIMENSION ||
    (row.pixel_height ?? 0) > PROJECT_FILE_IMAGE_VARIANT_MAX_DIMENSION ||
    Math.max(row.pixel_width ?? 0, row.pixel_height ?? 0) > targetMaxEdge ||
    (!allowPending && row.ready_at === null)
  ) {
    throw new CloudProjectFileRepositoryError(
      "invalid-server-metadata",
      "Project File image variant metadata is invalid.",
    );
  }
  return {
    workspaceId,
    projectId,
    fileId,
    kind: row.kind,
    storagePath: row.storage_path,
    mimeType: PROJECT_FILE_IMAGE_VARIANT_MIME_TYPE,
    byteSize: row.byte_size,
    pixelWidth: row.pixel_width as number,
    pixelHeight: row.pixel_height as number,
    targetMaxEdge,
    createdAt: row.created_at,
    readyAt: row.ready_at,
  };
}

export class SupabaseProjectFileImageVariantRepository implements ProjectFileImageVariantRepository {
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

  async listImageVariants(input: {
    workspaceId: string;
    projectId: string;
    fileId: string;
  }): Promise<ProjectFileImageVariantMetadata[]> {
    try {
      await this.assertAuthenticated();
      const scope = projectFileScope(input);
      const fileId = projectFileUuid(input.fileId, "fileId");
      const { data, error } = await this.supabase
        .from("file_variants")
        .select(PROJECT_FILE_VARIANT_SELECT)
        .eq("workspace_id", scope.workspaceId)
        .eq("project_id", scope.projectId)
        .eq("file_id", fileId)
        .not("ready_at", "is", null)
        .order("target_max_edge", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) =>
        mapVariant(row, { ...scope, fileId }, false),
      );
    } catch (cause) {
      throw projectFileRepositoryError(cause, "metadata");
    }
  }

  async loadImageVariant(input: {
    workspaceId: string;
    projectId: string;
    fileId: string;
    targetMaxEdge: number;
  }): Promise<ProjectFileImageVariantRecord | null> {
    try {
      await this.assertAuthenticated();
      const scope = projectFileScope(input);
      const fileId = projectFileUuid(input.fileId, "fileId");
      if (!isProjectFileImageVariantTargetMaxEdge(input.targetMaxEdge)) {
        throw new CloudProjectFileRepositoryError(
          "invalid-input",
          "Project File image variant target edge is invalid.",
        );
      }
      const { data, error } = await this.supabase
        .from("file_variants")
        .select(PROJECT_FILE_VARIANT_SELECT)
        .eq("workspace_id", scope.workspaceId)
        .eq("project_id", scope.projectId)
        .eq("file_id", fileId)
        .eq("target_max_edge", input.targetMaxEdge)
        .not("ready_at", "is", null)
        .maybeSingle();
      if (error) throw error;
      if (data === null) return null;
      const metadata = mapVariant(data, { ...scope, fileId }, false);
      const { data: blob, error: downloadError } = await this.supabase.storage
        .from(PROJECT_FILES_BUCKET)
        .download(metadata.storagePath);
      if (downloadError) throw downloadError;
      if (
        !(blob instanceof Blob) ||
        blob.type !== PROJECT_FILE_IMAGE_VARIANT_MIME_TYPE
      ) {
        throw new CloudProjectFileRepositoryError(
          "invalid-server-metadata",
          "Project File image variant download returned invalid binary content.",
        );
      }
      return { ...metadata, blob, readyAt: metadata.readyAt as string };
    } catch (cause) {
      throw projectFileRepositoryError(cause, "download");
    }
  }

  async storeImageVariant(
    input: StoreProjectFileImageVariantInput,
  ): Promise<ProjectFileImageVariantMetadata> {
    try {
      await this.assertAuthenticated();
      const scope = projectFileScope(input);
      const fileId = projectFileUuid(input.fileId, "fileId");
      if (
        !isProjectFileImageVariantTargetMaxEdge(input.targetMaxEdge) ||
        !(input.blob instanceof Blob) ||
        input.blob.type !== PROJECT_FILE_IMAGE_VARIANT_MIME_TYPE ||
        !Number.isSafeInteger(input.byteSize) ||
        input.byteSize <= 0 ||
        input.byteSize > PROJECT_FILE_IMAGE_VARIANT_MAX_BYTES ||
        input.byteSize !== input.blob.size ||
        !Number.isSafeInteger(input.pixelWidth) ||
        !Number.isSafeInteger(input.pixelHeight) ||
        input.pixelWidth <= 0 ||
        input.pixelHeight <= 0 ||
        input.pixelWidth > PROJECT_FILE_IMAGE_VARIANT_MAX_DIMENSION ||
        input.pixelHeight > PROJECT_FILE_IMAGE_VARIANT_MAX_DIMENSION ||
        Math.max(input.pixelWidth, input.pixelHeight) > input.targetMaxEdge
      ) {
        throw new CloudProjectFileRepositoryError(
          "invalid-input",
          "Project File image variant input is invalid.",
        );
      }

      const { data: original, error: originalError } = await this.supabase
        .from("project_files")
        .select(
          "id,workspace_id,project_id,mime_type,width,height,ready_at,deleted_at",
        )
        .eq("workspace_id", scope.workspaceId)
        .eq("project_id", scope.projectId)
        .eq("id", fileId)
        .is("deleted_at", null)
        .not("ready_at", "is", null)
        .maybeSingle();
      if (originalError) throw originalError;
      if (
        original === null ||
        !original.mime_type.startsWith("image/") ||
        original.width === null ||
        original.height === null ||
        input.targetMaxEdge >= Math.max(original.width, original.height) ||
        input.pixelWidth > original.width ||
        input.pixelHeight > original.height ||
        Math.abs(
          input.pixelWidth * original.height -
            original.width * input.pixelHeight,
        ) > original.height
      ) {
        throw new CloudProjectFileRepositoryError(
          "invalid-input",
          "Project File image variant does not match the original.",
        );
      }

      const { data: reservedData, error: reserveError } =
        await this.supabase.rpc("reserve_project_file_variant", {
          target_workspace_id: scope.workspaceId,
          target_project_id: scope.projectId,
          target_file_id: fileId,
          requested_max_edge: input.targetMaxEdge,
          target_byte_size: input.byteSize,
          target_pixel_width: input.pixelWidth,
          target_pixel_height: input.pixelHeight,
        });
      if (reserveError) throw reserveError;
      if (!reservedData || reservedData.length !== 1) {
        throw new CloudProjectFileRepositoryError(
          "invalid-server-metadata",
          "Project File image variant reserve returned invalid metadata.",
        );
      }
      const reserved = mapVariant(reservedData[0], { ...scope, fileId }, true);
      if (reserved.readyAt !== null) return reserved;

      const { error: uploadError } = await this.supabase.storage
        .from(PROJECT_FILES_BUCKET)
        .upload(reserved.storagePath, input.blob, {
          cacheControl: "31536000",
          contentType: PROJECT_FILE_IMAGE_VARIANT_MIME_TYPE,
          upsert: false,
          metadata: {
            fileId,
            projectId: scope.projectId,
            targetMaxEdge: String(input.targetMaxEdge),
          },
        });
      if (uploadError && statusCode(uploadError) !== "409") throw uploadError;

      const { data: finalizedData, error: finalizeError } =
        await this.supabase.rpc("finalize_project_file_variant", {
          target_workspace_id: scope.workspaceId,
          target_project_id: scope.projectId,
          target_file_id: fileId,
          requested_max_edge: input.targetMaxEdge,
        });
      if (finalizeError) throw finalizeError;
      if (!finalizedData || finalizedData.length !== 1) {
        throw new CloudProjectFileRepositoryError(
          "invalid-server-metadata",
          "Project File image variant finalize returned invalid metadata.",
        );
      }
      return mapVariant(finalizedData[0], { ...scope, fileId }, false);
    } catch (cause) {
      throw projectFileRepositoryError(cause, "upload");
    }
  }
}
