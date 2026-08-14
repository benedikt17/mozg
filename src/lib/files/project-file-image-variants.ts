export const PROJECT_FILE_IMAGE_VARIANT_MIME_TYPE = "image/webp" as const;
export const PROJECT_FILE_IMAGE_VARIANT_TARGET_MAX_EDGES = [
  256, 512, 1024, 2048, 4096,
] as const;
export const PROJECT_FILE_PREVIEW_PREFERRED_MAX_EDGE = 1024;
export const PROJECT_FILE_IMAGE_VARIANT_QUALITY = 0.82;
export const PROJECT_FILE_IMAGE_VARIANT_MAX_BYTES = 20 * 1024 * 1024;
export const PROJECT_FILE_IMAGE_VARIANT_MAX_DIMENSION = 16_384;
export const PROJECT_FILE_IMAGE_VARIANT_MIN_TARGET_MAX_EDGE = 64;
export const PROJECT_FILE_IMAGE_VARIANT_MAX_TARGET_MAX_EDGE = 16_384;

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
  readyAt: string | null;
};

export type ProjectFileImageVariantRecord = ProjectFileImageVariantMetadata & {
  blob: Blob;
  readyAt: string;
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

export interface ProjectFileImageVariantRepository {
  listImageVariants(input: {
    workspaceId: string;
    projectId: string;
    fileId: string;
  }): Promise<ProjectFileImageVariantMetadata[]>;
  loadImageVariant(input: {
    workspaceId: string;
    projectId: string;
    fileId: string;
    targetMaxEdge: number;
  }): Promise<ProjectFileImageVariantRecord | null>;
  storeImageVariant(
    input: StoreProjectFileImageVariantInput,
  ): Promise<ProjectFileImageVariantMetadata>;
  invalidateAuthentication(): void;
}

export type GeneratedProjectFileImageVariantTier = {
  targetMaxEdge: number;
  blob: Blob;
  pixelWidth: number;
  pixelHeight: number;
};

export function isProjectFileImageVariantTargetMaxEdge(
  value: unknown,
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= PROJECT_FILE_IMAGE_VARIANT_MIN_TARGET_MAX_EDGE &&
    value <= PROJECT_FILE_IMAGE_VARIANT_MAX_TARGET_MAX_EDGE
  );
}

export function projectFileImageVariantKind(targetMaxEdge: number): string {
  if (!isProjectFileImageVariantTargetMaxEdge(targetMaxEdge)) {
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

function normalizeProjectFileImageVariantTargetMaxEdges(
  values: readonly unknown[],
): number[] {
  return [...new Set(values.filter(isProjectFileImageVariantTargetMaxEdge))].sort(
    (left, right) => left - right,
  );
}

export function planProjectFileImageVariants(input: {
  width: number;
  height: number;
  readyTargetMaxEdges?: readonly number[];
}): number[] {
  if (
    !Number.isSafeInteger(input.width) ||
    !Number.isSafeInteger(input.height) ||
    input.width <= 0 ||
    input.height <= 0
  ) {
    return [];
  }
  const originalMaxEdge = Math.max(input.width, input.height);
  const ready = new Set(
    normalizeProjectFileImageVariantTargetMaxEdges(
      input.readyTargetMaxEdges ?? [],
    ),
  );
  return normalizeProjectFileImageVariantTargetMaxEdges(
    PROJECT_FILE_IMAGE_VARIANT_TARGET_MAX_EDGES,
  ).filter(
    (targetMaxEdge) => targetMaxEdge < originalMaxEdge && !ready.has(targetMaxEdge),
  );
}

function scaledDimensions(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function abortError(): Error {
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}

function canvasToWebp(
  canvas: OffscreenCanvas | HTMLCanvasElement,
): Promise<Blob | null> {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({
      type: PROJECT_FILE_IMAGE_VARIANT_MIME_TYPE,
      quality: PROJECT_FILE_IMAGE_VARIANT_QUALITY,
    });
  }
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      PROJECT_FILE_IMAGE_VARIANT_MIME_TYPE,
      PROJECT_FILE_IMAGE_VARIANT_QUALITY,
    );
  });
}

async function decodeProjectFileImage(blob: Blob): Promise<{
  source: CanvasImageSource;
  close?: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob, {
        imageOrientation: "from-image",
      });
      return { source: bitmap, close: () => bitmap.close() };
    } catch {
      try {
        const bitmap = await createImageBitmap(blob);
        return { source: bitmap, close: () => bitmap.close() };
      } catch {
        // Fall through to HTMLImageElement. Some browser engines accept the
        // source image but reject one or both createImageBitmap paths.
      }
    }
  }
  if (
    typeof Image === "undefined" ||
    typeof URL?.createObjectURL !== "function"
  ) {
    throw new Error("Project File image variant generation is unavailable.");
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error("Project File image variant decode failed."));
      image.src = url;
    });
    return { source: image };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function generateProjectFileImageVariantsProgressively(
  blob: Blob,
  dimensions: { width: number; height: number },
  readyTargetMaxEdges: readonly number[],
  onTier: (
    tier: GeneratedProjectFileImageVariantTier,
  ) => Promise<void> | void,
  signal?: AbortSignal,
): Promise<void> {
  const planned = planProjectFileImageVariants({
    ...dimensions,
    readyTargetMaxEdges,
  });
  if (signal?.aborted) throw abortError();
  if (planned.length === 0) return;
  if (
    typeof OffscreenCanvas === "undefined" &&
    typeof document === "undefined"
  ) {
    return;
  }

  const decoded = await decodeProjectFileImage(blob);
  try {
    for (const targetMaxEdge of planned) {
      if (signal?.aborted) throw abortError();
      const target = scaledDimensions(
        dimensions.width,
        dimensions.height,
        targetMaxEdge,
      );
      const canvas =
        typeof OffscreenCanvas === "undefined"
          ? Object.assign(document.createElement("canvas"), {
              width: target.width,
              height: target.height,
            })
          : new OffscreenCanvas(target.width, target.height);
      const context = canvas.getContext("2d") as
        | CanvasRenderingContext2D
        | OffscreenCanvasRenderingContext2D
        | null;
      if (!context) {
        throw new Error("Project File image 2D context is unavailable.");
      }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(decoded.source, 0, 0, target.width, target.height);
      const generated = await canvasToWebp(canvas);
      if (
        !generated ||
        generated.type !== PROJECT_FILE_IMAGE_VARIANT_MIME_TYPE
      ) {
        throw new Error("Project File WebP encoding is unavailable.");
      }
      await onTier({
        targetMaxEdge,
        blob: generated,
        pixelWidth: target.width,
        pixelHeight: target.height,
      });
    }
  } finally {
    decoded.close?.();
  }
}

export function chooseProjectFilePreviewVariant(
  variants: readonly ProjectFileImageVariantMetadata[],
  preferredMaxEdge = PROJECT_FILE_PREVIEW_PREFERRED_MAX_EDGE,
): ProjectFileImageVariantMetadata | null {
  const sorted = variants
    .filter((variant) => variant.readyAt !== null)
    .slice()
    .sort((left, right) => left.targetMaxEdge - right.targetMaxEdge);
  return (
    sorted.find((variant) => variant.targetMaxEdge >= preferredMaxEdge) ??
    sorted.at(-1) ??
    null
  );
}
