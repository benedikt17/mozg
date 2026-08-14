import {
  generateProjectFileImageVariantsProgressively,
  type ProjectFileImageVariantRepository,
} from "./project-file-image-variants";
import {
  isProjectFileImageMimeType,
  type ProjectFileRecord,
} from "./project-file-repository";

export async function generateAndStoreProjectFileImageVariants(input: {
  repository: ProjectFileImageVariantRepository;
  file: ProjectFileRecord;
  sourceBlob: Blob;
  signal?: AbortSignal;
}): Promise<void> {
  const { file, repository, sourceBlob, signal } = input;
  if (
    !isProjectFileImageMimeType(file.mimeType) ||
    file.width === null ||
    file.height === null
  ) {
    return;
  }

  const ready = await repository.listImageVariants({
    workspaceId: file.workspaceId,
    projectId: file.projectId,
    fileId: file.id,
  });
  await generateProjectFileImageVariantsProgressively(
    sourceBlob,
    { width: file.width, height: file.height },
    ready.map((variant) => variant.targetMaxEdge),
    async (tier) => {
      await repository.storeImageVariant({
        workspaceId: file.workspaceId,
        projectId: file.projectId,
        fileId: file.id,
        targetMaxEdge: tier.targetMaxEdge,
        blob: tier.blob,
        byteSize: tier.blob.size,
        pixelWidth: tier.pixelWidth,
        pixelHeight: tier.pixelHeight,
      });
    },
    signal,
  );
}

export async function generateAndStoreProjectFileImageVariantsBestEffort(input: {
  repository: ProjectFileImageVariantRepository;
  file: ProjectFileRecord;
  sourceBlob: Blob;
  signal?: AbortSignal;
}): Promise<void> {
  try {
    await generateAndStoreProjectFileImageVariants(input);
  } catch {
    // Derivatives are disposable caches. Their failure must never invalidate a
    // successfully finalized immutable original.
  }
}
