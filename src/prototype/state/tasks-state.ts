import type {
  PrototypeTask,
  PrototypeTaskFolder,
} from "@/prototype/desktop-mock-data";
import type { DesktopPrototypeState } from "@/prototype/desktop-state";

export function getTaskById(
  state: DesktopPrototypeState,
  taskId: string | null,
): PrototypeTask | undefined {
  if (!taskId) return undefined;
  return state.tasks.find((task) => task.id === taskId);
}

export function getProjectTasks(
  state: DesktopPrototypeState,
  projectId = state.activeProjectId,
): PrototypeTask[] {
  return state.tasks.filter((task) => task.projectId === projectId);
}

export function getProjectTaskFolders(
  state: DesktopPrototypeState,
  projectId = state.activeProjectId,
): PrototypeTaskFolder[] {
  return state.taskFolders
    .filter((folder) => folder.projectId === projectId)
    .sort((first, second) => first.order - second.order);
}

export function getVisibleTaskList(
  state: DesktopPrototypeState,
): PrototypeTask[] {
  const normalizedQuery = state.taskSearchQuery.trim().toLocaleLowerCase();
  return [...getProjectTasks(state)]
    .filter((task) => {
      const matchesView = state.selectedTaskFolderId
        ? task.taskFolderId === state.selectedTaskFolderId
        : state.selectedTaskDirectionId
          ? task.overviewDirectionId === state.selectedTaskDirectionId
          : state.taskFilter === "overview"
            ? task.showOnOverview
            : state.taskFilter === "important"
              ? task.starred
              : state.taskFilter === "completed"
                ? task.completedAt !== null
                : true;
      return (
        matchesView &&
        (normalizedQuery.length === 0 ||
          task.title.toLocaleLowerCase().includes(normalizedQuery))
      );
    })
    .sort((first, second) => {
      if (first.taskListOrder !== second.taskListOrder) {
        return first.taskListOrder - second.taskListOrder;
      }
      return first.id.localeCompare(second.id);
    });
}

export function getProjectAreas(
  state: DesktopPrototypeState,
  projectId = state.activeProjectId,
): string[] {
  return Array.from(
    new Set(
      getProjectTasks(state, projectId)
        .map((task) => task.area)
        .filter((area): area is string => Boolean(area)),
    ),
  ).sort((first, second) => first.localeCompare(second, "ru"));
}

export function updateTask(
  state: DesktopPrototypeState,
  taskId: string,
  updater: (task: PrototypeTask) => PrototypeTask,
): DesktopPrototypeState {
  return {
    ...state,
    tasks: state.tasks.map((task) =>
      task.id === taskId ? updater(task) : task,
    ),
  };
}

export function getNextSubtaskId(task: PrototypeTask): string {
  const prefix = `${task.id}-subtask-`;
  let nextNumber = task.subtasks.length + 1;

  while (
    task.subtasks.some((subtask) => subtask.id === `${prefix}${nextNumber}`)
  ) {
    nextNumber += 1;
  }

  return `${prefix}${nextNumber}`;
}

export function getNextTaskLinkId(task: PrototypeTask): string {
  const prefix = `${task.id}-link-`;
  let nextNumber = task.links.length + 1;

  while (task.links.some((link) => link.id === `${prefix}${nextNumber}`)) {
    nextNumber += 1;
  }

  return `${prefix}${nextNumber}`;
}

export function isValidTaskLinkUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function getNextTaskListOrder(
  state: DesktopPrototypeState,
  projectId = state.activeProjectId,
): number {
  return (
    state.tasks.reduce(
      (highestOrder, task) =>
        task.projectId === projectId
          ? Math.max(highestOrder, task.taskListOrder)
          : highestOrder,
      -1,
    ) + 1
  );
}
