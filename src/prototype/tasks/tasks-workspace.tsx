import React, { useEffect, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { PrototypeTask } from "@/prototype/desktop-mock-data";
import {
  getCompletedTasksForList,
  getTaskById,
  getTaskListById,
  getVisibleTaskList,
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
} from "@/prototype/desktop-state";
import { TaskDropGap } from "@/prototype/dnd/task-dnd-primitives";
import {
  getTasksListActiveTasks,
  taskDragId,
  taskInsertionId,
  type TasksInsertionDropData,
  type TasksTaskDragData,
  useTasksDnd,
} from "@/prototype/tasks/tasks-dnd-context";

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
  const [completedOpen, setCompletedOpen] = useState(false);
  const [editingTaskListId, setEditingTaskListId] = useState<string | null>(
    null,
  );
  const [taskListTitleDraft, setTaskListTitleDraft] = useState("");
  const { activeTaskId, dropTarget } = useTasksDnd();
  const taskComposerInputRef = useRef<HTMLInputElement>(null);
  const taskListTitleInputRef = useRef<HTMLInputElement>(null);
  const focusedTask = getTaskById(state, state.taskDetailViewTaskId);
  const selectedList =
    state.taskSelection.kind === "list"
      ? getTaskListById(state, state.taskSelection.listId)
      : undefined;
  const completedTasks = selectedList
    ? getCompletedTasksForList(state, selectedList.id)
    : [];
  const tasks = state.taskDetailViewTaskId
    ? focusedTask
      ? [focusedTask]
      : []
    : getVisibleTaskList(state);
  const positionedTasks = tasks.filter((task) => task.id !== activeTaskId);

  useEffect(() => {
    if (!taskComposerOpen) return;
    taskComposerInputRef.current?.focus();
  }, [taskComposerOpen]);

  useEffect(() => {
    if (editingTaskListId !== selectedList?.id) return;
    const input = taskListTitleInputRef.current;
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  }, [editingTaskListId, selectedList?.id]);

  const closeTaskComposer = (): void => {
    setTaskComposerOpen(false);
    setTaskComposerDraft("");
  };

  const createTaskFromComposer = (): void => {
    const title = taskComposerDraft.trim();
    if (title.length === 0 || !selectedList) return;
    dispatch({
      type: "create-task",
      title,
      destinationListId: selectedList.id,
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
    if (!selectedList) return;
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
          selectedList && editingTaskListId === selectedList.id ? (
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
          ) : selectedList ? (
            <button
              aria-label={`Переименовать список ${selectedList.title}`}
              className="task-list-heading task-list-heading-editable"
              onDoubleClick={startTaskListTitleEdit}
              type="button"
            >
              {selectedList.title}
            </button>
          ) : (
            <h2 className="task-list-heading">{systemHeading}</h2>
          )
        ) : null}
        <SortableContext
          items={[...tasks, ...completedTasks].map((task) =>
            taskDragId(task.id),
          )}
          strategy={verticalListSortingStrategy}
        >
          <div className="task-list">
            {tasks.map((task) => {
              const visibleIndex = positionedTasks.findIndex(
                (item) => item.id === task.id,
              );
              return (
                <React.Fragment key={task.id}>
                  {task.id !== activeTaskId ? (
                    <TaskInsertionSlot
                      index={visibleIndex}
                      isActive={
                        dropTarget?.listId === task.listId &&
                        dropTarget.index === visibleIndex
                      }
                      listId={task.listId}
                    />
                  ) : null}
                  <TaskListRow
                    dispatch={dispatch}
                    isSelected={state.selectedTaskId === task.id}
                    sortable={task.completedAt === null}
                    task={task}
                  />
                </React.Fragment>
              );
            })}
            {selectedList ? (
              <TaskInsertionSlot
                index={
                  getTasksListActiveTasks(
                    state,
                    selectedList.id,
                    activeTaskId ?? "",
                  ).length
                }
                isActive={
                  activeTaskId !== null &&
                  dropTarget?.listId === selectedList.id &&
                  dropTarget.index ===
                    getTasksListActiveTasks(
                      state,
                      selectedList.id,
                      activeTaskId,
                    ).length
                }
                listId={selectedList.id}
              />
            ) : null}
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
                    <TaskListRow
                      dispatch={dispatch}
                      isSelected={state.selectedTaskId === task.id}
                      key={task.id}
                      sortable={false}
                      task={task}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
        </SortableContext>
      </div>
      {state.taskDetailViewTaskId || !selectedList ? null : (
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
              <button type="submit">Добавить</button>
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
  isSelected = false,
  sortable = true,
}: {
  task: PrototypeTask;
  dispatch: Dispatch;
  isSelected?: boolean;
  sortable?: boolean;
}): React.JSX.Element {
  const suppressCardClickUntilRef = useRef(0);
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    disabled: !sortable,
    id: taskDragId(task.id),
    data: {
      type: "tasks-task",
      taskId: task.id,
      listId: task.listId,
    } satisfies TasksTaskDragData,
  });

  useEffect(() => {
    if (isDragging) suppressCardClickUntilRef.current = Date.now() + 500;
  }, [isDragging]);

  return (
    <article
      className={[
        "task-row",
        `task-signal-${task.signal}`,
        isSelected && "is-selected",
        isDragging && "is-dragging",
      ]
        .filter(Boolean)
        .join(" ")}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      onClick={() => {
        if (Date.now() < suppressCardClickUntilRef.current) return;
        dispatch({ type: "select-task", taskId: task.id, section: "tasks" });
      }}
    >
      <button
        aria-label={`Перетащить задачу ${task.title}`}
        {...attributes}
        {...listeners}
        className="task-list-drag-handle"
        onClick={(event) => event.stopPropagation()}
        ref={setActivatorNodeRef}
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
          dispatch({
            type: "toggle-task-completed",
            taskId: task.id,
            completedAt:
              task.completedAt === null ? new Date().toISOString() : null,
          });
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

function TaskInsertionSlot({
  listId,
  index,
  isActive,
}: {
  listId: string;
  index: number;
  isActive: boolean;
}): React.JSX.Element {
  const { setNodeRef } = useDroppable({
    id: taskInsertionId(listId, index),
    data: {
      type: "tasks-insertion",
      listId,
      index,
    } satisfies TasksInsertionDropData,
  });

  return (
    <div
      className={["task-insertion-slot", isActive && "is-active"]
        .filter(Boolean)
        .join(" ")}
      ref={setNodeRef}
    >
      {isActive ? <TaskDropGap /> : null}
    </div>
  );
}
