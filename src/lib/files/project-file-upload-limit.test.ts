import { describe, expect, it } from "vitest";

import { PROJECT_FILE_MAX_BYTES } from "./project-file-repository";
import { validateProjectFileUpload } from "./project-file-runtime";
import {
  PROJECT_FILE_STANDARD_UPLOAD_MAX_BYTES,
  projectFileUploadTransport,
} from "./project-file-upload-limit";

const workspaceId = "84000000-0000-4000-8000-000000000001";
const fileId = "84000000-0000-4000-8000-000000000021";

describe("Project Files browser upload limit", () => {
  it("routes files up to 6 MiB through standard upload", () => {
    expect(
      projectFileUploadTransport(PROJECT_FILE_STANDARD_UPLOAD_MAX_BYTES),
    ).toBe("standard");
  });

  it("routes files above 6 MiB through resumable upload", () => {
    expect(
      projectFileUploadTransport(PROJECT_FILE_STANDARD_UPLOAD_MAX_BYTES + 1),
    ).toBe("resumable");
  });

  it("accepts files larger than 6 MiB within the Files boundary", () => {
    const blob = new Blob([new Uint8Array(7 * 1024 * 1024)], {
      type: "application/pdf",
    });

    expect(() =>
      validateProjectFileUpload(
        {
          workspaceId,
          projectId: "project-a",
          fileId,
          name: "large.pdf",
          originalName: "large.pdf",
          blob,
          mimeType: "application/pdf",
          byteSize: blob.size,
        },
        () => fileId,
      ),
    ).not.toThrow();
  });

  it("rejects files above the 50 MiB Files boundary", () => {
    const blob = new Blob([new Uint8Array(PROJECT_FILE_MAX_BYTES + 1)], {
      type: "application/pdf",
    });

    expect(() =>
      validateProjectFileUpload(
        {
          workspaceId,
          projectId: "project-a",
          fileId,
          name: "too-large.pdf",
          originalName: "too-large.pdf",
          blob,
          mimeType: "application/pdf",
          byteSize: blob.size,
        },
        () => fileId,
      ),
    ).toThrowError(/byte size/i);
  });
});
