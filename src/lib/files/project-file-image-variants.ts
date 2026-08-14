import {
  CANVAS_IMAGE_PYRAMID_RECOMMENDED_TARGET_MAX_EDGES,
  CANVAS_IMAGE_VARIANT_MIME_TYPE,
  generateCanvasImagePyramidProgressively,
  isCanvasImagePyramidTargetMaxEdge,
  planCanvasImagePyramidTiers,
  type GeneratedCanvasImagePyramidTier,
} from "@/lib/canvas/canvas-image-variants";

export const PROJECT_FILE_IMAGE_VARIANT_MIME_TYPE =
  CANVAS_IMAGE_VARIANT_MIME_TYPE;
export const PROJECT_FILE_IMAGE_VARIANT_TARGET_MAX_EDGES =
  CANVAS_IMAGE_PYRAMID_RECOMMENDED_TARGET_MAX_EDGES;
export const PROJECT_FILE_PREVIEW_PREFERRED_MAX_EDGE = 1024;
export const PROJECT_FILE_IMAGE_VARIANT_MAX_BYTES = 20 * 1024 * 1024;
export const PROJECT_FILE_IMAGE_VARIANT_MAX_DIMENSION = 16_384;

export type ProjectFileImageVariantMetadata = {
  workspaceId: string;
  projectId: string;
  fileId: string;
  kind: string;
  storagePath: string;
  mimeType: typeof PROJECT_FILE_IMAGE_VARIANT_MIME_TYPE;
  byteSize: number;
  pixelWidth: number;
  pixelHeight: number;
  targetMaxEdge: number;
  createdAt: string;
  readyAt: string;
};

export type ProjectFileImageVariantRecord = ProjectFileImageVariantMetadata & {
  blob: Blob;
};

export type StoreProjectFileImageVariantInput = {
  workspaceId: string;
  projectId: string;
  fileId: string;
  targetMaxEdge: number;
  blob: Blob;
  byteSize: number;
  pixelWidth: number;
  pixelHeight: number;
};

export function projectFileImageVariantKind(targetMaxEdge: number): string {
  if (!isCanvasImagePyramidTargetMaxEdge(targetMaxEdge)) {
    throw new Error("Project file image variant target edge is invalid.");
  }
  return `edge-${targetMaxEdge}`;
}

export function projectFileImageVariantStoragePath(input: {
  workspaceId: string;
  fileId: string;
  targetMaxEdge: number;
}): string {
  return `${input.workspaceId}/${input.fileId}/variants/${projectFileImageVariantKind(input.targetMaxEdge)}.webp`;
}

export function planProjectFileImageVariants(input: {
  width: number;
  height: number;
  readyTargetMaxEdges?: readonly number[];
}): number[] {
  return planCanvasImagePyramidTiers({
    width: input.width,
    height: input.height,
    targetMaxEdges: PROJECT_FILE_IMAGE_VARIANT_TARGET_MAX_EDGES,
    readyTargetMaxEdges: input.readyTargetMaxEdges,
  });
}

export async function generateProjectFileImageVariantsProgressively(
  blob: Blob,
  dimensions: { width: number; height: number },
  readyTargetMaxEdges: readonly number[],
  onTier: (tier: GeneratedCanvasImagePyramidTier) => Promise<void> | void,
  signal?: AbortSignal,
): Promise<void> {
  const planned = planProjectFileImageVariants({
    ...dimensions,
    readyTargetMaxEdges,
  });
  await generateCanvasImagePyramidProgressively(
    blob,
    dimensions,
    planned,
    onTier,
    signal,
  );
}

export function chooseProjectFilePreviewVariant(
  variants: readonly ProjectFileImageVariantMetadata[],
  preferredMaxEdge = PROJECT_FILE_PREVIEW_PREFERRED_MAX_EDGE,
): ProjectFileImageVariantMetadata | null {
  const sorted = variants
    .filter((variant) => variant.readyAt.length > 0)
    .slice()
    .sort((left, right) => left.targetMaxEdge - right.targetMaxEdge);
  return (
    sorted.find((variant) => variant.targetMaxEdge >= preferredMaxEdge) ??
    sorted.at(-1) ??
    null
  );
}
