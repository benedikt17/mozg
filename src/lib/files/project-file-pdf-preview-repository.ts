import { type ProjectFileScope } from "./project-file-repository";
import {
  PROJECT_FILE_PDF_COVER_KIND,
  PROJECT_FILE_PDF_COVER_MIME_TYPE,
} from "./project-file-pdf-preview";

export type ProjectFilePdfCoverMetadata = ProjectFileScope & {
  fileId: string;
  kind: typeof PROJECT_FILE_PDF_COVER_KIND;
  storagePath: string;
  mimeType: typeof PROJECT_FILE_PDF_COVER_MIME_TYPE;
  byteSize: number;
  pixelWidth: number;
  pixelHeight: number;
  createdAt: string;
  readyAt: string | null;
  processingError: string | null;
};

export type ProjectFilePdfCoverRecord = ProjectFilePdfCoverMetadata & {
  blob: Blob;
  readyAt: string;
};

export type StoreProjectFilePdfCoverInput = ProjectFileScope & {
  fileId: string;
  blob: Blob;
  byteSize: number;
  pixelWidth: number;
  pixelHeight: number;
};

export interface ProjectFilePdfPreviewRepository {
  getPdfCover(
    input: ProjectFileScope & { fileId: string },
  ): Promise<ProjectFilePdfCoverMetadata | null>;
  loadPdfCover(
    input: ProjectFileScope & { fileId: string },
  ): Promise<ProjectFilePdfCoverRecord | null>;
  storePdfCover(
    input: StoreProjectFilePdfCoverInput,
  ): Promise<ProjectFilePdfCoverMetadata>;
  markPdfCoverFailed(
    input: ProjectFileScope & { fileId: string; error: string },
  ): Promise<void>;
  invalidateAuthentication(): void;
}
