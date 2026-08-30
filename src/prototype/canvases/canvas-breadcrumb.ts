import type { CanvasGroup } from "@/lib/canvas/canvas-group-repository";
import type { CanvasSummary } from "@/lib/canvas/local-canvas-repository";

export type CanvasBreadcrumbSegment =
  | { id: string; kind: "group"; title: string }
  | { id: string; kind: "canvas"; title: string };

/**
 * Produces the visible group path for a Canvas without assuming that the
 * persisted group tree is valid. A malformed parent cycle simply stops the
 * path at the first repeated group.
 */
export function getCanvasBreadcrumb(
  groups: readonly CanvasGroup[],
  canvas: CanvasSummary | undefined,
): CanvasBreadcrumbSegment[] {
  if (!canvas) return [];

  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const groupPath: CanvasBreadcrumbSegment[] = [];
  const visited = new Set<string>();
  let groupId = canvas.groupId;

  while (groupId && !visited.has(groupId)) {
    visited.add(groupId);
    const group = groupsById.get(groupId);
    if (!group) break;
    groupPath.unshift({ id: group.id, kind: "group", title: group.title });
    groupId = group.parentGroupId;
  }

  return [...groupPath, { id: canvas.id, kind: "canvas", title: canvas.title }];
}

export function getCanvasGroupAncestorIds(
  groups: readonly CanvasGroup[],
  groupId: string,
): string[] {
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const ancestors: string[] = [];
  const visited = new Set<string>();
  let currentId: string | null = groupId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const group = groupsById.get(currentId);
    if (!group) break;
    ancestors.unshift(group.id);
    currentId = group.parentGroupId;
  }

  return ancestors;
}
