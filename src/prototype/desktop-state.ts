import {
  aiProposals,
  initialCanvases,
  initialDocuments,
  initialInboxItems,
  initialOverviewDirections,
  initialProjects,
  initialTaskFolders,
  initialTasks,
  type InboxFilter,
  type OverviewDirectionId,
  type ProjectSection,
  type PrototypeCanvas,
  type PrototypeDocument,
  type PrototypeInboxItem,
  type PrototypeOverviewDirection,
  type PrototypeProject,
  type PrototypeTask,
  type PrototypeTaskFolder,
  type TaskSignal,
  type TaskFilter,
} from "@/prototype/desktop-mock-data";
import {
  firstCanvasForProject,
  getCanvasById,
  selectCanvas,
  selectCanvasObject,
} from "@/prototype/state/canvases-state";
import {
  firstInboxItemForProject,
  getInboxItemById,
  selectInboxItem,
  setInboxFilter,
} from "@/prototype/state/inbox-state";
import {
  getNextOverviewOrder,
  getOverviewDirectionById,
  getProjectOverviewDirections,
  getVisibleOverviewTasks,
  moveOverviewTaskAtIndex,
  moveTaskToDirection,
  renameOverviewDirection,
  setOverviewDirectionVisible,
  setOverviewScrollLeft,
  toggleOverviewTaskExpanded,
} from "@/prototype/state/overview-state";
import {
  activateKnowledgePane,
  closeDocumentTab,
  createKnowledgeDocument,
  createKnowledgeFolder,
  getDocumentAncestorFolderIds,
  getDocumentById,
  getDocumentFolderPath,
  knowledgeFolderId,
  finishEditingKnowledgeFolder,
  moveKnowledgeDocument,
  renameKnowledgeFolder,
  revealCurrentKnowledgeDocument,
  setKnowledgeContextMode,
  setKnowledgeSearch,
  toggleAllKnowledgeFolders,
  toggleKeyDocument,
  toggleKnowledgeDocumentEdit,
  toggleKnowledgeFolder,
  toggleKnowledgeSplitView,
  updateKnowledgeDocumentMarkdown,
} from "@/prototype/state/knowledge-state";
import {
  addSubtask,
  addTaskLink,
  assignTaskFolder,
  beginTaskTitleEdit,
  cancelTaskTitleEdit,
  commitTaskTitleEdit,
  createTaskFolder,
  deleteSubtask,
  deleteTaskFolder,
  deleteTaskLink,
  editTaskLink,
  editTaskTitle,
  getNextTaskListOrder,
  getProjectAreas,
  getTaskById,
  moveTaskList,
  renameSubtask,
  renameTaskFolder,
  selectTaskDay,
  selectTaskDirection,
  selectTaskFolder,
  setTaskDueDate,
  setTaskFilter,
  setTaskNotes,
  setTaskOverview,
  setTaskSearchQuery,
  setTaskSignal,
  toggleSubtask,
  toggleTaskCompleted,
  toggleTaskStar,
  updateTask,
} from "@/prototype/state/tasks-state";

export {
  getCanvasById,
  getCanvasObjectById,
  getProjectCanvases,
  firstCanvasForProject,
} from "@/prototype/state/canvases-state";

export {
  firstInboxItemForProject,
  getInboxItemById,
  getProjectInboxItems,
  getVisibleInboxItems,
} from "@/prototype/state/inbox-state";

export {
  getNextOverviewOrder,
  getOverviewDirectionById,
  getProjectOverviewDirections,
  getTasksForDirection,
  getVisibleOverviewTasks,
  moveOverviewTask,
  normalizeDirectionOrders,
  sortTasksForBoard,
} from "@/prototype/state/overview-state";

export {
  getNextSubtaskId,
  getNextTaskLinkId,
  getNextTaskListOrder,
  getProjectAreas,
  getProjectTaskFolders,
  getProjectTasks,
  getTaskById,
  getVisibleTaskList,
  isValidTaskLinkUrl,
  updateTask,
} from "@/prototype/state/tasks-state";

export {
  getDocumentAncestorFolderIds,
  getDocumentBreadcrumb,
  getDocumentById,
  getDocumentFolderPath,
  getKeyDocuments,
  getKnowledgePaneState,
  getKnowledgeTree,
  getOpenDocuments,
  getProjectDocumentFolders,
  getProjectDocuments,
  knowledgeFolderId,
  sortKnowledgeNodes,
} from "@/prototype/state/knowledge-state";

export {
  getActiveProject,
  getAiContextLabel,
  getCommandResults,
  MAX_VISIBLE_COMMAND_RESULTS,
  visibleCommandResults,
} from "@/prototype/state/selectors";

export type ContextPanelState =
  | { kind: "task"; taskId: string }
  | { kind: "knowledge-tasks" }
  | { kind: "knowledge-task-reference"; taskId: string }
  | { kind: "document-context"; documentId: string }
  | { kind: "canvas-inspector"; canvasId: string; objectId: string }
  | { kind: "inbox-item"; itemId: string }
  | { kind: "ai" }
  | null;

export type RestorableContextPanelState = Exclude<
  ContextPanelState,
  { kind: "ai" } | null
>;

export type KnowledgeContextMode =
  "outline" | "backlinks" | "outgoing" | "tasks" | "history";

export type KnowledgePane = "primary" | "secondary";

export type KnowledgePaneState = {
  primaryDocument: PrototypeDocument | undefined;
  secondaryDocument: PrototypeDocument | undefined;
  activePane: KnowledgePane;
  activeDocument: PrototypeDocument | undefined;
};

export type PrototypeKnowledgeFolder = {
  id: string;
  projectId: string;
  path: string[];
};

export type KnowledgeTreeNode =
  | {
      kind: "folder";
      id: string;
      title: string;
      path: string[];
      children: KnowledgeTreeNode[];
    }
  | {
      kind: "document";
      id: string;
      title: string;
      path: string[];
      document: PrototypeDocument;
    };

export type CommandResult =
  | { kind: "project"; id: string; title: string; subtitle: string }
  | { kind: "section"; id: ProjectSection; title: string; subtitle: string }
  | { kind: "task"; id: string; title: string; subtitle: string }
  | { kind: "document"; id: string; title: string; subtitle: string }
  | { kind: "canvas"; id: string; title: string; subtitle: string }
  | { kind: "inbox"; id: string; title: string; subtitle: string };

export type DesktopPrototypeState = {
  activeProjectId: string;
  activeSection: ProjectSection;
  projectRailCollapsed: boolean;
  overviewExpandedTaskId: string | null;
  overviewHiddenDirectionIds: string[];
  overviewScrollLeft: number;
  overviewArticleSourceTaskId: string | null;
  overviewArticlePreviewDocumentId: string | null;
  editingTaskTitleId: string | null;
  selectedTaskId: string | null;
  taskDetailViewTaskId: string | null;
  selectedDocumentId: string | null;
  selectedCanvasId: string | null;
  selectedCanvasObjectId: string | null;
  selectedInboxItemId: string | null;
  selectedDocumentFolder: string | null;
  selectedKnowledgeFolderPath: string[] | null;
  expandedFolderIds: string[];
  knowledgeExpandedBeforeCollapse: string[] | null;
  editingKnowledgeFolderId: string | null;
  knowledgeSearchQuery: string;
  openDocumentIds: string[];
  documentHistoryBack: string[];
  documentHistoryForward: string[];
  knowledgeContextMode: KnowledgeContextMode;
  splitViewDocumentId: string | null;
  activeKnowledgePane: KnowledgePane;
  editingKnowledgeDocumentId: string | null;
  taskFilter: TaskFilter;
  selectedTaskFolderId: string | null;
  selectedTaskDirectionId: OverviewDirectionId | null;
  taskDayViewActive: boolean;
  taskSearchQuery: string;
  inboxFilter: InboxFilter;
  contextPanel: ContextPanelState;
  contextPanelBeforeAi: RestorableContextPanelState | null;
  commandPaletteOpen: boolean;
  projects: PrototypeProject[];
  overviewDirections: PrototypeOverviewDirection[];
  tasks: PrototypeTask[];
  taskFolders: PrototypeTaskFolder[];
  knowledgeFolders: PrototypeKnowledgeFolder[];
  documents: PrototypeDocument[];
  canvases: PrototypeCanvas[];
  inboxItems: PrototypeInboxItem[];
  selectedAiProposalIds: string[];
  aiActivityLog: string[];
  nextProjectNumber: number;
  nextTaskNumber: number;
  nextTaskFolderNumber: number;
  nextDocumentNumber: number;
  nextKnowledgeFolderNumber: number;
};

export type DesktopPrototypeAction =
  | { type: "switch-project"; projectId: string }
  | { type: "toggle-project-rail" }
  | { type: "create-project" }
  | { type: "switch-section"; section: ProjectSection }
  | { type: "select-task"; taskId: string; section?: "overview" | "tasks" }
  | { type: "open-task-detail-view"; taskId: string }
  | { type: "close-task-detail-view" }
  | { type: "close-context-panel" }
  | { type: "toggle-task-star"; taskId: string }
  | { type: "toggle-task-completed"; taskId: string }
  | { type: "delete-task"; taskId: string }
  | { type: "edit-task-title"; taskId: string; title: string }
  | { type: "begin-task-title-edit"; taskId: string }
  | { type: "commit-task-title-edit"; taskId: string; title: string }
  | { type: "cancel-task-title-edit" }
  | { type: "set-task-due-date"; taskId: string; dueDate: string }
  | { type: "set-task-notes"; taskId: string; notes: string }
  | { type: "add-task-link"; taskId: string; title: string; url: string }
  | {
      type: "edit-task-link";
      taskId: string;
      linkId: string;
      title: string;
      url: string;
    }
  | { type: "delete-task-link"; taskId: string; linkId: string }
  | { type: "attach-task-document"; taskId: string; documentId: string }
  | { type: "detach-task-document"; taskId: string; documentId: string }
  | { type: "toggle-subtask"; taskId: string; subtaskId: string }
  | { type: "add-subtask"; taskId: string; title: string }
  | {
      type: "rename-subtask";
      taskId: string;
      subtaskId: string;
      title: string;
    }
  | { type: "delete-subtask"; taskId: string; subtaskId: string }
  | {
      type: "move-task";
      taskId: string;
      overviewDirectionId: OverviewDirectionId;
    }
  | {
      type: "move-overview-task";
      taskId: string;
      targetDirectionId: OverviewDirectionId;
      targetIndex: number;
    }
  | { type: "toggle-overview-task-expanded"; taskId: string }
  | {
      type: "set-overview-direction-visible";
      directionId: OverviewDirectionId;
      visible: boolean;
    }
  | { type: "set-overview-scroll-left"; scrollLeft: number }
  | {
      type: "rename-overview-direction";
      directionId: OverviewDirectionId;
      title: string;
    }
  | { type: "set-task-signal"; taskId: string; signal: TaskSignal }
  | { type: "set-task-filter"; filter: TaskFilter }
  | { type: "select-task-day" }
  | { type: "select-task-direction"; directionId: OverviewDirectionId }
  | { type: "set-task-search-query"; query: string }
  | { type: "select-task-folder"; folderId: string }
  | { type: "create-task-folder"; title: string }
  | { type: "rename-task-folder"; folderId: string; title: string }
  | { type: "delete-task-folder"; folderId: string }
  | { type: "assign-task-folder"; taskId: string; folderId: string | null }
  | { type: "set-task-overview"; taskId: string; visible: boolean }
  | { type: "move-task-list"; taskId: string; targetTaskId: string | null }
  | { type: "set-inbox-filter"; filter: InboxFilter }
  | {
      type: "create-task";
      overviewDirectionId?: OverviewDirectionId;
      title?: string;
    }
  | { type: "select-document"; documentId: string }
  | { type: "toggle-key-document"; documentId: string }
  | { type: "toggle-knowledge-folder"; folderId: string; path: string[] }
  | { type: "toggle-all-knowledge-folders" }
  | { type: "reveal-current-knowledge-document" }
  | { type: "set-knowledge-search"; query: string }
  | { type: "create-knowledge-document" }
  | {
      type: "update-knowledge-document-markdown";
      documentId: string;
      markdown: string;
    }
  | { type: "create-knowledge-folder" }
  | { type: "rename-knowledge-folder"; folderId: string; title: string }
  | { type: "finish-editing-knowledge-folder" }
  | {
      type: "move-knowledge-document";
      documentId: string;
      targetFolderPath: string[];
      targetDocumentId?: string;
      position: "before" | "after" | "end";
    }
  | { type: "close-document-tab"; documentId: string }
  | { type: "activate-document-tab"; documentId: string }
  | { type: "go-document-back" }
  | { type: "go-document-forward" }
  | { type: "set-knowledge-context-mode"; mode: KnowledgeContextMode }
  | { type: "toggle-knowledge-split-view" }
  | { type: "activate-knowledge-pane"; pane: KnowledgePane }
  | { type: "toggle-knowledge-document-edit"; documentId: string }
  | { type: "open-knowledge-task-linker" }
  | {
      type: "open-overview-task-article";
      taskId: string;
      documentId: string;
    }
  | { type: "close-overview-article-preview" }
  | { type: "open-overview-task-article-linker"; taskId: string }
  | { type: "return-to-overview-from-task-article" }
  | { type: "open-document-context"; documentId?: string }
  | { type: "select-canvas"; canvasId: string }
  | { type: "select-canvas-object"; canvasId: string; objectId: string }
  | { type: "select-inbox-item"; itemId: string }
  | { type: "open-ai-panel" }
  | { type: "close-ai-panel" }
  | { type: "toggle-ai-proposal"; proposalId: string }
  | { type: "confirm-ai-proposals" }
  | { type: "open-command-palette" }
  | { type: "close-command-palette" }
  | { type: "activate-command-result"; result: CommandResult };

const initialProjectId = "lukomorie";
const initialDocumentId = "doc-l-nastenka";
const initialOpenDocumentIds = [
  initialDocumentId,
  "doc-l-baba-yaga",
  "doc-l-magic",
  "doc-l-scene-list",
];
const initialExpandedFolderIds = [
  knowledgeFolderId(initialProjectId, ["Персонажи"]),
  knowledgeFolderId(initialProjectId, ["Персонажи", "Главные герои"]),
  knowledgeFolderId(initialProjectId, ["Персонажи", "Волшебные существа"]),
  knowledgeFolderId(initialProjectId, ["Мир"]),
  knowledgeFolderId(initialProjectId, ["Мир", "География"]),
  knowledgeFolderId(initialProjectId, ["Сценарии"]),
  knowledgeFolderId(initialProjectId, ["Сценарии", "Первый сезон"]),
  knowledgeFolderId(initialProjectId, ["Производство"]),
];
export const initialDesktopPrototypeState: DesktopPrototypeState = {
  activeProjectId: initialProjectId,
  activeSection: "overview",
  projectRailCollapsed: false,
  overviewExpandedTaskId: null,
  overviewHiddenDirectionIds: [],
  overviewScrollLeft: 0,
  overviewArticleSourceTaskId: null,
  overviewArticlePreviewDocumentId: null,
  editingTaskTitleId: null,
  selectedTaskId: null,
  taskDetailViewTaskId: null,
  selectedDocumentId: initialDocumentId,
  selectedCanvasId: "canvas-l-characters",
  selectedCanvasObjectId: null,
  selectedInboxItemId: "inbox-l-text",
  selectedDocumentFolder: "Персонажи",
  selectedKnowledgeFolderPath: ["Персонажи"],
  expandedFolderIds: initialExpandedFolderIds,
  knowledgeExpandedBeforeCollapse: null,
  editingKnowledgeFolderId: null,
  knowledgeSearchQuery: "",
  openDocumentIds: initialOpenDocumentIds,
  documentHistoryBack: [],
  documentHistoryForward: [],
  knowledgeContextMode: "outline",
  splitViewDocumentId: null,
  activeKnowledgePane: "primary",
  editingKnowledgeDocumentId: null,
  taskFilter: "all",
  selectedTaskFolderId: null,
  selectedTaskDirectionId: null,
  taskDayViewActive: false,
  taskSearchQuery: "",
  inboxFilter: "all",
  contextPanel: null,
  contextPanelBeforeAi: null,
  commandPaletteOpen: false,
  projects: initialProjects,
  overviewDirections: initialOverviewDirections,
  tasks: initialTasks,
  taskFolders: initialTaskFolders,
  knowledgeFolders: [],
  documents: initialDocuments,
  canvases: initialCanvases,
  inboxItems: initialInboxItems,
  selectedAiProposalIds: [],
  aiActivityLog: [],
  nextProjectNumber: 1,
  nextTaskNumber: 1,
  nextTaskFolderNumber: 1,
  nextDocumentNumber: 1,
  nextKnowledgeFolderNumber: 1,
};

function firstDocumentForProject(
  state: DesktopPrototypeState,
  projectId: string,
): PrototypeDocument | undefined {
  return state.documents.find((document) => document.projectId === projectId);
}

function createPrototypeTask({
  id,
  projectId,
  overviewDirectionId,
  overviewOrder,
  taskListOrder,
  title,
  area,
  subtasks,
  notes,
}: {
  id: string;
  projectId: string;
  overviewDirectionId: OverviewDirectionId;
  overviewOrder: number;
  taskListOrder: number;
  title: string;
  area: string;
  subtasks: PrototypeTask["subtasks"];
  notes: string;
}): PrototypeTask {
  return {
    id,
    projectId,
    title,
    overviewDirectionId,
    overviewOrder,
    taskListOrder,
    taskFolderId: null,
    showOnOverview: true,
    completedAt: null,
    signal: "none",
    starred: false,
    area,
    links: [],
    linkedDocumentIds: [],
    subtasks,
    notes,
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

function switchToProject(
  state: DesktopPrototypeState,
  projectId: string,
): DesktopPrototypeState {
  const document = firstDocumentForProject(state, projectId);
  const canvas = firstCanvasForProject(state, projectId);
  const inboxItem = firstInboxItemForProject(state, projectId);
  return {
    ...state,
    activeProjectId: projectId,
    overviewExpandedTaskId: null,
    overviewHiddenDirectionIds: [],
    overviewScrollLeft: 0,
    overviewArticleSourceTaskId: null,
    overviewArticlePreviewDocumentId: null,
    editingTaskTitleId: null,
    selectedTaskId: null,
    taskDetailViewTaskId: null,
    selectedDocumentId: document?.id ?? null,
    selectedDocumentFolder: document?.folder ?? null,
    selectedKnowledgeFolderPath: document
      ? getDocumentFolderPath(document)
      : null,
    expandedFolderIds: document ? getDocumentAncestorFolderIds(document) : [],
    knowledgeExpandedBeforeCollapse: null,
    editingKnowledgeFolderId: null,
    knowledgeSearchQuery: "",
    openDocumentIds: document ? [document.id] : [],
    documentHistoryBack: [],
    documentHistoryForward: [],
    knowledgeContextMode: "outline",
    splitViewDocumentId: null,
    activeKnowledgePane: "primary",
    editingKnowledgeDocumentId: null,
    selectedCanvasId: canvas?.id ?? null,
    selectedCanvasObjectId: null,
    selectedInboxItemId: inboxItem?.id ?? null,
    contextPanel: null,
    contextPanelBeforeAi: null,
    taskFilter: "all",
    selectedTaskFolderId: null,
    selectedTaskDirectionId: null,
    taskDayViewActive: false,
    taskSearchQuery: "",
    inboxFilter: "all",
    commandPaletteOpen: false,
    selectedAiProposalIds: [],
  };
}

function selectKnowledgeDocument(
  state: DesktopPrototypeState,
  document: PrototypeDocument,
  options: { pushHistory: boolean; contextPanel?: ContextPanelState } = {
    pushHistory: true,
  },
): DesktopPrototypeState {
  const sameProjectState =
    document.projectId === state.activeProjectId
      ? state
      : switchToProject(state, document.projectId);
  const previousDocumentId = sameProjectState.selectedDocumentId;
  const shouldPushHistory =
    options.pushHistory &&
    previousDocumentId !== null &&
    previousDocumentId !== document.id;
  return {
    ...sameProjectState,
    activeProjectId: document.projectId,
    activeSection: "knowledge",
    selectedDocumentId: document.id,
    selectedDocumentFolder: document.folder,
    selectedKnowledgeFolderPath: getDocumentFolderPath(document),
    expandedFolderIds: Array.from(
      new Set([
        ...sameProjectState.expandedFolderIds,
        ...getDocumentAncestorFolderIds(document),
      ]),
    ),
    openDocumentIds: sameProjectState.openDocumentIds.includes(document.id)
      ? sameProjectState.openDocumentIds
      : [...sameProjectState.openDocumentIds, document.id],
    documentHistoryBack: shouldPushHistory
      ? [...sameProjectState.documentHistoryBack, previousDocumentId]
      : sameProjectState.documentHistoryBack,
    documentHistoryForward: options.pushHistory
      ? []
      : sameProjectState.documentHistoryForward,
    activeKnowledgePane: "primary",
    editingKnowledgeDocumentId: null,
    contextPanel: options.contextPanel ?? sameProjectState.contextPanel,
    contextPanelBeforeAi: null,
    commandPaletteOpen: false,
  };
}

function activateCommandResult(
  state: DesktopPrototypeState,
  result: CommandResult,
): DesktopPrototypeState {
  if (result.kind === "project") {
    return switchToProject(state, result.id);
  }
  if (result.kind === "section") {
    return {
      ...state,
      activeSection: result.id,
      contextPanel: null,
      contextPanelBeforeAi: null,
      taskDetailViewTaskId: null,
      commandPaletteOpen: false,
    };
  }
  if (result.kind === "task") {
    const task = getTaskById(state, result.id);
    if (!task) return state;
    return {
      ...switchToProject(state, task.projectId),
      activeSection: "tasks",
      selectedTaskId: task.id,
      contextPanel: { kind: "task", taskId: task.id },
      contextPanelBeforeAi: null,
      commandPaletteOpen: false,
    };
  }
  if (result.kind === "document") {
    const document = getDocumentById(state, result.id);
    if (!document) return state;
    return selectKnowledgeDocument(state, document, {
      pushHistory: true,
      contextPanel: { kind: "document-context", documentId: document.id },
    });
  }
  if (result.kind === "canvas") {
    const canvas = getCanvasById(state, result.id);
    if (!canvas) return state;
    return {
      ...switchToProject(state, canvas.projectId),
      activeSection: "canvases",
      selectedCanvasId: canvas.id,
      selectedCanvasObjectId: canvas.objects[0]?.id ?? null,
      contextPanel: canvas.objects[0]
        ? {
            kind: "canvas-inspector",
            canvasId: canvas.id,
            objectId: canvas.objects[0].id,
          }
        : null,
      contextPanelBeforeAi: null,
      commandPaletteOpen: false,
    };
  }
  const item = getInboxItemById(state, result.id);
  if (!item) return state;
  return {
    ...switchToProject(state, item.projectId),
    activeSection: "inbox",
    selectedInboxItemId: item.id,
    contextPanel: { kind: "inbox-item", itemId: item.id },
    contextPanelBeforeAi: null,
    commandPaletteOpen: false,
  };
}

export function desktopPrototypeReducer(
  state: DesktopPrototypeState,
  action: DesktopPrototypeAction,
): DesktopPrototypeState {
  switch (action.type) {
    case "switch-project":
      return switchToProject(state, action.projectId);
    case "toggle-project-rail":
      return {
        ...state,
        projectRailCollapsed: !state.projectRailCollapsed,
      };
    case "create-project": {
      const id = `mock-project-${state.nextProjectNumber}`;
      const project: PrototypeProject = {
        id,
        name: `Новый проект ${state.nextProjectNumber}`,
        shortName: `Проект ${state.nextProjectNumber}`,
        description: "Черновой проект для проверки поведения shell.",
      };
      const overviewDirection: PrototypeOverviewDirection = {
        id: `${id}-primary-direction`,
        projectId: id,
        title: "Основное направление",
        order: 0,
      };
      return {
        ...state,
        projects: [...state.projects, project],
        overviewDirections: [...state.overviewDirections, overviewDirection],
        activeProjectId: id,
        activeSection: "overview",
        overviewExpandedTaskId: null,
        overviewHiddenDirectionIds: [],
        overviewScrollLeft: 0,
        overviewArticleSourceTaskId: null,
        overviewArticlePreviewDocumentId: null,
        editingTaskTitleId: null,
        selectedTaskId: null,
        taskDetailViewTaskId: null,
        selectedDocumentId: null,
        selectedDocumentFolder: null,
        selectedKnowledgeFolderPath: null,
        expandedFolderIds: [],
        knowledgeExpandedBeforeCollapse: null,
        editingKnowledgeFolderId: null,
        knowledgeSearchQuery: "",
        openDocumentIds: [],
        documentHistoryBack: [],
        documentHistoryForward: [],
        knowledgeContextMode: "outline",
        splitViewDocumentId: null,
        activeKnowledgePane: "primary",
        editingKnowledgeDocumentId: null,
        selectedCanvasId: null,
        selectedCanvasObjectId: null,
        selectedInboxItemId: null,
        contextPanel: null,
        contextPanelBeforeAi: null,
        nextProjectNumber: state.nextProjectNumber + 1,
      };
    }
    case "switch-section":
      return {
        ...state,
        activeSection: action.section,
        editingTaskTitleId: null,
        editingKnowledgeFolderId: null,
        activeKnowledgePane: "primary",
        editingKnowledgeDocumentId: null,
        taskDetailViewTaskId: null,
        contextPanel: null,
        contextPanelBeforeAi: null,
        commandPaletteOpen: false,
      };
    case "select-task": {
      const task = getTaskById(state, action.taskId);
      if (!task) return state;
      const nextState =
        task.projectId === state.activeProjectId
          ? state
          : switchToProject(state, task.projectId);
      return {
        ...nextState,
        activeSection: action.section ?? nextState.activeSection,
        editingTaskTitleId: null,
        selectedTaskId: task.id,
        taskDetailViewTaskId:
          nextState.taskDetailViewTaskId === task.id
            ? nextState.taskDetailViewTaskId
            : null,
        contextPanel: { kind: "task", taskId: task.id },
        contextPanelBeforeAi: null,
        commandPaletteOpen: false,
      };
    }
    case "open-task-detail-view": {
      const task = getTaskById(state, action.taskId);
      if (!task) return state;
      const nextState =
        task.projectId === state.activeProjectId
          ? state
          : switchToProject(state, task.projectId);
      return {
        ...nextState,
        activeSection: "tasks",
        editingTaskTitleId: null,
        selectedTaskId: task.id,
        taskDetailViewTaskId: task.id,
        contextPanel: { kind: "task", taskId: task.id },
        contextPanelBeforeAi: null,
        commandPaletteOpen: false,
      };
    }
    case "close-task-detail-view":
      return {
        ...state,
        activeSection: "tasks",
        taskDetailViewTaskId: null,
        contextPanelBeforeAi: null,
      };
    case "close-context-panel":
      return {
        ...state,
        contextPanel: null,
        contextPanelBeforeAi: null,
        selectedAiProposalIds: [],
      };
    case "toggle-task-star":
      return toggleTaskStar(state, action.taskId);
    case "toggle-task-completed":
      return toggleTaskCompleted(state, action.taskId);
    case "delete-task": {
      const task = getTaskById(state, action.taskId);
      if (!task || task.projectId !== state.activeProjectId) return state;
      const contextPanelReferencesTask =
        (state.contextPanel?.kind === "task" ||
          state.contextPanel?.kind === "knowledge-task-reference") &&
        state.contextPanel.taskId === task.id;
      const restorablePanelReferencesTask =
        (state.contextPanelBeforeAi?.kind === "task" ||
          state.contextPanelBeforeAi?.kind === "knowledge-task-reference") &&
        state.contextPanelBeforeAi.taskId === task.id;
      return {
        ...state,
        tasks: state.tasks.filter((item) => item.id !== task.id),
        selectedTaskId:
          state.selectedTaskId === task.id ? null : state.selectedTaskId,
        taskDetailViewTaskId:
          state.taskDetailViewTaskId === task.id
            ? null
            : state.taskDetailViewTaskId,
        editingTaskTitleId:
          state.editingTaskTitleId === task.id
            ? null
            : state.editingTaskTitleId,
        overviewExpandedTaskId:
          state.overviewExpandedTaskId === task.id
            ? null
            : state.overviewExpandedTaskId,
        overviewArticleSourceTaskId:
          state.overviewArticleSourceTaskId === task.id
            ? null
            : state.overviewArticleSourceTaskId,
        overviewArticlePreviewDocumentId:
          state.overviewArticleSourceTaskId === task.id
            ? null
            : state.overviewArticlePreviewDocumentId,
        contextPanel: contextPanelReferencesTask ? null : state.contextPanel,
        contextPanelBeforeAi: restorablePanelReferencesTask
          ? null
          : state.contextPanelBeforeAi,
      };
    }
    case "edit-task-title":
      return editTaskTitle(state, action.taskId, action.title);
    case "begin-task-title-edit":
      return beginTaskTitleEdit(state, action.taskId);
    case "commit-task-title-edit":
      return commitTaskTitleEdit(state, action.taskId, action.title);
    case "cancel-task-title-edit":
      return cancelTaskTitleEdit(state);
    case "set-task-due-date":
      return setTaskDueDate(state, action.taskId, action.dueDate);
    case "set-task-notes":
      return setTaskNotes(state, action.taskId, action.notes);
    case "add-task-link":
      return addTaskLink(state, action.taskId, action.title, action.url);
    case "edit-task-link":
      return editTaskLink(
        state,
        action.taskId,
        action.linkId,
        action.title,
        action.url,
      );
    case "delete-task-link":
      return deleteTaskLink(state, action.taskId, action.linkId);
    case "attach-task-document": {
      const task = getTaskById(state, action.taskId);
      const document = getDocumentById(state, action.documentId);
      if (
        !task ||
        !document ||
        document.projectId !== task.projectId ||
        task.linkedDocumentIds.includes(document.id)
      ) {
        return state;
      }

      return updateTask(state, task.id, (currentTask) => ({
        ...currentTask,
        linkedDocumentIds: [...currentTask.linkedDocumentIds, document.id],
      }));
    }
    case "detach-task-document": {
      const task = getTaskById(state, action.taskId);
      if (!task?.linkedDocumentIds.includes(action.documentId)) return state;

      return updateTask(state, task.id, (currentTask) => ({
        ...currentTask,
        linkedDocumentIds: currentTask.linkedDocumentIds.filter(
          (documentId) => documentId !== action.documentId,
        ),
      }));
    }
    case "toggle-subtask":
      return toggleSubtask(state, action.taskId, action.subtaskId);
    case "add-subtask":
      return addSubtask(state, action.taskId, action.title);
    case "rename-subtask":
      return renameSubtask(
        state,
        action.taskId,
        action.subtaskId,
        action.title,
      );
    case "delete-subtask":
      return deleteSubtask(state, action.taskId, action.subtaskId);
    case "move-task":
      return moveTaskToDirection(
        state,
        action.taskId,
        action.overviewDirectionId,
      );
    case "move-overview-task":
      return moveOverviewTaskAtIndex(
        state,
        action.taskId,
        action.targetDirectionId,
        action.targetIndex,
      );
    case "toggle-overview-task-expanded":
      return toggleOverviewTaskExpanded(state, action.taskId);
    case "set-overview-direction-visible":
      return setOverviewDirectionVisible(
        state,
        action.directionId,
        action.visible,
      );
    case "set-overview-scroll-left":
      return setOverviewScrollLeft(state, action.scrollLeft);
    case "rename-overview-direction":
      return renameOverviewDirection(state, action.directionId, action.title);
    case "set-task-signal":
      return setTaskSignal(state, action.taskId, action.signal);
    case "set-task-filter":
      return setTaskFilter(state, action.filter);
    case "select-task-day":
      return selectTaskDay(state);
    case "select-task-direction":
      return selectTaskDirection(state, action.directionId);
    case "set-task-search-query":
      return setTaskSearchQuery(state, action.query);
    case "select-task-folder":
      return selectTaskFolder(state, action.folderId);
    case "create-task-folder":
      return createTaskFolder(state, action.title);
    case "rename-task-folder":
      return renameTaskFolder(state, action.folderId, action.title);
    case "delete-task-folder":
      return deleteTaskFolder(state, action.folderId);
    case "assign-task-folder":
      return assignTaskFolder(state, action.taskId, action.folderId);
    case "set-task-overview":
      return setTaskOverview(state, action.taskId, action.visible);
    case "move-task-list":
      return moveTaskList(state, action.taskId, action.targetTaskId);
    case "set-inbox-filter":
      return setInboxFilter(state, action.filter);
    case "create-task": {
      const requestedDirectionId =
        action.overviewDirectionId ??
        (state.activeSection === "tasks"
          ? (state.selectedTaskDirectionId ?? undefined)
          : undefined);
      const activeDirection = requestedDirectionId
        ? getOverviewDirectionById(state, requestedDirectionId)
        : getProjectOverviewDirections(state)[0];
      if (
        !activeDirection ||
        activeDirection.projectId !== state.activeProjectId
      ) {
        return state;
      }
      let task = createPrototypeTask({
        id: `mock-task-${state.nextTaskNumber}`,
        projectId: state.activeProjectId,
        title: action.title?.trim() || "Новая задача",
        overviewDirectionId: activeDirection.id,
        overviewOrder: getNextOverviewOrder(state, activeDirection.id),
        taskListOrder: getNextTaskListOrder(state),
        area: getProjectAreas(state)[0] ?? "Общее",
        subtasks: [],
        notes: "Черновая задача создана только в mock-состоянии прототипа.",
      });
      if (state.activeSection === "tasks") {
        task = {
          ...task,
          taskFolderId: state.selectedTaskFolderId,
          showOnOverview:
            state.selectedTaskFolderId === null &&
            state.taskFilter === "overview",
          starred:
            state.selectedTaskFolderId === null &&
            state.taskFilter === "important",
          completedAt:
            state.selectedTaskFolderId === null &&
            state.taskFilter === "completed"
              ? new Date().toISOString()
              : null,
        };
      }
      return {
        ...state,
        activeSection:
          state.activeSection === "overview" ? "overview" : "tasks",
        tasks: [task, ...state.tasks],
        nextTaskNumber: state.nextTaskNumber + 1,
      };
    }
    case "select-document": {
      const document = getDocumentById(state, action.documentId);
      if (!document) return state;
      return selectKnowledgeDocument(state, document);
    }
    case "toggle-key-document":
      return toggleKeyDocument(state, action.documentId);
    case "toggle-knowledge-folder":
      return toggleKnowledgeFolder(state, action.folderId, action.path);
    case "toggle-all-knowledge-folders":
      return toggleAllKnowledgeFolders(state);
    case "reveal-current-knowledge-document":
      return revealCurrentKnowledgeDocument(state);
    case "set-knowledge-search":
      return setKnowledgeSearch(state, action.query);
    case "create-knowledge-document":
      return createKnowledgeDocument(state);
    case "update-knowledge-document-markdown":
      return updateKnowledgeDocumentMarkdown(
        state,
        action.documentId,
        action.markdown,
      );
    case "create-knowledge-folder":
      return createKnowledgeFolder(state);
    case "rename-knowledge-folder":
      return renameKnowledgeFolder(state, action.folderId, action.title);
    case "finish-editing-knowledge-folder":
      return finishEditingKnowledgeFolder(state);
    case "move-knowledge-document":
      return moveKnowledgeDocument(
        state,
        action.documentId,
        action.targetFolderPath,
        action.targetDocumentId,
        action.position,
      );
    case "close-document-tab":
      return closeDocumentTab(state, action.documentId);
    case "activate-document-tab": {
      const document = getDocumentById(state, action.documentId);
      if (!document) return state;
      return selectKnowledgeDocument(state, document);
    }
    case "go-document-back": {
      const previousDocumentId =
        state.documentHistoryBack[state.documentHistoryBack.length - 1];
      const previousDocument = getDocumentById(state, previousDocumentId);
      if (!previousDocument) return state;
      const currentDocumentId = state.selectedDocumentId;
      const nextState = selectKnowledgeDocument(state, previousDocument, {
        pushHistory: false,
      });
      return {
        ...nextState,
        documentHistoryBack: state.documentHistoryBack.slice(0, -1),
        documentHistoryForward: currentDocumentId
          ? [currentDocumentId, ...state.documentHistoryForward]
          : state.documentHistoryForward,
      };
    }
    case "go-document-forward": {
      const nextDocumentId = state.documentHistoryForward[0];
      const nextDocument = getDocumentById(state, nextDocumentId);
      if (!nextDocument) return state;
      const currentDocumentId = state.selectedDocumentId;
      const nextState = selectKnowledgeDocument(state, nextDocument, {
        pushHistory: false,
      });
      return {
        ...nextState,
        documentHistoryBack: currentDocumentId
          ? [...state.documentHistoryBack, currentDocumentId]
          : state.documentHistoryBack,
        documentHistoryForward: state.documentHistoryForward.slice(1),
      };
    }
    case "set-knowledge-context-mode":
      return setKnowledgeContextMode(state, action.mode);
    case "toggle-knowledge-split-view":
      return toggleKnowledgeSplitView(state);
    case "activate-knowledge-pane":
      return activateKnowledgePane(state, action.pane);
    case "toggle-knowledge-document-edit":
      return toggleKnowledgeDocumentEdit(state, action.documentId);
    case "open-knowledge-task-linker":
      return {
        ...state,
        activeSection: "knowledge",
        contextPanel: { kind: "knowledge-tasks" },
        contextPanelBeforeAi: null,
      };
    case "open-overview-task-article": {
      const task = getTaskById(state, action.taskId);
      const document = getDocumentById(state, action.documentId);
      if (
        !task ||
        !document ||
        task.projectId !== state.activeProjectId ||
        document.projectId !== task.projectId ||
        !task.linkedDocumentIds.includes(document.id)
      ) {
        return state;
      }
      return {
        ...state,
        overviewArticleSourceTaskId: task.id,
        overviewArticlePreviewDocumentId: document.id,
      };
    }
    case "close-overview-article-preview":
      return {
        ...state,
        overviewArticleSourceTaskId: null,
        overviewArticlePreviewDocumentId: null,
      };
    case "open-overview-task-article-linker": {
      const task = getTaskById(state, action.taskId);
      const document = getDocumentById(state, state.selectedDocumentId);
      if (
        !task ||
        !document ||
        task.projectId !== state.activeProjectId ||
        document.projectId !== task.projectId
      ) {
        return state;
      }
      return selectKnowledgeDocument(state, document, {
        pushHistory: false,
        contextPanel: {
          kind: "knowledge-task-reference",
          taskId: task.id,
        },
      });
    }
    case "return-to-overview-from-task-article":
      return {
        ...state,
        activeSection: "overview",
        activeKnowledgePane: "primary",
        editingKnowledgeDocumentId: null,
        contextPanel: null,
        contextPanelBeforeAi: null,
      };
    case "open-document-context": {
      const documentId = action.documentId ?? state.selectedDocumentId;
      if (!documentId) return state;
      return {
        ...state,
        activeSection: "knowledge",
        selectedDocumentId: documentId,
        activeKnowledgePane: "primary",
        editingKnowledgeDocumentId: null,
        contextPanel: { kind: "document-context", documentId },
        contextPanelBeforeAi: null,
      };
    }
    case "select-canvas":
      return selectCanvas(state, action.canvasId);
    case "select-canvas-object":
      return selectCanvasObject(state, action.canvasId, action.objectId);
    case "select-inbox-item":
      return selectInboxItem(state, action.itemId);
    case "open-ai-panel":
      return {
        ...state,
        contextPanel: { kind: "ai" },
        contextPanelBeforeAi:
          state.contextPanel && state.contextPanel.kind !== "ai"
            ? state.contextPanel
            : state.contextPanelBeforeAi,
        selectedAiProposalIds: [],
      };
    case "close-ai-panel":
      return {
        ...state,
        contextPanel:
          state.contextPanel?.kind === "ai"
            ? state.contextPanelBeforeAi
            : state.contextPanel,
        contextPanelBeforeAi: null,
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
          const activeDirection = getProjectOverviewDirections(nextState)[0];
          if (!activeDirection) continue;
          const task = createPrototypeTask({
            id: `ai-task-${nextState.nextTaskNumber}`,
            projectId: nextState.activeProjectId,
            title: "Проверить следующий конкретный шаг",
            overviewDirectionId: activeDirection.id,
            overviewOrder: getNextOverviewOrder(nextState, activeDirection.id),
            taskListOrder: getNextTaskListOrder(nextState),
            area: getProjectAreas(nextState)[0] ?? "Общее",
            subtasks: [
              {
                id: `ai-task-${nextState.nextTaskNumber}-subtask`,
                title: "Уточнить критерий готовности",
                done: false,
              },
            ],
            notes:
              "Создано mock-предложением AI после явного подтверждения пользователя.",
          });
          nextState = {
            ...nextState,
            tasks: [task, ...nextState.tasks],
            nextTaskNumber: nextState.nextTaskNumber + 1,
          };
        }
        if (proposal.kind === "clarify-task") {
          const targetTask =
            getTaskById(nextState, nextState.selectedTaskId) ??
            getVisibleOverviewTasks(nextState)[0];
          if (targetTask) {
            nextState = updateTask(nextState, targetTask.id, (task) => ({
              ...task,
              notes:
                `${task.notes ?? ""}\nКритерий готовности: сформулировать проверяемый результат.`.trim(),
            }));
          }
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
    case "activate-command-result":
      return activateCommandResult(state, action.result);
  }
}
