import type { ProjectFileUploadTransport } from "./project-file-repository";

export const PROJECT_FILE_STANDARD_UPLOAD_MAX_BYTES = 6 * 1024 * 1024;

export function projectFileUploadTransport(
  byteSize: number,
): ProjectFileUploadTransport {
  return byteSize <= PROJECT_FILE_STANDARD_UPLOAD_MAX_BYTES
    ? "standard"
    : "resumable";
}
