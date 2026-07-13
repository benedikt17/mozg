import type { DragEndEvent, DragOverEvent } from "@dnd-kit/core";
import type {
  OverviewDirectionId,
  PrototypeTask,
} from "@/prototype/desktop-mock-data";

export type OverviewDropTarget = {
  directionId: OverviewDirectionId;
  index: number;
};

export type OverviewDragData = {
  type: "overview-task";
  taskId: string;
  directionId: OverviewDirectionId;
};

export type OverviewDirectionDropData = {
  type: "overview-direction";
  directionId: OverviewDirectionId;
};

export type VerticalDragGeometry = {
  activeTop: number;
  activeHeight: number;
  overTop: number;
  overHeight: number;
};

export const taskDragId = (taskId: string): string => `overview-task:${taskId}`;

export const directionDropId = (directionId: OverviewDirectionId): string =>
  `overview-direction:${directionId}`;

export function getOverviewDirectionTasks(
  tasks: PrototypeTask[],
  directionId: OverviewDirectionId,
): PrototypeTask[] {
  return tasks.filter((task) => task.overviewDirectionId === directionId);
}

export function isOverviewTaskDragData(
  value: unknown,
): value is OverviewDragData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === "overview-task" &&
    typeof candidate.taskId === "string" &&
    typeof candidate.directionId === "string"
  );
}

function isOverviewDirectionDropData(
  value: unknown,
): value is OverviewDirectionDropData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === "overview-direction" &&
    typeof candidate.directionId === "string"
  );
}

export function getOverviewInsertionIndex({
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

export function getOverviewDropTarget(
  tasks: PrototypeTask[],
  activeTaskId: string,
  event: DragOverEvent | DragEndEvent,
): OverviewDropTarget | null {
  const over = event.over;
  if (!over) return null;
  const overData = over.data.current;

  if (isOverviewDirectionDropData(overData)) {
    const targetCount = getOverviewDirectionTasks(
      tasks,
      overData.directionId,
    ).filter((task) => task.id !== activeTaskId).length;
    return {
      directionId: overData.directionId,
      index: getOverviewInsertionIndex({
        targetCount,
        overIndex: null,
        geometry: null,
      }),
    };
  }

  if (!isOverviewTaskDragData(overData)) return null;
  const directionTasks = getOverviewDirectionTasks(tasks, overData.directionId);
  const targetTasks = directionTasks.filter((task) => task.id !== activeTaskId);
  const overIndex = targetTasks.findIndex(
    (task) => task.id === overData.taskId,
  );
  if (overIndex < 0) {
    const currentIndex = directionTasks.findIndex(
      (task) => task.id === activeTaskId,
    );
    return {
      directionId: overData.directionId,
      index: Math.min(Math.max(currentIndex, 0), targetTasks.length),
    };
  }

  const translatedRect = event.active.rect.current.translated;
  return {
    directionId: overData.directionId,
    index: getOverviewInsertionIndex({
      targetCount: targetTasks.length,
      overIndex,
      geometry: translatedRect
        ? {
            activeTop: translatedRect.top,
            activeHeight: translatedRect.height,
            overTop: over.rect.top,
            overHeight: over.rect.height,
          }
        : null,
    }),
  };
}
