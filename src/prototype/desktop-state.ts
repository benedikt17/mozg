import {
  aiProposals,
  initialMilestones,
  initialProjects,
  initialTasks,
  type OverviewLane,
  type ProjectSection,
  type PrototypeMilestone,
  type PrototypeProject,
  type PrototypeTask,
} from "@/prototype/desktop-mock-data";

export type RightPanel = "task" | "ai" | null;

export type OverviewFilters = {
  area: string;
  milestoneId: string;
  starredOnly: boolean;
};

export type DesktopPrototypeState = {
  activeProjectId: string;
  activeSection: ProjectSection;
  selectedTaskId: string | null;
  rightPanel: RightPanel;
  commandPaletteOpen: boolean;
  projects: PrototypeProject[];
  milestones: PrototypeMilestone[];
  tasks: PrototypeTask[];
  filters: OverviewFilters;
  selectedAiProposalIds: string[];
  aiActivityLog: string[];
  nextProjectNumber: number;
  nextTaskNumber: number;
};

export type DesktopPrototypeAction =
  | { type: "switch-project"; projectId: string }
  | { type: "create-project" }
  | { type: "switch-section"; section: ProjectSection }
  | { type: "select-task"; taskId: string }
  | { type: "close-right-panel" }
  | { type: "toggle-task-star"; taskId: string }
  | { type: "edit-task-title"; taskId: string; title: string }
  | { type: "set-task-due-date"; taskId: string; dueDate: string }
  | { type: "set-task-notes"; taskId: string; notes: string }
  | { type: "toggle-subtask"; taskId: string; subtaskId: string }
  | { type: "move-task"; taskId: string; overviewLane: OverviewLane }
  | { type: "set-area-filter"; area: string }
  | { type: "set-milestone-filter"; milestoneId: string }
  | { type: "toggle-starred-filter" }
  | { type: "create-task" }
  | { type: "open-ai-panel" }
  | { type: "close-ai-panel" }
  | { type: "toggle-ai-proposal"; proposalId: string }
  | { type: "confirm-ai-proposals" }
  | { type: "open-command-palette" }
  | { type: "close-command-palette" };

export const ALL_AREAS = "all";
export const ALL_MILESTONES = "all";
export const MAX_VISIBLE_COMMAND_RESULTS = 8;

export const initialDesktopPrototypeState: DesktopPrototypeState = {
  activeProjectId: "lukomorie",
  activeSection: "overview",
  selectedTaskId: null,
  rightPanel: null,
  commandPaletteOpen: false,
  projects: initialProjects,
  milestones: initialMilestones,
  tasks: initialTasks,
  filters: {
    area: ALL_AREAS,
    milestoneId: "lukomorie-alpha",
    starredOnly: false,
  },
  selectedAiProposalIds: [],
  aiActivityLog: [],
  nextProjectNumber: 1,
  nextTaskNumber: 1,
};

export function getActiveProject(
  state: DesktopPrototypeState,
): PrototypeProject {
  return (
    state.projects.find((project) => project.id === state.activeProjectId) ??
    state.projects[0]
  );
}

export function getProjectMilestones(
  state: DesktopPrototypeState,
  projectId = state.activeProjectId,
): PrototypeMilestone[] {
  return state.milestones.filter(
    (milestone) => milestone.projectId === projectId,
  );
}

export function getActiveMilestone(
  state: DesktopPrototypeState,
): PrototypeMilestone {
  const projectMilestones = getProjectMilestones(state);
  return (
    projectMilestones.find(
      (milestone) => milestone.id === state.filters.milestoneId,
    ) ?? projectMilestones[0]
  );
}

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

export function getVisibleOverviewTasks(
  state: DesktopPrototypeState,
): PrototypeTask[] {
  return sortTasksForBoard(
    getProjectTasks(state).filter((task) => {
      const areaMatches =
        state.filters.area === ALL_AREAS || task.area === state.filters.area;
      const milestoneMatches =
        state.filters.milestoneId === ALL_MILESTONES ||
        task.milestoneId === state.filters.milestoneId;
      const starMatches = !state.filters.starredOnly || task.starred;
      return areaMatches && milestoneMatches && starMatches;
    }),
  );
}

export function sortTasksForBoard(tasks: PrototypeTask[]): PrototypeTask[] {
  return [...tasks].sort((first, second) => {
    if (first.starred !== second.starred) return first.starred ? -1 : 1;
    return first.title.localeCompare(second.title, "ru");
  });
}

export function getTasksForLane(
  state: DesktopPrototypeState,
  lane: OverviewLane,
): PrototypeTask[] {
  return getVisibleOverviewTasks(state).filter(
    (task) => task.overviewLane === lane,
  );
}

export function getMilestoneProgress(state: DesktopPrototypeState): {
  completed: number;
  total: number;
} {
  const activeMilestone = getActiveMilestone(state);
  const milestoneTasks = getProjectTasks(state).filter(
    (task) => task.milestoneId === activeMilestone.id,
  );
  return {
    completed: milestoneTasks.filter((task) => task.overviewLane === "done")
      .length,
    total: milestoneTasks.length,
  };
}

export function visibleCommandResults<T>(results: T[]): T[] {
  return results.slice(0, MAX_VISIBLE_COMMAND_RESULTS);
}

function filtersForProject(
  state: DesktopPrototypeState,
  projectId: string,
): OverviewFilters {
  const firstMilestone = state.milestones.find(
    (milestone) => milestone.projectId === projectId,
  );
  return {
    area: ALL_AREAS,
    milestoneId: firstMilestone?.id ?? ALL_MILESTONES,
    starredOnly: false,
  };
}

function updateTask(
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

function addAiLog(
  state: DesktopPrototypeState,
  message: string,
): DesktopPrototypeState {
  return {
    ...state,
    aiActivityLog: [message, ...state.aiActivityLog].slice(0, 5),
  };
}

export function desktopPrototypeReducer(
  state: DesktopPrototypeState,
  action: DesktopPrototypeAction,
): DesktopPrototypeState {
  switch (action.type) {
    case "switch-project": {
      const selectedTask = getTaskById(state, state.selectedTaskId);
      const selectedTaskBelongsToProject =
        selectedTask?.projectId === action.projectId;
      return {
        ...state,
        activeProjectId: action.projectId,
        selectedTaskId: selectedTaskBelongsToProject
          ? state.selectedTaskId
          : null,
        rightPanel: selectedTaskBelongsToProject ? state.rightPanel : null,
        filters: filtersForProject(state, action.projectId),
        commandPaletteOpen: false,
        selectedAiProposalIds: [],
      };
    }
    case "create-project": {
      const id = `mock-project-${state.nextProjectNumber}`;
      const project: PrototypeProject = {
        id,
        name: `Новый проект ${state.nextProjectNumber}`,
        shortName: `Проект ${state.nextProjectNumber}`,
        description: "Черновой проект для проверки поведения вкладок.",
      };
      const milestone: PrototypeMilestone = {
        id: `${id}-milestone`,
        projectId: id,
        title: "Первый рабочий рубеж",
        description: "Определить цель проекта и первые действия.",
      };
      return {
        ...state,
        projects: [...state.projects, project],
        milestones: [...state.milestones, milestone],
        activeProjectId: id,
        activeSection: "overview",
        selectedTaskId: null,
        rightPanel: null,
        filters: {
          area: ALL_AREAS,
          milestoneId: milestone.id,
          starredOnly: false,
        },
        nextProjectNumber: state.nextProjectNumber + 1,
      };
    }
    case "switch-section":
      return {
        ...state,
        activeSection: action.section,
        rightPanel: action.section === "overview" ? state.rightPanel : null,
        commandPaletteOpen: false,
      };
    case "select-task": {
      const task = getTaskById(state, action.taskId);
      if (!task) return state;
      return {
        ...state,
        activeProjectId: task.projectId,
        activeSection: "overview",
        selectedTaskId: task.id,
        rightPanel: "task",
        commandPaletteOpen: false,
      };
    }
    case "close-right-panel":
      return { ...state, rightPanel: null };
    case "toggle-task-star":
      return updateTask(state, action.taskId, (task) => ({
        ...task,
        starred: !task.starred,
      }));
    case "edit-task-title":
      return updateTask(state, action.taskId, (task) => ({
        ...task,
        title: action.title,
      }));
    case "set-task-due-date":
      return updateTask(state, action.taskId, (task) => ({
        ...task,
        dueDate: action.dueDate.trim() || undefined,
      }));
    case "set-task-notes":
      return updateTask(state, action.taskId, (task) => ({
        ...task,
        notes: action.notes,
      }));
    case "toggle-subtask":
      return updateTask(state, action.taskId, (task) => ({
        ...task,
        subtasks: task.subtasks.map((subtask) =>
          subtask.id === action.subtaskId
            ? { ...subtask, done: !subtask.done }
            : subtask,
        ),
      }));
    case "move-task":
      return updateTask(state, action.taskId, (task) => ({
        ...task,
        overviewLane: action.overviewLane,
      }));
    case "set-area-filter":
      return {
        ...state,
        filters: { ...state.filters, area: action.area },
      };
    case "set-milestone-filter":
      return {
        ...state,
        filters: { ...state.filters, milestoneId: action.milestoneId },
      };
    case "toggle-starred-filter":
      return {
        ...state,
        filters: {
          ...state.filters,
          starredOnly: !state.filters.starredOnly,
        },
      };
    case "create-task": {
      const activeMilestone = getActiveMilestone(state);
      const task: PrototypeTask = {
        id: `mock-task-${state.nextTaskNumber}`,
        projectId: state.activeProjectId,
        title: "Новая задача",
        overviewLane: "now",
        starred: false,
        area: getProjectAreas(state)[0] ?? "Общее",
        milestoneId: activeMilestone.id,
        linkedDocumentIds: [],
        subtasks: [],
        notes: "Черновая задача создана только в mock-состоянии прототипа.",
      };
      return {
        ...state,
        tasks: [task, ...state.tasks],
        selectedTaskId: task.id,
        rightPanel: "task",
        nextTaskNumber: state.nextTaskNumber + 1,
      };
    }
    case "open-ai-panel":
      return {
        ...state,
        rightPanel: "ai",
        activeSection: "overview",
        selectedAiProposalIds: [],
      };
    case "close-ai-panel":
      return {
        ...state,
        rightPanel: state.rightPanel === "ai" ? null : state.rightPanel,
        selectedAiProposalIds: [],
      };
    case "toggle-ai-proposal":
      return {
        ...state,
        selectedAiProposalIds: state.selectedAiProposalIds.includes(
          action.proposalId,
        )
          ? state.selectedAiProposalIds.filter((id) => id !== action.proposalId)
          : [...state.selectedAiProposalIds, action.proposalId],
      };
    case "confirm-ai-proposals": {
      let nextState: DesktopPrototypeState = {
        ...state,
        selectedAiProposalIds: [],
      };
      for (const proposalId of state.selectedAiProposalIds) {
        const proposal = aiProposals.find((item) => item.id === proposalId);
        if (!proposal) continue;
        if (proposal.kind === "create-next-step") {
          const activeMilestone = getActiveMilestone(nextState);
          const task: PrototypeTask = {
            id: `ai-task-${nextState.nextTaskNumber}`,
            projectId: nextState.activeProjectId,
            title: "Проверить следующий конкретный шаг",
            overviewLane: "next",
            starred: false,
            area: getProjectAreas(nextState)[0] ?? "Общее",
            milestoneId: activeMilestone.id,
            linkedDocumentIds: [],
            subtasks: [
              {
                id: `ai-task-${nextState.nextTaskNumber}-subtask`,
                title: "Уточнить критерий готовности",
                done: false,
              },
            ],
            notes:
              "Создано mock-предложением AI после явного подтверждения пользователя.",
          };
          nextState = {
            ...nextState,
            tasks: [task, ...nextState.tasks],
            nextTaskNumber: nextState.nextTaskNumber + 1,
          };
        }
        if (proposal.kind === "clarify-task") {
          const targetTask =
            getTaskById(nextState, nextState.selectedTaskId) ??
            getTasksForLane(nextState, "now")[0];
          if (targetTask) {
            nextState = updateTask(nextState, targetTask.id, (task) => ({
              ...task,
              notes:
                `${task.notes ?? ""}\nКритерий готовности: сформулировать проверяемый результат.`.trim(),
            }));
          }
        }
        if (proposal.kind === "move-to-milestone" && nextState.selectedTaskId) {
          const activeMilestone = getActiveMilestone(nextState);
          nextState = updateTask(
            nextState,
            nextState.selectedTaskId,
            (task) => ({
              ...task,
              milestoneId: activeMilestone.id,
            }),
          );
        }
        if (proposal.kind === "add-question") {
          nextState = addAiLog(
            nextState,
            "Вопрос добавлен в контекст: что мешает следующему завершённому результату?",
          );
        }
        if (proposal.kind === "find-documents") {
          nextState = addAiLog(
            nextState,
            "Найдены mock-документы: brief проекта, заметки по сценам, список противоречий.",
          );
        }
        nextState = addAiLog(nextState, `Применено: ${proposal.title}`);
      }
      return nextState;
    }
    case "open-command-palette":
      return { ...state, commandPaletteOpen: true };
    case "close-command-palette":
      return { ...state, commandPaletteOpen: false };
  }
}
