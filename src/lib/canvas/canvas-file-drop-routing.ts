export type CanvasDropFileLike = {
  name: string;
  type: string;
};

const CANVAS_IMAGE_DROP_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export function isCanvasPdfDropFile(file: CanvasDropFileLike): boolean {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

export function isCanvasImageDropFile(file: CanvasDropFileLike): boolean {
  return CANVAS_IMAGE_DROP_MIME_TYPES.has(file.type);
}

export function partitionCanvasDropFiles<T extends CanvasDropFileLike>(
  files: readonly T[],
): { imageFiles: T[]; pdfFiles: T[] } {
  const imageFiles: T[] = [];
  const pdfFiles: T[] = [];

  for (const file of files) {
    if (isCanvasPdfDropFile(file)) {
      pdfFiles.push(file);
      continue;
    }
    if (isCanvasImageDropFile(file)) imageFiles.push(file);
  }

  return { imageFiles, pdfFiles };
}

export async function runCanvasMixedDrop<T extends CanvasDropFileLike>(
  input: {
    imageFiles: readonly T[];
    pdfFiles: readonly T[];
  },
  handlers: {
    ingestImages: (files: readonly T[]) => Promise<void>;
    uploadPdfs: (files: readonly T[]) => Promise<void>;
  },
): Promise<void> {
  if (input.imageFiles.length > 0) {
    await handlers.ingestImages(input.imageFiles);
  }
  if (input.pdfFiles.length > 0) {
    await handlers.uploadPdfs(input.pdfFiles);
  }
}

export function resolveCanvasDropFlowPosition<T>(
  client: { x: number; y: number },
  screenToFlow: (point: { x: number; y: number }) => T,
): T {
  return screenToFlow(client);
}
