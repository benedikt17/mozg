export const PROJECT_FILE_PDF_COVER_KIND = "pdf-page-1" as const;
export const PROJECT_FILE_PDF_COVER_MIME_TYPE = "image/webp" as const;
export const PROJECT_FILE_PDF_COVER_MAX_BYTES = 20 * 1024 * 1024;
export const PROJECT_FILE_PDF_COVER_MAX_DIMENSION = 1024;
export const PROJECT_FILE_PDF_COVER_TARGET_MAX_EDGE = 768;
export const PROJECT_FILE_PDF_COVER_QUALITY = 0.82;

export type GeneratedProjectFilePdfCover = {
  blob: Blob;
  pixelWidth: number;
  pixelHeight: number;
};

function canvasToWebp(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Project File PDF cover encoding failed."));
      },
      PROJECT_FILE_PDF_COVER_MIME_TYPE,
      PROJECT_FILE_PDF_COVER_QUALITY,
    );
  });
}

/**
 * Renders only the first page, locally in the authenticated browser. The PDF
 * itself never leaves the existing private Project Files access path.
 */
export async function generateProjectFilePdfCover(
  sourceBlob: Blob,
): Promise<GeneratedProjectFilePdfCover> {
  if (
    typeof document === "undefined" ||
    sourceBlob.type !== "application/pdf"
  ) {
    throw new Error("Project File PDF cover generation is unavailable.");
  }

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
    import.meta.url,
  ).toString();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await sourceBlob.arrayBuffer()),
    stopAtErrors: false,
  });

  try {
    const pdf = await loadingTask.promise;
    try {
      const page = await pdf.getPage(1);
      try {
        const naturalViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(
          1,
          PROJECT_FILE_PDF_COVER_TARGET_MAX_EDGE /
            Math.max(naturalViewport.width, naturalViewport.height),
        );
        const viewport = page.getViewport({ scale });
        const pixelWidth = Math.max(1, Math.round(viewport.width));
        const pixelHeight = Math.max(1, Math.round(viewport.height));
        if (
          pixelWidth > PROJECT_FILE_PDF_COVER_MAX_DIMENSION ||
          pixelHeight > PROJECT_FILE_PDF_COVER_MAX_DIMENSION
        ) {
          throw new Error("Project File PDF cover dimensions are invalid.");
        }
        const canvas = document.createElement("canvas");
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) {
          throw new Error("Project File PDF cover canvas is unavailable.");
        }
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, pixelWidth, pixelHeight);
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        const blob = await canvasToWebp(canvas);
        if (
          blob.type !== PROJECT_FILE_PDF_COVER_MIME_TYPE ||
          blob.size <= 0 ||
          blob.size > PROJECT_FILE_PDF_COVER_MAX_BYTES
        ) {
          throw new Error("Project File PDF cover output is invalid.");
        }
        return { blob, pixelWidth, pixelHeight };
      } finally {
        page.cleanup();
      }
    } finally {
      await pdf.destroy();
    }
  } finally {
    await loadingTask.destroy();
  }
}
