"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  aiProposals,
  inboxFilters,
  overviewLanes,
  projectSections,
  taskFilters,
  type OverviewLane,
  type ProjectSection,
  type PrototypeDocument,
  type PrototypeInboxItem,
  type PrototypeTask,
} from "@/prototype/desktop-mock-data";
import {
  ALL_AREAS,
  ALL_MILESTONES,
  desktopPrototypeReducer,
  getActiveMilestone,
  getActiveProject,
  getAiContextLabel,
  getCanvasById,
  getCanvasObjectById,
  getCommandResults,
  getDocumentBreadcrumb,
  getDocumentById,
  getDocumentFolderPath,
  getInboxItemById,
  getKeyDocuments,
  getKnowledgeTree,
  getMilestoneProgress,
  getOpenDocuments,
  getProjectAreas,
  getProjectCanvases,
  getProjectDocuments,
  getProjectMilestones,
  getTaskById,
  getTasksForLane,
  getVisibleInboxItems,
  getVisibleTaskList,
  initialDesktopPrototypeState,
  type CommandResult,
  type ContextPanelState,
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
  type KnowledgeContextMode,
  type KnowledgeTreeNode,
} from "@/prototype/desktop-state";
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

const laneLabels: Record<OverviewLane, string> = {
  now: "Сейчас",
  next: "Дальше",
  later: "Позже",
  done: "Готово",
};

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
  }, []);

  const activateCommandResult = (result: CommandResult): void => {
    dispatch({ type: "activate-command-result", result });
    setCommandQuery("");
  };

  const activeProject = getActiveProject(state);

  return (
    <main
      className={[
        "desktop-prototype",
        state.projectRailCollapsed ? "project-rail-collapsed" : "",
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
  return (
    <header className="application-header">
      <div className="header-project">
        <strong>{activeProject.name}</strong>
        <MetadataLine>{activeProject.description}</MetadataLine>
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
  const sidebar = renderToolSidebar(state, dispatch);
  const hasContextPanel = state.contextPanel !== null;
  return (
    <div
      className={[
        "section-workspace",
        `workspace-policy-${workspaceWidthPolicy(state)}`,
        `section-${state.activeSection}`,
        sidebar ? "has-tool-sidebar" : "",
        hasContextPanel ? "has-context-panel" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {sidebar}
      <section className="main-workspace" aria-label="Рабочая область">
        {renderMainWorkspace(state, dispatch)}
      </section>
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
): "full-surface" | "readable-document" | "bounded-cluster" {
  if (state.activeSection === "canvases") return "full-surface";
  if (state.activeSection === "knowledge") return "readable-document";
  if (state.activeSection === "tasks" || state.activeSection === "inbox") {
    return "bounded-cluster";
  }
  return state.contextPanel ? "bounded-cluster" : "full-surface";
}

function getInitialCommandQuery(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("commandQuery") ?? "";
}

function renderToolSidebar(
  state: DesktopPrototypeState,
  dispatch: Dispatch,
): React.JSX.Element | null {
  if (state.activeSection === "knowledge") {
    return <KnowledgeSidebar state={state} dispatch={dispatch} />;
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
): React.JSX.Element {
  if (state.activeSection === "knowledge") {
    return <KnowledgeWorkspace state={state} dispatch={dispatch} />;
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
  return <OverviewWorkspace state={state} dispatch={dispatch} />;
}

function OverviewWorkspace({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  const activeMilestone = getActiveMilestone(state);
  const progress = getMilestoneProgress(state);
  const areas = getProjectAreas(state);
  const milestones = getProjectMilestones(state);
  return (
    <div className="overview-workspace">
      <section className="overview-command-bar">
        <div className="overview-goal">
          <span className="ui-eyebrow">Ближайшая цель</span>
          <h2>{activeMilestone.title}</h2>
          <p>{activeMilestone.description}</p>
        </div>
        <div className="overview-controls" aria-label="Фильтры обзора">
          <label>
            <span>Область</span>
            <select
              aria-label="Фильтр по области"
              onChange={(event) =>
                dispatch({ type: "set-area-filter", area: event.target.value })
              }
              value={state.filters.area}
            >
              <option value={ALL_AREAS}>Все области</option>
              {areas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Рубеж</span>
            <select
              aria-label="Фильтр по рубежу"
              onChange={(event) =>
                dispatch({
                  type: "set-milestone-filter",
                  milestoneId: event.target.value,
                })
              }
              value={state.filters.milestoneId}
            >
              <option value={ALL_MILESTONES}>Все рубежи</option>
              {milestones.map((milestone) => (
                <option key={milestone.id} value={milestone.id}>
                  {milestone.title}
                </option>
              ))}
            </select>
          </label>
          <IconButton
            active={state.filters.starredOnly}
            icon="★"
            label="Только важные"
            onClick={() => dispatch({ type: "toggle-starred-filter" })}
            title="Только важные"
            variant="quiet"
          />
          <PrototypeButton
            onClick={() => dispatch({ type: "create-task" })}
            size="compact"
            variant="primary"
          >
            + Задача
          </PrototypeButton>
        </div>
        <div className="progress-box">
          <span>
            <strong>
              {progress.completed}/{progress.total}
            </strong>{" "}
            завершено
          </span>
          <PrototypeButton
            onClick={() =>
              dispatch({ type: "switch-section", section: "tasks" })
            }
            size="compact"
            variant="quiet"
          >
            Открыть задачи
          </PrototypeButton>
        </div>
      </section>
      <section className="overview-board" aria-label="Доска проекта">
        {overviewLanes.map((lane) => (
          <OverviewLaneColumn
            dispatch={dispatch}
            key={lane.id}
            lane={lane.id}
            state={state}
          />
        ))}
      </section>
    </div>
  );
}

function OverviewLaneColumn({
  state,
  dispatch,
  lane,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
  lane: OverviewLane;
}): React.JSX.Element {
  const tasks = getTasksForLane(state, lane);
  return (
    <article className="board-column">
      <header>
        <div>
          <h3>{laneLabels[lane]}</h3>
          <p>{overviewLanes.find((item) => item.id === lane)?.hint}</p>
        </div>
        <span>{tasks.length}</span>
      </header>
      <div className="task-stack">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <TaskCard dispatch={dispatch} key={task.id} task={task} />
          ))
        ) : (
          <p className="empty-state">Нет задач в этой зоне.</p>
        )}
      </div>
      {lane === "done" ? (
        <button className="muted-action" type="button">
          Все завершённые
        </button>
      ) : null}
    </article>
  );
}

function TaskCard({
  task,
  dispatch,
}: {
  task: PrototypeTask;
  dispatch: Dispatch;
}): React.JSX.Element {
  const doneSubtasks = task.subtasks.filter((subtask) => subtask.done).length;
  return (
    <article className="task-card">
      <IconButton
        active={task.starred}
        className="task-star-control"
        icon={task.starred ? "★" : "☆"}
        label={task.starred ? "Убрать из важных" : "Пометить важной"}
        onClick={() => dispatch({ type: "toggle-task-star", taskId: task.id })}
        variant="ghost"
      />
      <button
        className="task-hit-area"
        onClick={() =>
          dispatch({
            type: "select-task",
            taskId: task.id,
            section: "overview",
          })
        }
        type="button"
      >
        <strong>{task.title}</strong>
        <MetadataLine>
          {task.area ?? "Общее"} · {task.dueDate ?? "без срока"} ·{" "}
          {task.linkedDocumentIds.length} док. · {doneSubtasks}/
          {task.subtasks.length || 0}
        </MetadataLine>
      </button>
    </article>
  );
}

function KnowledgeSidebar({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  const tree = getKnowledgeTree(state);
  const keyDocuments = getKeyDocuments(state);
  return (
    <aside
      className="tool-sidebar knowledge-sidebar"
      aria-label="Дерево документов"
    >
      <header className="knowledge-sidebar-header">
        <strong>Документы</strong>
        <div
          className="knowledge-toolbar"
          aria-label="Действия с деревом документов"
        >
          <IconButton
            icon={<UiIcon name="collapse" />}
            label="Свернуть все папки"
            onClick={() => dispatch({ type: "collapse-all-knowledge-folders" })}
            title="Свернуть все папки"
            variant="ghost"
          />
        </div>
      </header>
      <label className="knowledge-search">
        <span>Поиск по проекту</span>
        <input
          onChange={(event) =>
            dispatch({
              type: "set-knowledge-search",
              query: event.target.value,
            })
          }
          placeholder="Документ, папка или связь"
          value={state.knowledgeSearchQuery}
        />
      </label>
      <section
        className="knowledge-key-documents"
        aria-labelledby="knowledge-key-documents-title"
      >
        <div>
          <strong id="knowledge-key-documents-title">Ключевые документы</strong>
          <span>Отмечены вручную для быстрого доступа</span>
        </div>
        <nav aria-label="Ключевые документы проекта">
          {keyDocuments.map((document) => (
            <button
              className={
                state.selectedDocumentId === document.id ? "is-active" : ""
              }
              key={document.id}
              onClick={() =>
                dispatch({ type: "select-document", documentId: document.id })
              }
              title={`${document.title} — ключевой документ проекта`}
              type="button"
            >
              <UiIcon name="pin" />
              <span>{document.title}</span>
            </button>
          ))}
        </nav>
      </section>
      <nav className="knowledge-tree" aria-label="Иерархия документов">
        {tree.length > 0 ? (
          tree.map((node) => (
            <KnowledgeTreeNodeView
              dispatch={dispatch}
              key={node.id}
              node={node}
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

function KnowledgeTreeNodeView({
  node,
  state,
  dispatch,
}: {
  node: KnowledgeTreeNode;
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  const depth = Math.max(node.path.length - 1, 0);
  if (node.kind === "folder") {
    const expanded =
      state.knowledgeSearchQuery.trim().length > 0 ||
      state.expandedFolderIds.includes(node.id);
    return (
      <div className="knowledge-tree-branch">
        <button
          aria-expanded={expanded}
          className="knowledge-tree-row folder"
          onClick={() =>
            dispatch({ type: "toggle-knowledge-folder", folderId: node.id })
          }
          style={treeDepthStyle(depth)}
          title={node.path.join(" / ")}
          type="button"
        >
          <UiIcon name={expanded ? "chevron-down" : "chevron-right"} />
          <UiIcon name={expanded ? "folder-open" : "folder"} />
          <span>{node.title}</span>
        </button>
        {expanded ? (
          <div className="knowledge-tree-children">
            {node.children.map((child) => (
              <KnowledgeTreeNodeView
                dispatch={dispatch}
                key={child.id}
                node={child}
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
      ]
        .filter(Boolean)
        .join(" ")}
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

function KnowledgeWorkspace({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  const documents = getProjectDocuments(state);
  const selectedDocument =
    getDocumentById(state, state.selectedDocumentId) ?? documents[0];
  if (!selectedDocument) {
    return <EmptySection title="Знания" />;
  }
  const openTabs = getOpenDocuments(state);
  const splitDocument = getDocumentById(state, state.splitViewDocumentId);
  return (
    <div className="document-workspace">
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
              onClick={() =>
                dispatch({
                  type: "close-document-tab",
                  documentId: document.id,
                })
              }
              title={`Закрыть ${document.title}`}
              variant="ghost"
            />
          </div>
        ))}
        <button
          className="document-tab-add"
          type="button"
          title="Открыть новую вкладку"
          aria-label="Открыть новую вкладку"
        >
          <UiIcon name="plus" />
        </button>
      </div>
      <nav className="document-nav" aria-label="Навигация документа">
        <div className="document-history-controls">
          <IconButton
            disabled={state.documentHistoryBack.length === 0}
            icon={<UiIcon name="arrow-left" />}
            label="Назад"
            onClick={() => dispatch({ type: "go-document-back" })}
            title="Назад"
            variant="ghost"
          />
          <IconButton
            disabled={state.documentHistoryForward.length === 0}
            icon={<UiIcon name="arrow-right" />}
            label="Вперёд"
            onClick={() => dispatch({ type: "go-document-forward" })}
            title="Вперёд"
            variant="ghost"
          />
        </div>
        <ol className="document-breadcrumb">
          {getDocumentFolderPath(selectedDocument).map((part) => (
            <li key={part}>{part}</li>
          ))}
          <li aria-current="page">{selectedDocument.title}</li>
        </ol>
        <div className="document-actions">
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
      </nav>
      <div className="document-body">
        <DocumentOutline document={selectedDocument} />
        <div
          className={[
            "document-editor-surface",
            splitDocument ? "is-split-view" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <DocumentArticle document={selectedDocument} />
          {splitDocument ? (
            <DocumentArticle document={splitDocument} secondary />
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
  level: 1 | 2;
};

function getDocumentHeadings(document: PrototypeDocument): DocumentHeading[] {
  return document.content.flatMap((line, index) => {
    const match = /^(#{1,2})\s+(.+)$/.exec(line);
    if (!match) return [];
    return [
      {
        id: `document-${document.id}-heading-${index}`,
        label: match[2] ?? line,
        level: match[1]?.length === 2 ? 2 : 1,
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
    <aside className="document-outline" aria-label="Содержание документа">
      <div>
        <strong>Содержание</strong>
        <span>Переходы по заголовкам</span>
      </div>
      <nav>
        {headings.map((heading) => (
          <button
            className={heading.level === 2 ? "level-two" : "level-one"}
            key={heading.id}
            onClick={() =>
              window.document
                .getElementById(heading.id)
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            type="button"
          >
            <span aria-hidden="true" />
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
}: {
  document: PrototypeDocument;
  secondary?: boolean;
}): React.JSX.Element {
  const headings = getDocumentHeadings(document);
  return (
    <article
      className={secondary ? "document-page secondary" : "document-page"}
    >
      <span>{getDocumentBreadcrumb(document)}</span>
      {document.content.map((line, index) => {
        const heading = headings.find(
          (item) => item.id === `document-${document.id}-heading-${index}`,
        );
        return (
          <MarkdownPreviewBlock
            anchorId={heading?.id}
            key={`${document.id}-${index}`}
            line={line}
          />
        );
      })}
    </article>
  );
}

function MarkdownPreviewBlock({
  line,
  anchorId,
}: {
  line: string;
  anchorId?: string;
}): React.JSX.Element {
  if (line.startsWith("# ")) return <h1 id={anchorId}>{line.slice(2)}</h1>;
  if (line.startsWith("## ")) return <h2 id={anchorId}>{line.slice(3)}</h2>;
  if (line.startsWith("- "))
    return <p className="document-list-item">• {line.slice(2)}</p>;
  if (/^\d+\.\s/.test(line))
    return <p className="document-list-item">{line}</p>;
  if (line.startsWith("> ")) return <blockquote>{line.slice(2)}</blockquote>;
  return <p>{line}</p>;
}

function TasksSidebar({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  return (
    <aside className="tool-sidebar" aria-label="Фильтры задач">
      <header>
        <span>Задачи</span>
        <strong>Списки</strong>
      </header>
      <nav className="vertical-menu">
        {taskFilters.map((filter) => (
          <ToolSidebarItem
            active={state.taskFilter === filter.id}
            key={filter.id}
            onClick={() =>
              dispatch({ type: "set-task-filter", filter: filter.id })
            }
          >
            <strong>{filter.label}</strong>
            <span>{filter.description}</span>
          </ToolSidebarItem>
        ))}
      </nav>
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
  const tasks = getVisibleTaskList(state);
  const currentFilter =
    taskFilters.find((filter) => filter.id === state.taskFilter) ??
    taskFilters[0];
  return (
    <div className="task-list-workspace">
      <WorkspaceHeader
        description={currentFilter.description}
        eyebrow="Список задач"
        title={currentFilter.label}
      />
      <div className="task-list">
        {tasks.map((task) => (
          <TaskListRow dispatch={dispatch} key={task.id} task={task} />
        ))}
      </div>
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
  const doneSubtasks = task.subtasks.filter((subtask) => subtask.done).length;
  return (
    <article className="task-row">
      <button
        onClick={() =>
          dispatch({ type: "select-task", taskId: task.id, section: "tasks" })
        }
        type="button"
      >
        <strong>{task.title}</strong>
        <span>
          {task.area ?? "Общее"} · {laneLabels[task.overviewLane]} ·{" "}
          {doneSubtasks}/{task.subtasks.length || 0}
        </span>
      </button>
      <button
        className={task.starred ? "star-button active" : "star-button"}
        onClick={() => dispatch({ type: "toggle-task-star", taskId: task.id })}
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
  if (!contextPanel) return null;
  return (
    <aside className="context-panel" aria-label="Контекстная панель">
      <header>
        <div>
          <span>Контекст</span>
          <h2>{contextTitle(contextPanel)}</h2>
        </div>
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
      </header>
      {renderContextPanelContent(state, dispatch, contextPanel)}
    </aside>
  );
}

function contextTitle(contextPanel: Exclude<ContextPanelState, null>): string {
  if (contextPanel.kind === "task") return "Детали задачи";
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
      <TaskDetailsPanel dispatch={dispatch} task={task} />
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

function TaskDetailsPanel({
  task,
  dispatch,
}: {
  task: PrototypeTask;
  dispatch: Dispatch;
}): React.JSX.Element {
  return (
    <div className="panel-stack">
      <label className="field">
        Название
        <textarea
          onChange={(event) =>
            dispatch({
              type: "edit-task-title",
              taskId: task.id,
              title: event.target.value,
            })
          }
          value={task.title}
        />
      </label>
      <button
        className={task.starred ? "wide-toggle active" : "wide-toggle"}
        onClick={() => dispatch({ type: "toggle-task-star", taskId: task.id })}
        type="button"
      >
        {task.starred ? "★ Важная задача" : "☆ Сделать важной"}
      </button>
      <label className="field">
        Срок
        <input
          onChange={(event) =>
            dispatch({
              type: "set-task-due-date",
              taskId: task.id,
              dueDate: event.target.value,
            })
          }
          value={task.dueDate ?? ""}
        />
      </label>
      <label className="field">
        Колонка обзора
        <select
          onChange={(event) =>
            dispatch({
              type: "move-task",
              taskId: task.id,
              overviewLane: event.target.value as OverviewLane,
            })
          }
          value={task.overviewLane}
        >
          {overviewLanes.map((lane) => (
            <option key={lane.id} value={lane.id}>
              {lane.label}
            </option>
          ))}
        </select>
      </label>
      <ContextPanelSection title="Подзадачи">
        {task.subtasks.length > 0 ? (
          task.subtasks.map((subtask) => (
            <label className="subtask-row" key={subtask.id}>
              <input
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
              {subtask.title}
            </label>
          ))
        ) : (
          <p>Подзадач пока нет.</p>
        )}
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
  | "file"
  | "file-plus"
  | "folder"
  | "folder-open"
  | "folder-plus"
  | "more"
  | "panel-left"
  | "panel-right"
  | "pin"
  | "plus"
  | "search"
  | "sort";

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
