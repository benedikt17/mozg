import { describe, expect, it } from "vitest";

import {
  findProjectFileResumableResumeKey,
  projectFileResumableReservationKey,
  projectFileResumableUploadEndpoint,
  projectFileTusFingerprint,
} from "./project-file-resumable-upload";

const workspaceId = "84000000-0000-4000-8000-000000000001";
const fileId = "84000000-0000-4000-8000-000000000021";
const otherFileId = "84000000-0000-4000-8000-000000000022";
const resumeKey = '["large.pdf",7340032,1786720000000,"application/pdf"]';

describe("Project Files resumable upload helpers", () => {
  it("uses the direct Supabase Storage hostname for hosted projects", () => {
    expect(
      projectFileResumableUploadEndpoint(
        "https://pqamwicfuojoqzmrsuuh.supabase.co",
      ),
    ).toBe(
      "https://pqamwicfuojoqzmrsuuh.storage.supabase.co/storage/v1/upload/resumable",
    );
  });

  it("keeps the local Supabase origin for local development", () => {
    expect(projectFileResumableUploadEndpoint("http://127.0.0.1:54321")).toBe(
      "http://127.0.0.1:54321/storage/v1/upload/resumable",
    );
  });

  it("scopes browser reservation persistence by Project and folder", () => {
    const inboxKey = projectFileResumableReservationKey({
      workspaceId,
      projectId: "project-a",
      folderId: null,
      resumeKey,
    });
    const folderKey = projectFileResumableReservationKey({
      workspaceId,
      projectId: "project-a",
      folderId: "84000000-0000-4000-8000-000000000031",
      resumeKey,
    });
    const otherProjectKey = projectFileResumableReservationKey({
      workspaceId,
      projectId: "project-b",
      folderId: null,
      resumeKey,
    });

    expect(folderKey).not.toBe(inboxKey);
    expect(otherProjectKey).not.toBe(inboxKey);
  });

  it("recovers the persisted resume key for the same pending reservation", () => {
    const key = projectFileResumableReservationKey({
      workspaceId,
      projectId: "project-a",
      folderId: null,
      resumeKey,
    });
    const values = new Map([[key, fileId]]);
    const keys = [...values.keys()];
    const storage = {
      get length() {
        return keys.length;
      },
      getItem: (candidate: string) => values.get(candidate) ?? null,
      key: (index: number) => keys[index] ?? null,
    };

    expect(
      findProjectFileResumableResumeKey(
        {
          workspaceId,
          projectId: "project-a",
          folderId: null,
          fileId,
        },
        storage,
      ),
    ).toBe(resumeKey);
  });

  it("binds the TUS fingerprint to the immutable reserved file id", () => {
    expect(
      projectFileTusFingerprint({ workspaceId, fileId, resumeKey }),
    ).not.toBe(
      projectFileTusFingerprint({
        workspaceId,
        fileId: otherFileId,
        resumeKey,
      }),
    );
  });
});
