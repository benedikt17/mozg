import type {
  OverviewDirectionId,
  PrototypeOverviewDirection,
  PrototypeTask,
} from "@/prototype/desktop-mock-data";
import type { DesktopPrototypeState } from "@/prototype/desktop-state";

export function getProjectOverviewDirections(
  state: DesktopPrototypeState,
  projectId = state.activeProjectId,
): PrototypeOverviewDirection[] {
  return state.overviewDirections
    .filter((direction) => direction.projectId === projectId)
    .sort((first, second) => first.order - second.order)
    .slice(0, 4);
}

export function getOverviewDirectionById(
  state: DesktopPrototypeState,
  directionId: OverviewDirectionId,
): PrototypeOverviewDirection | undefined {
  return state.overviewDirections.find(
    (direction) => direction.id === directionId,
  );
}

export function getVisibleOverviewTasks(
  state: DesktopPrototypeState,
): PrototypeTask[] {
  return sortTasksForBoard(
    state.tasks.filter(
      (task) =>
        task.projectId === state.activeProjectId &&
        task.showOnOverview &&
        task.completedAt === null,
    ),
  );
}

export function sortTasksForBoard(tasks: PrototypeTask[]): PrototypeTask[] {
  return [...tasks].sort((first, second) => {
    if (first.overviewOrder !== second.overviewOrder) {
      return first.overviewOrder - second.overviewOrder;
    }
    return first.id.localeCompare(second.id);
  });
}

export function getTasksForDirection(
  state: DesktopPrototypeState,
  directionId: OverviewDirectionId,
): PrototypeTask[] {
  return getVisibleOverviewTasks(state).filter(
    (task) => task.overviewDirectionId === directionId,
  );
}

export function getNextOverviewOrder(
  state: DesktopPrototypeState,
  directionId: OverviewDirectionId,
): number {
  return (
    state.tasks.reduce(
      (highestOrder, task) =>
        task.projectId === state.activeProjectId &&
        task.overviewDirectionId === directionId
          ? Math.max(highestOrder, task.overviewOrder)
          : highestOrder,
      -1,
    ) + 1
  );
}

export function normalizeDirectionOrders(
  tasks: PrototypeTask[],
  projectId: string,
  directionId: OverviewDirectionId,
): PrototypeTask[] {
  const orderedIds = sortTasksForBoard(
    tasks.filter(
      (task) =>
        task.projectId === projectId &&
        task.overviewDirectionId === directionId,
    ),
  ).map((task) => task.id);
  const orderById = new Map(
    orderedIds.map((taskId, overviewOrder) => [taskId, overviewOrder]),
  );
  return tasks.map((task) => {
    const overviewOrder = orderById.get(task.id);
    return overviewOrder === undefined ? task : { ...task, overviewOrder };
  });
}

export function moveOverviewTask(
  state: DesktopPrototypeState,
  taskId: string,
  targetDirectionId: OverviewDirectionId,
  targetIndex: number,
  appendToDirectionEnd = false,
): DesktopPrototypeState {
  const movingTask = state.tasks.find((task) => task.id === taskId);
  if (!movingTask) return state;
  const targetDirection = getOverviewDirectionById(state, targetDirectionId);
  if (!targetDirection || targetDirection.projectId !== movingTask.projectId) {
    return state;
  }

  const sourceDirectionId = movingTask.overviewDirectionId;
  const targetTasks = sortTasksForBoard(
    state.tasks.filter(
      (task) =>
        task.projectId === movingTask.projectId &&
        task.overviewDirectionId === targetDirectionId &&
        task.id !== taskId,
    ),
  );
  const visibleTargetIds = targetTasks
    .filter((task) => task.completedAt === null)
    .map((task) => task.id);
  const safeTargetIndex = Math.max(
    0,
    Math.min(Math.trunc(targetIndex), visibleTargetIds.length),
  );

  let fullInsertionIndex = targetTasks.length;
  if (!appendToDirectionEnd && visibleTargetIds.length > 0) {
    if (safeTargetIndex < visibleTargetIds.length) {
      fullInsertionIndex = targetTasks.findIndex(
        (task) => task.id === visibleTargetIds[safeTargetIndex],
      );
    } else {
      fullInsertionIndex =
        targetTasks.findIndex(
          (task) => task.id === visibleTargetIds[visibleTargetIds.length - 1],
        ) + 1;
    }
  }

  const movedTask: PrototypeTask = {
    ...movingTask,
    overviewDirectionId: targetDirectionId,
  };
  const orderedTargetTasks = [...targetTasks];
  orderedTargetTasks.splice(fullInsertionIndex, 0, movedTask);
  const targetOrderById = new Map(
    orderedTargetTasks.map((task, overviewOrder) => [task.id, overviewOrder]),
  );

  let tasks = state.tasks.map((task) => {
    const targetOrder = targetOrderById.get(task.id);
    if (task.id === taskId) {
      return {
        ...movedTask,
        overviewOrder: targetOrder ?? 0,
      };
    }
    return targetOrder === undefined
      ? task
      : { ...task, overviewOrder: targetOrder };
  });

  if (sourceDirectionId !== targetDirectionId) {
    tasks = normalizeDirectionOrders(
      tasks,
      movingTask.projectId,
      sourceDirectionId,
    );
  }

  return { ...state, tasks };
}

export function moveTaskToDirection(
  state: DesktopPrototypeState,
  taskId: string,
  overviewDirectionId: OverviewDirectionId,
): DesktopPrototypeState {
  return moveOverviewTask(state, taskId, overviewDirectionId, 0, true);
}

export function moveOverviewTaskAtIndex(
  state: DesktopPrototypeState,
  taskId: string,
  targetDirectionId: OverviewDirectionId,
  targetIndex: number,
): DesktopPrototypeState {
  return moveOverviewTask(state, taskId, targetDirectionId, targetIndex);
}

export function toggleOverviewTaskExpanded(
  state: DesktopPrototypeState,
  taskId: string,
): DesktopPrototypeState {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task || task.projectId !== state.activeProjectId) return state;
  return {
    ...state,
    overviewExpandedTaskId:
      state.overviewExpandedTaskId === task.id ? null : task.id,
  };
}

export function setOverviewDirectionVisible(
  state: DesktopPrototypeState,
  directionId: OverviewDirectionId,
  visible: boolean,
): DesktopPrototypeState {
  const direction = getOverviewDirectionById(state, directionId);
  if (!direction || direction.projectId !== state.activeProjectId) {
    return state;
  }
  return {
    ...state,
    overviewHiddenDirectionIds: visible
      ? state.overviewHiddenDirectionIds.filter(
          (hiddenDirectionId) => hiddenDirectionId !== direction.id,
        )
      : Array.from(
          new Set([...state.overviewHiddenDirectionIds, direction.id]),
        ),
  };
}

export function setOverviewScrollLeft(
  state: DesktopPrototypeState,
  scrollLeft: number,
): DesktopPrototypeState {
  return {
    ...state,
    overviewScrollLeft: Math.max(0, scrollLeft),
  };
}

export function renameOverviewDirection(
  state: DesktopPrototypeState,
  directionId: OverviewDirectionId,
  title: string,
): DesktopPrototypeState {
  const normalizedTitle = title.trim();
  if (normalizedTitle.length === 0) return state;
  const direction = getOverviewDirectionById(state, directionId);
  if (!direction || direction.projectId !== state.activeProjectId) {
    return state;
  }
  return {
    ...state,
    overviewDirections: state.overviewDirections.map((item) =>
      item.id === direction.id ? { ...item, title: normalizedTitle } : item,
    ),
  };
}
