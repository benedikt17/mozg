import {
  generateProjectFilePdfCover,
  type GeneratedProjectFilePdfCover,
} from "./project-file-pdf-preview";
import type { ProjectFilePdfPreviewRepository } from "./project-file-pdf-preview-repository";
import type { ProjectFileRecord } from "./project-file-repository";

export async function generateAndStoreProjectFilePdfCover(input: {
  repository: ProjectFilePdfPreviewRepository;
  file: ProjectFileRecord;
  sourceBlob: Blob;
}): Promise<GeneratedProjectFilePdfCover | null> {
  if (input.file.mimeType !== "application/pdf") return null;
  const generated = await generateProjectFilePdfCover(input.sourceBlob);
  await input.repository.storePdfCover({
    workspaceId: input.file.workspaceId,
    projectId: input.file.projectId,
    fileId: input.file.id,
    blob: generated.blob,
    byteSize: generated.blob.size,
    pixelWidth: generated.pixelWidth,
    pixelHeight: generated.pixelHeight,
  });
  return generated;
}

export async function generateAndStoreProjectFilePdfCoverBestEffort(input: {
  repository: ProjectFilePdfPreviewRepository;
  file: ProjectFileRecord;
  sourceBlob: Blob;
}): Promise<void> {
  try {
    await generateAndStoreProjectFilePdfCover(input);
  } catch {
    // The original PDF is already finalized. A disposable cover must not make
    // it unavailable when local rendering is unsupported or fails.
  }
}
