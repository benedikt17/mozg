"use client";

import {
  useCallback,
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
  getDocumentFolderPath,
  getInboxItemById,
  getKnowledgePaneState,
  getKnowledgeTree,
  getOpenDocuments,
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
  type KnowledgeTreeNode,
} from "@/prototype/desktop-state";
import { OverviewWorkspace } from "@/prototype/overview";
import {
  ContextPanelSection,
  IconButton,
  MetadataLine,
  PrototypeButton,
  ToolSidebarItem,
  WorkspaceHeader,
} from "@/prototype/desktop-ui";
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
      <ProjectRail state={state} dispatch={dispatch} />
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

function ProjectRail({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  return (
    <aside
      className="project-rail"
      aria-label="Проекты"
      data-collapsed={state.projectRailCollapsed}
    >
      <div className="rail-brand">
        <div className="rail-brand-identity">
          <span className="rail-brand-mark">M</span>
          <strong>mozg</strong>
        </div>
        <IconButton
          className="rail-collapse-control"
          icon={
            <UiIcon
              name={state.projectRailCollapsed ? "panel-right" : "panel-left"}
            />
          }
          label={
            state.projectRailCollapsed
              ? "Развернуть панель проектов"
              : "Свернуть панель проектов"
          }
          onClick={() => dispatch({ type: "toggle-project-rail" })}
          title={
            state.projectRailCollapsed
              ? "Развернуть панель проектов"
              : "Свернуть панель проектов"
          }
          variant="ghost"
        />
      </div>
      <nav className="project-list" aria-label="Выбор проекта">
        {state.projects.map((project) => (
          <PrototypeButton
            active={project.id === state.activeProjectId}
            aria-label={project.name}
            className="project-row"
            key={project.id}
            onClick={() =>
              dispatch({ type: "switch-project", projectId: project.id })
            }
            title={project.description}
            variant="ghost"
          >
            <span className="project-row-indicator" />
            <span className="project-row-mark" aria-hidden="true">
              {project.shortName.slice(0, 1)}
            </span>
            <strong>{project.name}</strong>
          </PrototypeButton>
        ))}
      </nav>
      <PrototypeButton
        aria-label="Создать проект"
        className="create-project"
        onClick={() => dispatch({ type: "create-project" })}
        title="Создать проект"
        variant="quiet"
      >
        <span aria-hidden="true">+</span>
        <span className="create-project-label">Создать проект</span>
      </PrototypeButton>
    </aside>
  );
}

function ApplicationHeader({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  const activeProject = getActiveProject(state);
  const usesLargeProjectTitle =
    state.activeSection === "overview" ||
    state.activeSection === "knowledge" ||
    state.activeSection === "tasks";
  return (
    <header
      className={
        usesLargeProjectTitle
          ? "application-header knowledge-application-header"
          : "application-header"
      }
    >
      <div className="header-project">
        <strong>{activeProject.name}</strong>
        {!usesLargeProjectTitle ? (
          <MetadataLine>{activeProject.description}</MetadataLine>
        ) : null}
      </div>
      <nav className="section-navigation" aria-label="Разделы проекта">
        {projectSections.map((section) => (
          <PrototypeButton
            active={state.activeSection === section.id}
            className="section-nav-item"
            key={section.id}
            onClick={() =>
              dispatch({ type: "switch-section", section: section.id })
            }
            title={section.description}
            variant="ghost"
          >
            {section.label}
          </PrototypeButton>
        ))}
      </nav>
      <div className="header-tools" aria-label="Глобальные инструменты">
        <PrototypeButton
          onClick={() => dispatch({ type: "open-command-palette" })}
          variant="quiet"
        >
          Поиск
        </PrototypeButton>
        <PrototypeButton
          active={state.contextPanel?.kind === "ai"}
          onClick={() => dispatch({ type: "open-ai-panel" })}
          variant="quiet"
        >
          AI
        </PrototypeButton>
        <PrototypeButton variant="quiet">Профиль</PrototypeButton>
      </div>
    </header>
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

function KnowledgeSidebar({
  state,
  dispatch,
  onClose,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
  onClose?: () => void;
}): React.JSX.Element {
  const tree = getKnowledgeTree(state);
  const treeRef = useRef<HTMLElement>(null);
  const [knowledgeDropTarget, setKnowledgeDropTarget] =
    useState<KnowledgeDropTarget>(null);
  const [revealDocumentId, setRevealDocumentId] = useState<string | null>(null);
  const treeCollapsed = state.knowledgeExpandedBeforeCollapse !== null;

  useEffect(() => {
    if (!revealDocumentId) return;
    const frame = window.requestAnimationFrame(() => {
      treeRef.current
        ?.querySelector<HTMLElement>(
          `[data-knowledge-document-id="${revealDocumentId}"]`,
        )
        ?.scrollIntoView({ block: "nearest" });
      setRevealDocumentId(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [revealDocumentId, state.expandedFolderIds]);

  return (
    <aside
      className="tool-sidebar knowledge-sidebar"
      aria-label="Дерево документов"
    >
      <header className="knowledge-sidebar-header">
        <div
          className="knowledge-toolbar"
          aria-label="Действия с деревом документов"
        >
          <IconButton
            icon={<UiIcon name="file-plus" />}
            label="Создать документ"
            onClick={() => dispatch({ type: "create-knowledge-document" })}
            title="Создать документ"
            variant="ghost"
          />
          <IconButton
            icon={<UiIcon name="folder-plus" />}
            label="Создать папку"
            onClick={() => dispatch({ type: "create-knowledge-folder" })}
            title="Создать папку"
            variant="ghost"
          />
          <IconButton
            disabled={!state.selectedDocumentId}
            icon={<UiIcon name="locate" />}
            label="Показать текущий документ в дереве"
            onClick={() => {
              if (!state.selectedDocumentId) return;
              dispatch({ type: "reveal-current-knowledge-document" });
              setRevealDocumentId(state.selectedDocumentId);
            }}
            title="Показать текущий документ в дереве"
            variant="ghost"
          />
          <IconButton
            icon={<UiIcon name={treeCollapsed ? "expand" : "collapse"} />}
            label={treeCollapsed ? "Восстановить папки" : "Свернуть все папки"}
            onClick={() => dispatch({ type: "toggle-all-knowledge-folders" })}
            title={treeCollapsed ? "Восстановить папки" : "Свернуть все папки"}
            variant="ghost"
          />
        </div>
        <IconButton
          className="knowledge-responsive-close"
          icon={<UiIcon name="close" />}
          label="Закрыть дерево документов"
          onClick={onClose}
          title="Закрыть дерево документов"
          variant="ghost"
        />
      </header>
      <div className="knowledge-search">
        <input
          aria-label="Поиск по проекту"
          onChange={(event) =>
            dispatch({
              type: "set-knowledge-search",
              query: event.target.value,
            })
          }
          placeholder="Документ, папка или связь"
          value={state.knowledgeSearchQuery}
        />
      </div>
      <nav
        className="knowledge-tree"
        aria-label="Иерархия документов"
        ref={treeRef}
      >
        {tree.length > 0 ? (
          tree.map((node) => (
            <KnowledgeTreeNodeView
              dispatch={dispatch}
              dropTarget={knowledgeDropTarget}
              key={node.id}
              node={node}
              onDropTargetChange={setKnowledgeDropTarget}
              state={state}
            />
          ))
        ) : (
          <p className="empty-state">Ничего не найдено.</p>
        )}
      </nav>
    </aside>
  );
}

type KnowledgeDropTarget =
  | { kind: "folder"; id: string }
  | { kind: "document"; id: string; position: "before" | "after" }
  | null;

const knowledgeDocumentDragType = "application/x-mozg-knowledge-document";

function KnowledgeTreeNodeView({
  node,
  state,
  dispatch,
  dropTarget,
  onDropTargetChange,
}: {
  node: KnowledgeTreeNode;
  state: DesktopPrototypeState;
  dispatch: Dispatch;
  dropTarget: KnowledgeDropTarget;
  onDropTargetChange: (target: KnowledgeDropTarget) => void;
}): React.JSX.Element {
  const depth = Math.max(node.path.length - 1, 0);

  if (node.kind === "folder") {
    const expanded =
      state.knowledgeSearchQuery.trim().length > 0 ||
      state.expandedFolderIds.includes(node.id);
    const editing = state.editingKnowledgeFolderId === node.id;
    return (
      <div className="knowledge-tree-branch">
        <button
          aria-expanded={expanded}
          className={[
            "knowledge-tree-row",
            "folder",
            state.selectedKnowledgeFolderPath?.join("/") === node.path.join("/")
              ? "is-selected-folder"
              : "",
            dropTarget?.kind === "folder" && dropTarget.id === node.id
              ? "is-drop-target"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = "move";
            onDropTargetChange({ kind: "folder", id: node.id });
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const documentId = event.dataTransfer.getData(
              knowledgeDocumentDragType,
            );
            onDropTargetChange(null);
            if (!documentId) return;
            dispatch({
              type: "move-knowledge-document",
              documentId,
              targetFolderPath: node.path,
              position: "end",
            });
          }}
          onClick={() =>
            dispatch({
              type: "toggle-knowledge-folder",
              folderId: node.id,
              path: node.path,
            })
          }
          style={treeDepthStyle(depth)}
          title={node.path.join(" / ")}
          type="button"
        >
          <UiIcon name={expanded ? "chevron-down" : "chevron-right"} />
          <UiIcon name={expanded ? "folder-open" : "folder"} />
          {editing ? (
            <KnowledgeFolderTitleEditor
              dispatch={dispatch}
              folderId={node.id}
              title={node.title}
            />
          ) : (
            <span>{node.title}</span>
          )}
        </button>
        {expanded ? (
          <div className="knowledge-tree-children">
            {node.children.map((child) => (
              <KnowledgeTreeNodeView
                dispatch={dispatch}
                dropTarget={dropTarget}
                key={child.id}
                node={child}
                onDropTargetChange={onDropTargetChange}
                state={state}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <button
      className={[
        "knowledge-tree-row",
        "document",
        state.selectedDocumentId === node.document.id ? "is-active" : "",
        dropTarget?.kind === "document" && dropTarget.id === node.document.id
          ? `drop-${dropTarget.position}`
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-knowledge-document-id={node.document.id}
      draggable
      onDragEnd={() => onDropTargetChange(null)}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        const bounds = event.currentTarget.getBoundingClientRect();
        const position =
          event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
        onDropTargetChange({
          kind: "document",
          id: node.document.id,
          position,
        });
      }}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(knowledgeDocumentDragType, node.document.id);
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const documentId = event.dataTransfer.getData(
          knowledgeDocumentDragType,
        );
        const position =
          dropTarget?.kind === "document" && dropTarget.id === node.document.id
            ? dropTarget.position
            : "before";
        onDropTargetChange(null);
        if (!documentId) return;
        dispatch({
          type: "move-knowledge-document",
          documentId,
          targetFolderPath: getDocumentFolderPath(node.document),
          targetDocumentId: node.document.id,
          position,
        });
      }}
      onClick={() =>
        dispatch({ type: "select-document", documentId: node.document.id })
      }
      style={treeDepthStyle(depth)}
      title={getDocumentBreadcrumb(node.document)}
      type="button"
    >
      <span className="tree-disclosure-spacer" />
      <UiIcon name="file" />
      <span>{node.title}</span>
    </button>
  );
}

function KnowledgeFolderTitleEditor({
  dispatch,
  folderId,
  title,
}: {
  dispatch: Dispatch;
  folderId: string;
  title: string;
}): React.JSX.Element {
  const [draft, setDraft] = useState(title);

  return (
    <input
      aria-label="Название папки"
      autoFocus
      className="knowledge-folder-title-input"
      onBlur={() =>
        dispatch({
          type: "rename-knowledge-folder",
          folderId,
          title: draft,
        })
      }
      onChange={(event) => setDraft(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          event.preventDefault();
          dispatch({ type: "finish-editing-knowledge-folder" });
        }
      }}
      value={draft}
    />
  );
}

function KnowledgeWorkspace({
  state,
  dispatch,
  onOpenTree,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
  onOpenTree?: () => void;
}): React.JSX.Element {
  const {
    primaryDocument: selectedDocument,
    secondaryDocument: splitDocument,
    activePane,
    activeDocument,
  } = getKnowledgePaneState(state);
  const activePaneDocumentId = activeDocument?.id ?? "";
  const openTabs = getOpenDocuments(state);
  const editingDocumentId = state.editingKnowledgeDocumentId;

  const activatePane = (pane: "primary" | "secondary"): void => {
    dispatch({ type: "activate-knowledge-pane", pane });
  };

  if (!selectedDocument) {
    return <EmptySection title="Знания" />;
  }

  return (
    <div className="document-workspace">
      <div className="document-tabs-row">
        <div
          className="document-tabs"
          role="tablist"
          aria-label="Открытые документы"
        >
          {openTabs.map((document) => (
            <div
              className={[
                "document-tab-item",
                document.id === selectedDocument.id ? "active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={document.id}
            >
              <button
                aria-selected={document.id === selectedDocument.id}
                className="document-tab-activate"
                onClick={() =>
                  dispatch({
                    type: "activate-document-tab",
                    documentId: document.id,
                  })
                }
                role="tab"
                type="button"
              >
                <span>{document.title}</span>
                {document.id === "doc-l-magic" ? (
                  <span
                    className="tab-unsaved"
                    aria-label="Есть несохранённые mock-правки"
                  />
                ) : null}
              </button>
              <IconButton
                className="tab-close"
                icon={<UiIcon name="close" />}
                label={`Закрыть ${document.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  dispatch({
                    type: "close-document-tab",
                    documentId: document.id,
                  });
                }}
                title={`Закрыть ${document.title}`}
                variant="ghost"
              />
            </div>
          ))}
          <button
            className="document-tab-add"
            onClick={() => dispatch({ type: "create-knowledge-document" })}
            type="button"
            title="Создать документ"
            aria-label="Создать документ"
          >
            <UiIcon name="plus" />
          </button>
        </div>
        <div className="document-actions">
          <div className="knowledge-responsive-actions">
            <PrototypeButton
              onClick={onOpenTree}
              size="compact"
              variant="quiet"
            >
              Дерево
            </PrototypeButton>
          </div>
          <IconButton
            active={editingDocumentId === activePaneDocumentId}
            icon={
              <UiIcon
                name={
                  editingDocumentId === activePaneDocumentId ? "eye" : "pencil"
                }
              />
            }
            label={
              editingDocumentId === activePaneDocumentId
                ? "Перейти в режим чтения"
                : "Редактировать Markdown"
            }
            onClick={() =>
              dispatch({
                type: "toggle-knowledge-document-edit",
                documentId: activePaneDocumentId,
              })
            }
            title={
              editingDocumentId === activePaneDocumentId
                ? "Режим чтения"
                : "Редактировать Markdown"
            }
            variant="quiet"
          />
          <PrototypeButton
            active={state.contextPanel?.kind === "knowledge-tasks"}
            onClick={() => dispatch({ type: "open-knowledge-task-linker" })}
            size="compact"
            variant="quiet"
          >
            Задачи
          </PrototypeButton>
          <PrototypeButton
            active={selectedDocument.isKeyDocument === true}
            onClick={() =>
              dispatch({
                type: "toggle-key-document",
                documentId: selectedDocument.id,
              })
            }
            size="compact"
            title="Добавить или убрать из ключевых документов проекта"
            variant="quiet"
          >
            <UiIcon name="pin" />
            Ключевой
          </PrototypeButton>
          <PrototypeButton
            active={Boolean(state.splitViewDocumentId)}
            onClick={() => dispatch({ type: "toggle-knowledge-split-view" })}
            size="compact"
            variant="quiet"
          >
            Split
          </PrototypeButton>
          <PrototypeButton
            active={state.contextPanel?.kind === "document-context"}
            onClick={() =>
              dispatch({
                type: "open-document-context",
                documentId: selectedDocument.id,
              })
            }
            size="compact"
            variant="quiet"
          >
            Контекст
          </PrototypeButton>
          <PrototypeButton
            active={state.contextPanel?.kind === "ai"}
            onClick={() => dispatch({ type: "open-ai-panel" })}
            size="compact"
            variant="quiet"
          >
            AI
          </PrototypeButton>
        </div>
      </div>
      <div
        className={
          splitDocument ? "document-body is-split-view" : "document-body"
        }
      >
        {splitDocument ? null : <DocumentOutline document={selectedDocument} />}
        <div
          className={`document-breadcrumb-row is-primary ${
            activePane === "primary" ? "is-active" : ""
          }`}
        >
          {getDocumentBreadcrumb(selectedDocument)}
        </div>
        {splitDocument ? (
          <div
            className={`document-breadcrumb-row is-secondary ${
              activePane === "secondary" ? "is-active" : ""
            }`}
          >
            {getDocumentBreadcrumb(splitDocument)}
          </div>
        ) : null}
        {splitDocument ? (
          <div
            aria-label="Выбор документа Split"
            className="knowledge-split-switcher"
            role="tablist"
          >
            <button
              aria-selected={activePane === "primary"}
              className={activePane === "primary" ? "active" : ""}
              onClick={() => activatePane("primary")}
              role="tab"
              type="button"
            >
              Левый: {selectedDocument.title}
            </button>
            <button
              aria-selected={activePane === "secondary"}
              className={activePane === "secondary" ? "active" : ""}
              onClick={() => activatePane("secondary")}
              role="tab"
              type="button"
            >
              Правый: {splitDocument.title}
            </button>
          </div>
        ) : null}
        <div
          className={[
            "document-editor-surface",
            splitDocument ? "is-split-view" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <DocumentArticle
            active={activePane === "primary"}
            dispatch={dispatch}
            document={selectedDocument}
            editing={editingDocumentId === selectedDocument.id}
            onActivate={() => activatePane("primary")}
          />
          {splitDocument ? (
            <DocumentArticle
              active={activePane === "secondary"}
              dispatch={dispatch}
              document={splitDocument}
              editing={editingDocumentId === splitDocument.id}
              onActivate={() => activatePane("secondary")}
              secondary
            />
          ) : null}
        </div>
      </div>
      <footer className="workspace-footer">
        <PrototypeButton
          onClick={() =>
            dispatch({
              type: "open-document-context",
              documentId: selectedDocument.id,
            })
          }
          variant="quiet"
        >
          Открыть контекст документа
        </PrototypeButton>
        <PrototypeButton
          onClick={() => dispatch({ type: "open-ai-panel" })}
          variant="quiet"
        >
          AI по документу
        </PrototypeButton>
      </footer>
    </div>
  );
}

type DocumentHeading = {
  id: string;
  label: string;
  level: 1 | 2 | 3;
};

function getDocumentHeadings(document: PrototypeDocument): DocumentHeading[] {
  return document.content.flatMap((line, index) => {
    const match = /^(#{1,3})\s+(.+)$/.exec(line);
    if (!match) return [];
    const level = match[1]?.length;
    return [
      {
        id: `document-${document.id}-heading-${index}`,
        label: match[2] ?? line,
        level: level === 3 ? 3 : level === 2 ? 2 : 1,
      } satisfies DocumentHeading,
    ];
  });
}

function DocumentOutline({
  document,
}: {
  document: PrototypeDocument;
}): React.JSX.Element {
  const headings = getDocumentHeadings(document);
  return (
    <aside className="document-outline" aria-label="Навигация по статье">
      <nav>
        {headings.map((heading) => (
          <button
            className={`level-${heading.level}`}
            key={heading.id}
            onClick={() =>
              window.document
                .getElementById(heading.id)
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            type="button"
          >
            {heading.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

function DocumentArticle({
  document,
  secondary = false,
  active,
  editing,
  dispatch,
  onActivate,
}: {
  document: PrototypeDocument;
  secondary?: boolean;
  active: boolean;
  editing: boolean;
  dispatch: Dispatch;
  onActivate: () => void;
}): React.JSX.Element {
  return (
    <article
      className={[
        "document-page",
        secondary ? "secondary" : "",
        active ? "is-active-pane" : "",
        editing ? "is-editing" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onPointerDown={onActivate}
    >
      <div className="document-page-inner">
        {editing ? (
          <MarkdownSourceEditor
            dispatch={dispatch}
            document={document}
            key={document.id}
          />
        ) : (
          <MarkdownDocumentPreview document={document} />
        )}
      </div>
    </article>
  );
}

type MarkdownEditAction =
  | "undo"
  | "redo"
  | "h1"
  | "h2"
  | "h3"
  | "bold"
  | "italic"
  | "strike"
  | "inline-code"
  | "link"
  | "bullet"
  | "numbered"
  | "checklist"
  | "quote"
  | "code-block"
  | "horizontal-rule";

const markdownToolbarActions: Array<{
  action: MarkdownEditAction;
  label: string;
  title: string;
}> = [
  { action: "undo", label: "↶", title: "Отменить" },
  { action: "redo", label: "↷", title: "Повторить" },
  { action: "h1", label: "H1", title: "Заголовок 1" },
  { action: "h2", label: "H2", title: "Заголовок 2" },
  { action: "h3", label: "H3", title: "Заголовок 3" },
  { action: "bold", label: "B", title: "Жирный" },
  { action: "italic", label: "I", title: "Курсив" },
  { action: "strike", label: "S", title: "Зачёркнутый" },
  { action: "inline-code", label: "`", title: "Встроенный код" },
  { action: "link", label: "↗", title: "Ссылка" },
  { action: "bullet", label: "•", title: "Маркированный список" },
  { action: "numbered", label: "1.", title: "Нумерованный список" },
  { action: "checklist", label: "☐", title: "Чек-лист" },
  { action: "quote", label: "❯", title: "Цитата" },
  { action: "code-block", label: "{}", title: "Блок кода" },
  { action: "horizontal-rule", label: "—", title: "Горизонтальная линия" },
];

function MarkdownSourceEditor({
  document,
  dispatch,
}: {
  document: PrototypeDocument;
  dispatch: Dispatch;
}): React.JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const markdown = document.content.join("\n");
  const historyRef = useRef<string[]>([markdown]);
  const historyIndexRef = useRef(0);
  const mountTextarea = useCallback((textarea: HTMLTextAreaElement | null) => {
    textareaRef.current = textarea;
    textarea?.focus({ preventScroll: true });
  }, []);

  const updateMarkdown = (nextMarkdown: string, addToHistory = true): void => {
    if (addToHistory) {
      const history = historyRef.current.slice(0, historyIndexRef.current + 1);
      if (history[history.length - 1] !== nextMarkdown) {
        history.push(nextMarkdown);
        historyRef.current = history;
        historyIndexRef.current = history.length - 1;
      }
    }
    dispatch({
      type: "update-knowledge-document-markdown",
      documentId: document.id,
      markdown: nextMarkdown,
    });
  };

  const restoreSelection = (start: number, end = start): void => {
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus({ preventScroll: true });
      textareaRef.current?.setSelectionRange(start, end);
    });
  };

  const replaceSelection = (
    replacement: string,
    selectionStart: number,
    selectionEnd: number,
  ): void => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const next =
      markdown.slice(0, textarea.selectionStart) +
      replacement +
      markdown.slice(textarea.selectionEnd);
    updateMarkdown(next);
    restoreSelection(selectionStart, selectionEnd);
  };

  const wrapSelection = (
    before: string,
    after: string,
    placeholder: string,
  ): void => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const selected = markdown.slice(
      textarea.selectionStart,
      textarea.selectionEnd,
    );
    const content = selected || placeholder;
    const replacement = `${before}${content}${after}`;
    const start = textarea.selectionStart + before.length;
    replaceSelection(replacement, start, start + content.length);
  };

  const prefixSelectedLines = (
    prefixForLine: (line: string, index: number) => string,
  ): void => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const lineStart =
      markdown.lastIndexOf("\n", textarea.selectionStart - 1) + 1;
    const nextLineBreak = markdown.indexOf("\n", textarea.selectionEnd);
    const lineEnd = nextLineBreak === -1 ? markdown.length : nextLineBreak;
    const replacement = markdown
      .slice(lineStart, lineEnd)
      .split("\n")
      .map(prefixForLine)
      .join("\n");
    const next =
      markdown.slice(0, lineStart) + replacement + markdown.slice(lineEnd);
    updateMarkdown(next);
    restoreSelection(lineStart, lineStart + replacement.length);
  };

  const applyAction = (action: MarkdownEditAction): void => {
    if (action === "undo") {
      if (historyIndexRef.current === 0) return;
      historyIndexRef.current -= 1;
      const previous = historyRef.current[historyIndexRef.current] ?? "";
      updateMarkdown(previous, false);
      return;
    }
    if (action === "redo") {
      if (historyIndexRef.current >= historyRef.current.length - 1) return;
      historyIndexRef.current += 1;
      const next = historyRef.current[historyIndexRef.current] ?? "";
      updateMarkdown(next, false);
      return;
    }
    if (action === "h1" || action === "h2" || action === "h3") {
      const level = Number(action.slice(1));
      prefixSelectedLines(
        (line) => `${"#".repeat(level)} ${line.replace(/^#{1,6}\s+/, "")}`,
      );
      return;
    }
    if (action === "bullet") {
      prefixSelectedLines((line) => `- ${line.replace(/^[-*+]\s+/, "")}`);
      return;
    }
    if (action === "numbered") {
      prefixSelectedLines(
        (line, index) => `${index + 1}. ${line.replace(/^\d+\.\s+/, "")}`,
      );
      return;
    }
    if (action === "checklist") {
      prefixSelectedLines(
        (line) => `- [ ] ${line.replace(/^- \[[ x]\]\s+/, "")}`,
      );
      return;
    }
    if (action === "quote") {
      prefixSelectedLines((line) => `> ${line.replace(/^>\s+/, "")}`);
      return;
    }
    if (action === "bold") wrapSelection("**", "**", "текст");
    if (action === "italic") wrapSelection("*", "*", "текст");
    if (action === "strike") wrapSelection("~~", "~~", "текст");
    if (action === "inline-code") wrapSelection("`", "`", "код");
    if (action === "link") wrapSelection("[", "](https://)", "ссылка");
    if (action === "code-block") wrapSelection("```\n", "\n```", "код");
    if (action === "horizontal-rule") {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const prefix = textarea.selectionStart > 0 ? "\n" : "";
      replaceSelection(
        `${prefix}---\n`,
        textarea.selectionStart + prefix.length + 4,
        textarea.selectionStart + prefix.length + 4,
      );
    }
  };

  return (
    <div className="markdown-source-editor">
      <div className="markdown-toolbar" aria-label="Форматирование Markdown">
        {markdownToolbarActions.map((item) => (
          <button
            aria-label={item.title}
            className="markdown-toolbar-button"
            key={item.action}
            onClick={() => applyAction(item.action)}
            onMouseDown={(event) => event.preventDefault()}
            title={item.title}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
      <textarea
        aria-label={`Markdown: ${document.title}`}
        className="markdown-source-textarea"
        onChange={(event) => updateMarkdown(event.target.value)}
        ref={mountTextarea}
        spellCheck
        value={markdown}
      />
    </div>
  );
}

function MarkdownDocumentPreview({
  document,
  hideLeadingTitle = false,
}: {
  document: PrototypeDocument;
  hideLeadingTitle?: boolean;
}): React.JSX.Element {
  const headings = getDocumentHeadings(document);
  const blocks: React.ReactNode[] = [];
  const firstContentIndex =
    hideLeadingTitle && document.content[0]?.trim() === `# ${document.title}`
      ? 1
      : 0;
  for (
    let index = firstContentIndex;
    index < document.content.length;
    index += 1
  ) {
    const line = document.content[index] ?? "";
    if (line.startsWith("```")) {
      const code: string[] = [];
      let codeIndex = index + 1;
      while (
        codeIndex < document.content.length &&
        !(document.content[codeIndex] ?? "").startsWith("```")
      ) {
        code.push(document.content[codeIndex] ?? "");
        codeIndex += 1;
      }
      blocks.push(
        <pre className="document-code-block" key={`${document.id}-${index}`}>
          <code>{code.join("\n")}</code>
        </pre>,
      );
      index = codeIndex;
      continue;
    }
    const heading = headings.find(
      (item) => item.id === `document-${document.id}-heading-${index}`,
    );
    blocks.push(
      <MarkdownPreviewBlock
        anchorId={heading?.id}
        key={`${document.id}-${index}`}
        line={line}
      />,
    );
  }
  return <>{blocks}</>;
}

function MarkdownPreviewBlock({
  line,
  anchorId,
}: {
  line: string;
  anchorId?: string;
}): React.JSX.Element {
  if (line === "---") return <hr />;
  if (line.startsWith("# "))
    return <h1 id={anchorId}>{renderInlineMarkdown(line.slice(2))}</h1>;
  if (line.startsWith("## "))
    return <h2 id={anchorId}>{renderInlineMarkdown(line.slice(3))}</h2>;
  if (line.startsWith("### "))
    return <h3 id={anchorId}>{renderInlineMarkdown(line.slice(4))}</h3>;
  const checklist = /^- \[([ x])\]\s+(.+)$/.exec(line);
  if (checklist) {
    return (
      <p className="document-list-item document-checklist-item">
        <input
          aria-label="Состояние пункта"
          checked={checklist[1] === "x"}
          disabled
          type="checkbox"
        />
        <span>{renderInlineMarkdown(checklist[2] ?? "")}</span>
      </p>
    );
  }
  if (line.startsWith("- "))
    return (
      <p className="document-list-item">
        • {renderInlineMarkdown(line.slice(2))}
      </p>
    );
  if (/^\d+\.\s/.test(line))
    return <p className="document-list-item">{renderInlineMarkdown(line)}</p>;
  if (line.startsWith("> "))
    return <blockquote>{renderInlineMarkdown(line.slice(2))}</blockquote>;
  return <p>{renderInlineMarkdown(line)}</p>;
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const tokenPattern =
    /(\*\*[^*\n]+\*\*|~~[^~\n]+~~|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)|\*[^*\n]+\*)/g;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let match = tokenPattern.exec(text);
  while (match) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const token = match[0];
    const key = `${match.index}-${token}`;
    if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("~~")) {
      nodes.push(<del key={key}>{token.slice(2, -2)}</del>);
    } else if (token.startsWith("`")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("[")) {
      const link = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/.exec(token);
      nodes.push(
        link ? (
          <a href={link[2]} key={key} rel="noreferrer" target="_blank">
            {link[1]}
          </a>
        ) : (
          token
        ),
      );
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    cursor = match.index + token.length;
    match = tokenPattern.exec(text);
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
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
  const selectedFolder = getProjectTaskFolders(state).find(
    (folder) => folder.id === state.selectedTaskFolderId,
  );
  const selectedDirection = getProjectOverviewDirections(state).find(
    (direction) => direction.id === state.selectedTaskDirectionId,
  );
  const activeListTitle = selectedFolder
    ? selectedFolder.title
    : selectedDirection
      ? selectedDirection.title
      : state.taskDayViewActive
        ? "Задачи на день"
        : state.taskFilter === "important"
          ? "Важные"
          : state.taskFilter === "completed"
            ? "Завершённые"
            : "Все";

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
      <WorkspaceHeader title={activeListTitle} />
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
      <header className="canvas-toolbar">
        <div>
          <span>Холст</span>
          <h1>{canvas.title}</h1>
        </div>
        <div>
          <button type="button">−</button>
          <button type="button">100%</button>
          <button type="button">+</button>
        </div>
      </header>
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
      <WorkspaceHeader
        description="Структурный макет места, куда попадают быстрые материалы."
        eyebrow="Захваты"
        title="Входящие"
      />
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
            ? "application-wide-overlay knowledge-ai-overlay"
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

type UiIconName =
  | "arrow-left"
  | "arrow-right"
  | "chevron-down"
  | "chevron-right"
  | "close"
  | "collapse"
  | "expand"
  | "eye"
  | "file"
  | "file-plus"
  | "folder"
  | "folder-open"
  | "folder-plus"
  | "locate"
  | "more"
  | "panel-left"
  | "panel-right"
  | "pencil"
  | "pin"
  | "plus"
  | "search"
  | "sort"
  | "trash";

function UiIcon({ name }: { name: UiIconName }): React.JSX.Element {
  const commonProps = {
    "aria-hidden": true,
    className: "ui-icon",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
  } as const;
  const paths: Record<UiIconName, React.ReactNode> = {
    "arrow-left": <path d="M15 18l-6-6 6-6" />,
    "arrow-right": <path d="M9 6l6 6-6 6" />,
    "chevron-down": <path d="M7 10l5 5 5-5" />,
    "chevron-right": <path d="M10 7l5 5-5 5" />,
    close: (
      <>
        <path d="M7 7l10 10" />
        <path d="M17 7L7 17" />
      </>
    ),
    collapse: (
      <>
        <path d="M8 7h8" />
        <path d="M8 12h8" />
        <path d="M8 17h8" />
      </>
    ),
    expand: (
      <>
        <path d="M8 7h8" />
        <path d="M8 12h8" />
        <path d="M8 17h8" />
        <path d="M5 9V5h4" />
        <path d="M19 15v4h-4" />
      </>
    ),
    eye: (
      <>
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    file: (
      <>
        <path d="M7 3h7l4 4v14H7z" />
        <path d="M14 3v5h5" />
      </>
    ),
    "file-plus": (
      <>
        <path d="M7 3h7l4 4v14H7z" />
        <path d="M14 3v5h5" />
        <path d="M10 14h5" />
        <path d="M12.5 11.5v5" />
      </>
    ),
    folder: (
      <>
        <path d="M3 6h7l2 2h9v10.5A2.5 2.5 0 0 1 18.5 21h-13A2.5 2.5 0 0 1 3 18.5z" />
        <path d="M3 9h18" />
      </>
    ),
    "folder-open": (
      <>
        <path d="M3 7h7l2 2h9" />
        <path d="M4 11h17l-2 8H5z" />
      </>
    ),
    "folder-plus": (
      <>
        <path d="M3 6h7l2 2h9v10.5A2.5 2.5 0 0 1 18.5 21h-13A2.5 2.5 0 0 1 3 18.5z" />
        <path d="M10 15h5" />
        <path d="M12.5 12.5v5" />
      </>
    ),
    locate: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v3" />
        <path d="M12 18v3" />
        <path d="M3 12h3" />
        <path d="M18 12h3" />
      </>
    ),
    more: (
      <>
        <path d="M6 12h.01" />
        <path d="M12 12h.01" />
        <path d="M18 12h.01" />
      </>
    ),
    "panel-left": (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 4v16" />
        <path d="M15 9l-3 3 3 3" />
      </>
    ),
    "panel-right": (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 4v16" />
        <path d="M12 9l3 3-3 3" />
      </>
    ),
    pencil: (
      <>
        <path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z" />
        <path d="M14 7l3 3" />
      </>
    ),
    pin: (
      <>
        <path d="M9 4h6l-1 5 3 3H7l3-3z" />
        <path d="M12 12v8" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="6" />
        <path d="M16 16l4 4" />
      </>
    ),
    sort: (
      <>
        <path d="M7 6h10" />
        <path d="M9 12h6" />
        <path d="M11 18h2" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16" />
        <path d="M9 7V4h6v3" />
        <path d="M7 7l1 13h8l1-13" />
        <path d="M10 11v5" />
        <path d="M14 11v5" />
      </>
    ),
  };
  return <svg {...commonProps}>{paths[name]}</svg>;
}

function treeDepthStyle(
  depth: number,
): React.CSSProperties & { "--tree-depth": number } {
  return { "--tree-depth": depth };
}

function EmptySection({ title }: { title: string }): React.JSX.Element {
  return (
    <section className="empty-section">
      <span>{title}</span>
      <h1>Нет mock-данных</h1>
      <p>Этот проект пока показывает только структуру зоны.</p>
    </section>
  );
}
