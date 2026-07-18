import React, { useEffect, useRef, useState } from "react";
import type { PrototypeTask } from "@/prototype/desktop-mock-data";
import {
  getTaskById,
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

export function TaskListRow({
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
