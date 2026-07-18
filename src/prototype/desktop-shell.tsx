"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  projectSections,
  type ProjectSection,
  type PrototypeDocument,
  type PrototypeTask,
} from "@/prototype/desktop-mock-data";
import {
  desktopPrototypeReducer,
  getActiveProject,
  getCommandResults,
  getDocumentById,
  getProjectDocuments,
  getProjectOverviewDirections,
  getTaskById,
  getVisibleOverviewTasks,
  initialDesktopPrototypeState,
  type CommandResult,
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
} from "@/prototype/desktop-state";
import { OverviewWorkspace } from "@/prototype/overview";
import { UiIcon } from "@/prototype/desktop-icons";
import { KnowledgeSidebar } from "@/prototype/knowledge/knowledge-sidebar";
import { KnowledgeWorkspace } from "@/prototype/knowledge/knowledge-workspace";
import { MarkdownDocumentPreview } from "@/prototype/knowledge/markdown-document-preview";
import { ContextPanelSlot } from "@/prototype/context-panels/context-panel-slot";
import { TasksSidebar } from "@/prototype/tasks/tasks-sidebar";
import { TasksWorkspace } from "@/prototype/tasks/tasks-workspace";
import { CanvasesSidebar } from "@/prototype/canvases/canvases-sidebar";
import { CanvasesWorkspace } from "@/prototype/canvases/canvases-workspace";
import { InboxSidebar } from "@/prototype/inbox/inbox-sidebar";
import { InboxWorkspace } from "@/prototype/inbox/inbox-workspace";
import { IconButton, PrototypeButton } from "@/prototype/desktop-ui";
import { ApplicationHeader } from "@/prototype/shell/application-header";
import { SectionRail } from "@/prototype/shell/section-rail";
import "./desktop-shell.css";
import "./desktop-workspaces.css";
import "./desktop-knowledge.css";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

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
