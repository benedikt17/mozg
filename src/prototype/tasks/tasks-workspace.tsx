import React, { useEffect, useRef, useState } from "react";
import type { PrototypeTask } from "@/prototype/desktop-mock-data";
import {
  getCompletedTasksForList,
  getProjectTaskGroups,
  getProjectTaskLists,
  getTaskById,
  getTaskListById,
  getVisibleTaskList,
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
} from "@/prototype/desktop-state";
import { getDraggedTaskId, taskDragMimeType } from "./task-drag";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

export function TasksWorkspace({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  const [taskComposerOpen, setTaskComposerOpen] = useState(false);
  const [taskComposerDraft, setTaskComposerDraft] = useState("");
  const [taskComposerDestinationListId, setTaskComposerDestinationListId] =
    useState("");
  const [completedOpen, setCompletedOpen] = useState(false);
  const [editingTaskListId, setEditingTaskListId] = useState<string | null>(
    null,
  );
  const [taskListTitleDraft, setTaskListTitleDraft] = useState("");
  const taskComposerInputRef = useRef<HTMLInputElement>(null);
  const taskListTitleInputRef = useRef<HTMLInputElement>(null);
  const focusedTask = getTaskById(state, state.taskDetailViewTaskId);
  const selectedList =
    state.taskSelection.kind === "list"
      ? getTaskListById(state, state.taskSelection.listId)
      : undefined;
  const destinationGroups = getProjectTaskGroups(state)
    .map((group) => ({
      group,
      lists: getProjectTaskLists(state).filter(
        (list) => list.groupId === group.id,
      ),
    }))
    .filter(({ lists }) => lists.length > 0);
  const completedTasks = selectedList
    ? getCompletedTasksForList(state, selectedList.id)
    : [];
  const tasks = state.taskDetailViewTaskId
    ? focusedTask
      ? [focusedTask]
      : []
    : getVisibleTaskList(state);

  useEffect(() => {
    if (!taskComposerOpen) return;
    taskComposerInputRef.current?.focus();
  }, [taskComposerOpen]);

  useEffect(() => {
    if (editingTaskListId !== selectedList?.id) return;
    taskListTitleInputRef.current?.focus();
    taskListTitleInputRef.current?.select();
  }, [editingTaskListId, selectedList?.id]);

  const closeTaskComposer = (): void => {
    setTaskComposerOpen(false);
    setTaskComposerDraft("");
    setTaskComposerDestinationListId("");
  };

  const createTaskFromComposer = (): void => {
    const title = taskComposerDraft.trim();
    if (title.length === 0) return;
    const sourceSystemView =
      state.taskSelection.kind === "system"
        ? state.taskSelection.view
        : undefined;
    if (sourceSystemView && taskComposerDestinationListId.length === 0) return;
    dispatch({
      type: "create-task",
      title,
      ...(sourceSystemView
        ? {
            destinationListId: taskComposerDestinationListId,
            sourceSystemView,
          }
        : {}),
    });
    closeTaskComposer();
  };

  const cancelTaskListTitleEdit = (): void => {
    setEditingTaskListId(null);
    setTaskListTitleDraft("");
  };

  const commitTaskListTitleEdit = (): void => {
    if (!selectedList || editingTaskListId !== selectedList.id) return;
    const trimmedTitle = taskListTitleDraft.trim();
    if (trimmedTitle.length === 0) {
      cancelTaskListTitleEdit();
      return;
    }
    dispatch({
      type: "rename-task-list",
      listId: selectedList.id,
      title: trimmedTitle,
    });
    cancelTaskListTitleEdit();
  };

  const startTaskListTitleEdit = (): void => {
    if (!selectedList || selectedList.kind !== "user") return;
    setTaskListTitleDraft(selectedList.title);
    setEditingTaskListId(selectedList.id);
  };

  const systemHeading =
    state.taskSelection.kind === "system"
      ? state.taskSelection.view === "day"
        ? "Задачи на день"
        : state.taskSelection.view === "important"
          ? "Важные"
          : "Все"
      : "Все";

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
        {!state.taskDetailViewTaskId ? (
          selectedList?.kind === "user" &&
          editingTaskListId === selectedList.id ? (
            <form
              className="task-list-heading-edit-form"
              onSubmit={(event) => {
                event.preventDefault();
                commitTaskListTitleEdit();
              }}
            >
              <input
                aria-label="Переименовать список"
                className="task-list-heading-edit-input"
                onBlur={commitTaskListTitleEdit}
                onChange={(event) => setTaskListTitleDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Escape") return;
                  event.preventDefault();
                  cancelTaskListTitleEdit();
                }}
                ref={taskListTitleInputRef}
                value={taskListTitleDraft}
              />
            </form>
          ) : selectedList?.kind === "user" ? (
            <button
              aria-label={`Переименовать список ${selectedList.title}`}
              className="task-list-heading task-list-heading-editable"
              onClick={startTaskListTitleEdit}
              type="button"
            >
              {selectedList.title}
            </button>
          ) : (
            <h2 className="task-list-heading">
              {selectedList?.title ?? systemHeading}
            </h2>
          )
        ) : null}
        <div className="task-list">
          {tasks.map((task) => (
            <TaskListRow
              dispatch={dispatch}
              key={task.id}
              sourceSystemView={
                state.taskSelection.kind === "system"
                  ? state.taskSelection.view
                  : undefined
              }
              task={task}
            />
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
              if (!taskId || !selectedList) return;
              dispatch({
                type: "move-task-to-list",
                taskId,
                targetListId: selectedList.id,
                targetTaskId: null,
                ...(state.taskSelection.kind === "system"
                  ? { sourceSystemView: state.taskSelection.view }
                  : {}),
              });
            }}
          />
        </div>
        {selectedList && completedTasks.length > 0 ? (
          <section className="task-completed-section">
            <button
              aria-expanded={completedOpen}
              className="task-completed-toggle"
              onClick={() => setCompletedOpen((open) => !open)}
              type="button"
            >
              <span>{`Завершённые — ${completedTasks.length}`}</span>
              <span aria-hidden="true">{completedOpen ? "⌄" : "›"}</span>
            </button>
            {completedOpen ? (
              <div className="task-list">
                {completedTasks.map((task) => (
                  <TaskListRow dispatch={dispatch} key={task.id} task={task} />
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
      {state.taskDetailViewTaskId ||
      (state.taskSelection.kind !== "system" && !selectedList) ? null : (
        <div className="task-list-composer">
          {taskComposerOpen ? (
            <form
              className="task-list-composer-form"
              onSubmit={(event) => {
                event.preventDefault();
                createTaskFromComposer();
              }}
            >
              <input
                aria-label="Название новой задачи"
                onBlur={(event) => {
                  if (
                    event.relatedTarget instanceof Node &&
                    event.currentTarget.form?.contains(event.relatedTarget)
                  ) {
                    return;
                  }
                  if (taskComposerDraft.trim().length === 0)
                    closeTaskComposer();
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
              {state.taskSelection.kind === "system" ? (
                <select
                  aria-label="Выберите список для новой задачи"
                  className="task-composer-destination"
                  onChange={(event) =>
                    setTaskComposerDestinationListId(event.target.value)
                  }
                  value={taskComposerDestinationListId}
                >
                  <option value="">Выберите список</option>
                  {destinationGroups.map(({ group, lists }) => (
                    <optgroup key={group.id} label={group.title}>
                      {lists.map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.title}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              ) : null}
              {state.taskSelection.kind === "system" ? (
                <button
                  disabled={taskComposerDestinationListId.length === 0}
                  type="submit"
                >
                  Добавить
                </button>
              ) : null}
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

export function TaskListRow({
  task,
  dispatch,
  sourceSystemView,
}: {
  task: PrototypeTask;
  dispatch: Dispatch;
  sourceSystemView?: "day" | "important" | "all";
}): React.JSX.Element {
  const [isDragging, setIsDragging] = useState(false);
  const didDragRef = useRef(false);
  return (
    <article
      className={[
        "task-row",
        `task-signal-${task.signal}`,
        isDragging && "is-dragging",
      ]
        .filter(Boolean)
        .join(" ")}
      draggable={task.completedAt === null}
      onClick={() => {
        if (didDragRef.current) {
          didDragRef.current = false;
          return;
        }
        dispatch({ type: "select-task", taskId: task.id, section: "tasks" });
      }}
      onDragEnd={() => {
        setIsDragging(false);
      }}
      onDragStart={(event) => {
        if (task.completedAt !== null) {
          event.preventDefault();
          return;
        }
        didDragRef.current = true;
        setIsDragging(true);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(taskDragMimeType, task.id);
        event.dataTransfer.setData("text/plain", task.id);
      }}
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
          type: "move-task-to-list",
          taskId,
          targetListId: task.listId,
          targetTaskId: task.id,
          ...(sourceSystemView ? { sourceSystemView } : {}),
        });
      }}
    >
      <button
        aria-label={`Перетащить задачу ${task.title}`}
        className="task-list-drag-handle"
        onClick={(event) => event.stopPropagation()}
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
        draggable={false}
        onDragStart={(event) => event.stopPropagation()}
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
        draggable={false}
        onDragStart={(event) => event.stopPropagation()}
        type="button"
      >
        ★
      </button>
    </article>
  );
}
