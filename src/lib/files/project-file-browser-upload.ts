import {
  isProjectFileImageMimeType,
  isProjectFileMimeType,
  type ProjectFileMimeType,
} from "./project-file-repository";
import { PROJECT_FILE_STANDARD_UPLOAD_MAX_BYTES } from "./project-file-upload-limit";

export type PreparedProjectFileUpload = {
  name: string;
  originalName: string;
  blob: Blob;
  mimeType: ProjectFileMimeType;
  byteSize: number;
  width: number | null;
  height: number | null;
};

const PROJECT_FILE_EXTENSION_MIME_TYPES: Readonly<
  Record<string, ProjectFileMimeType>
> = {
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".md": "text/markdown",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".webp": "image/webp",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export class ProjectFileBrowserUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectFileBrowserUploadError";
  }
}

export function resolveProjectFileBrowserMimeType(
  fileName: string,
  browserMimeType: string,
): ProjectFileMimeType | null {
  const normalizedBrowserMime = browserMimeType.trim().toLowerCase();
  if (isProjectFileMimeType(normalizedBrowserMime)) {
    return normalizedBrowserMime;
  }

  const normalizedFileName = fileName.trim().toLowerCase();
  const dotIndex = normalizedFileName.lastIndexOf(".");
  if (dotIndex < 0) return null;
  return (
    PROJECT_FILE_EXTENSION_MIME_TYPES[normalizedFileName.slice(dotIndex)] ??
    null
  );
}

export async function prepareProjectFileBrowserUpload(
  file: File,
): Promise<PreparedProjectFileUpload> {
  const fileName = file.name.trim();
  if (
    fileName.length === 0 ||
    fileName !== file.name ||
    fileName.includes("/") ||
    fileName.includes("\\")
  ) {
    throw new ProjectFileBrowserUploadError("Имя файла недопустимо.");
  }
  if (file.size <= 0) {
    throw new ProjectFileBrowserUploadError("Пустой файл загрузить нельзя.");
  }
  if (file.size > PROJECT_FILE_STANDARD_UPLOAD_MAX_BYTES) {
    throw new ProjectFileBrowserUploadError(
      "Сейчас через браузер можно загрузить файл размером до 6 МБ. Для больших файлов будет добавлена возобновляемая загрузка.",
    );
  }

  const mimeType = resolveProjectFileBrowserMimeType(fileName, file.type);
  if (!mimeType) {
    throw new ProjectFileBrowserUploadError(
      "Этот формат файла пока не поддерживается.",
    );
  }

  const dimensions = isProjectFileImageMimeType(mimeType)
    ? await readProjectImageDimensions(file)
    : null;

  return {
    name: fileName,
    originalName: fileName,
    blob: file,
    mimeType,
    byteSize: file.size,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
  };
}

async function readProjectImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      const dimensions = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return dimensions;
    } catch {
      // Fall through to the HTMLImageElement path for formats/browser engines
      // that do not decode through createImageBitmap.
    }
  }

  if (typeof Image === "undefined" || typeof URL === "undefined") {
    throw new ProjectFileBrowserUploadError(
      "Не удалось прочитать размеры изображения.",
    );
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      };
      image.onerror = () => {
        reject(
          new ProjectFileBrowserUploadError(
            "Не удалось прочитать изображение.",
          ),
        );
      };
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
