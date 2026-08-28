import { describe, expect, it } from "vitest";

import type { ProjectFolderRecord } from "@/lib/files/project-file-repository";
import {
  formatProjectFileSize,
  getProjectFolderBreadcrumbs,
  getProjectFolderMoveTargets,
  getProjectFolderTree,
  isProjectFilePreviewable,
} from "@/prototype/files/files-workspace";

const baseFolder = {
  workspaceId: "10000000-0000-4000-8000-000000000001",
  projectId: "lukomorie",
  sortOrder: 0,
  createdBy: "20000000-0000-4000-8000-000000000001",
  createdAt: "2026-08-14T00:00:00.000Z",
  updatedAt: "2026-08-14T00:00:00.000Z",
  deletedAt: null,
} satisfies Omit<ProjectFolderRecord, "id" | "parentFolderId" | "name">;

function folder(
  id: string,
  name: string,
  parentFolderId: string | null,
): ProjectFolderRecord {
  return { ...baseFolder, id, name, parentFolderId };
}

describe("getProjectFolderBreadcrumbs", () => {
  it("builds a root-to-leaf path", () => {
    const folders = [
      folder("a", "Персонажи", null),
      folder("b", "Яга", "a"),
      folder("c", "Концепты", "b"),
    ];

    expect(
      getProjectFolderBreadcrumbs(folders, "c").map((item) => item.id),
    ).toEqual(["a", "b", "c"]);
  });

  it("stops safely if folder metadata contains a cycle", () => {
    const folders = [folder("a", "A", "b"), folder("b", "B", "a")];

    expect(getProjectFolderBreadcrumbs(folders, "a")).toHaveLength(2);
  });
});

describe("getProjectFolderTree", () => {
  it("flattens nested project folders in sidebar order", () => {
    const folders = [
      { ...folder("a", "Персонажи", null), sortOrder: 1 },
      { ...folder("b", "Мир", null), sortOrder: 0 },
      folder("c", "Яга", "a"),
    ];

    expect(
      getProjectFolderTree(folders).map(({ folder: item, depth }) => [
        item.id,
        depth,
      ]),
    ).toEqual([
      ["b", 0],
      ["a", 0],
      ["c", 1],
    ]);
  });
});

describe("getProjectFolderMoveTargets", () => {
  it("excludes the moving folder and all of its descendants", () => {
    const folders = [
      folder("a", "A", null),
      folder("b", "B", "a"),
      folder("c", "C", "b"),
      folder("d", "D", null),
    ];

    expect(
      getProjectFolderMoveTargets(folders, "a").map(
        ({ folder: item }) => item.id,
      ),
    ).toEqual(["d"]);
  });
});

describe("formatProjectFileSize", () => {
  it("formats bytes and binary kilobytes/megabytes for the Russian UI", () => {
    expect(formatProjectFileSize(512)).toBe("512 Б");
    expect(formatProjectFileSize(1536)).toBe("1,5 КБ");
    expect(formatProjectFileSize(5 * 1024 * 1024)).toBe("5 МБ");
  });
});

describe("isProjectFilePreviewable", () => {
  it("opens images and PDFs in the built-in viewer, but leaves other files downloadable", () => {
    expect(isProjectFilePreviewable({ mimeType: "image/png" })).toBe(true);
    expect(isProjectFilePreviewable({ mimeType: "image/webp" })).toBe(true);
    expect(isProjectFilePreviewable({ mimeType: "application/pdf" })).toBe(
      true,
    );
    expect(isProjectFilePreviewable({ mimeType: "text/markdown" })).toBe(false);
    expect(
      isProjectFilePreviewable({
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    ).toBe(false);
  });
});
