import {
  aiProposals,
  initialCanvases,
  initialDocuments,
  initialInboxItems,
  initialMilestones,
  initialProjects,
  initialTasks,
  overviewLanes,
  type InboxFilter,
  type OverviewLane,
  type ProjectSection,
  type PrototypeCanvas,
  type PrototypeCanvasObject,
  type PrototypeDocument,
  type PrototypeInboxItem,
  type PrototypeMilestone,
  type PrototypeProject,
  type PrototypeTask,
  type TaskFilter,
} from "@/prototype/desktop-mock-data";

export type ContextPanelState =
  | { kind: "task"; taskId: string }
  | { kind: "document-context"; documentId: string }
  | { kind: "canvas-inspector"; canvasId: string; objectId: string }
  | { kind: "inbox-item"; itemId: string }
  | { kind: "ai" }
  | null;

export type RestorableContextPanelState = Exclude<
  ContextPanelState,
  { kind: "ai" } | null
>;

export type OverviewFilters = {
  area: string;
  milestoneId: string;
  starredOnly: boolean;
};

export type KnowledgeContextMode =
  "outline" | "backlinks" | "outgoing" | "tasks" | "history";

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
  visibleOverviewLanes: OverviewLane[];
  editingTaskTitleId: string | null;
  selectedTaskId: string | null;
  selectedDocumentId: string | null;
  selectedCanvasId: string | null;
  selectedCanvasObjectId: string | null;
  selectedInboxItemId: string | null;
  selectedDocumentFolder: string | null;
  expandedFolderIds: string[];
  knowledgeSearchQuery: string;
  openDocumentIds: string[];
  documentHistoryBack: string[];
  documentHistoryForward: string[];
  knowledgeContextMode: KnowledgeContextMode;
  splitViewDocumentId: string | null;
  taskFilter: TaskFilter;
  inboxFilter: InboxFilter;
  contextPanel: ContextPanelState;
  contextPanelBeforeAi: RestorableContextPanelState | null;
  commandPaletteOpen: boolean;
  projects: PrototypeProject[];
  milestones: PrototypeMilestone[];
  tasks: PrototypeTask[];
  documents: PrototypeDocument[];
  canvases: PrototypeCanvas[];
  inboxItems: PrototypeInboxItem[];
  filters: OverviewFilters;
  selectedAiProposalIds: string[];
  aiActivityLog: string[];
  nextProjectNumber: number;
  nextTaskNumber: number;
};

export type DesktopPrototypeAction =
  | { type: "switch-project"; projectId: string }
  | { type: "toggle-project-rail" }
  | { type: "create-project" }
  | { type: "switch-section"; section: ProjectSection }
  | { type: "select-task"; taskId: string; section?: "overview" | "tasks" }
  | { type: "close-context-panel" }
  | { type: "toggle-task-star"; taskId: string }
  | { type: "edit-task-title"; taskId: string; title: string }
  | { type: "begin-task-title-edit"; taskId: string }
  | { type: "commit-task-title-edit"; taskId: string; title: string }
  | { type: "cancel-task-title-edit" }
  | { type: "set-task-due-date"; taskId: string; dueDate: string }
  | { type: "set-task-notes"; taskId: string; notes: string }
  | { type: "toggle-subtask"; taskId: string; subtaskId: string }
  | { type: "move-task"; taskId: string; overviewLane: OverviewLane }
  | { type: "set-area-filter"; area: string }
  | { type: "set-milestone-filter"; milestoneId: string }
  | { type: "toggle-starred-filter" }
  | { type: "toggle-overview-lane"; lane: OverviewLane }
  | { type: "focus-overview-lane"; lane: OverviewLane }
  | { type: "show-all-overview-lanes" }
  | { type: "set-visible-overview-lanes"; lanes: OverviewLane[] }
  | { type: "set-task-filter"; filter: TaskFilter }
  | { type: "set-inbox-filter"; filter: InboxFilter }
  | { type: "create-task" }
  | { type: "select-document"; documentId: string }
  | { type: "toggle-key-document"; documentId: string }
  | { type: "toggle-knowledge-folder"; folderId: string }
  | { type: "collapse-all-knowledge-folders" }
  | { type: "set-knowledge-search"; query: string }
  | { type: "close-document-tab"; documentId: string }
  | { type: "activate-document-tab"; documentId: string }
  | { type: "go-document-back" }
  | { type: "go-document-forward" }
  | { type: "set-knowledge-context-mode"; mode: KnowledgeContextMode }
  | { type: "toggle-knowledge-split-view" }
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

export const ALL_AREAS = "all";
export const ALL_MILESTONES = "all";
export const ALL_OVERVIEW_LANES: OverviewLane[] = overviewLanes.map(
  (lane) => lane.id,
);
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
  visibleOverviewLanes: [...ALL_OVERVIEW_LANES],
  editingTaskTitleId: null,
  selectedTaskId: null,
  selectedDocumentId: initialDocumentId,
  selectedCanvasId: "canvas-l-characters",
  selectedCanvasObjectId: null,
  selectedInboxItemId: "inbox-l-text",
  selectedDocumentFolder: "Персонажи",
  expandedFolderIds: initialExpandedFolderIds,
  knowledgeSearchQuery: "",
  openDocumentIds: initialOpenDocumentIds,
  documentHistoryBack: [],
  documentHistoryForward: [],
  knowledgeContextMode: "outline",
  splitViewDocumentId: null,
  taskFilter: "all",
  inboxFilter: "all",
  contextPanel: null,
  contextPanelBeforeAi: null,
  commandPaletteOpen: false,
  projects: initialProjects,
  milestones: initialMilestones,
  tasks: initialTasks,
  documents: initialDocuments,
  canvases: initialCanvases,
  inboxItems: initialInboxItems,
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

export function getDocumentById(
  state: DesktopPrototypeState,
  documentId: string | null,
): PrototypeDocument | undefined {
  if (!documentId) return undefined;
  return state.documents.find((document) => document.id === documentId);
}

export function getCanvasById(
  state: DesktopPrototypeState,
  canvasId: string | null,
): PrototypeCanvas | undefined {
  if (!canvasId) return undefined;
  return state.canvases.find((canvas) => canvas.id === canvasId);
}

export function getCanvasObjectById(
  state: DesktopPrototypeState,
  canvasId: string | null,
  objectId: string | null,
): PrototypeCanvasObject | undefined {
  if (!objectId) return undefined;
  return getCanvasById(state, canvasId)?.objects.find(
    (object) => object.id === objectId,
  );
}

export function getInboxItemById(
  state: DesktopPrototypeState,
  itemId: string | null,
): PrototypeInboxItem | undefined {
  if (!itemId) return undefined;
  return state.inboxItems.find((item) => item.id === itemId);
}

export function getProjectTasks(
  state: DesktopPrototypeState,
  projectId = state.activeProjectId,
): PrototypeTask[] {
  return state.tasks.filter((task) => task.projectId === projectId);
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
  if (document.folderPath && document.folderPath.length > 0) {
    return document.folderPath;
  }
  const overridePath = documentFolderPathOverrides[document.id];
  if (overridePath) return overridePath;
  return document.folder ? [document.folder] : [];
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

export function getKnowledgeTree(
  state: DesktopPrototypeState,
  projectId = state.activeProjectId,
): KnowledgeTreeNode[] {
  const documents = getProjectDocuments(state, projectId);
  const query = state.knowledgeSearchQuery.trim().toLocaleLowerCase("ru");
  const rootFolders = new Map<string, KnowledgeTreeNode>();
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

  for (const document of documents) {
    if (!matches(document)) continue;
    const folderPath = getDocumentFolderPath(document);
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

  return sortKnowledgeNodes(Array.from(rootFolders.values()));
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

export function getProjectCanvases(
  state: DesktopPrototypeState,
  projectId = state.activeProjectId,
): PrototypeCanvas[] {
  return state.canvases.filter((canvas) => canvas.projectId === projectId);
}

export function getProjectInboxItems(
  state: DesktopPrototypeState,
  projectId = state.activeProjectId,
): PrototypeInboxItem[] {
  return state.inboxItems.filter((item) => item.projectId === projectId);
}

export function getVisibleInboxItems(
  state: DesktopPrototypeState,
): PrototypeInboxItem[] {
  return getProjectInboxItems(state).filter(
    (item) => state.inboxFilter === "all" || item.kind === state.inboxFilter,
  );
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

export function getVisibleTaskList(
  state: DesktopPrototypeState,
): PrototypeTask[] {
  return sortTasksForBoard(
    getProjectTasks(state).filter((task) => {
      if (state.taskFilter === "important") return task.starred;
      if (state.taskFilter === "today") return task.overviewLane === "now";
      if (state.taskFilter === "upcoming") {
        return task.overviewLane === "next" || task.overviewLane === "later";
      }
      if (state.taskFilter === "completed") return task.overviewLane === "done";
      return true;
    }),
  );
}

export function sortTasksForBoard(tasks: PrototypeTask[]): PrototypeTask[] {
  return [...tasks].sort((first, second) => {
    if (first.starred !== second.starred) return first.starred ? -1 : 1;
    return first.title.localeCompare(second.title, "ru");
  });
}

function sortKnowledgeNodes(nodes: KnowledgeTreeNode[]): KnowledgeTreeNode[] {
  return [...nodes]
    .map((node) =>
      node.kind === "folder"
        ? { ...node, children: sortKnowledgeNodes(node.children) }
        : node,
    )
    .sort((first, second) => {
      if (first.kind !== second.kind) return first.kind === "folder" ? -1 : 1;
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

function firstDocumentForProject(
  state: DesktopPrototypeState,
  projectId: string,
): PrototypeDocument | undefined {
  return state.documents.find((document) => document.projectId === projectId);
}

function firstCanvasForProject(
  state: DesktopPrototypeState,
  projectId: string,
): PrototypeCanvas | undefined {
  return state.canvases.find((canvas) => canvas.projectId === projectId);
}

function firstInboxItemForProject(
  state: DesktopPrototypeState,
  projectId: string,
): PrototypeInboxItem | undefined {
  return state.inboxItems.find((item) => item.projectId === projectId);
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

function withVisibleOverviewLanes(
  state: DesktopPrototypeState,
  lanes: OverviewLane[],
): DesktopPrototypeState {
  const requestedLanes = new Set(lanes);
  const visibleOverviewLanes = ALL_OVERVIEW_LANES.filter((lane) =>
    requestedLanes.has(lane),
  );
  if (visibleOverviewLanes.length === 0) return state;

  const editingTask = getTaskById(state, state.editingTaskTitleId);
  return {
    ...state,
    visibleOverviewLanes,
    editingTaskTitleId:
      editingTask && !visibleOverviewLanes.includes(editingTask.overviewLane)
        ? null
        : state.editingTaskTitleId,
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
    editingTaskTitleId: null,
    selectedTaskId: null,
    selectedDocumentId: document?.id ?? null,
    selectedDocumentFolder: document?.folder ?? null,
    expandedFolderIds: document ? getDocumentAncestorFolderIds(document) : [],
    knowledgeSearchQuery: "",
    openDocumentIds: document ? [document.id] : [],
    documentHistoryBack: [],
    documentHistoryForward: [],
    knowledgeContextMode: "outline",
    splitViewDocumentId: null,
    selectedCanvasId: canvas?.id ?? null,
    selectedCanvasObjectId: null,
    selectedInboxItemId: inboxItem?.id ?? null,
    contextPanel: null,
    contextPanelBeforeAi: null,
    filters: filtersForProject(state, projectId),
    taskFilter: "all",
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
      filters: filtersForProject(state, task.projectId),
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
        editingTaskTitleId: null,
        selectedTaskId: null,
        selectedDocumentId: null,
        selectedDocumentFolder: null,
        expandedFolderIds: [],
        knowledgeSearchQuery: "",
        openDocumentIds: [],
        documentHistoryBack: [],
        documentHistoryForward: [],
        knowledgeContextMode: "outline",
        splitViewDocumentId: null,
        selectedCanvasId: null,
        selectedCanvasObjectId: null,
        selectedInboxItemId: null,
        contextPanel: null,
        contextPanelBeforeAi: null,
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
        editingTaskTitleId: null,
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
        contextPanel: { kind: "task", taskId: task.id },
        contextPanelBeforeAi: null,
        commandPaletteOpen: false,
      };
    }
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
    case "toggle-overview-lane": {
      const isVisible = state.visibleOverviewLanes.includes(action.lane);
      if (isVisible && state.visibleOverviewLanes.length === 1) return state;
      return withVisibleOverviewLanes(
        state,
        isVisible
          ? state.visibleOverviewLanes.filter((lane) => lane !== action.lane)
          : [...state.visibleOverviewLanes, action.lane],
      );
    }
    case "focus-overview-lane":
      return withVisibleOverviewLanes(state, [action.lane]);
    case "show-all-overview-lanes":
      return withVisibleOverviewLanes(state, ALL_OVERVIEW_LANES);
    case "set-visible-overview-lanes":
      return withVisibleOverviewLanes(state, action.lanes);
    case "set-task-filter":
      return { ...state, taskFilter: action.filter };
    case "set-inbox-filter":
      return { ...state, inboxFilter: action.filter };
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
        activeSection:
          state.activeSection === "overview" ? "overview" : "tasks",
        tasks: [task, ...state.tasks],
        selectedTaskId: task.id,
        contextPanel: { kind: "task", taskId: task.id },
        contextPanelBeforeAi: null,
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
        expandedFolderIds: expanded
          ? state.expandedFolderIds.filter(
              (folderId) => folderId !== action.folderId,
            )
          : [...state.expandedFolderIds, action.folderId],
      };
    }
    case "collapse-all-knowledge-folders": {
      const selectedDocument = getDocumentById(state, state.selectedDocumentId);
      return {
        ...state,
        expandedFolderIds: selectedDocument
          ? getDocumentAncestorFolderIds(selectedDocument)
          : [],
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
        openDocumentIds: nextOpenDocumentIds,
        contextPanel:
          state.contextPanel?.kind === "document-context" &&
          state.contextPanel.documentId === action.documentId
            ? null
            : state.contextPanel,
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
        return { ...state, splitViewDocumentId: null };
      }
      const fallbackDocument = getProjectDocuments(state).find(
        (document) => document.id !== state.selectedDocumentId,
      );
      return {
        ...state,
        splitViewDocumentId: fallbackDocument?.id ?? null,
      };
    }
    case "open-document-context": {
      const documentId = action.documentId ?? state.selectedDocumentId;
      if (!documentId) return state;
      return {
        ...state,
        activeSection: "knowledge",
        selectedDocumentId: documentId,
        contextPanel: { kind: "document-context", documentId },
        contextPanelBeforeAi: null,
      };
    }
    case "select-canvas": {
      const canvas = getCanvasById(state, action.canvasId);
      if (!canvas) return state;
      return {
        ...state,
        activeProjectId: canvas.projectId,
        activeSection: "canvases",
        selectedCanvasId: canvas.id,
        selectedCanvasObjectId: null,
        contextPanel: null,
        contextPanelBeforeAi: null,
        commandPaletteOpen: false,
      };
    }
    case "select-canvas-object": {
      return {
        ...state,
        activeSection: "canvases",
        selectedCanvasId: action.canvasId,
        selectedCanvasObjectId: action.objectId,
        contextPanel: {
          kind: "canvas-inspector",
          canvasId: action.canvasId,
          objectId: action.objectId,
        },
        contextPanelBeforeAi: null,
      };
    }
    case "select-inbox-item": {
      const item = getInboxItemById(state, action.itemId);
      if (!item) return state;
      return {
        ...state,
        activeProjectId: item.projectId,
        activeSection: "inbox",
        selectedInboxItemId: item.id,
        contextPanel: { kind: "inbox-item", itemId: item.id },
        contextPanelBeforeAi: null,
        commandPaletteOpen: false,
      };
    }
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
    case "activate-command-result":
      return activateCommandResult(state, action.result);
  }
}
