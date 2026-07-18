import type {
  OverviewDirectionId,
  PrototypeTask,
  PrototypeTaskFolder,
  TaskFilter,
  TaskSignal,
} from "@/prototype/desktop-mock-data";
import type { DesktopPrototypeState } from "@/prototype/state/types";

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

export function toggleTaskStar(
  state: DesktopPrototypeState,
  taskId: string,
): DesktopPrototypeState {
  return updateTask(state, taskId, (task) => ({
    ...task,
    starred: !task.starred,
  }));
}

export function toggleTaskCompleted(
  state: DesktopPrototypeState,
  taskId: string,
): DesktopPrototypeState {
  return updateTask(state, taskId, (task) => ({
    ...task,
    completedAt: task.completedAt ? null : new Date().toISOString(),
  }));
}

export function editTaskTitle(
  state: DesktopPrototypeState,
  taskId: string,
  title: string,
): DesktopPrototypeState {
  return updateTask(state, taskId, (task) => ({ ...task, title }));
}

export function beginTaskTitleEdit(
  state: DesktopPrototypeState,
  taskId: string,
): DesktopPrototypeState {
  const task = getTaskById(state, taskId);
  if (!task || task.projectId !== state.activeProjectId) return state;
  return {
    ...state,
    editingTaskTitleId: task.id,
    contextPanel: null,
    contextPanelBeforeAi: null,
  };
}

export function commitTaskTitleEdit(
  state: DesktopPrototypeState,
  taskId: string,
  title: string,
): DesktopPrototypeState {
  const trimmedTitle = title.trim();
  if (state.editingTaskTitleId !== taskId || trimmedTitle.length === 0) {
    return {
      ...state,
      editingTaskTitleId: null,
    };
  }
  return {
    ...updateTask(state, taskId, (task) => ({ ...task, title: trimmedTitle })),
    editingTaskTitleId: null,
  };
}

export function cancelTaskTitleEdit(
  state: DesktopPrototypeState,
): DesktopPrototypeState {
  return {
    ...state,
    editingTaskTitleId: null,
  };
}

export function setTaskDueDate(
  state: DesktopPrototypeState,
  taskId: string,
  dueDate: string,
): DesktopPrototypeState {
  return updateTask(state, taskId, (task) => ({
    ...task,
    dueDate: dueDate.trim() || undefined,
  }));
}

export function setTaskNotes(
  state: DesktopPrototypeState,
  taskId: string,
  notes: string,
): DesktopPrototypeState {
  return updateTask(state, taskId, (task) => ({
    ...task,
    notes,
  }));
}

export function addTaskLink(
  state: DesktopPrototypeState,
  taskId: string,
  title: string,
  url: string,
): DesktopPrototypeState {
  const task = getTaskById(state, taskId);
  const trimmedTitle = title.trim();
  const trimmedUrl = url.trim();
  if (!task || trimmedTitle.length === 0 || !isValidTaskLinkUrl(trimmedUrl)) {
    return state;
  }
  return updateTask(state, task.id, (currentTask) => ({
    ...currentTask,
    links: [
      ...currentTask.links,
      {
        id: getNextTaskLinkId(currentTask),
        title: trimmedTitle,
        url: trimmedUrl,
      },
    ],
  }));
}

export function editTaskLink(
  state: DesktopPrototypeState,
  taskId: string,
  linkId: string,
  title: string,
  url: string,
): DesktopPrototypeState {
  const task = getTaskById(state, taskId);
  const trimmedTitle = title.trim();
  const trimmedUrl = url.trim();
  if (
    !task?.links.some((link) => link.id === linkId) ||
    trimmedTitle.length === 0 ||
    !isValidTaskLinkUrl(trimmedUrl)
  ) {
    return state;
  }
  return updateTask(state, task.id, (currentTask) => ({
    ...currentTask,
    links: currentTask.links.map((link) =>
      link.id === linkId
        ? { ...link, title: trimmedTitle, url: trimmedUrl }
        : link,
    ),
  }));
}

export function deleteTaskLink(
  state: DesktopPrototypeState,
  taskId: string,
  linkId: string,
): DesktopPrototypeState {
  const task = getTaskById(state, taskId);
  if (!task?.links.some((link) => link.id === linkId)) return state;
  return updateTask(state, task.id, (currentTask) => ({
    ...currentTask,
    links: currentTask.links.filter((link) => link.id !== linkId),
  }));
}

export function toggleSubtask(
  state: DesktopPrototypeState,
  taskId: string,
  subtaskId: string,
): DesktopPrototypeState {
  return updateTask(state, taskId, (task) => ({
    ...task,
    subtasks: task.subtasks.map((subtask) =>
      subtask.id === subtaskId ? { ...subtask, done: !subtask.done } : subtask,
    ),
  }));
}

export function addSubtask(
  state: DesktopPrototypeState,
  taskId: string,
  title: string,
): DesktopPrototypeState {
  const trimmedTitle = title.trim();
  const task = getTaskById(state, taskId);
  if (!task || trimmedTitle.length === 0) return state;
  return updateTask(state, task.id, (currentTask) => ({
    ...currentTask,
    subtasks: [
      ...currentTask.subtasks,
      {
        id: getNextSubtaskId(currentTask),
        title: trimmedTitle,
        done: false,
      },
    ],
  }));
}

export function renameSubtask(
  state: DesktopPrototypeState,
  taskId: string,
  subtaskId: string,
  title: string,
): DesktopPrototypeState {
  const trimmedTitle = title.trim();
  const task = getTaskById(state, taskId);
  const subtask = task?.subtasks.find((item) => item.id === subtaskId);
  if (!task || !subtask || trimmedTitle.length === 0) return state;
  return updateTask(state, task.id, (currentTask) => ({
    ...currentTask,
    subtasks: currentTask.subtasks.map((item) =>
      item.id === subtask.id ? { ...item, title: trimmedTitle } : item,
    ),
  }));
}

export function deleteSubtask(
  state: DesktopPrototypeState,
  taskId: string,
  subtaskId: string,
): DesktopPrototypeState {
  const task = getTaskById(state, taskId);
  if (!task?.subtasks.some((item) => item.id === subtaskId)) return state;
  return updateTask(state, task.id, (currentTask) => ({
    ...currentTask,
    subtasks: currentTask.subtasks.filter((item) => item.id !== subtaskId),
  }));
}

export function setTaskSignal(
  state: DesktopPrototypeState,
  taskId: string,
  signal: TaskSignal,
): DesktopPrototypeState {
  return updateTask(state, taskId, (task) => ({ ...task, signal }));
}

export function setTaskFilter(
  state: DesktopPrototypeState,
  filter: TaskFilter,
): DesktopPrototypeState {
  return {
    ...state,
    taskFilter: filter,
    selectedTaskFolderId: null,
    selectedTaskDirectionId: null,
    taskDayViewActive: false,
    taskDetailViewTaskId: null,
  };
}

export function selectTaskDay(
  state: DesktopPrototypeState,
): DesktopPrototypeState {
  return {
    ...state,
    taskFilter: "all",
    selectedTaskFolderId: null,
    selectedTaskDirectionId: null,
    taskDayViewActive: true,
    taskDetailViewTaskId: null,
  };
}

export function selectTaskDirection(
  state: DesktopPrototypeState,
  directionId: OverviewDirectionId,
): DesktopPrototypeState {
  const direction = state.overviewDirections.find(
    (item) => item.id === directionId,
  );
  if (!direction || direction.projectId !== state.activeProjectId) return state;
  return {
    ...state,
    taskFilter: "all",
    selectedTaskFolderId: null,
    selectedTaskDirectionId: direction.id,
    taskDayViewActive: false,
    taskDetailViewTaskId: null,
  };
}

export function setTaskSearchQuery(
  state: DesktopPrototypeState,
  query: string,
): DesktopPrototypeState {
  return { ...state, taskSearchQuery: query };
}

export function selectTaskFolder(
  state: DesktopPrototypeState,
  folderId: string,
): DesktopPrototypeState {
  const folder = state.taskFolders.find(
    (item) => item.id === folderId && item.projectId === state.activeProjectId,
  );
  if (!folder) return state;
  return {
    ...state,
    taskFilter: "all",
    selectedTaskFolderId: folder.id,
    selectedTaskDirectionId: null,
    taskDayViewActive: false,
    taskDetailViewTaskId: null,
  };
}

export function createTaskFolder(
  state: DesktopPrototypeState,
  title: string,
): DesktopPrototypeState {
  const trimmedTitle = title.trim();
  if (trimmedTitle.length === 0) return state;
  const folder: PrototypeTaskFolder = {
    id: `mock-task-folder-${state.nextTaskFolderNumber}`,
    projectId: state.activeProjectId,
    title: trimmedTitle,
    order: getProjectTaskFolders(state).length,
  };
  return {
    ...state,
    taskFolders: [...state.taskFolders, folder],
    nextTaskFolderNumber: state.nextTaskFolderNumber + 1,
  };
}

export function renameTaskFolder(
  state: DesktopPrototypeState,
  folderId: string,
  title: string,
): DesktopPrototypeState {
  const trimmedTitle = title.trim();
  const folder = state.taskFolders.find(
    (item) => item.id === folderId && item.projectId === state.activeProjectId,
  );
  if (!folder || trimmedTitle.length === 0) return state;
  return {
    ...state,
    taskFolders: state.taskFolders.map((item) =>
      item.id === folder.id ? { ...item, title: trimmedTitle } : item,
    ),
  };
}

export function deleteTaskFolder(
  state: DesktopPrototypeState,
  folderId: string,
): DesktopPrototypeState {
  const folder = state.taskFolders.find(
    (item) => item.id === folderId && item.projectId === state.activeProjectId,
  );
  if (!folder || state.tasks.some((task) => task.taskFolderId === folder.id)) {
    return state;
  }
  return {
    ...state,
    taskFolders: state.taskFolders.filter((item) => item.id !== folder.id),
    selectedTaskFolderId:
      state.selectedTaskFolderId === folder.id
        ? null
        : state.selectedTaskFolderId,
  };
}

export function assignTaskFolder(
  state: DesktopPrototypeState,
  taskId: string,
  folderId: string | null,
): DesktopPrototypeState {
  const task = getTaskById(state, taskId);
  const folder = folderId
    ? state.taskFolders.find((item) => item.id === folderId)
    : null;
  if (
    !task ||
    task.projectId !== state.activeProjectId ||
    (folderId && (!folder || folder.projectId !== task.projectId))
  ) {
    return state;
  }
  return updateTask(state, task.id, (currentTask) => ({
    ...currentTask,
    taskFolderId: folder?.id ?? null,
  }));
}

export function setTaskOverview(
  state: DesktopPrototypeState,
  taskId: string,
  visible: boolean,
): DesktopPrototypeState {
  const task = getTaskById(state, taskId);
  if (!task || task.projectId !== state.activeProjectId) return state;
  if (task.showOnOverview === visible) return state;
  return updateTask(state, task.id, (currentTask) => ({
    ...currentTask,
    showOnOverview: visible,
  }));
}

export function moveTaskList(
  state: DesktopPrototypeState,
  taskId: string,
  targetTaskId: string | null,
): DesktopPrototypeState {
  const movingTask = getTaskById(state, taskId);
  const targetTask = targetTaskId ? getTaskById(state, targetTaskId) : null;
  if (
    !movingTask ||
    movingTask.projectId !== state.activeProjectId ||
    (targetTaskId &&
      (!targetTask || targetTask.projectId !== movingTask.projectId)) ||
    movingTask.id === targetTask?.id
  ) {
    return state;
  }

  const orderedTasks = [...getProjectTasks(state)].sort(
    (first, second) => first.taskListOrder - second.taskListOrder,
  );
  const remainingTasks = orderedTasks.filter(
    (task) => task.id !== movingTask.id,
  );
  const targetIndex = targetTask
    ? remainingTasks.findIndex((task) => task.id === targetTask.id)
    : remainingTasks.length;
  remainingTasks.splice(
    targetIndex < 0 ? remainingTasks.length : targetIndex,
    0,
    movingTask,
  );
  const orderByTaskId = new Map(
    remainingTasks.map((task, taskListOrder) => [task.id, taskListOrder]),
  );
  return {
    ...state,
    tasks: state.tasks.map((task) => {
      const taskListOrder = orderByTaskId.get(task.id);
      return taskListOrder === undefined ? task : { ...task, taskListOrder };
    }),
  };
}
