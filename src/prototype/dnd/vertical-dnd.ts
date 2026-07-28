export type VerticalDragGeometry = {
  activeTop: number;
  activeHeight: number;
  overTop: number;
  overHeight: number;
};

export function getVerticalInsertionIndex({
  targetCount,
  overIndex,
  geometry,
}: {
  targetCount: number;
  overIndex: number | null;
  geometry: VerticalDragGeometry | null;
}): number {
  const safeTargetCount = Math.max(0, Math.trunc(targetCount));
  if (overIndex === null) return safeTargetCount;

  const safeOverIndex = Math.max(
    0,
    Math.min(Math.trunc(overIndex), Math.max(safeTargetCount - 1, 0)),
  );
  const insertAfter = geometry
    ? geometry.activeTop + geometry.activeHeight / 2 >
      geometry.overTop + geometry.overHeight / 2
    : false;

  return Math.min(safeOverIndex + (insertAfter ? 1 : 0), safeTargetCount);
}
