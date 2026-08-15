import {
  parseCanvasDocumentV2,
  type CanvasDocument,
} from "@/lib/canvas/canvas-document";
import type { CloudCanvasShellRepository } from "@/lib/canvas/cloud-canvas-shell-adapter";
import type {
  CanvasAssetMetadata,
  CanvasAssetRecord,
  StoreLocalCanvasImageInput,
} from "@/lib/canvas/local-canvas-repository";
import type {
  CanvasAssetVariantKind,
  CanvasAssetVariantMetadata,
  CanvasAssetVariantRecord,
  CanvasAssetVariantV2Metadata,
  CanvasAssetVariantV2Record,
  StoreCanvasAssetVariantInput,
  StoreCanvasAssetVariantV2Input,
} from "@/lib/canvas/canvas-image-variants";
import {
  prepareProjectFileBrowserUpload,
  projectFileBrowserResumeKey,
} from "@/lib/files/project-file-browser-upload";
import { generateAndStoreProjectFileImageVariantsBestEffort } from "@/lib/files/project-file-image-variant-generation";
import type {
  ProjectFileImageVariantMetadata,
  ProjectFileImageVariantRecord,
  ProjectFileImageVariantRepository,
} from "@/lib/files/project-file-image-variants";
import type {
  ProjectFileRecord,
  ProjectFileRepository,
} from "@/lib/files/project-file-repository";

const PROJECT_FILE_RUNTIME_ASSET_PREFIX = "project-file:";

export function projectFileRuntimeAssetId(fileId: string): string {
  return `${PROJECT_FILE_RUNTIME_ASSET_PREFIX}${fileId}`;
}

export function projectFileIdFromRuntimeAssetId(
  assetId: string,
): string | null {
  if (!assetId.startsWith(PROJECT_FILE_RUNTIME_ASSET_PREFIX)) return null;
  const fileId = assetId.slice(PROJECT_FILE_RUNTIME_ASSET_PREFIX.length);
  return fileId.length > 0 ? fileId : null;
}

function isCanvasImageMimeType(
  value: string,
): value is CanvasAssetRecord["mimeType"] {
  return (
    value === "image/png" || value === "image/jpeg" || value === "image/webp"
  );
}

function imageExtension(mimeType: CanvasAssetRecord["mimeType"]): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

function fallbackImageName(input: StoreLocalCanvasImageInput): string {
  const suffix =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `canvas-image-${suffix}.${imageExtension(input.mimeType)}`;
}

function browserFileFromInput(input: StoreLocalCanvasImageInput): File {
  if (typeof File === "undefined") {
    throw new Error(
      "Canvas Project File upload requires browser File support.",
    );
  }
  if (input.blob instanceof File) {
    const name = input.blob.name.trim();
    if (
      name &&
      name === input.blob.name &&
      !name.includes("/") &&
      !name.includes("\\")
    ) {
      return input.blob;
    }
  }
  return new File([input.blob], fallbackImageName(input), {
    type: input.mimeType,
    lastModified: Date.now(),
  });
}

function canvasAssetRecord(
  file: ProjectFileRecord,
  blob: Blob,
): CanvasAssetRecord | null {
  if (
    !isCanvasImageMimeType(file.mimeType) ||
    file.width === null ||
    file.height === null
  ) {
    return null;
  }
  return {
    id: projectFileRuntimeAssetId(file.id),
    workspaceId: file.workspaceId,
    blob,
    preview: null,
    mimeType: file.mimeType,
    byteSize: file.byteSize,
    width: file.width,
    height: file.height,
    checksum: file.checksum,
    createdAt: file.createdAt,
    readyAt: file.readyAt,
    deletedAt: file.deletedAt,
  };
}

function canvasAssetMetadata(
  file: ProjectFileRecord,
): CanvasAssetMetadata | null {
  if (
    !isCanvasImageMimeType(file.mimeType) ||
    file.width === null ||
    file.height === null
  ) {
    return null;
  }
  return {
    id: projectFileRuntimeAssetId(file.id),
    workspaceId: file.workspaceId,
    mimeType: file.mimeType,
    byteSize: file.byteSize,
    width: file.width,
    height: file.height,
    checksum: file.checksum,
    createdAt: file.createdAt,
    readyAt: file.readyAt,
    deletedAt: file.deletedAt,
  };
}

export function canonicalizeCanvasProjectFileRuntimeReferences(
  document: CanvasDocument,
): CanvasDocument {
  const canonical = parseCanvasDocumentV2(document);
  return parseCanvasDocumentV2({
    ...canonical,
    nodes: canonical.nodes.map((node) => {
      if (node.kind !== "image" || !("assetId" in node)) return node;
      const fileId = projectFileIdFromRuntimeAssetId(node.assetId);
      if (!fileId) return node;
      const { assetId, ...rest } = node;
      void assetId;
      return { ...rest, fileId };
    }),
  });
}

function canvasTierMetadata(
  variant: ProjectFileImageVariantMetadata,
  canvasId: string,
): CanvasAssetVariantV2Metadata {
  return {
    workspaceId: variant.workspaceId,
    canvasId,
    assetId: projectFileRuntimeAssetId(variant.fileId),
    targetMaxEdge: variant.targetMaxEdge,
    storagePath: variant.storagePath,
    mimeType: variant.mimeType,
    byteSize: variant.byteSize,
    pixelWidth: variant.pixelWidth,
    pixelHeight: variant.pixelHeight,
    createdAt: variant.createdAt,
  };
}

function canvasTierRecord(
  variant: ProjectFileImageVariantRecord,
  canvasId: string,
): CanvasAssetVariantV2Record {
  return { ...canvasTierMetadata(variant, canvasId), blob: variant.blob };
}

function legacyTarget(kind: CanvasAssetVariantKind): number {
  return kind === "thumbnail" ? 512 : 2048;
}

function canvasLegacyMetadata(
  variant: ProjectFileImageVariantMetadata,
  canvasId: string,
  kind: CanvasAssetVariantKind,
): CanvasAssetVariantMetadata {
  return {
    workspaceId: variant.workspaceId,
    canvasId,
    assetId: projectFileRuntimeAssetId(variant.fileId),
    kind,
    storagePath: variant.storagePath,
    mimeType: variant.mimeType,
    byteSize: variant.byteSize,
    pixelWidth: variant.pixelWidth,
    pixelHeight: variant.pixelHeight,
    createdAt: variant.createdAt,
  };
}

function canvasLegacyRecord(
  variant: ProjectFileImageVariantRecord,
  canvasId: string,
  kind: CanvasAssetVariantKind,
): CanvasAssetVariantRecord {
  return {
    ...canvasLegacyMetadata(variant, canvasId, kind),
    blob: variant.blob,
  };
}

export function createProjectFileBackedCanvasShellRepository(input: {
  repository: CloudCanvasShellRepository;
  projectFileRepository: ProjectFileRepository;
  projectFileVariantRepository: ProjectFileImageVariantRepository;
  workspaceId: string;
  projectId: string;
}): CloudCanvasShellRepository {
  const {
    repository,
    projectFileRepository,
    projectFileVariantRepository,
    workspaceId,
    projectId,
  } = input;

  const uploadProjectFileImage = async (
    image: StoreLocalCanvasImageInput,
  ): Promise<CanvasAssetRecord> => {
    if (image.workspaceId !== workspaceId) {
      throw new Error("Canvas Project File upload workspace mismatch.");
    }
    const browserFile = browserFileFromInput(image);
    const prepared = await prepareProjectFileBrowserUpload(browserFile);
    const uploaded = await projectFileRepository.uploadFile({
      workspaceId,
      projectId,
      folderId: null,
      ...prepared,
      checksum: image.checksum,
      resumeKey:
        prepared.resumeKey ||
        projectFileBrowserResumeKey({
          fileName: prepared.name,
          byteSize: prepared.byteSize,
          lastModified: browserFile.lastModified,
          mimeType: prepared.mimeType,
        }),
    });
    await generateAndStoreProjectFileImageVariantsBestEffort({
      repository: projectFileVariantRepository,
      file: uploaded,
      sourceBlob: prepared.blob,
    });
    const record = canvasAssetRecord(uploaded, prepared.blob);
    if (!record)
      throw new Error("Uploaded Project File is not a Canvas image.");
    return record;
  };

  const loadProjectFileAsset = async (
    assetId: string,
  ): Promise<CanvasAssetRecord | null> => {
    const fileId = projectFileIdFromRuntimeAssetId(assetId);
    if (!fileId) return null;
    try {
      const file = await projectFileRepository.downloadFile({
        workspaceId,
        projectId,
        fileId,
      });
      return canvasAssetRecord(file, file.blob);
    } catch {
      return null;
    }
  };

  const getProjectFileMetadata = async (
    assetId: string,
  ): Promise<CanvasAssetMetadata | null> => {
    const fileId = projectFileIdFromRuntimeAssetId(assetId);
    if (!fileId) return null;
    try {
      return canvasAssetMetadata(
        await projectFileRepository.getFile({ workspaceId, projectId, fileId }),
      );
    } catch {
      return null;
    }
  };

  const deleteProjectFile = async (assetId: string): Promise<void> => {
    const fileId = projectFileIdFromRuntimeAssetId(assetId);
    if (!fileId) return;
    await projectFileRepository.deleteFile({ workspaceId, projectId, fileId });
  };

  const listProjectFileTiers = async (assetId: string, canvasId: string) => {
    const fileId = projectFileIdFromRuntimeAssetId(assetId);
    if (!fileId) return null;
    const variants = await projectFileVariantRepository.listImageVariants({
      workspaceId,
      projectId,
      fileId,
    });
    return variants
      .filter((variant) => variant.readyAt !== null)
      .map((variant) => canvasTierMetadata(variant, canvasId));
  };

  const loadProjectFileTier = async (
    assetId: string,
    canvasId: string,
    targetMaxEdge: number,
  ): Promise<CanvasAssetVariantV2Record | null> => {
    const fileId = projectFileIdFromRuntimeAssetId(assetId);
    if (!fileId) return null;
    const variant = await projectFileVariantRepository.loadImageVariant({
      workspaceId,
      projectId,
      fileId,
      targetMaxEdge,
    });
    return variant ? canvasTierRecord(variant, canvasId) : null;
  };

  const storeProjectFileTier = async (
    tier: StoreCanvasAssetVariantV2Input,
  ): Promise<CanvasAssetVariantV2Metadata> => {
    const fileId = projectFileIdFromRuntimeAssetId(tier.assetId);
    if (!fileId) throw new Error("Canvas Project File variant id is invalid.");
    return canvasTierMetadata(
      await projectFileVariantRepository.storeImageVariant({
        workspaceId,
        projectId,
        fileId,
        targetMaxEdge: tier.targetMaxEdge,
        blob: tier.blob,
        byteSize: tier.byteSize,
        pixelWidth: tier.pixelWidth,
        pixelHeight: tier.pixelHeight,
      }),
      tier.canvasId,
    );
  };

  const listProjectFileLegacyVariants = async (
    assetId: string,
    canvasId: string,
  ): Promise<CanvasAssetVariantMetadata[] | null> => {
    const fileId = projectFileIdFromRuntimeAssetId(assetId);
    if (!fileId) return null;
    const variants = (
      await projectFileVariantRepository.listImageVariants({
        workspaceId,
        projectId,
        fileId,
      })
    ).filter((variant) => variant.readyAt !== null);
    return (["thumbnail", "preview"] as const).flatMap((kind) => {
      const target = legacyTarget(kind);
      const exact = variants.find(
        (variant) => variant.targetMaxEdge === target,
      );
      return exact ? [canvasLegacyMetadata(exact, canvasId, kind)] : [];
    });
  };

  const loadProjectFileLegacyVariant = async (
    assetId: string,
    canvasId: string,
    kind: CanvasAssetVariantKind,
  ): Promise<CanvasAssetVariantRecord | null> => {
    const fileId = projectFileIdFromRuntimeAssetId(assetId);
    if (!fileId) return null;
    const variant = await projectFileVariantRepository.loadImageVariant({
      workspaceId,
      projectId,
      fileId,
      targetMaxEdge: legacyTarget(kind),
    });
    return variant ? canvasLegacyRecord(variant, canvasId, kind) : null;
  };

  const beginAssetScope = () => {
    const legacyScope = repository.beginAssetScope();
    return {
      storeImage: uploadProjectFileImage,
      loadAsset: async (assetInput: {
        workspaceId: string;
        assetId: string;
      }) => {
        if (projectFileIdFromRuntimeAssetId(assetInput.assetId)) {
          return loadProjectFileAsset(assetInput.assetId);
        }
        return legacyScope.loadAsset(assetInput);
      },
      getAssetMetadata: async (assetInput: {
        workspaceId: string;
        assetId: string;
      }) => {
        if (projectFileIdFromRuntimeAssetId(assetInput.assetId)) {
          return getProjectFileMetadata(assetInput.assetId);
        }
        return legacyScope.getAssetMetadata?.(assetInput) ?? null;
      },
      markAssetDeleted: async (assetInput: {
        workspaceId: string;
        assetId: string;
      }) => {
        if (projectFileIdFromRuntimeAssetId(assetInput.assetId)) {
          await deleteProjectFile(assetInput.assetId);
          return;
        }
        await legacyScope.markAssetDeleted(assetInput);
      },
      isCurrent: () => legacyScope.isCurrent(),
    };
  };

  const proxy = new Proxy(repository, {
    get(target, property) {
      if (property === "beginAssetScope") return beginAssetScope;
      if (property === "storeImage") return uploadProjectFileImage;
      if (property === "loadAsset") {
        return async (assetInput: { workspaceId: string; assetId: string }) => {
          if (projectFileIdFromRuntimeAssetId(assetInput.assetId)) {
            return loadProjectFileAsset(assetInput.assetId);
          }
          return target.loadAsset(assetInput);
        };
      }
      if (property === "getAssetMetadata") {
        return async (assetInput: { workspaceId: string; assetId: string }) => {
          if (projectFileIdFromRuntimeAssetId(assetInput.assetId)) {
            return getProjectFileMetadata(assetInput.assetId);
          }
          return target.getAssetMetadata(assetInput);
        };
      }
      if (property === "markAssetDeleted") {
        return async (assetInput: { workspaceId: string; assetId: string }) => {
          if (projectFileIdFromRuntimeAssetId(assetInput.assetId)) {
            return deleteProjectFile(assetInput.assetId);
          }
          return target.markAssetDeleted(assetInput);
        };
      }
      if (property === "saveCanvas") {
        return (
          saveInput: Parameters<CloudCanvasShellRepository["saveCanvas"]>[0],
        ) =>
          target.saveCanvas({
            ...saveInput,
            document: canonicalizeCanvasProjectFileRuntimeReferences(
              saveInput.document,
            ),
          });
      }
      if (property === "listVariantTiers") {
        return async (
          variantInput: Parameters<
            CloudCanvasShellRepository["listVariantTiers"]
          >[0],
        ) => {
          const projectTiers = await listProjectFileTiers(
            variantInput.assetId,
            variantInput.canvasId,
          );
          return projectTiers ?? target.listVariantTiers(variantInput);
        };
      }
      if (property === "listVariantTiersForAssets") {
        return async (
          variantInput: Parameters<
            CloudCanvasShellRepository["listVariantTiersForAssets"]
          >[0],
        ) =>
          new Map(
            await Promise.all(
              variantInput.assetIds.map(
                async (assetId) =>
                  [
                    assetId,
                    await (
                      proxy.listVariantTiers as CloudCanvasShellRepository["listVariantTiers"]
                    )({ ...variantInput, assetId }),
                  ] as const,
              ),
            ),
          );
      }
      if (property === "loadVariantTier") {
        return async (
          variantInput: Parameters<
            CloudCanvasShellRepository["loadVariantTier"]
          >[0],
        ) => {
          if (projectFileIdFromRuntimeAssetId(variantInput.assetId)) {
            return loadProjectFileTier(
              variantInput.assetId,
              variantInput.canvasId,
              variantInput.targetMaxEdge,
            );
          }
          return target.loadVariantTier(variantInput);
        };
      }
      if (property === "storeVariantTier") {
        return (variantInput: StoreCanvasAssetVariantV2Input) =>
          projectFileIdFromRuntimeAssetId(variantInput.assetId)
            ? storeProjectFileTier(variantInput)
            : target.storeVariantTier(variantInput);
      }
      if (property === "listVariants") {
        return async (
          variantInput: Parameters<
            CloudCanvasShellRepository["listVariants"]
          >[0],
        ) => {
          const projectVariants = await listProjectFileLegacyVariants(
            variantInput.assetId,
            variantInput.canvasId,
          );
          return projectVariants ?? target.listVariants(variantInput);
        };
      }
      if (property === "listVariantsForAssets") {
        return async (
          variantInput: Parameters<
            CloudCanvasShellRepository["listVariantsForAssets"]
          >[0],
        ) =>
          new Map(
            await Promise.all(
              variantInput.assetIds.map(
                async (assetId) =>
                  [
                    assetId,
                    await (
                      proxy.listVariants as CloudCanvasShellRepository["listVariants"]
                    )({ ...variantInput, assetId }),
                  ] as const,
              ),
            ),
          );
      }
      if (property === "loadVariant") {
        return async (
          variantInput: Parameters<
            CloudCanvasShellRepository["loadVariant"]
          >[0],
        ) => {
          if (projectFileIdFromRuntimeAssetId(variantInput.assetId)) {
            return loadProjectFileLegacyVariant(
              variantInput.assetId,
              variantInput.canvasId,
              variantInput.kind,
            );
          }
          return target.loadVariant(variantInput);
        };
      }
      if (property === "storeVariant") {
        return async (variantInput: StoreCanvasAssetVariantInput) => {
          const fileId = projectFileIdFromRuntimeAssetId(variantInput.assetId);
          if (!fileId) return target.storeVariant(variantInput);
          return canvasLegacyMetadata(
            await projectFileVariantRepository.storeImageVariant({
              workspaceId,
              projectId,
              fileId,
              targetMaxEdge: legacyTarget(variantInput.kind),
              blob: variantInput.blob,
              byteSize: variantInput.byteSize,
              pixelWidth: variantInput.pixelWidth,
              pixelHeight: variantInput.pixelHeight,
            }),
            variantInput.canvasId,
            variantInput.kind,
          );
        };
      }
      if (property === "deleteVariants") {
        return async (
          variantInput: Parameters<
            CloudCanvasShellRepository["deleteVariants"]
          >[0],
        ) => {
          if (projectFileIdFromRuntimeAssetId(variantInput.assetId)) return;
          return target.deleteVariants(variantInput);
        };
      }
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return proxy;
}
