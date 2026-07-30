import { canonicalOverviewDirectionDefinitions } from "@/prototype/desktop-mock-data";
import type {
  PrototypeOverviewDirection,
  PrototypeTask,
  PrototypeTaskGroup,
  PrototypeTaskList,
  TaskSignal,
} from "@/prototype/desktop-mock-data";
import type {
  DesktopPrototypeState,
  TaskSystemView,
} from "@/prototype/state/types";

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

export function getProjectTaskLists(
  state: DesktopPrototypeState,
  projectId = state.activeProjectId,
): PrototypeTaskList[] {
  return state.taskLists
    .filter((list) => list.projectId === projectId)
    .sort((first, second) => first.order - second.order);
}

export function getProjectTaskGroups(
  state: DesktopPrototypeState,
  projectId = state.activeProjectId,
): PrototypeTaskGroup[] {
  return state.taskGroups
    .filter((group) => group.projectId === projectId)
    .sort((first, second) => first.order - second.order);
}

export function createBazaTaskStructure(
  projectId: string,
  directions: PrototypeOverviewDirection[],
): { group: PrototypeTaskGroup; lists: PrototypeTaskList[] } {
  const group: PrototypeTaskGroup = {
    id: `${projectId}-baza`,
    projectId,
    title: "BAZA",
    order: 0,
    kind: "system",
  };
  const definitions = canonicalOverviewDirectionDefinitions;
  return {
    group,
    lists: definitions.map(([key, title], order) => ({
      id: `${projectId}-list-${key}`,
      projectId,
      groupId: group.id,
      title,
      order,
      kind: "system",
      overviewDirectionId: directions.find(
        (item) => item.id === `${projectId}-${key}`,
      )?.id,
    })),
  };
}

export function getTaskListById(
  state: DesktopPrototypeState,
  listId: string | null,
): PrototypeTaskList | undefined {
  if (!listId) return undefined;
  return state.taskLists.find(
    (list) => list.id === listId && list.projectId === state.activeProjectId,
  );
}

export function getTaskListActiveCount(
  state: DesktopPrototypeState,
  listId: string,
): number {
  return getProjectTasks(state).filter(
    (task) => task.listId === listId && task.completedAt === null,
  ).length;
}

export function isTaskInSystemView(
  task: PrototypeTask,
  view: TaskSystemView,
): boolean {
  if (task.completedAt !== null) return false;
  if (view === "day") return task.myDay;
  if (view === "important") return task.starred;
  return true;
}

export function getTaskSystemViewCount(
  state: DesktopPrototypeState,
  view: TaskSystemView,
): number {
  return getProjectTasks(state).filter((task) => isTaskInSystemView(task, view))
    .length;
}

export function getCompletedTasksForList(
  state: DesktopPrototypeState,
  listId: string,
): PrototypeTask[] {
  return getProjectTasks(state)
    .filter((task) => task.listId === listId && task.completedAt !== null)
    .sort((first, second) => first.taskListOrder - second.taskListOrder);
}

export function getVisibleTaskList(
  state: DesktopPrototypeState,
): PrototypeTask[] {
  const normalizedQuery = state.taskSearchQuery.trim().toLocaleLowerCase();
  return [...getProjectTasks(state)]
    .filter((task) => {
      const matchesView =
        state.taskSelection.kind === "list"
          ? task.listId === state.taskSelection.listId &&
            task.completedAt === null
          : isTaskInSystemView(task, state.taskSelection.view);
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
  const taskIndex = state.tasks.findIndex(
    (task) => task.id === taskId && task.projectId === state.activeProjectId,
  );
  if (taskIndex < 0) return state;

  const task = state.tasks[taskIndex];
  if (!task) return state;
  const updatedTask = updater(task);
  if (updatedTask === task) return state;

  const tasks = [...state.tasks];
  tasks[taskIndex] = updatedTask;
  return {
    ...state,
    tasks,
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
  const task = getTaskById(state, taskId);
  if (!task || task.projectId !== state.activeProjectId) return state;
  const taskList = state.taskLists.find(
    (list) => list.id === task.listId && list.projectId === task.projectId,
  );
  const restoring = task.completedAt !== null;

  return updateTask(state, taskId, (currentTask) => {
    if (!restoring) {
      return {
        ...currentTask,
        completedAt: new Date().toISOString(),
      };
    }

    if (
      taskList?.kind === "system" &&
      taskList.overviewDirectionId !== undefined
    ) {
      return {
        ...currentTask,
        completedAt: null,
        overviewDirectionId: taskList.overviewDirectionId,
        showOnOverview: true,
      };
    }

    if (taskList?.kind === "user") {
      return {
        ...currentTask,
        completedAt: null,
        overviewDirectionId: "",
        showOnOverview: false,
      };
    }

    return {
      ...currentTask,
      completedAt: null,
    };
  });
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
  };
}

export function commitTaskTitleEdit(
  state: DesktopPrototypeState,
  taskId: string,
  title: string,
): DesktopPrototypeState {
  const task = getTaskById(state, taskId);
  if (!task || task.projectId !== state.activeProjectId) return state;
  const trimmedTitle = title.trim();
  if (
    state.editingTaskTitleId !== taskId ||
    trimmedTitle.length === 0 ||
    trimmedTitle === task.title
  ) {
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
  const task = getTaskById(state, taskId);
  if (!task?.subtasks.some((subtask) => subtask.id === subtaskId)) return state;
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
        detailsMarkdown: "",
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

export function selectTaskSystemView(
  state: DesktopPrototypeState,
  view: TaskSystemView,
): DesktopPrototypeState {
  return {
    ...state,
    taskSelection: { kind: "system", view },
    taskDetailViewTaskId: null,
  };
}

export function selectTaskList(
  state: DesktopPrototypeState,
  listId: string,
): DesktopPrototypeState {
  const list = getTaskListById(state, listId);
  if (!list) return state;
  return {
    ...state,
    taskSelection: { kind: "list", listId: list.id },
    taskDetailViewTaskId: null,
  };
}

export function setTaskSearchQuery(
  state: DesktopPrototypeState,
  query: string,
): DesktopPrototypeState {
  return { ...state, taskSearchQuery: query };
}

export function createTaskGroup(
  state: DesktopPrototypeState,
  title: string,
): DesktopPrototypeState {
  const trimmedTitle = title.trim();
  if (trimmedTitle.length === 0) return state;
  const group: PrototypeTaskGroup = {
    id: `mock-task-group-${state.nextTaskGroupNumber}`,
    projectId: state.activeProjectId,
    title: trimmedTitle,
    order:
      Math.max(
        -1,
        ...getProjectTaskGroups(state)
          .filter((item) => item.kind === "user")
          .map((item) => item.order),
      ) + 1,
    kind: "user",
  };
  return {
    ...state,
    taskGroups: [...state.taskGroups, group],
    expandedTaskGroupIds: [...state.expandedTaskGroupIds, group.id],
    nextTaskGroupNumber: state.nextTaskGroupNumber + 1,
  };
}

export function toggleTaskGroup(
  state: DesktopPrototypeState,
  groupId: string,
): DesktopPrototypeState {
  const group = state.taskGroups.find(
    (item) => item.id === groupId && item.projectId === state.activeProjectId,
  );
  if (!group || group.kind !== "user") return state;
  const isExpanded = state.expandedTaskGroupIds.includes(group.id);
  return {
    ...state,
    expandedTaskGroupIds: isExpanded
      ? state.expandedTaskGroupIds.filter((id) => id !== group.id)
      : [...state.expandedTaskGroupIds, group.id],
  };
}

export function renameTaskGroup(
  state: DesktopPrototypeState,
  groupId: string,
  title: string,
): DesktopPrototypeState {
  const trimmedTitle = title.trim();
  if (trimmedTitle.length === 0) return state;
  const group = state.taskGroups.find(
    (item) =>
      item.id === groupId &&
      item.projectId === state.activeProjectId &&
      item.kind === "user",
  );
  if (!group) return state;
  return {
    ...state,
    taskGroups: state.taskGroups.map((item) =>
      item.id === group.id ? { ...item, title: trimmedTitle } : item,
    ),
  };
}

export function deleteTaskGroup(
  state: DesktopPrototypeState,
  groupId: string,
): DesktopPrototypeState {
  const group = state.taskGroups.find(
    (item) =>
      item.id === groupId &&
      item.projectId === state.activeProjectId &&
      item.kind === "user",
  );
  if (!group) return state;
  const fallbackGroup = state.taskGroups.find(
    (item) =>
      item.projectId === state.activeProjectId && item.kind === "system",
  );
  if (!fallbackGroup) return state;
  const nextLists = state.taskLists.map((list) =>
    list.groupId === group.id ? { ...list, groupId: fallbackGroup.id } : list,
  );
  return {
    ...state,
    taskGroups: state.taskGroups.filter((item) => item.id !== group.id),
    taskLists: nextLists,
    expandedTaskGroupIds: state.expandedTaskGroupIds.filter(
      (id) => id !== group.id,
    ),
  };
}

export function createTaskList(
  state: DesktopPrototypeState,
  title: string,
  groupId: string,
): DesktopPrototypeState {
  const trimmedTitle = title.trim();
  if (trimmedTitle.length === 0) return state;
  const group = state.taskGroups.find(
    (item) =>
      item.id === groupId &&
      item.projectId === state.activeProjectId &&
      item.kind === "user",
  );
  if (!group) return state;
  const list: PrototypeTaskList = {
    id: `mock-task-list-${state.nextTaskListNumber}`,
    projectId: state.activeProjectId,
    groupId: group.id,
    title: trimmedTitle,
    order: getProjectTaskLists(state).filter(
      (item) => item.groupId === group.id,
    ).length,
    kind: "user",
  };
  return {
    ...state,
    taskLists: [...state.taskLists, list],
    nextTaskListNumber: state.nextTaskListNumber + 1,
  };
}

export function renameTaskList(
  state: DesktopPrototypeState,
  listId: string,
  title: string,
): DesktopPrototypeState {
  const trimmedTitle = title.trim();
  if (trimmedTitle.length === 0) return state;
  const list = state.taskLists.find(
    (item) => item.id === listId && item.projectId === state.activeProjectId,
  );
  if (!list) return state;
  return {
    ...state,
    taskLists: state.taskLists.map((item) =>
      item.id === list.id ? { ...item, title: trimmedTitle } : item,
    ),
  };
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

export function moveTaskToList(
  state: DesktopPrototypeState,
  taskId: string,
  targetListId: string,
  targetTaskId: string | null,
  sourceSystemView?: TaskSystemView,
): DesktopPrototypeState {
  const movingTask = getTaskById(state, taskId);
  const targetTask = targetTaskId ? getTaskById(state, targetTaskId) : null;
  const targetList = state.taskLists.find(
    (list) =>
      list.id === targetListId && list.projectId === state.activeProjectId,
  );
  const targetGroup = targetList
    ? state.taskGroups.find(
        (group) =>
          group.id === targetList.groupId &&
          group.projectId === state.activeProjectId,
      )
    : undefined;
  if (
    !movingTask ||
    movingTask.projectId !== state.activeProjectId ||
    movingTask.completedAt !== null ||
    !targetList ||
    !targetGroup ||
    targetList.kind !== targetGroup.kind ||
    (targetList.kind === "system" && !targetList.overviewDirectionId) ||
    (targetTaskId &&
      (!targetTask ||
        targetTask.projectId !== movingTask.projectId ||
        targetTask.completedAt !== null ||
        targetTask.listId !== targetList.id)) ||
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
    : (() => {
        const targetListIndexes = remainingTasks.reduce<number[]>(
          (indexes, task, index) => {
            if (task.listId === targetList.id && task.completedAt === null) {
              indexes.push(index);
            }
            return indexes;
          },
          [],
        );
        return targetListIndexes.length > 0
          ? targetListIndexes[targetListIndexes.length - 1] + 1
          : remainingTasks.length;
      })();
  const taskAfterLeavingSystemView =
    sourceSystemView === "day"
      ? { ...movingTask, myDay: false }
      : sourceSystemView === "important"
        ? { ...movingTask, starred: false }
        : movingTask;
  const destinationTask = {
    ...taskAfterLeavingSystemView,
    listId: targetList.id,
    overviewDirectionId:
      targetList.kind === "system"
        ? (targetList.overviewDirectionId ?? "")
        : "",
    showOnOverview: targetList.kind === "system",
  };
  remainingTasks.splice(
    targetIndex < 0 ? remainingTasks.length : targetIndex,
    0,
    destinationTask,
  );
  const orderByTaskId = new Map(
    remainingTasks.map((task, taskListOrder) => [task.id, taskListOrder]),
  );
  return {
    ...state,
    tasks: state.tasks.map((task) => {
      const taskListOrder = orderByTaskId.get(task.id);
      if (taskListOrder === undefined) return task;
      const nextTask = task.id === destinationTask.id ? destinationTask : task;
      return { ...nextTask, taskListOrder };
    }),
  };
}
