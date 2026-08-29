import { describe, expect, it } from "vitest";
import {
  getCanvasBreadcrumb,
  getCanvasGroupAncestorIds,
} from "@/prototype/canvases/canvas-breadcrumb";

const group = (id: string, title: string, parentGroupId: string | null) => ({
  id,
  title,
  parentGroupId,
  workspaceId: "workspace-1",
  sortOrder: 0,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  deletedAt: null,
});

const canvas = {
  id: "canvas-1",
  title: "Кощей",
  groupId: "group-child",
  workspaceId: "workspace-1",
  revision: 1,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  deletedAt: null,
};

describe("Canvas breadcrumbs", () => {
  const groups = [
    group("group-root", "Лукоморье", null),
    group("group-child", "Территории сюжетов", "group-root"),
  ];

  it("builds the current Canvas path from its nested groups", () => {
    expect(getCanvasBreadcrumb(groups, canvas)).toEqual([
      { id: "group-root", kind: "group", title: "Лукоморье" },
      {
        id: "group-child",
        kind: "group",
        title: "Территории сюжетов",
      },
      { id: "canvas-1", kind: "canvas", title: "Кощей" },
    ]);
  });

  it("returns every ancestor that must be expanded to reveal a group", () => {
    expect(getCanvasGroupAncestorIds(groups, "group-child")).toEqual([
      "group-root",
      "group-child",
    ]);
  });

  it("stops safely when persisted groups contain a parent cycle", () => {
    const cyclicGroups = [
      group("group-a", "A", "group-b"),
      group("group-b", "B", "group-a"),
    ];

    expect(
      getCanvasBreadcrumb(cyclicGroups, { ...canvas, groupId: "group-a" }),
    ).toHaveLength(3);
    expect(getCanvasGroupAncestorIds(cyclicGroups, "group-a")).toHaveLength(2);
  });
});
