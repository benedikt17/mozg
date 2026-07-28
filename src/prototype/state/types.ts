import type {
  InboxFilter,
  OverviewDirectionId,
  ProjectSection,
  PrototypeCanvas,
  PrototypeCanvasGroup,
  PrototypeDocument,
  PrototypeInboxItem,
  PrototypeOverviewDirection,
  PrototypeProject,
  PrototypeTask,
  PrototypeTaskGroup,
  PrototypeTaskList,
  TaskSignal,
} from "@/prototype/desktop-mock-data";
import type { DesktopDomainSnapshot } from "@/prototype/persistence/domain-snapshot";

export type TaskSystemView = "day" | "important" | "all";

export type TaskSelection =
  { kind: "system"; view: TaskSystemView } | { kind: "list"; listId: string };

export type TaskAttachOrigin =
  | { section: "overview"; taskId: string; documentId?: string | null }
  | { section: "tasks"; taskId: string; documentId?: string | null };

export type ContextPanelState =
  | { kind: "task"; taskId: string; initialTab?: "articles" }
  | { kind: "knowledge-tasks" }
  | { kind: "knowledge-task-reference"; taskId: string }
  | { kind: "knowledge-task-attach"; taskId: string }
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
  splitEnabled: boolean;
  activePane: KnowledgePane;
  activeDocument: PrototypeDocument | undefined;
};

export type PrototypeKnowledgeFolder = {
  id: string;
  projectId: string;
  path: string[];
};

export type KnowledgePathSelection =
  | { kind: "folder"; path: string[] }
  | { kind: "document"; path: string[]; documentId: string }
  | null;

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
  selectedKnowledgePath: KnowledgePathSelection;
  knowledgeBreadcrumbHighlightVisible: boolean;
  expandedFolderIds: string[];
  knowledgeExpandedBeforeCollapse: string[] | null;
  editingKnowledgeFolderId: string | null;
  knowledgeSearchQuery: string;
  openDocumentIds: string[];
  documentHistoryBack: string[];
  documentHistoryForward: string[];
  knowledgeContextMode: KnowledgeContextMode;
  knowledgeSplitEnabled: boolean;
  splitViewDocumentId: string | null;
  activeKnowledgePane: KnowledgePane;
  editingKnowledgeDocumentId: string | null;
  taskSelection: TaskSelection;
  taskSearchQuery: string;
  expandedTaskGroupIds: string[];
  expandedCanvasGroupIds: string[];
  inboxFilter: InboxFilter;
  inboxSearchQuery: string;
  contextPanel: ContextPanelState;
  taskAttachOrigin: TaskAttachOrigin | null;
  contextPanelBeforeAi: RestorableContextPanelState | null;
  commandPaletteOpen: boolean;
  projects: PrototypeProject[];
  overviewDirections: PrototypeOverviewDirection[];
  tasks: PrototypeTask[];
  taskGroups: PrototypeTaskGroup[];
  taskLists: PrototypeTaskList[];
  knowledgeFolders: PrototypeKnowledgeFolder[];
  documents: PrototypeDocument[];
  canvases: PrototypeCanvas[];
  canvasGroups: PrototypeCanvasGroup[];
  inboxItems: PrototypeInboxItem[];
  selectedAiProposalIds: string[];
  aiActivityLog: string[];
  nextProjectNumber: number;
  nextTaskNumber: number;
  nextTaskGroupNumber: number;
  nextTaskListNumber: number;
  nextDocumentNumber: number;
  nextKnowledgeFolderNumber: number;
  nextCanvasGroupNumber: number;
  nextCanvasNumber: number;
};

export type DesktopPrototypeAction =
  | { type: "hydrate-domain"; snapshot: DesktopDomainSnapshot }
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
  | { type: "select-task-system-view"; view: TaskSystemView }
  | { type: "select-task-list"; listId: string }
  | { type: "set-task-search-query"; query: string }
  | { type: "create-task-group"; title: string }
  | { type: "rename-task-group"; groupId: string; title: string }
  | { type: "delete-task-group"; groupId: string }
  | { type: "toggle-task-group"; groupId: string }
  | {
      type: "create-task-list";
      title: string;
      groupId: string;
    }
  | {
      type: "rename-task-list";
      listId: string;
      title: string;
    }
  | { type: "set-task-overview"; taskId: string; visible: boolean }
  | { type: "move-task-list"; taskId: string; targetTaskId: string | null }
  | {
      type: "move-task-to-list";
      taskId: string;
      targetListId: string;
      targetTaskId: string | null;
      sourceSystemView?: TaskSystemView;
    }
  | { type: "set-inbox-filter"; filter: InboxFilter }
  | { type: "set-inbox-search-query"; query: string }
  | {
      type: "move-inbox-item";
      itemId: string;
      targetItemId: string | null;
      targetFilter: InboxFilter;
    }
  | {
      type: "create-task";
      overviewDirectionId?: OverviewDirectionId;
      title?: string;
      destinationListId?: string;
      sourceSystemView?: TaskSystemView;
    }
  | { type: "select-document"; documentId: string }
  | { type: "open-knowledge-document-in-active-pane"; documentId: string }
  | { type: "toggle-key-document"; documentId: string }
  | { type: "toggle-knowledge-folder"; folderId: string; path: string[] }
  | { type: "select-knowledge-folder"; path: string[] }
  | { type: "select-knowledge-folder-from-breadcrumb"; path: string[] }
  | { type: "open-knowledge-document-from-breadcrumb"; documentId: string }
  | { type: "clear-knowledge-breadcrumb-highlight" }
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
  | { type: "start-editing-knowledge-folder"; folderId: string }
  | { type: "rename-knowledge-folder"; folderId: string; title: string }
  | { type: "delete-knowledge-folder"; folderId: string }
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
  | { type: "close-knowledge-split-view" }
  | { type: "activate-knowledge-pane"; pane: KnowledgePane }
  | { type: "toggle-knowledge-document-edit"; documentId: string }
  | { type: "open-knowledge-task-linker" }
  | {
      type: "open-knowledge-article-attach";
      taskId: string;
      origin: TaskAttachOrigin;
    }
  | { type: "return-to-task-from-knowledge-attach" }
  | {
      type: "open-overview-task-article";
      taskId: string;
      documentId: string;
    }
  | { type: "open-overview-task-focus"; taskId: string; documentId?: string }
  | { type: "close-overview-article-preview" }
  | { type: "open-overview-task-article-linker"; taskId: string }
  | { type: "return-to-overview-from-task-article" }
  | { type: "open-document-context"; documentId?: string }
  | { type: "select-canvas"; canvasId: string }
  | { type: "select-canvas-object"; canvasId: string; objectId: string }
  | { type: "create-canvas-group"; title: string }
  | { type: "rename-canvas-group"; groupId: string; title: string }
  | { type: "delete-canvas-group"; groupId: string }
  | { type: "toggle-canvas-group"; groupId: string }
  | { type: "create-canvas"; title: string; groupId: string | null }
  | { type: "rename-canvas"; canvasId: string; title: string }
  | { type: "delete-canvas"; canvasId: string }
  | { type: "move-canvas-to-group"; canvasId: string; groupId: string }
  | { type: "select-inbox-item"; itemId: string }
  | { type: "open-ai-panel" }
  | { type: "close-ai-panel" }
  | { type: "toggle-ai-proposal"; proposalId: string }
  | { type: "confirm-ai-proposals" }
  | { type: "open-command-palette" }
  | { type: "close-command-palette" }
  | { type: "activate-command-result"; result: CommandResult };
