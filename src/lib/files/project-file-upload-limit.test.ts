import { describe, expect, it } from "vitest";

import { validateProjectFileUpload } from "./project-file-runtime";
import { PROJECT_FILE_STANDARD_UPLOAD_MAX_BYTES } from "./project-file-upload-limit";

const workspaceId = "84000000-0000-4000-8000-000000000001";
const fileId = "84000000-0000-4000-8000-000000000021";

describe("Project Files standard upload limit", () => {
  it("rejects files that require the resumable upload path", () => {
    const blob = new Blob(
      [new Uint8Array(PROJECT_FILE_STANDARD_UPLOAD_MAX_BYTES + 1)],
      { type: "application/pdf" },
    );

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
    ).toThrowError(/byte size/i);
  });
});
