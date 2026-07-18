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
  getCanvasObjectById,
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
  getNextSubtaskId,
  getNextTaskLinkId,
  getNextTaskListOrder,
  getProjectAreas,
  getProjectTaskFolders,
  getProjectTasks,
  getTaskById,
  isValidTaskLinkUrl,
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

export const MAX_VISIBLE_COMMAND_RESULTS = 10;

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
const documentFolderPathOverrides: Record<string, string[]> = {
  "doc-l-nastenka": ["Персонажи", "Главные герои"],
  "doc-l-baba-yaga": ["Персонажи", "Волшебные существа"],
  "doc-l-koschei": ["Персонажи", "Волшебные существа"],
  "doc-l-geography": ["Мир", "География"],
  "doc-l-magic": ["Мир"],
  "doc-l-first-chapter": ["Сценарии", "Первый сезон"],
  "doc-l-scenes": ["Сценарии", "Первый сезон"],
  "doc-l-production": ["Производство"],
};

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

export function getActiveProject(
  state: DesktopPrototypeState,
): PrototypeProject {
  return (
    state.projects.find((project) => project.id === state.activeProjectId) ??
    state.projects[0]
  );
}

export function getDocumentById(
  state: DesktopPrototypeState,
  documentId: string | null,
): PrototypeDocument | undefined {
  if (!documentId) return undefined;
  return state.documents.find((document) => document.id === documentId);
}

export function getProjectDocuments(
  state: DesktopPrototypeState,
  projectId = state.activeProjectId,
): PrototypeDocument[] {
  return state.documents.filter((document) => document.projectId === projectId);
}

export function getKeyDocuments(
  state: DesktopPrototypeState,
): PrototypeDocument[] {
  return getProjectDocuments(state).filter(
    (document) => document.isKeyDocument === true,
  );
}

export function knowledgeFolderId(projectId: string, path: string[]): string {
  return `${projectId}:${path.join("/")}`;
}

export function getDocumentFolderPath(document: PrototypeDocument): string[] {
  if (document.folderPath !== undefined) {
    return document.folderPath;
  }
  const overridePath = documentFolderPathOverrides[document.id];
  if (overridePath) return overridePath;
  return document.folder ? [document.folder] : [];
}

function knowledgePathsEqual(first: string[], second: string[]): boolean {
  return (
    first.length === second.length &&
    first.every((segment, index) => segment === second[index])
  );
}

function knowledgePathStartsWith(path: string[], prefix: string[]): boolean {
  return (
    path.length >= prefix.length &&
    prefix.every((segment, index) => segment === path[index])
  );
}

export function getDocumentBreadcrumb(document: PrototypeDocument): string {
  return [...getDocumentFolderPath(document), document.title].join(" / ");
}

export function getDocumentAncestorFolderIds(
  document: PrototypeDocument,
): string[] {
  const path = getDocumentFolderPath(document);
  return path.map((_, index) =>
    knowledgeFolderId(document.projectId, path.slice(0, index + 1)),
  );
}

export function getOpenDocuments(
  state: DesktopPrototypeState,
): PrototypeDocument[] {
  const openDocuments = state.openDocumentIds
    .map((documentId) => getDocumentById(state, documentId))
    .filter((document): document is PrototypeDocument => Boolean(document));
  const selectedDocument = getDocumentById(state, state.selectedDocumentId);
  if (
    selectedDocument &&
    !openDocuments.some((document) => document.id === selectedDocument.id)
  ) {
    return [...openDocuments, selectedDocument];
  }
  return openDocuments;
}

export function getKnowledgePaneState(
  state: DesktopPrototypeState,
): KnowledgePaneState {
  const projectDocuments = getProjectDocuments(state);
  const selectedDocument = getDocumentById(state, state.selectedDocumentId);
  const primaryDocument =
    selectedDocument?.projectId === state.activeProjectId
      ? selectedDocument
      : projectDocuments[0];
  const requestedSecondaryDocument = getDocumentById(
    state,
    state.splitViewDocumentId,
  );
  const secondaryDocument =
    requestedSecondaryDocument?.projectId === state.activeProjectId &&
    requestedSecondaryDocument.id !== primaryDocument?.id
      ? requestedSecondaryDocument
      : undefined;
  const activePane =
    state.activeKnowledgePane === "secondary" && secondaryDocument
      ? "secondary"
      : "primary";

  return {
    primaryDocument,
    secondaryDocument,
    activePane,
    activeDocument:
      activePane === "secondary" ? secondaryDocument : primaryDocument,
  };
}

export function getKnowledgeTree(
  state: DesktopPrototypeState,
  projectId = state.activeProjectId,
): KnowledgeTreeNode[] {
  const documents = getProjectDocuments(state, projectId);
  const documentOrder = new Map(
    documents.map((document, index) => [document.id, document.order ?? index]),
  );
  const query = state.knowledgeSearchQuery.trim().toLocaleLowerCase("ru");
  const rootFolders = new Map<string, KnowledgeTreeNode>();
  const rootDocuments: KnowledgeTreeNode[] = [];
  const childFolderMaps = new Map<string, Map<string, KnowledgeTreeNode>>();
  const matches = (document: PrototypeDocument): boolean => {
    if (!query) return true;
    const searchable = [
      document.title,
      document.excerpt,
      getDocumentBreadcrumb(document),
    ]
      .join(" ")
      .toLocaleLowerCase("ru");
    return searchable.includes(query);
  };

  const getFolderChildrenMap = (
    folder: Extract<KnowledgeTreeNode, { kind: "folder" }>,
  ): Map<string, KnowledgeTreeNode> => {
    const existing = childFolderMaps.get(folder.id);
    if (existing) return existing;
    const next = new Map<string, KnowledgeTreeNode>();
    childFolderMaps.set(folder.id, next);
    return next;
  };

  const ensureFolder = (path: string[]): KnowledgeTreeNode => {
    const id = knowledgeFolderId(projectId, path);
    const title = path[path.length - 1] ?? "Документы";
    if (path.length === 1) {
      const existingRoot = rootFolders.get(id);
      if (existingRoot) return existingRoot;
      const folder: KnowledgeTreeNode = {
        kind: "folder",
        id,
        title,
        path,
        children: [],
      };
      rootFolders.set(id, folder);
      return folder;
    }
    const parent = ensureFolder(path.slice(0, -1));
    if (parent.kind !== "folder") return parent;
    const siblings = getFolderChildrenMap(parent);
    const existing = siblings.get(id);
    if (existing) return existing;
    const folder: KnowledgeTreeNode = {
      kind: "folder",
      id,
      title,
      path,
      children: [],
    };
    siblings.set(id, folder);
    parent.children.push(folder);
    return folder;
  };

  if (!query) {
    for (const folder of state.knowledgeFolders) {
      if (folder.projectId === projectId) ensureFolder(folder.path);
    }
  }

  for (const document of documents) {
    if (!matches(document)) continue;
    const folderPath = getDocumentFolderPath(document);
    if (folderPath.length === 0) {
      rootDocuments.push({
        kind: "document",
        id: document.id,
        title: document.title,
        path: [document.title],
        document,
      });
      continue;
    }
    const folder = ensureFolder(folderPath);
    if (folder.kind !== "folder") continue;
    folder.children.push({
      kind: "document",
      id: document.id,
      title: document.title,
      path: [...folderPath, document.title],
      document,
    });
  }

  return sortKnowledgeNodes(
    [...Array.from(rootFolders.values()), ...rootDocuments],
    documentOrder,
  );
}

export function getProjectDocumentFolders(
  state: DesktopPrototypeState,
  projectId = state.activeProjectId,
): string[] {
  return Array.from(
    new Set(
      getProjectDocuments(state, projectId).map((document) => document.folder),
    ),
  );
}

function sortKnowledgeNodes(
  nodes: KnowledgeTreeNode[],
  documentOrder: ReadonlyMap<string, number>,
): KnowledgeTreeNode[] {
  return [...nodes]
    .map((node) =>
      node.kind === "folder"
        ? {
            ...node,
            children: sortKnowledgeNodes(node.children, documentOrder),
          }
        : node,
    )
    .sort((first, second) => {
      if (first.kind !== second.kind) return first.kind === "folder" ? -1 : 1;
      if (first.kind === "document" && second.kind === "document") {
        return (
          (documentOrder.get(first.id) ?? 0) -
          (documentOrder.get(second.id) ?? 0)
        );
      }
      return first.title.localeCompare(second.title, "ru");
    });
}

export function getAiContextLabel(state: DesktopPrototypeState): string {
  const project = getActiveProject(state).name;
  if (state.activeSection === "knowledge") {
    const document = getDocumentById(state, state.selectedDocumentId);
    return `Проект: ${project} · Раздел: Знания · Документ: ${document?.title ?? "не выбран"}`;
  }
  if (state.activeSection === "tasks") {
    const task = getTaskById(state, state.selectedTaskId);
    return `Проект: ${project} · Раздел: Задачи · Задача: ${task?.title ?? "не выбрана"}`;
  }
  if (state.activeSection === "canvases") {
    const canvas = getCanvasById(state, state.selectedCanvasId);
    const object = getCanvasObjectById(
      state,
      state.selectedCanvasId,
      state.selectedCanvasObjectId,
    );
    return `Проект: ${project} · Раздел: Холсты · Холст: ${canvas?.title ?? "не выбран"}${object ? ` · Объект: ${object.title}` : ""}`;
  }
  if (state.activeSection === "inbox") {
    const item = getInboxItemById(state, state.selectedInboxItemId);
    return `Проект: ${project} · Раздел: Входящие · Захват: ${item?.title ?? "не выбран"}`;
  }
  const task = getTaskById(state, state.selectedTaskId);
  return `Проект: ${project} · Раздел: Обзор${task ? ` · Задача: ${task.title}` : ""}`;
}

export function getCommandResults(
  state: DesktopPrototypeState,
  query: string,
): CommandResult[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("ru");
  const matches = (value: string): boolean =>
    normalizedQuery.length === 0 ||
    value.toLocaleLowerCase("ru").includes(normalizedQuery);

  const projectResults: CommandResult[] = state.projects
    .filter((project) => matches(project.name))
    .map((project) => ({
      kind: "project",
      id: project.id,
      title: project.name,
      subtitle: "Проект",
    }));

  const sectionResults: CommandResult[] = [
    ["overview", "Обзор"],
    ["knowledge", "Знания"],
    ["tasks", "Задачи"],
    ["canvases", "Холсты"],
    ["inbox", "Входящие"],
  ]
    .filter(([, label]) => matches(label))
    .map(([id, label]) => ({
      kind: "section",
      id: id as ProjectSection,
      title: label,
      subtitle: "Раздел текущего проекта",
    }));

  const taskResults: CommandResult[] = state.tasks
    .filter((task) => matches(task.title))
    .map((task) => ({
      kind: "task",
      id: task.id,
      title: task.title,
      subtitle: `Задача · ${getProjectName(state, task.projectId)}`,
    }));

  const documentResults: CommandResult[] = state.documents
    .filter(
      (document) =>
        matches(document.title) ||
        matches(document.excerpt) ||
        matches(getDocumentBreadcrumb(document)),
    )
    .map((document) => ({
      kind: "document",
      id: document.id,
      title: document.title,
      subtitle: `Документ · ${getProjectName(state, document.projectId)} · ${getDocumentBreadcrumb(document)}`,
    }));

  const canvasResults: CommandResult[] = state.canvases
    .filter((canvas) => matches(canvas.title))
    .map((canvas) => ({
      kind: "canvas",
      id: canvas.id,
      title: canvas.title,
      subtitle: `Холст · ${getProjectName(state, canvas.projectId)}`,
    }));

  const inboxResults: CommandResult[] = state.inboxItems
    .filter((item) => matches(item.title) || matches(item.preview))
    .map((item) => ({
      kind: "inbox",
      id: item.id,
      title: item.title,
      subtitle: `Р’С…РѕРґСЏС‰РµРµ В· ${getProjectName(state, item.projectId)}`,
    }));

  return visibleCommandResults([
    ...projectResults,
    ...sectionResults,
    ...taskResults,
    ...documentResults,
    ...canvasResults,
    ...inboxResults,
  ]);
}

export function visibleCommandResults<T>(results: T[]): T[] {
  return results.slice(0, MAX_VISIBLE_COMMAND_RESULTS);
}

function getProjectName(
  state: DesktopPrototypeState,
  projectId: string,
): string {
  return (
    state.projects.find((project) => project.id === projectId)?.name ?? "Проект"
  );
}

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
      return updateTask(state, action.taskId, (task) => ({
        ...task,
        starred: !task.starred,
      }));
    case "toggle-task-completed":
      return updateTask(state, action.taskId, (task) => ({
        ...task,
        completedAt: task.completedAt ? null : new Date().toISOString(),
      }));
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
      return updateTask(state, action.taskId, (task) => ({
        ...task,
        title: action.title,
      }));
    case "begin-task-title-edit": {
      const task = getTaskById(state, action.taskId);
      if (!task || task.projectId !== state.activeProjectId) return state;
      return {
        ...state,
        editingTaskTitleId: task.id,
        contextPanel: null,
        contextPanelBeforeAi: null,
      };
    }
    case "commit-task-title-edit": {
      const title = action.title.trim();
      if (state.editingTaskTitleId !== action.taskId || title.length === 0) {
        return {
          ...state,
          editingTaskTitleId: null,
        };
      }
      return {
        ...updateTask(state, action.taskId, (task) => ({ ...task, title })),
        editingTaskTitleId: null,
      };
    }
    case "cancel-task-title-edit":
      return {
        ...state,
        editingTaskTitleId: null,
      };
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
    case "add-task-link": {
      const task = getTaskById(state, action.taskId);
      const title = action.title.trim();
      const url = action.url.trim();
      if (!task || title.length === 0 || !isValidTaskLinkUrl(url)) return state;

      return updateTask(state, task.id, (currentTask) => ({
        ...currentTask,
        links: [
          ...currentTask.links,
          { id: getNextTaskLinkId(currentTask), title, url },
        ],
      }));
    }
    case "edit-task-link": {
      const task = getTaskById(state, action.taskId);
      const title = action.title.trim();
      const url = action.url.trim();
      if (
        !task?.links.some((link) => link.id === action.linkId) ||
        title.length === 0 ||
        !isValidTaskLinkUrl(url)
      ) {
        return state;
      }

      return updateTask(state, task.id, (currentTask) => ({
        ...currentTask,
        links: currentTask.links.map((link) =>
          link.id === action.linkId ? { ...link, title, url } : link,
        ),
      }));
    }
    case "delete-task-link": {
      const task = getTaskById(state, action.taskId);
      if (!task?.links.some((link) => link.id === action.linkId)) return state;

      return updateTask(state, task.id, (currentTask) => ({
        ...currentTask,
        links: currentTask.links.filter((link) => link.id !== action.linkId),
      }));
    }
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
      return updateTask(state, action.taskId, (task) => ({
        ...task,
        subtasks: task.subtasks.map((subtask) =>
          subtask.id === action.subtaskId
            ? { ...subtask, done: !subtask.done }
            : subtask,
        ),
      }));
    case "add-subtask": {
      const title = action.title.trim();
      const task = getTaskById(state, action.taskId);
      if (!task || title.length === 0) return state;

      return updateTask(state, task.id, (currentTask) => ({
        ...currentTask,
        subtasks: [
          ...currentTask.subtasks,
          {
            id: getNextSubtaskId(currentTask),
            title,
            done: false,
          },
        ],
      }));
    }
    case "rename-subtask": {
      const title = action.title.trim();
      const task = getTaskById(state, action.taskId);
      const subtask = task?.subtasks.find(
        (item) => item.id === action.subtaskId,
      );
      if (!task || !subtask || title.length === 0) return state;

      return updateTask(state, task.id, (currentTask) => ({
        ...currentTask,
        subtasks: currentTask.subtasks.map((item) =>
          item.id === subtask.id ? { ...item, title } : item,
        ),
      }));
    }
    case "delete-subtask": {
      const task = getTaskById(state, action.taskId);
      if (!task?.subtasks.some((item) => item.id === action.subtaskId)) {
        return state;
      }

      return updateTask(state, task.id, (currentTask) => ({
        ...currentTask,
        subtasks: currentTask.subtasks.filter(
          (item) => item.id !== action.subtaskId,
        ),
      }));
    }
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
      return updateTask(state, action.taskId, (task) => ({
        ...task,
        signal: action.signal,
      }));
    case "set-task-filter":
      return {
        ...state,
        taskFilter: action.filter,
        selectedTaskFolderId: null,
        selectedTaskDirectionId: null,
        taskDayViewActive: false,
        taskDetailViewTaskId: null,
      };
    case "select-task-day":
      return {
        ...state,
        taskFilter: "all",
        selectedTaskFolderId: null,
        selectedTaskDirectionId: null,
        taskDayViewActive: true,
        taskDetailViewTaskId: null,
      };
    case "select-task-direction": {
      const direction = getOverviewDirectionById(state, action.directionId);
      if (!direction || direction.projectId !== state.activeProjectId) {
        return state;
      }
      return {
        ...state,
        taskFilter: "all",
        selectedTaskFolderId: null,
        selectedTaskDirectionId: direction.id,
        taskDayViewActive: false,
        taskDetailViewTaskId: null,
      };
    }
    case "set-task-search-query":
      return { ...state, taskSearchQuery: action.query };
    case "select-task-folder": {
      const folder = state.taskFolders.find(
        (item) =>
          item.id === action.folderId &&
          item.projectId === state.activeProjectId,
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
    case "create-task-folder": {
      const title = action.title.trim();
      if (title.length === 0) return state;
      const folder: PrototypeTaskFolder = {
        id: `mock-task-folder-${state.nextTaskFolderNumber}`,
        projectId: state.activeProjectId,
        title,
        order: getProjectTaskFolders(state).length,
      };
      return {
        ...state,
        taskFolders: [...state.taskFolders, folder],
        nextTaskFolderNumber: state.nextTaskFolderNumber + 1,
      };
    }
    case "rename-task-folder": {
      const title = action.title.trim();
      const folder = state.taskFolders.find(
        (item) =>
          item.id === action.folderId &&
          item.projectId === state.activeProjectId,
      );
      if (!folder || title.length === 0) return state;
      return {
        ...state,
        taskFolders: state.taskFolders.map((item) =>
          item.id === folder.id ? { ...item, title } : item,
        ),
      };
    }
    case "delete-task-folder": {
      const folder = state.taskFolders.find(
        (item) =>
          item.id === action.folderId &&
          item.projectId === state.activeProjectId,
      );
      if (
        !folder ||
        state.tasks.some((task) => task.taskFolderId === folder.id)
      ) {
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
    case "assign-task-folder": {
      const task = getTaskById(state, action.taskId);
      const folder = action.folderId
        ? state.taskFolders.find((item) => item.id === action.folderId)
        : null;
      if (
        !task ||
        task.projectId !== state.activeProjectId ||
        (action.folderId && (!folder || folder.projectId !== task.projectId))
      ) {
        return state;
      }
      return updateTask(state, task.id, (currentTask) => ({
        ...currentTask,
        taskFolderId: folder?.id ?? null,
      }));
    }
    case "set-task-overview": {
      const task = getTaskById(state, action.taskId);
      if (!task || task.projectId !== state.activeProjectId) return state;
      if (task.showOnOverview === action.visible) return state;
      return updateTask(state, task.id, (currentTask) => ({
        ...currentTask,
        showOnOverview: action.visible,
      }));
    }
    case "move-task-list": {
      const movingTask = getTaskById(state, action.taskId);
      const targetTask = action.targetTaskId
        ? getTaskById(state, action.targetTaskId)
        : null;
      if (
        !movingTask ||
        movingTask.projectId !== state.activeProjectId ||
        (action.targetTaskId &&
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
          return taskListOrder === undefined
            ? task
            : { ...task, taskListOrder };
        }),
      };
    }
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
    case "toggle-key-document": {
      const document = getDocumentById(state, action.documentId);
      if (!document || document.projectId !== state.activeProjectId) {
        return state;
      }
      return {
        ...state,
        documents: state.documents.map((item) =>
          item.id === document.id
            ? { ...item, isKeyDocument: !item.isKeyDocument }
            : item,
        ),
      };
    }
    case "toggle-knowledge-folder": {
      const expanded = state.expandedFolderIds.includes(action.folderId);
      return {
        ...state,
        selectedKnowledgeFolderPath: action.path,
        expandedFolderIds: expanded
          ? state.expandedFolderIds.filter(
              (folderId) => folderId !== action.folderId,
            )
          : [...state.expandedFolderIds, action.folderId],
        knowledgeExpandedBeforeCollapse: null,
      };
    }
    case "toggle-all-knowledge-folders": {
      if (state.knowledgeExpandedBeforeCollapse !== null) {
        return {
          ...state,
          expandedFolderIds: state.knowledgeExpandedBeforeCollapse,
          knowledgeExpandedBeforeCollapse: null,
        };
      }
      return {
        ...state,
        expandedFolderIds: [],
        knowledgeExpandedBeforeCollapse: state.expandedFolderIds,
      };
    }
    case "reveal-current-knowledge-document": {
      const selectedDocument = getDocumentById(state, state.selectedDocumentId);
      if (!selectedDocument) return state;
      return {
        ...state,
        selectedKnowledgeFolderPath: getDocumentFolderPath(selectedDocument),
        expandedFolderIds: Array.from(
          new Set([
            ...state.expandedFolderIds,
            ...getDocumentAncestorFolderIds(selectedDocument),
          ]),
        ),
        knowledgeExpandedBeforeCollapse: null,
      };
    }
    case "set-knowledge-search":
      return {
        ...state,
        knowledgeSearchQuery: action.query,
        expandedFolderIds: action.query.trim()
          ? Array.from(
              new Set(
                getProjectDocuments(state).flatMap((document) =>
                  getDocumentAncestorFolderIds(document),
                ),
              ),
            )
          : state.expandedFolderIds,
      };
    case "create-knowledge-document": {
      const folderPath = state.selectedKnowledgeFolderPath ?? [];
      const siblingDocuments = getProjectDocuments(state).filter((document) =>
        knowledgePathsEqual(getDocumentFolderPath(document), folderPath),
      );
      const document: PrototypeDocument = {
        id: `mock-document-${state.nextDocumentNumber}`,
        projectId: state.activeProjectId,
        order: siblingDocuments.length,
        folder: folderPath.at(-1) ?? "",
        folderPath,
        title: "Без названия",
        excerpt: "",
        content: [],
        linkedTaskIds: [],
        backlinks: [],
      };
      return selectKnowledgeDocument(
        {
          ...state,
          documents: [...state.documents, document],
          nextDocumentNumber: state.nextDocumentNumber + 1,
        },
        document,
      );
    }
    case "update-knowledge-document-markdown": {
      const document = getDocumentById(state, action.documentId);
      if (!document || document.projectId !== state.activeProjectId)
        return state;
      const markdown = action.markdown.replace(/\r\n?/g, "\n");
      return {
        ...state,
        documents: state.documents.map((item) =>
          item.id === document.id
            ? {
                ...item,
                content: markdown.length > 0 ? markdown.split("\n") : [],
              }
            : item,
        ),
      };
    }
    case "create-knowledge-folder": {
      const parentPath = state.selectedKnowledgeFolderPath ?? [];
      const path = [...parentPath, "Новая папка"];
      const folderId = knowledgeFolderId(state.activeProjectId, path);
      const folder: PrototypeKnowledgeFolder = {
        id: `mock-knowledge-folder-${state.nextKnowledgeFolderNumber}`,
        projectId: state.activeProjectId,
        path,
      };
      return {
        ...state,
        knowledgeFolders: [...state.knowledgeFolders, folder],
        selectedKnowledgeFolderPath: path,
        expandedFolderIds: Array.from(
          new Set([
            ...state.expandedFolderIds,
            ...path.map((_, index) =>
              knowledgeFolderId(
                state.activeProjectId,
                path.slice(0, index + 1),
              ),
            ),
          ]),
        ),
        knowledgeExpandedBeforeCollapse: null,
        editingKnowledgeFolderId: folderId,
        nextKnowledgeFolderNumber: state.nextKnowledgeFolderNumber + 1,
      };
    }
    case "rename-knowledge-folder": {
      const folder = state.knowledgeFolders.find(
        (item) =>
          item.projectId === state.activeProjectId &&
          knowledgeFolderId(item.projectId, item.path) === action.folderId,
      );
      const title = action.title.trim();
      if (!folder || title.length === 0) {
        return { ...state, editingKnowledgeFolderId: null };
      }
      const oldPath = folder.path;
      const nextPath = [...oldPath.slice(0, -1), title];
      const replacePrefix = (path: string[]): string[] =>
        knowledgePathStartsWith(path, oldPath)
          ? [...nextPath, ...path.slice(oldPath.length)]
          : path;
      return {
        ...state,
        knowledgeFolders: state.knowledgeFolders.map((item) =>
          item.projectId === folder.projectId
            ? { ...item, path: replacePrefix(item.path) }
            : item,
        ),
        documents: state.documents.map((document) => {
          if (document.projectId !== folder.projectId) return document;
          const currentPath = getDocumentFolderPath(document);
          if (!knowledgePathStartsWith(currentPath, oldPath)) return document;
          const documentPath = replacePrefix(currentPath);
          return {
            ...document,
            folder: documentPath.at(-1) ?? "",
            folderPath: documentPath,
          };
        }),
        selectedKnowledgeFolderPath: state.selectedKnowledgeFolderPath
          ? replacePrefix(state.selectedKnowledgeFolderPath)
          : null,
        expandedFolderIds: Array.from(
          new Set([
            ...state.expandedFolderIds.filter(
              (id) => id !== knowledgeFolderId(folder.projectId, oldPath),
            ),
            knowledgeFolderId(folder.projectId, nextPath),
          ]),
        ),
        editingKnowledgeFolderId: null,
      };
    }
    case "finish-editing-knowledge-folder":
      return { ...state, editingKnowledgeFolderId: null };
    case "move-knowledge-document": {
      const movingDocument = getDocumentById(state, action.documentId);
      if (
        !movingDocument ||
        movingDocument.projectId !== state.activeProjectId ||
        action.targetDocumentId === movingDocument.id
      ) {
        return state;
      }
      const sourcePath = getDocumentFolderPath(movingDocument);
      const documentIndex = new Map(
        state.documents.map((document, index) => [document.id, index]),
      );
      const byManualOrder = (
        first: PrototypeDocument,
        second: PrototypeDocument,
      ): number =>
        (first.order ?? documentIndex.get(first.id) ?? 0) -
        (second.order ?? documentIndex.get(second.id) ?? 0);
      const targetDocuments = getProjectDocuments(state)
        .filter(
          (document) =>
            document.id !== movingDocument.id &&
            knowledgePathsEqual(
              getDocumentFolderPath(document),
              action.targetFolderPath,
            ),
        )
        .sort(byManualOrder);
      const targetIndex = action.targetDocumentId
        ? targetDocuments.findIndex(
            (document) => document.id === action.targetDocumentId,
          )
        : -1;
      const insertionIndex =
        action.position === "end" || targetIndex < 0
          ? targetDocuments.length
          : targetIndex + (action.position === "after" ? 1 : 0);
      targetDocuments.splice(insertionIndex, 0, movingDocument);
      const targetOrders = new Map(
        targetDocuments.map((document, index) => [document.id, index]),
      );
      const sourceOrders = new Map(
        getProjectDocuments(state)
          .filter(
            (document) =>
              document.id !== movingDocument.id &&
              knowledgePathsEqual(getDocumentFolderPath(document), sourcePath),
          )
          .sort(byManualOrder)
          .map((document, index) => [document.id, index]),
      );
      return {
        ...state,
        documents: state.documents.map((document) => {
          if (document.id === movingDocument.id) {
            return {
              ...document,
              folder: action.targetFolderPath.at(-1) ?? "",
              folderPath: action.targetFolderPath,
              order: targetOrders.get(document.id) ?? 0,
            };
          }
          const targetOrder = targetOrders.get(document.id);
          if (targetOrder !== undefined)
            return { ...document, order: targetOrder };
          const sourceOrder = sourceOrders.get(document.id);
          return sourceOrder === undefined
            ? document
            : { ...document, order: sourceOrder };
        }),
        selectedDocumentFolder:
          state.selectedDocumentId === movingDocument.id
            ? (action.targetFolderPath.at(-1) ?? "")
            : state.selectedDocumentFolder,
        selectedKnowledgeFolderPath:
          state.selectedDocumentId === movingDocument.id
            ? action.targetFolderPath
            : state.selectedKnowledgeFolderPath,
        expandedFolderIds: Array.from(
          new Set([
            ...state.expandedFolderIds,
            ...action.targetFolderPath.map((_, index) =>
              knowledgeFolderId(
                state.activeProjectId,
                action.targetFolderPath.slice(0, index + 1),
              ),
            ),
          ]),
        ),
      };
    }
    case "close-document-tab": {
      const nextOpenDocumentIds = state.openDocumentIds.filter(
        (documentId) => documentId !== action.documentId,
      );
      if (state.selectedDocumentId !== action.documentId) {
        return { ...state, openDocumentIds: nextOpenDocumentIds };
      }
      const nextActiveDocumentId =
        nextOpenDocumentIds[nextOpenDocumentIds.length - 1] ?? null;
      const nextActiveDocument = getDocumentById(state, nextActiveDocumentId);
      return {
        ...state,
        selectedDocumentId: nextActiveDocument?.id ?? null,
        selectedDocumentFolder: nextActiveDocument?.folder ?? null,
        selectedKnowledgeFolderPath: nextActiveDocument
          ? getDocumentFolderPath(nextActiveDocument)
          : null,
        openDocumentIds: nextOpenDocumentIds,
        contextPanel:
          state.contextPanel?.kind === "document-context" &&
          state.contextPanel.documentId === action.documentId
            ? null
            : state.contextPanel,
        activeKnowledgePane: "primary",
        editingKnowledgeDocumentId: null,
      };
    }
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
      return { ...state, knowledgeContextMode: action.mode };
    case "toggle-knowledge-split-view": {
      if (state.splitViewDocumentId) {
        return {
          ...state,
          splitViewDocumentId: null,
          activeKnowledgePane: "primary",
          editingKnowledgeDocumentId: null,
        };
      }
      const fallbackDocument = getProjectDocuments(state).find(
        (document) => document.id !== state.selectedDocumentId,
      );
      return {
        ...state,
        splitViewDocumentId: fallbackDocument?.id ?? null,
        activeKnowledgePane: "primary",
        editingKnowledgeDocumentId: null,
      };
    }
    case "activate-knowledge-pane": {
      const paneState = getKnowledgePaneState(state);
      const activeKnowledgePane =
        action.pane === "secondary" && paneState.secondaryDocument
          ? "secondary"
          : "primary";
      return {
        ...state,
        activeKnowledgePane,
        editingKnowledgeDocumentId:
          activeKnowledgePane === paneState.activePane
            ? state.editingKnowledgeDocumentId
            : null,
      };
    }
    case "toggle-knowledge-document-edit": {
      const paneState = getKnowledgePaneState(state);
      if (paneState.activeDocument?.id !== action.documentId) return state;
      return {
        ...state,
        editingKnowledgeDocumentId:
          state.editingKnowledgeDocumentId === action.documentId
            ? null
            : action.documentId,
      };
    }
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
