"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import {
  aiProposals,
  overviewLanes,
  projectSections,
  type OverviewLane,
  type ProjectSection,
  type PrototypeTask,
} from "@/prototype/desktop-mock-data";
import {
  ALL_AREAS,
  ALL_MILESTONES,
  desktopPrototypeReducer,
  getActiveMilestone,
  getActiveProject,
  getMilestoneProgress,
  getProjectAreas,
  getProjectMilestones,
  getTaskById,
  getTasksForLane,
  initialDesktopPrototypeState,
  visibleCommandResults,
} from "@/prototype/desktop-state";
import "@/prototype/desktop-shell.css";

type CommandResult =
  | {
      id: string;
      kind: "project";
      title: string;
      subtitle: string;
      projectId: string;
    }
  | {
      id: string;
      kind: "section";
      title: string;
      subtitle: string;
      section: ProjectSection;
    }
  | {
      id: string;
      kind: "task";
      title: string;
      subtitle: string;
      taskId: string;
    };

export function DesktopPrototypeShell() {
  const [state, dispatch] = useReducer(
    desktopPrototypeReducer,
    initialDesktopPrototypeState,
  );
  const [commandQuery, setCommandQuery] = useState("");
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);

  const activeProject = getActiveProject(state);
  const activeMilestone = getActiveMilestone(state);
  const progress = getMilestoneProgress(state);
  const selectedTask = getTaskById(state, state.selectedTaskId);
  const projectAreas = getProjectAreas(state);
  const projectMilestones = getProjectMilestones(state);

  const commandResults = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    const matches = (value: string) => value.toLowerCase().includes(query);
    const projects = state.projects
      .filter((project) => !query || matches(project.name))
      .map<CommandResult>((project) => ({
        id: `project-${project.id}`,
        kind: "project",
        title: project.name,
        subtitle: "Открыть проект",
        projectId: project.id,
      }));
    const sections = projectSections
      .filter((section) => !query || matches(section.label))
      .map<CommandResult>((section) => ({
        id: `section-${section.id}`,
        kind: "section",
        title: section.label,
        subtitle: "Перейти в раздел проекта",
        section: section.id,
      }));
    const tasks = state.tasks
      .filter((task) => !query || matches(task.title))
      .map<CommandResult>((task) => ({
        id: `task-${task.id}`,
        kind: "task",
        title: task.title,
        subtitle:
          state.projects.find((project) => project.id === task.projectId)
            ?.name ?? "Проект",
        taskId: task.id,
      }));
    return visibleCommandResults([...projects, ...sections, ...tasks]);
  }, [commandQuery, state.projects, state.tasks]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSelectedCommandIndex(0);
        dispatch({ type: "open-command-palette" });
      }
      if (!state.commandPaletteOpen) return;
      if (event.key === "Escape") {
        dispatch({ type: "close-command-palette" });
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedCommandIndex((value) =>
          Math.min(value + 1, Math.max(commandResults.length - 1, 0)),
        );
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedCommandIndex((value) => Math.max(value - 1, 0));
      }
      if (event.key === "Enter" && commandResults[selectedCommandIndex]) {
        event.preventDefault();
        runCommand(commandResults[selectedCommandIndex]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commandResults, selectedCommandIndex, state.commandPaletteOpen]);

  function runCommand(result: CommandResult) {
    if (result.kind === "project") {
      dispatch({ type: "switch-project", projectId: result.projectId });
    }
    if (result.kind === "section") {
      dispatch({ type: "switch-section", section: result.section });
    }
    if (result.kind === "task") {
      dispatch({ type: "select-task", taskId: result.taskId });
    }
    dispatch({ type: "close-command-palette" });
  }

  return (
    <main className="desktop-prototype">
      <div className="prototype-banner">
        PROTOTYPE · MOCK DATA · NO PERSISTENCE
      </div>
      <header className="desktop-header">
        <div className="project-tabs" aria-label="Проекты">
          {state.projects.map((project) => (
            <button
              className={project.id === state.activeProjectId ? "active" : ""}
              key={project.id}
              onClick={() =>
                dispatch({ type: "switch-project", projectId: project.id })
              }
            >
              {project.name}
            </button>
          ))}
          <button
            className="create-project"
            onClick={() => dispatch({ type: "create-project" })}
          >
            + Создать проект
          </button>
        </div>
        <div className="section-row">
          <nav className="section-tabs" aria-label="Разделы проекта">
            {projectSections.map((section) => (
              <button
                className={section.id === state.activeSection ? "active" : ""}
                key={section.id}
                onClick={() =>
                  dispatch({ type: "switch-section", section: section.id })
                }
              >
                {section.label}
              </button>
            ))}
          </nav>
          <div className="global-tools" aria-label="Глобальные инструменты">
            <button
              onClick={() => {
                setSelectedCommandIndex(0);
                dispatch({ type: "open-command-palette" });
              }}
            >
              Поиск
            </button>
            <button
              className={state.rightPanel === "ai" ? "active" : ""}
              onClick={() => dispatch({ type: "open-ai-panel" })}
            >
              AI
            </button>
            <button>Профиль</button>
          </div>
        </div>
      </header>

      <div
        className={`desktop-workspace ${state.rightPanel ? "has-right-panel" : ""}`}
      >
        <section className="workspace-main">
          {state.activeSection === "overview" ? (
            <ProjectOverview
              activeProjectName={activeProject.name}
              activeProjectDescription={activeProject.description}
              milestoneTitle={activeMilestone.title}
              milestoneDescription={activeMilestone.description}
              completedTasks={progress.completed}
              totalTasks={progress.total}
              areaFilter={state.filters.area}
              milestoneFilter={state.filters.milestoneId}
              starredOnly={state.filters.starredOnly}
              areas={projectAreas}
              milestones={projectMilestones}
              selectedTaskId={state.selectedTaskId}
              onAreaFilter={(area) =>
                dispatch({ type: "set-area-filter", area })
              }
              onMilestoneFilter={(milestoneId) =>
                dispatch({ type: "set-milestone-filter", milestoneId })
              }
              onToggleStarredFilter={() =>
                dispatch({ type: "toggle-starred-filter" })
              }
              onCreateTask={() => dispatch({ type: "create-task" })}
              onSelectTask={(taskId) =>
                dispatch({ type: "select-task", taskId })
              }
              onToggleStar={(taskId) =>
                dispatch({ type: "toggle-task-star", taskId })
              }
              onMoveTask={(taskId, overviewLane) =>
                dispatch({ type: "move-task", taskId, overviewLane })
              }
              getTasksForLane={(lane) => getTasksForLane(state, lane)}
            />
          ) : (
            <PlaceholderSection
              section={state.activeSection}
              projectName={activeProject.name}
            />
          )}
        </section>

        {state.rightPanel === "task" && selectedTask ? (
          <TaskDetailsPanel
            task={selectedTask}
            onClose={() => dispatch({ type: "close-right-panel" })}
            onTitle={(title) =>
              dispatch({
                type: "edit-task-title",
                taskId: selectedTask.id,
                title,
              })
            }
            onDueDate={(dueDate) =>
              dispatch({
                type: "set-task-due-date",
                taskId: selectedTask.id,
                dueDate,
              })
            }
            onNotes={(notes) =>
              dispatch({
                type: "set-task-notes",
                taskId: selectedTask.id,
                notes,
              })
            }
            onToggleStar={() =>
              dispatch({ type: "toggle-task-star", taskId: selectedTask.id })
            }
            onToggleSubtask={(subtaskId) =>
              dispatch({
                type: "toggle-subtask",
                taskId: selectedTask.id,
                subtaskId,
              })
            }
            onMove={(overviewLane) =>
              dispatch({
                type: "move-task",
                taskId: selectedTask.id,
                overviewLane,
              })
            }
          />
        ) : null}

        {state.rightPanel === "ai" ? (
          <AiPanel
            projectName={activeProject.name}
            sectionLabel={
              projectSections.find(
                (section) => section.id === state.activeSection,
              )?.label ?? "Обзор"
            }
            milestoneTitle={activeMilestone.title}
            selectedTaskTitle={selectedTask?.title}
            selectedProposalIds={state.selectedAiProposalIds}
            activityLog={state.aiActivityLog}
            onToggleProposal={(proposalId) =>
              dispatch({ type: "toggle-ai-proposal", proposalId })
            }
            onConfirm={() => dispatch({ type: "confirm-ai-proposals" })}
            onClose={() => dispatch({ type: "close-ai-panel" })}
          />
        ) : null}
      </div>

      {state.commandPaletteOpen ? (
        <CommandPalette
          query={commandQuery}
          selectedIndex={selectedCommandIndex}
          results={commandResults}
          onQuery={(query) => {
            setCommandQuery(query);
            setSelectedCommandIndex(0);
          }}
          onClose={() => dispatch({ type: "close-command-palette" })}
          onSelect={runCommand}
        />
      ) : null}
    </main>
  );
}

function ProjectOverview({
  activeProjectName,
  activeProjectDescription,
  milestoneTitle,
  milestoneDescription,
  completedTasks,
  totalTasks,
  areaFilter,
  milestoneFilter,
  starredOnly,
  areas,
  milestones,
  selectedTaskId,
  onAreaFilter,
  onMilestoneFilter,
  onToggleStarredFilter,
  onCreateTask,
  onSelectTask,
  onToggleStar,
  onMoveTask,
  getTasksForLane,
}: {
  activeProjectName: string;
  activeProjectDescription: string;
  milestoneTitle: string;
  milestoneDescription: string;
  completedTasks: number;
  totalTasks: number;
  areaFilter: string;
  milestoneFilter: string;
  starredOnly: boolean;
  areas: string[];
  milestones: { id: string; title: string }[];
  selectedTaskId: string | null;
  onAreaFilter: (area: string) => void;
  onMilestoneFilter: (milestoneId: string) => void;
  onToggleStarredFilter: () => void;
  onCreateTask: () => void;
  onSelectTask: (taskId: string) => void;
  onToggleStar: (taskId: string) => void;
  onMoveTask: (taskId: string, lane: OverviewLane) => void;
  getTasksForLane: (lane: OverviewLane) => PrototypeTask[];
}) {
  return (
    <div className="project-overview">
      <header className="project-heading">
        <div>
          <span>Активный проект</span>
          <h1>{activeProjectName}</h1>
        </div>
        <p>{activeProjectDescription}</p>
      </header>

      <section className="milestone-summary" aria-label="Текущий рубеж">
        <div>
          <span>Текущий рубеж</span>
          <h2>{milestoneTitle}</h2>
          <p>{milestoneDescription}</p>
        </div>
        <div className="milestone-progress">
          <strong>
            {completedTasks} из {totalTasks} задач завершено
          </strong>
          <div>
            <button>Открыть задачи</button>
            <button>Редактировать рубеж</button>
          </div>
        </div>
      </section>

      <section className="overview-controls" aria-label="Фильтры обзора">
        <label>
          Область
          <select
            value={areaFilter}
            onChange={(event) => onAreaFilter(event.target.value)}
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
            value={milestoneFilter}
            onChange={(event) => onMilestoneFilter(event.target.value)}
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
          className={starredOnly ? "toggle active" : "toggle"}
          onClick={onToggleStarredFilter}
        >
          Только важные
        </button>
        <button className="primary-action" onClick={onCreateTask}>
          + Создать задачу
        </button>
      </section>

      <section className="overview-board" aria-label="Доска проекта">
        {overviewLanes.map((lane) => {
          const tasks = getTasksForLane(lane.id);
          return (
            <article className="board-column" key={lane.id}>
              <header>
                <div>
                  <h3>{lane.label}</h3>
                  <p>{lane.hint}</p>
                </div>
                <span>{tasks.length}</span>
              </header>
              <div className="task-stack">
                {tasks.length ? (
                  tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      selected={selectedTaskId === task.id}
                      onSelect={() => onSelectTask(task.id)}
                      onToggleStar={() => onToggleStar(task.id)}
                      onMove={(overviewLane) =>
                        onMoveTask(task.id, overviewLane)
                      }
                    />
                  ))
                ) : (
                  <div className="lane-empty">
                    Нет задач по текущему фильтру.
                  </div>
                )}
              </div>
              {lane.id === "done" ? (
                <button className="done-link">Все завершённые</button>
              ) : null}
            </article>
          );
        })}
      </section>
    </div>
  );
}

function TaskCard({
  task,
  selected,
  onSelect,
  onToggleStar,
  onMove,
}: {
  task: PrototypeTask;
  selected: boolean;
  onSelect: () => void;
  onToggleStar: () => void;
  onMove: (lane: OverviewLane) => void;
}) {
  const doneSubtasks = task.subtasks.filter((subtask) => subtask.done).length;
  return (
    <article className={selected ? "task-card selected" : "task-card"}>
      <button className="task-hit-area" onClick={onSelect}>
        <span className="task-title-row">
          <span className={task.starred ? "star active" : "star"}>★</span>
          <strong>{task.title}</strong>
        </span>
        <span className="task-meta-row">
          {task.area ? <span>{task.area}</span> : null}
          {task.dueDate ? <span>{task.dueDate}</span> : null}
          <span>{task.linkedDocumentIds.length} док.</span>
          <span>
            {doneSubtasks}/{task.subtasks.length}
          </span>
        </span>
      </button>
      <div className="task-card-actions">
        <button onClick={onToggleStar}>
          {task.starred ? "Убрать ★" : "Важная"}
        </button>
        <label>
          Переместить
          <select
            value={task.overviewLane}
            onChange={(event) => onMove(event.target.value as OverviewLane)}
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

function TaskDetailsPanel({
  task,
  onClose,
  onTitle,
  onDueDate,
  onNotes,
  onToggleStar,
  onToggleSubtask,
  onMove,
}: {
  task: PrototypeTask;
  onClose: () => void;
  onTitle: (title: string) => void;
  onDueDate: (dueDate: string) => void;
  onNotes: (notes: string) => void;
  onToggleStar: () => void;
  onToggleSubtask: (subtaskId: string) => void;
  onMove: (lane: OverviewLane) => void;
}) {
  return (
    <aside className="right-panel task-panel" aria-label="Детали задачи">
      <header>
        <div>
          <span>Задача</span>
          <h2>Детали</h2>
        </div>
        <button onClick={onClose}>Закрыть</button>
      </header>
      <label className="field">
        Название
        <textarea
          value={task.title}
          onChange={(event) => onTitle(event.target.value)}
          rows={3}
        />
      </label>
      <button
        className={task.starred ? "wide-toggle active" : "wide-toggle"}
        onClick={onToggleStar}
      >
        {task.starred ? "★ Важная задача" : "☆ Сделать важной"}
      </button>
      <label className="field">
        Срок
        <input
          value={task.dueDate ?? ""}
          onChange={(event) => onDueDate(event.target.value)}
          placeholder="Например: 22 июл"
        />
      </label>
      <label className="field">
        Колонка обзора
        <select
          value={task.overviewLane}
          onChange={(event) => onMove(event.target.value as OverviewLane)}
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
        {task.subtasks.length ? (
          task.subtasks.map((subtask) => (
            <label className="subtask-row" key={subtask.id}>
              <input
                checked={subtask.done}
                onChange={() => onToggleSubtask(subtask.id)}
                type="checkbox"
              />
              <span>{subtask.title}</span>
            </label>
          ))
        ) : (
          <p>Подзадач пока нет.</p>
        )}
      </section>
      <label className="field">
        Заметки
        <textarea
          value={task.notes ?? ""}
          onChange={(event) => onNotes(event.target.value)}
          rows={6}
        />
      </label>
      <section className="panel-block">
        <h3>Связанные документы</h3>
        {task.linkedDocumentIds.length ? (
          task.linkedDocumentIds.map((documentId) => (
            <span className="document-pill" key={documentId}>
              {documentId}
            </span>
          ))
        ) : (
          <p>Связанных документов пока нет.</p>
        )}
      </section>
    </aside>
  );
}

function AiPanel({
  projectName,
  sectionLabel,
  milestoneTitle,
  selectedTaskTitle,
  selectedProposalIds,
  activityLog,
  onToggleProposal,
  onConfirm,
  onClose,
}: {
  projectName: string;
  sectionLabel: string;
  milestoneTitle: string;
  selectedTaskTitle: string | undefined;
  selectedProposalIds: string[];
  activityLog: string[];
  onToggleProposal: (proposalId: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <aside className="right-panel ai-panel" aria-label="Контекстный AI">
      <header>
        <div>
          <span>AI · предложение → проверка → применение</span>
          <h2>Контекст проекта</h2>
        </div>
        <button onClick={onClose}>Закрыть</button>
      </header>
      <dl className="ai-context">
        <div>
          <dt>Проект</dt>
          <dd>{projectName}</dd>
        </div>
        <div>
          <dt>Раздел</dt>
          <dd>{sectionLabel}</dd>
        </div>
        <div>
          <dt>Рубеж</dt>
          <dd>{milestoneTitle}</dd>
        </div>
        <div>
          <dt>Выбранная задача</dt>
          <dd>{selectedTaskTitle ?? "Не выбрана"}</dd>
        </div>
      </dl>
      <section className="panel-block">
        <h3>Предложения</h3>
        {aiProposals.map((proposal) => (
          <label className="proposal-row" key={proposal.id}>
            <input
              checked={selectedProposalIds.includes(proposal.id)}
              onChange={() => onToggleProposal(proposal.id)}
              type="checkbox"
            />
            <span>
              <strong>{proposal.title}</strong>
              <small>{proposal.description}</small>
            </span>
          </label>
        ))}
        <button
          className="primary-action confirm-ai"
          disabled={selectedProposalIds.length === 0}
          onClick={onConfirm}
        >
          Применить выбранное
        </button>
      </section>
      <section className="panel-block">
        <h3>Что изменилось</h3>
        {activityLog.length ? (
          activityLog.map((item) => <p key={item}>{item}</p>)
        ) : (
          <p>
            AI пока ничего не применял. Изменения появятся только после
            подтверждения.
          </p>
        )}
      </section>
    </aside>
  );
}

function PlaceholderSection({
  section,
  projectName,
}: {
  section: Exclude<ProjectSection, "overview">;
  projectName: string;
}) {
  const meta = projectSections.find((item) => item.id === section);
  return (
    <section className="placeholder-section">
      <span>{projectName}</span>
      <h1>{meta?.label}</h1>
      <p>{meta?.description}</p>
      <div>
        <strong>Структурный placeholder</strong>
        <p>
          Этот экран проверяет shell и навигацию. Реальный инструмент этого
          раздела в текущей задаче не проектируется.
        </p>
      </div>
    </section>
  );
}

function CommandPalette({
  query,
  results,
  selectedIndex,
  onQuery,
  onClose,
  onSelect,
}: {
  query: string;
  results: CommandResult[];
  selectedIndex: number;
  onQuery: (query: string) => void;
  onClose: () => void;
  onSelect: (result: CommandResult) => void;
}) {
  return (
    <div className="command-backdrop" onMouseDown={onClose}>
      <section
        className="command-palette"
        role="dialog"
        aria-label="Командная палитра"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <label>
          <span>Поиск</span>
          <input
            autoFocus
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Проект, раздел или задача"
          />
          <button onClick={onClose}>Закрыть</button>
        </label>
        <div className="command-results">
          {results.length ? (
            results.map((result, index) => (
              <button
                className={selectedIndex === index ? "active" : ""}
                key={result.id}
                onClick={() => onSelect(result)}
              >
                <span>
                  {result.kind === "project"
                    ? "Проект"
                    : result.kind === "section"
                      ? "Раздел"
                      : "Задача"}
                </span>
                <strong>{result.title}</strong>
                <small>{result.subtitle}</small>
              </button>
            ))
          ) : (
            <div className="command-empty">
              <strong>Ничего не найдено</strong>
              <span>
                Попробуйте другое название проекта, раздела или задачи.
              </span>
            </div>
          )}
        </div>
        <footer>
          <span>↑↓ выбрать</span>
          <span>Enter открыть</span>
          <span>Esc закрыть</span>
        </footer>
      </section>
    </div>
  );
}
