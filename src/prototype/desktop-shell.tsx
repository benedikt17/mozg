"use client";

import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type DragEvent,
} from "react";
import {
  aiProposals,
  inboxFilters,
  projectSections,
  type ProjectSection,
  type PrototypeDocument,
  type PrototypeInboxItem,
  type PrototypeTask,
  type TaskSignal,
} from "@/prototype/desktop-mock-data";
import {
  desktopPrototypeReducer,
  getActiveProject,
  getAiContextLabel,
  getCanvasById,
  getCanvasObjectById,
  getCommandResults,
  getDocumentBreadcrumb,
  getDocumentById,
  getInboxItemById,
  getProjectCanvases,
  getProjectDocuments,
  getProjectTasks,
  getProjectTaskFolders,
  getProjectOverviewDirections,
  getTaskById,
  getVisibleInboxItems,
  getVisibleOverviewTasks,
  getVisibleTaskList,
  initialDesktopPrototypeState,
  isValidTaskLinkUrl,
  type CommandResult,
  type ContextPanelState,
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
  type KnowledgeContextMode,
} from "@/prototype/desktop-state";
import { OverviewWorkspace } from "@/prototype/overview";
import { UiIcon } from "@/prototype/desktop-icons";
import { EmptySection } from "@/prototype/empty-section";
import { KnowledgeSidebar } from "@/prototype/knowledge/knowledge-sidebar";
import { KnowledgeWorkspace } from "@/prototype/knowledge/knowledge-workspace";
import { MarkdownDocumentPreview } from "@/prototype/knowledge/markdown-document-preview";
import {
  ContextPanelSection,
  IconButton,
  PrototypeButton,
  ToolSidebarItem,
} from "@/prototype/desktop-ui";
import { ApplicationHeader } from "@/prototype/shell/application-header";
import { SectionRail } from "@/prototype/shell/section-rail";
import "./desktop-shell.css";
import "./desktop-workspaces.css";
import "./desktop-knowledge.css";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

const taskSignalOptions: {
  id: TaskSignal;
  label: string;
}[] = [
  { id: "none", label: "Без сигнала" },
  { id: "green", label: "Зелёный" },
  { id: "yellow", label: "Жёлтый" },
  { id: "red", label: "Красный" },
];

const commandKindLabels: Record<CommandResult["kind"], string> = {
  project: "Проект",
  section: "Раздел",
  task: "Задача",
  document: "Документ",
  canvas: "Холст",
  inbox: "Входящее",
};

export function DesktopPrototypeShell(): React.JSX.Element {
  const [state, dispatch] = useReducer(
    desktopPrototypeReducer,
    initialDesktopPrototypeState,
  );
  const [commandQuery, setCommandQuery] = useState(getInitialCommandQuery);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const seededFromUrl = useRef(false);
  const commandResults = useMemo(
    () => getCommandResults(state, commandQuery),
    [state, commandQuery],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const isCommandShortcut =
        (event.ctrlKey || event.metaKey) && event.key === "k";
      if (isCommandShortcut) {
        event.preventDefault();
        setActiveCommandIndex(0);
        dispatch({ type: "open-command-palette" });
      }
      if (event.key === "Escape") {
        dispatch({ type: "close-command-palette" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (seededFromUrl.current) return;
    seededFromUrl.current = true;
    const params = new URLSearchParams(window.location.search);
    const sectionParam = params.get("section");
    const section = projectSections.some((item) => item.id === sectionParam)
      ? (sectionParam as ProjectSection)
      : null;
    if (section) {
      dispatch({ type: "switch-section", section });
    }
    if (params.get("search")) {
      dispatch({
        type: "set-knowledge-search",
        query: params.get("search") ?? "",
      });
    }
    const documentId = params.get("document") ?? "doc-l-routes";
    if (section === "knowledge" || params.get("document")) {
      dispatch({ type: "select-document", documentId });
    }
    if (params.get("split") === "1") {
      dispatch({ type: "toggle-knowledge-split-view" });
    }
    if (params.get("detail") === "task") {
      dispatch({
        type: "select-task",
        taskId: "luko-characters-map",
        section: section === "overview" ? "overview" : "tasks",
      });
    }
    if (params.get("detail") === "inbox") {
      dispatch({ type: "select-inbox-item", itemId: "inbox-l-text" });
    }
    if (params.get("context") === "document") {
      dispatch({ type: "open-document-context", documentId });
    }
    if (params.get("ai") === "1") {
      dispatch({ type: "open-ai-panel" });
    }
    if (params.get("command") === "1") {
      dispatch({ type: "open-command-palette" });
    }
    if (params.get("rail") === "collapsed") {
      dispatch({ type: "toggle-project-rail" });
    }
    const editingTaskId = params.get("editTask");
    if (editingTaskId) {
      dispatch({ type: "begin-task-title-edit", taskId: editingTaskId });
    }
  }, []);

  const activateCommandResult = (result: CommandResult): void => {
    dispatch({ type: "activate-command-result", result });
    setCommandQuery("");
  };

  const activeProject = getActiveProject(state);
  const overviewReaderActive =
    state.activeSection === "overview" &&
    state.overviewArticleSourceTaskId !== null &&
    state.overviewArticlePreviewDocumentId !== null;

  return (
    <main
      className={[
        "desktop-prototype",
        state.activeSection === "knowledge" ? "knowledge-active" : "",
        state.activeSection === "knowledge" && state.splitViewDocumentId
          ? "knowledge-split-active"
          : "",
        state.projectRailCollapsed ? "project-rail-collapsed" : "",
        state.activeSection === "overview" &&
        state.contextPanel?.kind === "task" &&
        !overviewReaderActive
          ? "overview-task-drawer-open"
          : "",
        state.activeSection === "tasks" && state.contextPanel?.kind === "task"
          ? "tasks-task-drawer-open"
          : "",
        state.activeSection === "knowledge" &&
        state.contextPanel?.kind === "knowledge-tasks"
          ? "knowledge-task-link-drawer-open"
          : "",
        state.activeSection === "knowledge" &&
        state.contextPanel?.kind === "knowledge-task-reference"
          ? "knowledge-task-reference-drawer-open"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <SectionRail state={state} dispatch={dispatch} />
      <div className="project-workspace">
        <ApplicationHeader state={state} dispatch={dispatch} />
        <SectionWorkspace state={state} dispatch={dispatch} />
      </div>
      {state.commandPaletteOpen ? (
        <CommandPalette
          activeIndex={activeCommandIndex}
          activeProjectName={activeProject.name}
          onActivate={activateCommandResult}
          onClose={() => dispatch({ type: "close-command-palette" })}
          onIndexChange={setActiveCommandIndex}
          onQueryChange={setCommandQuery}
          query={commandQuery}
          results={commandResults}
        />
      ) : null}
    </main>
  );
}

function SectionWorkspace({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  const [knowledgeTreeOverlayOpen, setKnowledgeTreeOverlayOpen] =
    useState(false);
  const sidebar = renderToolSidebar(state, dispatch, {
    onCloseKnowledgeTree: () => setKnowledgeTreeOverlayOpen(false),
  });
  const overviewReaderActive =
    state.activeSection === "overview" &&
    state.overviewArticleSourceTaskId !== null &&
    state.overviewArticlePreviewDocumentId !== null;
  const hasContextPanel =
    state.contextPanel !== null &&
    (state.activeSection !== "overview" ||
      (state.contextPanel.kind === "task" && !overviewReaderActive));
  const hasFullHeightDrawer =
    state.contextPanel?.kind === "knowledge-tasks" ||
    state.contextPanel?.kind === "knowledge-task-reference" ||
    (state.activeSection === "tasks" && state.contextPanel?.kind === "task");
  return (
    <div
      className={[
        "section-workspace",
        `workspace-policy-${workspaceWidthPolicy(state)}`,
        `section-${state.activeSection}`,
        sidebar ? "has-tool-sidebar" : "",
        hasContextPanel ? "has-context-panel" : "",
        hasFullHeightDrawer ? "has-full-height-drawer" : "",
        overviewReaderActive ? "has-overview-contextual-reader" : "",
        state.activeSection === "knowledge" && state.splitViewDocumentId
          ? "has-split-view"
          : "",
        state.activeSection === "knowledge" && knowledgeTreeOverlayOpen
          ? "is-knowledge-tree-open"
          : "",
        state.activeSection === "knowledge" && state.contextPanel?.kind === "ai"
          ? "has-wide-context-panel"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {sidebar}
      <section className="main-workspace" aria-label="Рабочая область">
        {renderMainWorkspace(state, dispatch, {
          onOpenKnowledgeTree: () => setKnowledgeTreeOverlayOpen(true),
        })}
      </section>
      {state.activeSection === "knowledge" && knowledgeTreeOverlayOpen ? (
        <button
          aria-label="Закрыть дополнительную панель"
          className="knowledge-overlay-backdrop"
          onClick={() => setKnowledgeTreeOverlayOpen(false)}
          type="button"
        />
      ) : null}
      {hasContextPanel ? (
        <ContextPanelSlot
          contextPanel={state.contextPanel}
          dispatch={dispatch}
          state={state}
        />
      ) : null}
    </div>
  );
}

function workspaceWidthPolicy(
  state: DesktopPrototypeState,
): "full-surface" | "readable-document" {
  if (state.activeSection === "knowledge") return "readable-document";
  return "full-surface";
}

function OverviewSectionWorkspace({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  const directions = getProjectOverviewDirections(state);
  const documents = getProjectDocuments(state);
  const sourceTask = getTaskById(state, state.overviewArticleSourceTaskId);
  const activeDocument = getDocumentById(
    state,
    state.overviewArticlePreviewDocumentId,
  );
  const sourceDirection = sourceTask
    ? directions.find(
        (direction) => direction.id === sourceTask.overviewDirectionId,
      )
    : undefined;
  const readerActive =
    sourceTask !== undefined &&
    activeDocument !== undefined &&
    sourceDirection !== undefined &&
    sourceTask.projectId === state.activeProjectId &&
    activeDocument.projectId === sourceTask.projectId &&
    sourceTask.linkedDocumentIds.includes(activeDocument.id);

  return (
    <div
      className={[
        "overview-mode-stage",
        readerActive ? "is-contextual-reader-active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div aria-hidden={readerActive} className="overview-board-mode">
        <OverviewWorkspace
          directions={directions}
          dispatch={dispatch}
          documents={documents}
          expandedTaskId={state.overviewExpandedTaskId}
          hiddenDirectionIds={state.overviewHiddenDirectionIds}
          openTaskId={
            state.contextPanel?.kind === "task"
              ? state.contextPanel.taskId
              : null
          }
          overviewScrollLeft={state.overviewScrollLeft}
          tasks={getVisibleOverviewTasks(state)}
        />
      </div>
      {readerActive ? (
        <OverviewContextualReader
          activeDocument={activeDocument}
          direction={sourceDirection}
          dispatch={dispatch}
          documents={documents}
          task={sourceTask}
        />
      ) : null}
    </div>
  );
}

function OverviewContextualReader({
  activeDocument,
  direction,
  dispatch,
  documents,
  task,
}: {
  activeDocument: PrototypeDocument;
  direction: ReturnType<typeof getProjectOverviewDirections>[number];
  dispatch: Dispatch;
  documents: PrototypeDocument[];
  task: PrototypeTask;
}): React.JSX.Element {
  const [contextCollapsed, setContextCollapsed] = useState(false);
  const [mobileContextOpen, setMobileContextOpen] = useState(false);
  const articleRef = useRef<HTMLElement>(null);
  const articleScrollDocumentIdRef = useRef(activeDocument.id);
  const articleScrollPositionsRef = useRef(new Map<string, number>());
  const mobileContextCloseRef = useRef<HTMLButtonElement>(null);
  const mobileContextTriggerRef = useRef<HTMLButtonElement>(null);
  const attachedDocuments = task.linkedDocumentIds
    .map((documentId) =>
      documents.find((document) => document.id === documentId),
    )
    .filter(
      (document): document is PrototypeDocument => document !== undefined,
    );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const article = articleRef.current;
      if (!article) return;
      article.scrollTop =
        articleScrollPositionsRef.current.get(activeDocument.id) ?? 0;
      articleScrollDocumentIdRef.current = activeDocument.id;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeDocument.id]);

  useEffect(() => {
    if (!mobileContextOpen) return;
    const frame = window.requestAnimationFrame(() => {
      mobileContextCloseRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mobileContextOpen]);

  const returnToBoard = (): void => {
    dispatch({ type: "close-overview-article-preview" });
  };

  const openTaskOnBoard = (): void => {
    dispatch({ type: "close-overview-article-preview" });
    dispatch({ type: "select-task", taskId: task.id, section: "overview" });
  };

  const closeMobileContext = (): void => {
    setMobileContextOpen(false);
    window.requestAnimationFrame(() => {
      mobileContextTriggerRef.current?.focus();
    });
  };

  return (
    <section
      className={[
        "overview-contextual-reader",
        contextCollapsed ? "is-context-collapsed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !mobileContextOpen) return;
        event.preventDefault();
        closeMobileContext();
      }}
    >
      {mobileContextOpen ? (
        <button
          aria-label="Закрыть контекст задачи"
          className="overview-reader-context-backdrop"
          onClick={closeMobileContext}
          type="button"
        />
      ) : null}
      <aside
        aria-hidden={contextCollapsed && !mobileContextOpen}
        aria-label={`Контекст задачи: ${task.title}`}
        aria-modal={mobileContextOpen || undefined}
        className={[
          "overview-reader-task-context",
          `task-signal-${task.signal}`,
          mobileContextOpen ? "is-mobile-open" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        role={mobileContextOpen ? "dialog" : undefined}
      >
        <button
          aria-label="Закрыть контекст задачи"
          className="overview-reader-mobile-close"
          onClick={closeMobileContext}
          ref={mobileContextCloseRef}
          title="Закрыть контекст задачи"
          type="button"
        >
          <span aria-hidden="true">×</span>
        </button>
        <PrototypeButton
          aria-label="Вернуться к доске Обзора"
          className="overview-reader-back"
          onClick={returnToBoard}
          size="compact"
          variant="ghost"
        >
          ← К доске
        </PrototypeButton>
        <div className="overview-reader-task-card">
          <h2>{task.title}</h2>
          {task.subtasks.length > 0 ? (
            <section className="overview-reader-context-section">
              <h3>Подзадачи</h3>
              <ul className="overview-reader-subtasks">
                {task.subtasks.map((subtask) => (
                  <li
                    className={subtask.done ? "is-complete" : ""}
                    key={subtask.id}
                  >
                    <input
                      aria-label={subtask.title}
                      checked={subtask.done}
                      onChange={() =>
                        dispatch({
                          type: "toggle-subtask",
                          taskId: task.id,
                          subtaskId: subtask.id,
                        })
                      }
                      type="checkbox"
                    />
                    <span>{subtask.title}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {task.links.length > 0 ? (
            <section className="overview-reader-context-section">
              <h3>Ссылки</h3>
              <ul className="overview-reader-resources">
                {task.links.map((link) => (
                  <li key={link.id}>
                    <a href={link.url} rel="noreferrer" target="_blank">
                      {link.title}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section className="overview-reader-context-section">
            <h3>Статьи</h3>
            <ul className="overview-reader-articles">
              {attachedDocuments.map((document) => (
                <li key={document.id}>
                  <button
                    aria-current={
                      document.id === activeDocument.id ? "page" : undefined
                    }
                    className={
                      document.id === activeDocument.id ? "is-active" : ""
                    }
                    onClick={() =>
                      dispatch({
                        type: "open-overview-task-article",
                        taskId: task.id,
                        documentId: document.id,
                      })
                    }
                    type="button"
                  >
                    {document.title}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </aside>
      <IconButton
        className="overview-reader-context-toggle"
        icon={<UiIcon name={contextCollapsed ? "panel-right" : "panel-left"} />}
        label={
          contextCollapsed
            ? "Показать контекст задачи"
            : "Скрыть контекст задачи"
        }
        onClick={() => setContextCollapsed((collapsed) => !collapsed)}
        title={
          contextCollapsed
            ? "Показать контекст задачи"
            : "Скрыть контекст задачи"
        }
        variant="quiet"
      />
      <article
        className="document-page overview-reader-article"
        onScroll={(event) => {
          articleScrollPositionsRef.current.set(
            articleScrollDocumentIdRef.current,
            event.currentTarget.scrollTop,
          );
        }}
        ref={articleRef}
      >
        <div className="document-page-inner">
          <div className="overview-reader-mobile-actions">
            <button
              className="ui-button ui-button-quiet ui-button-compact"
              onClick={() => setMobileContextOpen(true)}
              ref={mobileContextTriggerRef}
              type="button"
            >
              Контекст задачи
            </button>
            <PrototypeButton
              onClick={returnToBoard}
              size="compact"
              variant="ghost"
            >
              ← К доске
            </PrototypeButton>
          </div>
          <nav
            aria-label="Контекст статьи"
            className="overview-reader-breadcrumb"
          >
            <ol>
              <li>
                <button
                  onClick={returnToBoard}
                  title={`К направлению «${direction.title}»`}
                  type="button"
                >
                  {direction.title}
                </button>
              </li>
              <li className="is-task">
                <button
                  onClick={openTaskOnBoard}
                  title={task.title}
                  type="button"
                >
                  {task.title}
                </button>
              </li>
              <li aria-current="page" title={activeDocument.title}>
                <span>{activeDocument.title}</span>
              </li>
            </ol>
          </nav>
          <h1>{activeDocument.title}</h1>
          <MarkdownDocumentPreview document={activeDocument} hideLeadingTitle />
        </div>
      </article>
    </section>
  );
}

function getInitialCommandQuery(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("commandQuery") ?? "";
}

function renderToolSidebar(
  state: DesktopPrototypeState,
  dispatch: Dispatch,
  options?: { onCloseKnowledgeTree?: () => void },
): React.JSX.Element | null {
  if (state.activeSection === "knowledge") {
    return (
      <KnowledgeSidebar
        state={state}
        dispatch={dispatch}
        onClose={options?.onCloseKnowledgeTree}
      />
    );
  }
  if (state.activeSection === "tasks") {
    return <TasksSidebar state={state} dispatch={dispatch} />;
  }
  if (state.activeSection === "canvases") {
    return <CanvasesSidebar state={state} dispatch={dispatch} />;
  }
  if (state.activeSection === "inbox") {
    return <InboxSidebar state={state} dispatch={dispatch} />;
  }
  return null;
}

function renderMainWorkspace(
  state: DesktopPrototypeState,
  dispatch: Dispatch,
  options?: {
    onOpenKnowledgeTree?: () => void;
  },
): React.JSX.Element {
  if (state.activeSection === "knowledge") {
    return (
      <KnowledgeWorkspace
        state={state}
        dispatch={dispatch}
        onOpenTree={options?.onOpenKnowledgeTree}
      />
    );
  }
  if (state.activeSection === "tasks") {
    return <TasksWorkspace state={state} dispatch={dispatch} />;
  }
  if (state.activeSection === "canvases") {
    return <CanvasesWorkspace state={state} dispatch={dispatch} />;
  }
  if (state.activeSection === "inbox") {
    return <InboxWorkspace state={state} dispatch={dispatch} />;
  }
  return <OverviewSectionWorkspace state={state} dispatch={dispatch} />;
}

const taskDragMimeType = "application/x-mozg-task-id";

function getDraggedTaskId(event: DragEvent<HTMLElement>): string | null {
  return (
    event.dataTransfer.getData(taskDragMimeType) ||
    event.dataTransfer.getData("text/plain") ||
    null
  );
}

function TasksSidebar({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  const folders = getProjectTaskFolders(state);
  const directions = getProjectOverviewDirections(state);
  const [newFolderTitle, setNewFolderTitle] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [folderTitleDraft, setFolderTitleDraft] = useState("");

  const commitFolderRename = (): void => {
    if (!editingFolderId) return;
    if (folderTitleDraft.trim()) {
      dispatch({
        type: "rename-task-folder",
        folderId: editingFolderId,
        title: folderTitleDraft,
      });
    }
    setEditingFolderId(null);
    setFolderTitleDraft("");
  };

  return (
    <aside className="tool-sidebar tasks-sidebar" aria-label="Фильтры задач">
      <label className="task-sidebar-search">
        <input
          aria-label="Поиск задач"
          onChange={(event) =>
            dispatch({
              type: "set-task-search-query",
              query: event.target.value,
            })
          }
          placeholder="Поиск задач"
          type="search"
          value={state.taskSearchQuery}
        />
      </label>
      <nav className="vertical-menu task-sidebar-group">
        <ToolSidebarItem
          active={state.taskDayViewActive}
          onClick={() => dispatch({ type: "select-task-day" })}
        >
          <strong>Задачи на день</strong>
        </ToolSidebarItem>
        <ToolSidebarItem
          active={
            !state.taskDayViewActive &&
            state.selectedTaskDirectionId === null &&
            state.selectedTaskFolderId === null &&
            state.taskFilter === "important"
          }
          onClick={() =>
            dispatch({ type: "set-task-filter", filter: "important" })
          }
        >
          <strong>Важные</strong>
        </ToolSidebarItem>
        <div
          className="task-sidebar-drop-target"
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
          onDrop={(event) => {
            event.preventDefault();
            const taskId = getDraggedTaskId(event);
            if (!taskId) return;
            dispatch({ type: "assign-task-folder", taskId, folderId: null });
          }}
        >
          <ToolSidebarItem
            active={
              !state.taskDayViewActive &&
              state.selectedTaskDirectionId === null &&
              state.selectedTaskFolderId === null &&
              state.taskFilter === "all"
            }
            onClick={() => dispatch({ type: "set-task-filter", filter: "all" })}
          >
            <strong>Все</strong>
          </ToolSidebarItem>
        </div>
      </nav>
      <div className="task-sidebar-separator" />
      <nav
        className="vertical-menu task-sidebar-group"
        aria-label="Направления проекта"
      >
        {directions.map((direction) => (
          <ToolSidebarItem
            active={state.selectedTaskDirectionId === direction.id}
            key={direction.id}
            onClick={() =>
              dispatch({
                type: "select-task-direction",
                directionId: direction.id,
              })
            }
          >
            <strong>{direction.title}</strong>
          </ToolSidebarItem>
        ))}
      </nav>
      <div className="task-sidebar-separator" />
      <section className="task-folders" aria-label="Папки задач">
        <ToolSidebarItem
          active={
            !state.taskDayViewActive &&
            state.selectedTaskDirectionId === null &&
            state.selectedTaskFolderId === null &&
            state.taskFilter === "completed"
          }
          onClick={() =>
            dispatch({ type: "set-task-filter", filter: "completed" })
          }
        >
          <strong>Завершённые</strong>
        </ToolSidebarItem>
        <div className="task-folders-heading">Папки</div>
        <div className="task-folder-list">
          {folders.map((folder) => {
            const folderHasTasks = state.tasks.some(
              (task) => task.taskFolderId === folder.id,
            );
            return (
              <div
                className={
                  state.selectedTaskFolderId === folder.id
                    ? "task-folder-row is-active"
                    : "task-folder-row"
                }
                key={folder.id}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const taskId = getDraggedTaskId(event);
                  if (!taskId) return;
                  dispatch({
                    type: "assign-task-folder",
                    taskId,
                    folderId: folder.id,
                  });
                }}
              >
                {editingFolderId === folder.id ? (
                  <input
                    aria-label={`Название папки: ${folder.title}`}
                    autoFocus
                    onBlur={commitFolderRename}
                    onChange={(event) =>
                      setFolderTitleDraft(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitFolderRename();
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setEditingFolderId(null);
                        setFolderTitleDraft("");
                      }
                    }}
                    value={folderTitleDraft}
                  />
                ) : (
                  <button
                    className="task-folder-select"
                    onClick={() =>
                      dispatch({
                        type: "select-task-folder",
                        folderId: folder.id,
                      })
                    }
                    type="button"
                  >
                    {folder.title}
                  </button>
                )}
                <button
                  aria-label={`Переименовать папку: ${folder.title}`}
                  className="task-folder-action"
                  onClick={() => {
                    setEditingFolderId(folder.id);
                    setFolderTitleDraft(folder.title);
                  }}
                  title="Переименовать папку"
                  type="button"
                >
                  ✎
                </button>
                <button
                  aria-label={`Удалить папку: ${folder.title}`}
                  className="task-folder-action"
                  disabled={folderHasTasks}
                  onClick={() =>
                    dispatch({
                      type: "delete-task-folder",
                      folderId: folder.id,
                    })
                  }
                  title={
                    folderHasTasks
                      ? "Сначала переместите задачи из папки"
                      : "Удалить папку"
                  }
                  type="button"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
        <form
          className="task-folder-create"
          onSubmit={(event) => {
            event.preventDefault();
            if (!newFolderTitle.trim()) return;
            dispatch({ type: "create-task-folder", title: newFolderTitle });
            setNewFolderTitle("");
          }}
        >
          <input
            aria-label="Название новой папки задач"
            onChange={(event) => setNewFolderTitle(event.target.value)}
            placeholder="Новая папка"
            value={newFolderTitle}
          />
          <button aria-label="Создать папку" type="submit">
            +
          </button>
        </form>
      </section>
    </aside>
  );
}

function TasksWorkspace({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  const [taskComposerOpen, setTaskComposerOpen] = useState(false);
  const [taskComposerDraft, setTaskComposerDraft] = useState("");
  const taskComposerInputRef = useRef<HTMLInputElement>(null);
  const focusedTask = getTaskById(state, state.taskDetailViewTaskId);
  const tasks = state.taskDetailViewTaskId
    ? focusedTask
      ? [focusedTask]
      : []
    : getVisibleTaskList(state);

  useEffect(() => {
    if (!taskComposerOpen) return;
    taskComposerInputRef.current?.focus();
  }, [taskComposerOpen]);

  const closeTaskComposer = (): void => {
    setTaskComposerOpen(false);
    setTaskComposerDraft("");
  };

  const createTaskFromComposer = (): void => {
    const title = taskComposerDraft.trim();
    if (title.length === 0) return;
    dispatch({ type: "create-task", title });
    closeTaskComposer();
  };

  return (
    <div className="task-list-workspace">
      {state.taskDetailViewTaskId ? (
        <button
          className="quiet-text-link task-list-back-link"
          onClick={() => dispatch({ type: "close-task-detail-view" })}
          type="button"
        >
          ← Все задачи
        </button>
      ) : null}
      <div className="task-list-scroll">
        <div className="task-list">
          {tasks.map((task) => (
            <TaskListRow dispatch={dispatch} key={task.id} task={task} />
          ))}
          <div
            className="task-list-drop-end"
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => {
              event.preventDefault();
              const taskId = getDraggedTaskId(event);
              if (!taskId) return;
              dispatch({ type: "move-task-list", taskId, targetTaskId: null });
            }}
          />
        </div>
      </div>
      {state.taskDetailViewTaskId ? null : (
        <div className="task-list-composer">
          {taskComposerOpen ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                createTaskFromComposer();
              }}
            >
              <input
                aria-label="Название новой задачи"
                onBlur={() => {
                  if (taskComposerDraft.trim().length === 0) {
                    closeTaskComposer();
                  }
                }}
                onChange={(event) => setTaskComposerDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Escape") return;
                  event.preventDefault();
                  closeTaskComposer();
                }}
                placeholder="Название задачи"
                ref={taskComposerInputRef}
                value={taskComposerDraft}
              />
            </form>
          ) : (
            <button
              className="task-list-add"
              onClick={() => setTaskComposerOpen(true)}
              type="button"
            >
              + Добавить задачу
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TaskListRow({
  task,
  dispatch,
}: {
  task: PrototypeTask;
  dispatch: Dispatch;
}): React.JSX.Element {
  return (
    <article
      className={`task-row task-signal-${task.signal}`}
      onClick={() =>
        dispatch({ type: "select-task", taskId: task.id, section: "tasks" })
      }
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const taskId = getDraggedTaskId(event);
        if (!taskId || taskId === task.id) return;
        dispatch({
          type: "move-task-list",
          taskId,
          targetTaskId: task.id,
        });
      }}
    >
      <button
        aria-label={`Перетащить задачу ${task.title}`}
        className="task-list-drag-handle"
        draggable
        onClick={(event) => event.stopPropagation()}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData(taskDragMimeType, task.id);
          event.dataTransfer.setData("text/plain", task.id);
        }}
        title="Перетащить задачу"
        type="button"
      >
        ⠿
      </button>
      <button
        aria-checked={task.completedAt !== null}
        aria-label={
          task.completedAt
            ? `Отметить задачу незавершённой: ${task.title}`
            : `Завершить задачу: ${task.title}`
        }
        className={
          task.completedAt
            ? "task-completion-checkbox is-completed"
            : "task-completion-checkbox"
        }
        onClick={(event) => {
          event.stopPropagation();
          dispatch({ type: "toggle-task-completed", taskId: task.id });
        }}
        role="checkbox"
        type="button"
      >
        <span aria-hidden="true">{task.completedAt ? "✓" : ""}</span>
      </button>
      <strong
        className={
          task.completedAt ? "task-row-title is-completed" : "task-row-title"
        }
      >
        {task.title}
      </strong>
      <button
        className={task.starred ? "star-button active" : "star-button"}
        onClick={(event) => {
          event.stopPropagation();
          dispatch({ type: "toggle-task-star", taskId: task.id });
        }}
        type="button"
      >
        ★
      </button>
    </article>
  );
}

function CanvasesSidebar({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  const canvases = getProjectCanvases(state);
  return (
    <aside className="tool-sidebar" aria-label="Список холстов">
      <header>
        <span>Холсты</span>
        <strong>Карты</strong>
      </header>
      <nav className="vertical-menu">
        {canvases.map((canvas) => (
          <ToolSidebarItem
            active={state.selectedCanvasId === canvas.id}
            key={canvas.id}
            onClick={() =>
              dispatch({ type: "select-canvas", canvasId: canvas.id })
            }
          >
            <strong>{canvas.title}</strong>
            <span>{canvas.description}</span>
          </ToolSidebarItem>
        ))}
      </nav>
    </aside>
  );
}

function CanvasesWorkspace({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  const canvas = getCanvasById(state, state.selectedCanvasId);
  if (!canvas) {
    return <EmptySection title="Холсты" />;
  }
  return (
    <div className="canvas-workspace">
      <div className="canvas-surface">
        <div className="canvas-line line-one" />
        <div className="canvas-line line-two" />
        {canvas.objects.map((object) => (
          <button
            className={[
              "canvas-object",
              object.type,
              state.selectedCanvasObjectId === object.id ? "active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            key={object.id}
            onClick={() =>
              dispatch({
                type: "select-canvas-object",
                canvasId: canvas.id,
                objectId: object.id,
              })
            }
            style={{ left: `${object.x}%`, top: `${object.y}%` }}
            type="button"
          >
            <strong>{object.title}</strong>
            <span>{object.body}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function InboxSidebar({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  return (
    <aside className="tool-sidebar" aria-label="Фильтры входящих">
      <header>
        <span>Входящие</span>
        <strong>Источники</strong>
      </header>
      <nav className="vertical-menu compact">
        {inboxFilters.map((filter) => (
          <ToolSidebarItem
            active={state.inboxFilter === filter.id}
            key={filter.id}
            onClick={() =>
              dispatch({ type: "set-inbox-filter", filter: filter.id })
            }
          >
            {filter.label}
          </ToolSidebarItem>
        ))}
      </nav>
    </aside>
  );
}

function InboxWorkspace({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  const items = getVisibleInboxItems(state);
  return (
    <div className="inbox-workspace">
      <div className="inbox-grid">
        {items.map((item) => (
          <InboxItemCard dispatch={dispatch} item={item} key={item.id} />
        ))}
      </div>
    </div>
  );
}

function InboxItemCard({
  item,
  dispatch,
}: {
  item: PrototypeInboxItem;
  dispatch: Dispatch;
}): React.JSX.Element {
  return (
    <article className="inbox-item">
      <button
        onClick={() => dispatch({ type: "select-inbox-item", itemId: item.id })}
        type="button"
      >
        <span>{item.source}</span>
        <strong>{item.title}</strong>
        <p>{item.preview}</p>
        <small>{item.capturedAt}</small>
      </button>
    </article>
  );
}

function ContextPanelSlot({
  state,
  dispatch,
  contextPanel,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
  contextPanel: ContextPanelState;
}): React.JSX.Element | null {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  if (!contextPanel) return null;
  const usesIconClose =
    contextPanel.kind === "task" || contextPanel.kind === "knowledge-tasks";
  return (
    <>
      <aside
        className={[
          "context-panel",
          state.activeSection === "knowledge" && contextPanel.kind === "ai"
            ? "knowledge-ai-panel"
            : "",
          contextPanel.kind === "task"
            ? "task-context-panel"
            : contextPanel.kind === "knowledge-tasks"
              ? "knowledge-task-link-drawer"
              : contextPanel.kind === "knowledge-task-reference"
                ? "knowledge-task-reference-drawer"
                : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label="Контекстная панель"
      >
        <header className={usesIconClose ? "task-context-header" : undefined}>
          {usesIconClose ? null : (
            <div>
              <span>Контекст</span>
              <h2>{contextTitle(contextPanel)}</h2>
            </div>
          )}
          {usesIconClose ? (
            <IconButton
              className="task-context-close"
              icon={<span aria-hidden="true">×</span>}
              label={
                contextPanel.kind === "task"
                  ? "Закрыть панель задачи"
                  : "Закрыть панель задач"
              }
              onClick={() => dispatch({ type: "close-context-panel" })}
              title={
                contextPanel.kind === "task"
                  ? "Закрыть панель задачи"
                  : "Закрыть панель задач"
              }
            />
          ) : (
            <PrototypeButton
              onClick={() =>
                dispatch({
                  type:
                    contextPanel.kind === "ai"
                      ? "close-ai-panel"
                      : "close-context-panel",
                })
              }
              variant="quiet"
            >
              Закрыть
            </PrototypeButton>
          )}
        </header>
        {renderContextPanelContent(state, dispatch, contextPanel)}
        {contextPanel.kind === "task" ? (
          <footer className="task-context-footer">
            <IconButton
              className="task-context-delete"
              icon={<UiIcon name="trash" />}
              label="Удалить задачу"
              onClick={() => setDeleteConfirmOpen(true)}
              title="Удалить задачу"
              variant="ghost"
            />
          </footer>
        ) : null}
      </aside>
      {contextPanel.kind === "task" && deleteConfirmOpen ? (
        <div
          className="task-delete-confirm-backdrop"
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            setDeleteConfirmOpen(false);
          }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setDeleteConfirmOpen(false);
            }
          }}
        >
          <section
            aria-describedby="task-delete-confirm-description"
            aria-labelledby="task-delete-confirm-title"
            aria-modal="true"
            className="task-delete-confirm-dialog"
            role="alertdialog"
          >
            <h2 id="task-delete-confirm-title">Удалить задачу?</h2>
            <p id="task-delete-confirm-description">
              Это действие нельзя отменить.
            </p>
            <div className="task-delete-confirm-actions">
              <PrototypeButton
                autoFocus
                onClick={() => setDeleteConfirmOpen(false)}
                variant="quiet"
              >
                Отмена
              </PrototypeButton>
              <PrototypeButton
                className="task-delete-confirm-submit"
                onClick={() =>
                  dispatch({ type: "delete-task", taskId: contextPanel.taskId })
                }
                variant="quiet"
              >
                Удалить
              </PrototypeButton>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function contextTitle(
  contextPanel: Exclude<
    NonNullable<ContextPanelState>,
    { kind: "task" } | { kind: "knowledge-tasks" }
  >,
): string {
  if (contextPanel.kind === "document-context") return "Документ";
  if (contextPanel.kind === "canvas-inspector") return "Инспектор";
  if (contextPanel.kind === "inbox-item") return "Захват";
  return "AI";
}

function renderContextPanelContent(
  state: DesktopPrototypeState,
  dispatch: Dispatch,
  contextPanel: Exclude<ContextPanelState, null>,
): React.JSX.Element {
  if (contextPanel.kind === "task") {
    const task = getTaskById(state, contextPanel.taskId);
    return task ? (
      <TaskDetailsPanel
        dispatch={dispatch}
        key={task.id}
        state={state}
        task={task}
      />
    ) : (
      <p>Задача не найдена.</p>
    );
  }
  if (contextPanel.kind === "knowledge-tasks") {
    const document = getDocumentById(state, state.selectedDocumentId);
    return document ? (
      <KnowledgeTaskLinkPanel
        dispatch={dispatch}
        document={document}
        state={state}
      />
    ) : (
      <p>Документ не найден.</p>
    );
  }
  if (contextPanel.kind === "knowledge-task-reference") {
    const task = getTaskById(state, contextPanel.taskId);
    return task ? (
      <KnowledgeTaskReferencePanel
        dispatch={dispatch}
        state={state}
        task={task}
      />
    ) : (
      <p>Задача не найдена.</p>
    );
  }
  if (contextPanel.kind === "document-context") {
    const document = getDocumentById(state, contextPanel.documentId);
    return document ? (
      <DocumentContextPanel
        dispatch={dispatch}
        document={document}
        state={state}
      />
    ) : (
      <p>Документ не найден.</p>
    );
  }
  if (contextPanel.kind === "canvas-inspector") {
    const object = getCanvasObjectById(
      state,
      contextPanel.canvasId,
      contextPanel.objectId,
    );
    return object ? (
      <CanvasInspectorPanel
        objectTitle={object.title}
        objectBody={object.body}
      />
    ) : (
      <p>Объект не выбран.</p>
    );
  }
  if (contextPanel.kind === "inbox-item") {
    const item = getInboxItemById(state, contextPanel.itemId);
    return item ? <InboxContextPanel item={item} /> : <p>Захват не найден.</p>;
  }
  return <AiPanel dispatch={dispatch} state={state} />;
}

function KnowledgeTaskLinkPanel({
  document,
  state,
  dispatch,
}: {
  document: PrototypeDocument;
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  const [requestedTaskId, setRequestedTaskId] = useState<string | null>(null);
  const tasks = [...getProjectTasks(state, document.projectId)].sort(
    (first, second) =>
      first.taskListOrder - second.taskListOrder ||
      first.id.localeCompare(second.id),
  );
  const selectedTaskId = tasks.some((task) => task.id === requestedTaskId)
    ? requestedTaskId
    : null;

  return (
    <div className="knowledge-task-link-panel">
      <h2>Задачи</h2>
      <div className="knowledge-task-link-list">
        {tasks.map((task) => {
          const attached = task.linkedDocumentIds.includes(document.id);
          const selected = task.id === selectedTaskId;
          const signalLabel =
            taskSignalOptions.find((option) => option.id === task.signal)
              ?.label ?? "Без сигнала";
          return (
            <div className="knowledge-task-link-item" key={task.id}>
              <button
                aria-pressed={selected}
                className={[
                  "knowledge-task-link-card",
                  selected ? "is-selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setRequestedTaskId(task.id)}
                type="button"
              >
                <span
                  aria-label={`Сигнал: ${signalLabel}`}
                  className={`knowledge-task-signal task-signal-${task.signal}`}
                  role="img"
                  title={signalLabel}
                />
                <strong>{task.title}</strong>
                <svg
                  aria-label={task.starred ? "Важная задача" : "Обычная задача"}
                  className="knowledge-task-star"
                  fill={task.starred ? "#facc15" : "transparent"}
                  role="img"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="m12 2.75 2.78 5.63 6.22.9-4.5 4.39 1.06 6.2L12 16.94l-5.56 2.93 1.06-6.2L3 9.28l6.22-.9L12 2.75Z"
                    stroke="currentColor"
                    strokeLinejoin="round"
                    strokeWidth="1"
                  />
                </svg>
                <small>
                  {attached ? "Статья привязана" : "Статья не привязана"}
                </small>
              </button>
              {selected ? (
                <PrototypeButton
                  className="knowledge-task-link-action"
                  onClick={() =>
                    dispatch({
                      type: attached
                        ? "detach-task-document"
                        : "attach-task-document",
                      taskId: task.id,
                      documentId: document.id,
                    })
                  }
                  variant={attached ? "quiet" : "primary"}
                >
                  {attached ? "Отвязать эту статью" : "+ Привязать эту статью"}
                </PrototypeButton>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KnowledgeTaskReferencePanel({
  task,
  state,
  dispatch,
}: {
  task: PrototypeTask;
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  const attachedDocuments = task.linkedDocumentIds
    .map((documentId) => getDocumentById(state, documentId))
    .filter(
      (document): document is PrototypeDocument => document !== undefined,
    );
  const currentDocument = getDocumentById(state, state.selectedDocumentId);
  const currentDocumentAttached = currentDocument
    ? task.linkedDocumentIds.includes(currentDocument.id)
    : false;

  return (
    <div className="knowledge-task-reference-content">
      <article
        className={`knowledge-task-reference-card task-signal-${task.signal}`}
      >
        <header>
          <strong>{task.title}</strong>
          <svg
            aria-label={task.starred ? "Важная задача" : "Обычная задача"}
            className="knowledge-task-star"
            fill={task.starred ? "#facc15" : "transparent"}
            role="img"
            viewBox="0 0 24 24"
          >
            <path
              d="m12 2.75 2.78 5.63 6.22.9-4.5 4.39 1.06 6.2L12 16.94l-5.56 2.93 1.06-6.2L3 9.28l6.22-.9L12 2.75Z"
              stroke="currentColor"
              strokeLinejoin="round"
              strokeWidth="1"
            />
          </svg>
        </header>
        {task.subtasks.length > 0 ? (
          <section>
            <h3>Подзадачи</h3>
            <ul className="knowledge-task-reference-subtasks">
              {task.subtasks.map((subtask) => (
                <li
                  className={subtask.done ? "is-complete" : ""}
                  key={subtask.id}
                >
                  <span aria-hidden="true">{subtask.done ? "✓" : "○"}</span>
                  <span>{subtask.title}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {task.links.length > 0 ? (
          <section>
            <h3>Ссылки</h3>
            <ul className="knowledge-task-reference-resources">
              {task.links.map((link) => (
                <li key={link.id}>
                  <a href={link.url} rel="noreferrer" target="_blank">
                    {link.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {attachedDocuments.length > 0 ? (
          <section>
            <h3>Статьи</h3>
            <ul className="knowledge-task-reference-resources">
              {attachedDocuments.map((document) => (
                <li key={document.id}>
                  <button
                    onClick={() =>
                      dispatch({
                        type: "select-document",
                        documentId: document.id,
                      })
                    }
                    type="button"
                  >
                    {document.title}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
      {currentDocument ? (
        <PrototypeButton
          className="knowledge-task-reference-action"
          onClick={() =>
            dispatch({
              type: currentDocumentAttached
                ? "detach-task-document"
                : "attach-task-document",
              taskId: task.id,
              documentId: currentDocument.id,
            })
          }
          size="compact"
          variant={currentDocumentAttached ? "quiet" : "primary"}
        >
          {currentDocumentAttached ? "Отвязать статью" : "+ Прикрепить статью"}
        </PrototypeButton>
      ) : null}
      <button
        className="quiet-text-link knowledge-task-reference-back"
        onClick={() =>
          dispatch({ type: "return-to-overview-from-task-article" })
        }
        type="button"
      >
        ← Назад
      </button>
    </div>
  );
}

function TaskDetailsPanel({
  task,
  state,
  dispatch,
}: {
  task: PrototypeTask;
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [subtaskTitleDraft, setSubtaskTitleDraft] = useState("");
  const [openSubtaskMenuId, setOpenSubtaskMenuId] = useState<string | null>(
    null,
  );
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [linkTitleDraft, setLinkTitleDraft] = useState("");
  const [linkUrlDraft, setLinkUrlDraft] = useState("");
  const [articlePickerOpen, setArticlePickerOpen] = useState(false);
  const [articleSearchQuery, setArticleSearchQuery] = useState("");
  const subtaskEditInputRef = useRef<HTMLInputElement>(null);
  const subtaskRenameCancelledRef = useRef(false);
  const attachedDocuments = task.linkedDocumentIds
    .map((documentId) => getDocumentById(state, documentId))
    .filter(
      (document): document is PrototypeDocument =>
        document !== undefined && document.projectId === task.projectId,
    );
  const normalizedArticleQuery = articleSearchQuery.trim().toLocaleLowerCase();
  const availableDocuments = getProjectDocuments(state, task.projectId).filter(
    (document) =>
      !task.linkedDocumentIds.includes(document.id) &&
      (normalizedArticleQuery.length === 0 ||
        document.title.toLocaleLowerCase().includes(normalizedArticleQuery)),
  );

  useEffect(() => {
    if (!editingSubtaskId) return;
    subtaskEditInputRef.current?.focus();
    subtaskEditInputRef.current?.select();
  }, [editingSubtaskId]);

  function addSubtask(): void {
    if (newSubtaskTitle.trim().length === 0) return;
    dispatch({
      type: "add-subtask",
      taskId: task.id,
      title: newSubtaskTitle,
    });
    setNewSubtaskTitle("");
  }

  function startSubtaskRename(subtaskId: string, title: string): void {
    setOpenSubtaskMenuId(null);
    subtaskRenameCancelledRef.current = false;
    setEditingSubtaskId(subtaskId);
    setSubtaskTitleDraft(title);
  }

  function commitSubtaskRename(): void {
    if (!editingSubtaskId) return;
    if (subtaskTitleDraft.trim().length > 0) {
      dispatch({
        type: "rename-subtask",
        taskId: task.id,
        subtaskId: editingSubtaskId,
        title: subtaskTitleDraft,
      });
    }
    setEditingSubtaskId(null);
    setSubtaskTitleDraft("");
  }

  function cancelSubtaskRename(): void {
    setEditingSubtaskId(null);
    setSubtaskTitleDraft("");
  }

  function addTaskLink(): void {
    if (newLinkTitle.trim().length === 0 || !isValidTaskLinkUrl(newLinkUrl)) {
      return;
    }

    dispatch({
      type: "add-task-link",
      taskId: task.id,
      title: newLinkTitle,
      url: newLinkUrl,
    });
    setNewLinkTitle("");
    setNewLinkUrl("");
  }

  function startTaskLinkEdit(linkId: string): void {
    const link = task.links.find((item) => item.id === linkId);
    if (!link) return;
    setEditingLinkId(link.id);
    setLinkTitleDraft(link.title);
    setLinkUrlDraft(link.url);
  }

  function commitTaskLinkEdit(): void {
    if (
      !editingLinkId ||
      linkTitleDraft.trim().length === 0 ||
      !isValidTaskLinkUrl(linkUrlDraft)
    ) {
      return;
    }

    dispatch({
      type: "edit-task-link",
      taskId: task.id,
      linkId: editingLinkId,
      title: linkTitleDraft,
      url: linkUrlDraft,
    });
    setEditingLinkId(null);
    setLinkTitleDraft("");
    setLinkUrlDraft("");
  }

  function cancelTaskLinkEdit(): void {
    setEditingLinkId(null);
    setLinkTitleDraft("");
    setLinkUrlDraft("");
  }

  return (
    <div className="panel-stack">
      <div className="field">
        <textarea
          aria-label="Название"
          onChange={(event) =>
            dispatch({
              type: "edit-task-title",
              taskId: task.id,
              title: event.target.value,
            })
          }
          value={task.title}
        />
      </div>
      <fieldset aria-label="Сигнал задачи" className="task-signal-selector">
        <div className="task-signal-options">
          {taskSignalOptions.map((option) => (
            <label
              className={`task-signal-option task-signal-${option.id}`}
              key={option.id}
              title={option.label}
            >
              <input
                aria-label={option.label}
                checked={task.signal === option.id}
                name={`task-signal-${task.id}`}
                onChange={() =>
                  dispatch({
                    type: "set-task-signal",
                    taskId: task.id,
                    signal: option.id,
                  })
                }
                type="radio"
                value={option.id}
              />
              <span className="task-signal-swatch" aria-hidden="true" />
            </label>
          ))}
        </div>
      </fieldset>
      <ContextPanelSection title="Подзадачи">
        <form
          className="subtask-add-form"
          onSubmit={(event) => {
            event.preventDefault();
            addSubtask();
          }}
        >
          <input
            aria-label="Новая подзадача"
            onChange={(event) => setNewSubtaskTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              addSubtask();
            }}
            placeholder="Новая подзадача"
            value={newSubtaskTitle}
          />
          <IconButton
            icon={<span aria-hidden="true">+</span>}
            label="Добавить подзадачу"
            title="Добавить подзадачу"
            type="submit"
            variant="quiet"
          />
        </form>
        {task.subtasks.length > 0 ? (
          task.subtasks.map((subtask) => (
            <div className="subtask-row" key={subtask.id}>
              <input
                aria-label={subtask.title}
                checked={subtask.done}
                onChange={() =>
                  dispatch({
                    type: "toggle-subtask",
                    taskId: task.id,
                    subtaskId: subtask.id,
                  })
                }
                type="checkbox"
              />
              {editingSubtaskId === subtask.id ? (
                <input
                  aria-label={`Название подзадачи: ${subtask.title}`}
                  className="subtask-title-input"
                  onBlur={() => {
                    if (subtaskRenameCancelledRef.current) {
                      subtaskRenameCancelledRef.current = false;
                      return;
                    }
                    commitSubtaskRename();
                  }}
                  onChange={(event) => setSubtaskTitleDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitSubtaskRename();
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      subtaskRenameCancelledRef.current = true;
                      cancelSubtaskRename();
                    }
                  }}
                  ref={subtaskEditInputRef}
                  value={subtaskTitleDraft}
                />
              ) : (
                <button
                  className="subtask-title-button"
                  onClick={() => startSubtaskRename(subtask.id, subtask.title)}
                  type="button"
                >
                  {subtask.title}
                </button>
              )}
              <div
                className="subtask-actions"
                onKeyDown={(event) => {
                  if (event.key !== "Escape") return;
                  event.preventDefault();
                  event.stopPropagation();
                  setOpenSubtaskMenuId(null);
                }}
              >
                <IconButton
                  aria-expanded={openSubtaskMenuId === subtask.id}
                  aria-haspopup="menu"
                  className="subtask-actions-button"
                  icon={<span aria-hidden="true">⋮</span>}
                  label={`Действия подзадачи: ${subtask.title}`}
                  onClick={() =>
                    setOpenSubtaskMenuId((currentId) =>
                      currentId === subtask.id ? null : subtask.id,
                    )
                  }
                  title={`Действия подзадачи: ${subtask.title}`}
                />
                {openSubtaskMenuId === subtask.id ? (
                  <>
                    <button
                      aria-label="Закрыть меню подзадачи"
                      className="subtask-menu-dismiss"
                      onClick={() => setOpenSubtaskMenuId(null)}
                      tabIndex={-1}
                      type="button"
                    />
                    <div className="subtask-actions-menu" role="menu">
                      <button
                        className="subtask-delete-action"
                        onClick={() => {
                          dispatch({
                            type: "delete-subtask",
                            taskId: task.id,
                            subtaskId: subtask.id,
                          });
                          if (editingSubtaskId === subtask.id) {
                            cancelSubtaskRename();
                          }
                          setOpenSubtaskMenuId(null);
                        }}
                        role="menuitem"
                        type="button"
                      >
                        Удалить подзадачу
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <p>Подзадач пока нет.</p>
        )}
      </ContextPanelSection>
      <ContextPanelSection title="Ссылки">
        <form
          className="task-link-add-form"
          onSubmit={(event) => {
            event.preventDefault();
            addTaskLink();
          }}
        >
          <input
            aria-label="Описание ссылки"
            onChange={(event) => setNewLinkTitle(event.target.value)}
            placeholder="Описание"
            value={newLinkTitle}
          />
          <input
            aria-label="URL ссылки"
            inputMode="url"
            onChange={(event) => setNewLinkUrl(event.target.value)}
            placeholder="https://…"
            type="url"
            value={newLinkUrl}
          />
          <IconButton
            icon={<span aria-hidden="true">+</span>}
            label="Добавить ссылку"
            title="Добавить ссылку"
            type="submit"
            variant="quiet"
          />
        </form>
        {task.links.map((link) =>
          editingLinkId === link.id ? (
            <form
              className="task-link-edit-form"
              key={link.id}
              onSubmit={(event) => {
                event.preventDefault();
                commitTaskLinkEdit();
              }}
            >
              <input
                aria-label={`Описание ссылки: ${link.title}`}
                onChange={(event) => setLinkTitleDraft(event.target.value)}
                value={linkTitleDraft}
              />
              <input
                aria-label={`URL ссылки: ${link.title}`}
                inputMode="url"
                onChange={(event) => setLinkUrlDraft(event.target.value)}
                type="url"
                value={linkUrlDraft}
              />
              <div className="task-link-edit-actions">
                <PrototypeButton size="compact" type="submit" variant="quiet">
                  Сохранить
                </PrototypeButton>
                <PrototypeButton
                  onClick={cancelTaskLinkEdit}
                  size="compact"
                  type="button"
                  variant="quiet"
                >
                  Отмена
                </PrototypeButton>
              </div>
            </form>
          ) : (
            <div className="task-link-row" key={link.id}>
              <a href={link.url} rel="noreferrer" target="_blank">
                {link.title}
              </a>
              <IconButton
                icon={<span aria-hidden="true">✎</span>}
                label={`Изменить ссылку: ${link.title}`}
                onClick={() => startTaskLinkEdit(link.id)}
                title={`Изменить ссылку: ${link.title}`}
                variant="ghost"
              />
              <IconButton
                icon={<span aria-hidden="true">×</span>}
                label={`Удалить ссылку: ${link.title}`}
                onClick={() =>
                  dispatch({
                    type: "delete-task-link",
                    taskId: task.id,
                    linkId: link.id,
                  })
                }
                title={`Удалить ссылку: ${link.title}`}
                variant="ghost"
              />
            </div>
          ),
        )}
      </ContextPanelSection>
      <ContextPanelSection title="Статьи">
        {attachedDocuments.map((document) => (
          <div className="task-article-row" key={document.id}>
            <button
              className="task-article-link"
              onClick={() =>
                dispatch({ type: "select-document", documentId: document.id })
              }
              type="button"
            >
              {document.title}
            </button>
            <IconButton
              icon={<span aria-hidden="true">×</span>}
              label={`Открепить статью: ${document.title}`}
              onClick={() =>
                dispatch({
                  type: "detach-task-document",
                  taskId: task.id,
                  documentId: document.id,
                })
              }
              title={`Открепить статью: ${document.title}`}
              variant="ghost"
            />
          </div>
        ))}
        <PrototypeButton
          aria-expanded={
            state.activeSection === "overview" ? undefined : articlePickerOpen
          }
          onClick={() => {
            if (state.activeSection === "overview") {
              dispatch({
                type: "open-overview-task-article-linker",
                taskId: task.id,
              });
              return;
            }
            setArticlePickerOpen((open) => !open);
          }}
          size="compact"
          variant="quiet"
        >
          + Прикрепить статью
        </PrototypeButton>
        {state.activeSection !== "overview" && articlePickerOpen ? (
          <div className="task-article-picker">
            <input
              aria-label="Поиск статьи"
              onChange={(event) => setArticleSearchQuery(event.target.value)}
              placeholder="Поиск по статьям"
              type="search"
              value={articleSearchQuery}
            />
            <div className="task-article-picker-results">
              {availableDocuments.length > 0 ? (
                availableDocuments.map((document) => (
                  <button
                    key={document.id}
                    onClick={() =>
                      dispatch({
                        type: "attach-task-document",
                        taskId: task.id,
                        documentId: document.id,
                      })
                    }
                    type="button"
                  >
                    {document.title}
                  </button>
                ))
              ) : (
                <p>Нет доступных статей.</p>
              )}
            </div>
          </div>
        ) : null}
      </ContextPanelSection>
      <label className="field">
        Заметки
        <textarea
          onChange={(event) =>
            dispatch({
              type: "set-task-notes",
              taskId: task.id,
              notes: event.target.value,
            })
          }
          rows={5}
          value={task.notes ?? ""}
        />
      </label>
    </div>
  );
}

function DocumentContextPanel({
  dispatch,
  document,
  state,
}: {
  dispatch: Dispatch;
  document: PrototypeDocument;
  state: DesktopPrototypeState;
}): React.JSX.Element {
  const linkedTasks = document.linkedTaskIds
    .map((taskId) => getTaskById(state, taskId))
    .filter((task): task is PrototypeTask => Boolean(task));
  const outgoingLinks = document.content
    .join(" ")
    .match(/\[\[([^\]]+)\]\]/g)
    ?.map((link) => link.slice(2, -2)) ?? ["Правила магии", "Список сцен"];
  const modes: { id: KnowledgeContextMode; label: string }[] = [
    { id: "outline", label: "Структура" },
    { id: "backlinks", label: "Обратные" },
    { id: "outgoing", label: "Исходящие" },
    { id: "tasks", label: "Задачи" },
    { id: "history", label: "История" },
  ];
  return (
    <div className="panel-stack">
      <div
        className="context-mode-tabs"
        role="tablist"
        aria-label="Режим контекста документа"
      >
        {modes.map((mode) => (
          <button
            aria-selected={state.knowledgeContextMode === mode.id}
            className={state.knowledgeContextMode === mode.id ? "active" : ""}
            key={mode.id}
            onClick={() =>
              dispatch({ type: "set-knowledge-context-mode", mode: mode.id })
            }
            role="tab"
            type="button"
          >
            {mode.label}
          </button>
        ))}
      </div>
      {state.knowledgeContextMode === "outline" ? (
        <ContextPanelSection title="Структура">
          <p>{getDocumentBreadcrumb(document)}</p>
          <p>{document.excerpt}</p>
        </ContextPanelSection>
      ) : null}
      {state.knowledgeContextMode === "backlinks" ? (
        <ContextPanelSection title="Обратные ссылки">
          {document.backlinks.map((backlink) => (
            <span className="document-pill" key={backlink}>
              {backlink}
            </span>
          ))}
        </ContextPanelSection>
      ) : null}
      {state.knowledgeContextMode === "outgoing" ? (
        <ContextPanelSection title="Исходящие ссылки">
          {outgoingLinks.map((link) => (
            <span className="document-pill" key={link}>
              {link}
            </span>
          ))}
        </ContextPanelSection>
      ) : null}
      {state.knowledgeContextMode === "tasks" ? (
        <ContextPanelSection title="Связанные задачи">
          {linkedTasks.length > 0 ? (
            linkedTasks.map((task) => <p key={task.id}>{task.title}</p>)
          ) : (
            <p>Связанных mock-задач пока нет.</p>
          )}
        </ContextPanelSection>
      ) : null}
      {state.knowledgeContextMode === "history" ? (
        <ContextPanelSection title="История">
          <p>Сегодня: документ открыт в структурном прототипе shell.</p>
          <p>Вчера: уточнены связи с соседними заметками и задачами.</p>
        </ContextPanelSection>
      ) : null}
    </div>
  );
}

function CanvasInspectorPanel({
  objectTitle,
  objectBody,
}: {
  objectTitle: string;
  objectBody: string;
}): React.JSX.Element {
  return (
    <div className="panel-stack">
      <ContextPanelSection title={objectTitle}>
        <p>{objectBody}</p>
      </ContextPanelSection>
      <ContextPanelSection title="Свойства">
        <p>Тип, позиция и связи показаны как mock-инспектор.</p>
      </ContextPanelSection>
    </div>
  );
}

function InboxContextPanel({
  item,
}: {
  item: PrototypeInboxItem;
}): React.JSX.Element {
  return (
    <div className="panel-stack">
      <ContextPanelSection title={item.title}>
        <p>{item.preview}</p>
      </ContextPanelSection>
      <ContextPanelSection title="Источник">
        <p>
          {item.source} · {item.capturedAt}
        </p>
      </ContextPanelSection>
    </div>
  );
}

function AiPanel({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  return (
    <div className="panel-stack">
      <ContextPanelSection title="Текущий контекст">
        <p>{getAiContextLabel(state)}</p>
      </ContextPanelSection>
      <ContextPanelSection title="Предложения">
        {aiProposals.map((proposal) => (
          <label className="proposal-row" key={proposal.id}>
            <input
              checked={state.selectedAiProposalIds.includes(proposal.id)}
              onChange={() =>
                dispatch({
                  type: "toggle-ai-proposal",
                  proposalId: proposal.id,
                })
              }
              type="checkbox"
            />
            <span>
              <strong>{proposal.title}</strong>
              <small>{proposal.description}</small>
            </span>
          </label>
        ))}
      </ContextPanelSection>
      <PrototypeButton
        disabled={state.selectedAiProposalIds.length === 0}
        onClick={() => dispatch({ type: "confirm-ai-proposals" })}
        variant="primary"
      >
        Применить выбранное
      </PrototypeButton>
      {state.aiActivityLog.length > 0 ? (
        <ContextPanelSection title="Журнал">
          {state.aiActivityLog.map((entry) => (
            <p key={entry}>{entry}</p>
          ))}
        </ContextPanelSection>
      ) : null}
    </div>
  );
}

function CommandPalette({
  activeIndex,
  activeProjectName,
  onActivate,
  onClose,
  onIndexChange,
  onQueryChange,
  query,
  results,
}: {
  activeIndex: number;
  activeProjectName: string;
  onActivate: (result: CommandResult) => void;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  onQueryChange: (query: string) => void;
  query: string;
  results: CommandResult[];
}): React.JSX.Element {
  const boundedActiveIndex = Math.min(
    activeIndex,
    Math.max(results.length - 1, 0),
  );
  return (
    <div className="command-backdrop" role="presentation">
      <section className="command-palette" aria-label="Командная палитра">
        <label>
          <span>Поиск</span>
          <input
            autoFocus
            onChange={(event) => {
              onIndexChange(0);
              onQueryChange(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                onIndexChange(
                  Math.min(boundedActiveIndex + 1, results.length - 1),
                );
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                onIndexChange(Math.max(boundedActiveIndex - 1, 0));
              }
              if (event.key === "Enter" && results[boundedActiveIndex]) {
                event.preventDefault();
                onActivate(results[boundedActiveIndex]);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              }
            }}
            placeholder={`${activeProjectName}: проект, раздел, задача, документ или холст`}
            value={query}
          />
          <button onClick={onClose} type="button">
            Закрыть
          </button>
        </label>
        <div className="command-results">
          {results.length > 0 ? (
            results.map((result, index) => (
              <button
                className={index === boundedActiveIndex ? "active" : ""}
                key={`${result.kind}-${result.id}`}
                onClick={() => onActivate(result)}
                onMouseEnter={() => onIndexChange(index)}
                type="button"
              >
                <span>{commandKindLabels[result.kind]}</span>
                <strong>{result.title}</strong>
                <small>{result.subtitle}</small>
              </button>
            ))
          ) : (
            <p className="empty-state">Ничего не найдено.</p>
          )}
        </div>
        <footer>↑↓ выбрать · Enter открыть · Esc закрыть</footer>
      </section>
    </div>
  );
}
