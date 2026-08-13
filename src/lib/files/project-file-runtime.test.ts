import { describe, expect, it } from "vitest";

import type { Database } from "@/lib/supabase/database.types";
import {
  CloudProjectFileRepositoryError,
  mapProjectFile,
  projectFileScope,
  validateProjectFileUpload,
} from "./project-file-runtime";

type ProjectFileRow = Database["public"]["Tables"]["project_files"]["Row"];

const workspaceId = "84000000-0000-4000-8000-000000000001";
const fileId = "84000000-0000-4000-8000-000000000021";

function fileRow(overrides: Partial<ProjectFileRow> = {}): ProjectFileRow {
  return {
    id: fileId,
    workspace_id: workspaceId,
    project_id: "project-a",
    folder_id: null,
    name: "concept.png",
    original_name: "concept-original.png",
    storage_key: `${workspaceId}/${fileId}/original`,
    mime_type: "image/png",
    byte_size: 3,
    checksum: null,
    width: 100,
    height: 80,
    search_tsv: null,
    created_by: "84000000-0000-4000-8000-000000000099",
    created_at: "2026-08-14T00:00:00.000Z",
    updated_at: "2026-08-14T00:00:00.000Z",
    ready_at: "2026-08-14T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

describe("Project Files runtime boundary", () => {
  it("normalizes UUID scope while preserving opaque Project identity", () => {
    expect(
      projectFileScope({
        workspaceId: workspaceId.toUpperCase(),
        projectId: "project-a",
      }),
    ).toEqual({ workspaceId, projectId: "project-a" });
  });

  it("rejects Project ids with hidden surrounding whitespace", () => {
    expect(() =>
      projectFileScope({ workspaceId, projectId: " project-a" }),
    ).toThrowError(CloudProjectFileRepositoryError);
  });

  it("accepts byte-preserving image uploads with explicit dimensions", () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], {
      type: "image/png",
    });
    expect(
      validateProjectFileUpload(
        {
          workspaceId,
          projectId: "project-a",
          fileId,
          name: "concept.png",
          originalName: "concept-original.png",
          blob,
          mimeType: "image/png",
          byteSize: 3,
          width: 100,
          height: 80,
        },
        () => fileId,
      ),
    ).toMatchObject({
      workspaceId,
      projectId: "project-a",
      fileId,
      name: "concept.png",
      originalName: "concept-original.png",
      byteSize: 3,
      width: 100,
      height: 80,
    });
  });

  it("rejects a Blob whose bytes do not match the reservation", () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], {
      type: "application/pdf",
    });
    expect(() =>
      validateProjectFileUpload(
        {
          workspaceId,
          projectId: "project-a",
          fileId,
          name: "brief.pdf",
          originalName: "brief.pdf",
          blob,
          mimeType: "application/pdf",
          byteSize: 4,
        },
        () => fileId,
      ),
    ).toThrowError(/byte size/i);
  });

  it("rejects image dimensions on non-image files", () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], {
      type: "application/pdf",
    });
    expect(() =>
      validateProjectFileUpload(
        {
          workspaceId,
          projectId: "project-a",
          fileId,
          name: "brief.pdf",
          originalName: "brief.pdf",
          blob,
          mimeType: "application/pdf",
          byteSize: 3,
          width: 10,
          height: 10,
        },
        () => fileId,
      ),
    ).toThrowError(/cannot carry image dimensions/i);
  });

  it("rejects server metadata that escapes the requested Project scope", () => {
    expect(() =>
      mapProjectFile(fileRow({ project_id: "project-b" }), {
        workspaceId,
        projectId: "project-a",
        fileId,
      }),
    ).toThrowError(/escaped the requested scope/i);
  });

  it("rejects server metadata with a non-canonical Storage key", () => {
    expect(() =>
      mapProjectFile(fileRow({ storage_key: `${workspaceId}/wrong/original` })),
    ).toThrowError(/Storage key is invalid/i);
  });
});
