"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import {
  aiProposals,
  inboxFilters,
  overviewLanes,
  projectSections,
  taskFilters,
  type OverviewLane,
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
  getDocumentById,
  getInboxItemById,
  getMilestoneProgress,
  getProjectAreas,
  getProjectCanvases,
  getProjectDocumentFolders,
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
} from "@/prototype/desktop-state";
import "./desktop-shell.css";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

const laneLabels: Record<OverviewLane, string> = {
  now: "Сейчас",
  next: "Дальше",
  later: "Позже",
  done: "Готово",
};

export function DesktopPrototypeShell(): React.JSX.Element {
  const [state, dispatch] = useReducer(
    desktopPrototypeReducer,
    initialDesktopPrototypeState,
  );
  const [commandQuery, setCommandQuery] = useState("");
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
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

  const activateCommandResult = (result: CommandResult): void => {
    dispatch({ type: "activate-command-result", result });
    setCommandQuery("");
  };

  const activeProject = getActiveProject(state);

  return (
    <main className="desktop-prototype">
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
    <aside className="project-rail" aria-label="Проекты">
      <div className="prototype-banner">MOCK</div>
      <div className="rail-heading">
        <span>Проекты</span>
        <strong>Рабочая область</strong>
      </div>
      <nav className="project-list" aria-label="Выбор проекта">
        {state.projects.map((project) => (
          <button
            className={project.id === state.activeProjectId ? "active" : ""}
            key={project.id}
            onClick={() =>
              dispatch({ type: "switch-project", projectId: project.id })
            }
            type="button"
          >
            <strong>{project.name}</strong>
            <span>{project.description}</span>
          </button>
        ))}
      </nav>
      <button
        className="create-project"
        onClick={() => dispatch({ type: "create-project" })}
        type="button"
      >
        + Создать проект
      </button>
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
        <span>Проект</span>
        <strong>{activeProject.name}</strong>
      </div>
      <nav className="section-navigation" aria-label="Разделы проекта">
        {projectSections.map((section) => (
          <button
            className={state.activeSection === section.id ? "active" : ""}
            key={section.id}
            onClick={() =>
              dispatch({ type: "switch-section", section: section.id })
            }
            title={section.description}
            type="button"
          >
            {section.label}
          </button>
        ))}
      </nav>
      <div className="header-tools" aria-label="Глобальные инструменты">
        <button
          onClick={() => dispatch({ type: "open-command-palette" })}
          type="button"
        >
          Поиск
        </button>
        <button
          className={state.contextPanel?.kind === "ai" ? "active" : ""}
          onClick={() => dispatch({ type: "open-ai-panel" })}
          type="button"
        >
          AI
        </button>
        <button type="button">Профиль</button>
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
  const activeProject = getActiveProject(state);
  const activeMilestone = getActiveMilestone(state);
  const progress = getMilestoneProgress(state);
  const areas = getProjectAreas(state);
  const milestones = getProjectMilestones(state);
  return (
    <div className="overview-workspace">
      <section className="project-summary">
        <div>
          <span>Активный проект</span>
          <h1>{activeProject.name}</h1>
          <p>{activeProject.description}</p>
        </div>
        <div>
          <span>Текущий рубеж</span>
          <h2>{activeMilestone.title}</h2>
          <p>{activeMilestone.description}</p>
        </div>
        <div className="progress-box">
          <strong>
            {progress.completed} из {progress.total} задач завершено
          </strong>
          <button
            onClick={() =>
              dispatch({ type: "switch-section", section: "tasks" })
            }
            type="button"
          >
            Открыть задачи
          </button>
        </div>
      </section>
      <section className="overview-controls" aria-label="Фильтры обзора">
        <label>
          Область
          <select
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
          Рубеж
          <select
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
        <button
          className={state.filters.starredOnly ? "active" : ""}
          onClick={() => dispatch({ type: "toggle-starred-filter" })}
          type="button"
        >
          Только важные
        </button>
        <button
          className="primary-action"
          onClick={() => dispatch({ type: "create-task" })}
          type="button"
        >
          + Создать задачу
        </button>
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
        <span className={task.starred ? "star active" : "star"}>★</span>
        <strong>{task.title}</strong>
        <span>{task.area ?? "Общее"}</span>
        <span>{task.dueDate ?? "без срока"}</span>
        <span>{task.linkedDocumentIds.length} док.</span>
        <span>
          {doneSubtasks}/{task.subtasks.length || 0}
        </span>
      </button>
      <div className="task-card-actions">
        <button
          onClick={() =>
            dispatch({ type: "toggle-task-star", taskId: task.id })
          }
          type="button"
        >
          {task.starred ? "Убрать ★" : "Важная"}
        </button>
        <label>
          Переместить
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
      </div>
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
  const folders = getProjectDocumentFolders(state);
  const documents = getProjectDocuments(state);
  return (
    <aside className="tool-sidebar" aria-label="Дерево документов">
      <header>
        <span>Знания</span>
        <strong>Документы</strong>
      </header>
      {folders.map((folder) => (
        <section className="tree-group" key={folder}>
          <h3>{folder}</h3>
          {documents
            .filter((document) => document.folder === folder)
            .map((document) => (
              <button
                className={
                  state.selectedDocumentId === document.id ? "active" : ""
                }
                key={document.id}
                onClick={() =>
                  dispatch({ type: "select-document", documentId: document.id })
                }
                type="button"
              >
                {document.title}
              </button>
            ))}
        </section>
      ))}
    </aside>
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
  const openTabs = documents.slice(0, 3);
  return (
    <div className="document-workspace">
      <div className="document-tabs">
        <button type="button">←</button>
        <button type="button">→</button>
        {openTabs.map((document) => (
          <button
            className={document.id === selectedDocument.id ? "active" : ""}
            key={document.id}
            onClick={() =>
              dispatch({ type: "select-document", documentId: document.id })
            }
            type="button"
          >
            {document.title}
          </button>
        ))}
      </div>
      <article className="document-page">
        <span>{selectedDocument.folder}</span>
        <h1>{selectedDocument.title}</h1>
        {selectedDocument.content.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </article>
      <footer className="workspace-footer">
        <button
          onClick={() =>
            dispatch({
              type: "open-document-context",
              documentId: selectedDocument.id,
            })
          }
          type="button"
        >
          Открыть контекст документа
        </button>
        <button
          onClick={() => dispatch({ type: "open-ai-panel" })}
          type="button"
        >
          AI по документу
        </button>
      </footer>
    </div>
  );
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
          <button
            className={state.taskFilter === filter.id ? "active" : ""}
            key={filter.id}
            onClick={() =>
              dispatch({ type: "set-task-filter", filter: filter.id })
            }
            type="button"
          >
            <strong>{filter.label}</strong>
            <span>{filter.description}</span>
          </button>
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
      <header className="section-title">
        <span>Список задач</span>
        <h1>{currentFilter.label}</h1>
        <p>{currentFilter.description}</p>
      </header>
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
          <button
            className={state.selectedCanvasId === canvas.id ? "active" : ""}
            key={canvas.id}
            onClick={() =>
              dispatch({ type: "select-canvas", canvasId: canvas.id })
            }
            type="button"
          >
            <strong>{canvas.title}</strong>
            <span>{canvas.description}</span>
          </button>
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
          <button
            className={state.inboxFilter === filter.id ? "active" : ""}
            key={filter.id}
            onClick={() =>
              dispatch({ type: "set-inbox-filter", filter: filter.id })
            }
            type="button"
          >
            {filter.label}
          </button>
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
      <header className="section-title">
        <span>Захваты</span>
        <h1>Входящие</h1>
        <p>Структурный макет места, куда попадают быстрые материалы.</p>
      </header>
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
        <button
          onClick={() => dispatch({ type: "close-context-panel" })}
          type="button"
        >
          Закрыть
        </button>
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
      <DocumentContextPanel document={document} state={state} />
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
      <section className="panel-block">
        <h3>Подзадачи</h3>
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
      </section>
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
  document,
  state,
}: {
  document: PrototypeDocument;
  state: DesktopPrototypeState;
}): React.JSX.Element {
  const linkedTasks = document.linkedTaskIds
    .map((taskId) => getTaskById(state, taskId))
    .filter((task): task is PrototypeTask => Boolean(task));
  return (
    <div className="panel-stack">
      <section className="panel-block">
        <h3>Backlinks</h3>
        {document.backlinks.map((backlink) => (
          <span className="document-pill" key={backlink}>
            {backlink}
          </span>
        ))}
      </section>
      <section className="panel-block">
        <h3>Связанные задачи</h3>
        {linkedTasks.map((task) => (
          <p key={task.id}>{task.title}</p>
        ))}
      </section>
      <section className="panel-block">
        <h3>История</h3>
        <p>Mock: документ открыт в структурном прототипе shell.</p>
      </section>
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
      <section className="panel-block">
        <h3>{objectTitle}</h3>
        <p>{objectBody}</p>
      </section>
      <section className="panel-block">
        <h3>Свойства</h3>
        <p>Тип, позиция и связи показаны как mock-инспектор.</p>
      </section>
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
      <section className="panel-block">
        <h3>{item.title}</h3>
        <p>{item.preview}</p>
      </section>
      <section className="panel-block">
        <h3>Источник</h3>
        <p>
          {item.source} · {item.capturedAt}
        </p>
      </section>
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
      <section className="panel-block">
        <h3>Текущий контекст</h3>
        <p>{getAiContextLabel(state)}</p>
      </section>
      <section className="panel-block">
        <h3>Предложения</h3>
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
      </section>
      <button
        className="primary-action"
        disabled={state.selectedAiProposalIds.length === 0}
        onClick={() => dispatch({ type: "confirm-ai-proposals" })}
        type="button"
      >
        Применить выбранное
      </button>
      {state.aiActivityLog.length > 0 ? (
        <section className="panel-block">
          <h3>Журнал</h3>
          {state.aiActivityLog.map((entry) => (
            <p key={entry}>{entry}</p>
          ))}
        </section>
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
                <span>{result.kind}</span>
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

function EmptySection({ title }: { title: string }): React.JSX.Element {
  return (
    <section className="empty-section">
      <span>{title}</span>
      <h1>Нет mock-данных</h1>
      <p>Этот проект пока показывает только структуру зоны.</p>
    </section>
  );
}
