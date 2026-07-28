"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  createContext,
  useContext,
  useState,
  type JSX,
  type ReactNode,
} from "react";
import type { PrototypeTask } from "@/prototype/desktop-mock-data";
import type {
  DesktopPrototypeAction,
  DesktopPrototypeState,
} from "@/prototype/desktop-state";
import { getVerticalInsertionIndex } from "@/prototype/dnd/vertical-dnd";

export type TaskInsertionTarget = {
  listId: string;
  index: number;
};

export type TasksTaskDragData = {
  type: "tasks-task";
  taskId: string;
  listId: string;
};

export type TasksListDropData = {
  type: "tasks-list";
  listId: string;
};

export type TasksInsertionDropData = {
  type: "tasks-insertion";
  listId: string;
  index: number;
};

export const taskDragId = (taskId: string): string => `tasks-task:${taskId}`;
export const taskListDropId = (listId: string): string =>
  `tasks-list:${listId}`;
export const taskInsertionId = (listId: string, index: number): string =>
  `tasks-insertion:${listId}:${index}`;

function isTasksTaskDragData(value: unknown): value is TasksTaskDragData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === "tasks-task" &&
    typeof candidate.taskId === "string" &&
    typeof candidate.listId === "string"
  );
}

function isTasksListDropData(value: unknown): value is TasksListDropData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === "tasks-list" && typeof candidate.listId === "string"
  );
}

function isTasksInsertionDropData(
  value: unknown,
): value is TasksInsertionDropData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === "tasks-insertion" &&
    typeof candidate.listId === "string" &&
    typeof candidate.index === "number"
  );
}

export function getTasksListActiveTasks(
  state: DesktopPrototypeState,
  listId: string,
  activeTaskId: string,
): PrototypeTask[] {
  return state.tasks
    .filter(
      (task) =>
        task.projectId === state.activeProjectId &&
        task.listId === listId &&
        task.completedAt === null &&
        task.id !== activeTaskId,
    )
    .sort(
      (first, second) =>
        first.taskListOrder - second.taskListOrder ||
        first.id.localeCompare(second.id),
    );
}

function getTasksDropTarget(
  state: DesktopPrototypeState,
  activeTaskId: string,
  event: DragOverEvent | DragEndEvent,
): TaskInsertionTarget | null {
  const over = event.over;
  if (!over) return null;
  const overData = over.data.current;
  if (isTasksInsertionDropData(overData)) {
    const targetTasks = getTasksListActiveTasks(
      state,
      overData.listId,
      activeTaskId,
    );
    return {
      listId: overData.listId,
      index: Math.max(0, Math.min(overData.index, targetTasks.length)),
    };
  }
  if (isTasksListDropData(overData)) {
    return {
      listId: overData.listId,
      index: getTasksListActiveTasks(state, overData.listId, activeTaskId)
        .length,
    };
  }
  if (!isTasksTaskDragData(overData)) return null;
  const targetTasks = getTasksListActiveTasks(
    state,
    overData.listId,
    activeTaskId,
  );
  const overIndex = targetTasks.findIndex(
    (task) => task.id === overData.taskId,
  );
  if (overIndex < 0) return null;
  const translatedRect = event.active.rect.current.translated;
  return {
    listId: overData.listId,
    index: getVerticalInsertionIndex({
      targetCount: targetTasks.length,
      overIndex,
      geometry: translatedRect
        ? {
            activeTop: translatedRect.top,
            activeHeight: translatedRect.height,
            overTop: over.rect.top,
            overHeight: over.rect.height,
          }
        : null,
    }),
  };
}

type TasksDndContextValue = {
  activeTaskId: string | null;
  dropTarget: TaskInsertionTarget | null;
};

const TasksDndContext = createContext<TasksDndContextValue | null>(null);

export function useTasksDnd(): TasksDndContextValue {
  const value = useContext(TasksDndContext);
  if (!value)
    throw new Error("useTasksDnd must be used inside TasksDndProvider");
  return value;
}

export function TasksDndProvider({
  state,
  dispatch,
  children,
}: {
  state: DesktopPrototypeState;
  dispatch: React.Dispatch<DesktopPrototypeAction>;
  children: ReactNode;
}): JSX.Element {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskInsertionTarget | null>(
    null,
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const activeTask = activeTaskId
    ? state.tasks.find((task) => task.id === activeTaskId)
    : undefined;

  const clearDragState = (): void => {
    setActiveTaskId(null);
    setDropTarget(null);
  };

  const handleDragStart = (event: DragStartEvent): void => {
    const dragData = event.active.data.current;
    if (!isTasksTaskDragData(dragData)) return;
    setActiveTaskId(dragData.taskId);
  };

  const handleDragOver = (event: DragOverEvent): void => {
    if (!activeTaskId) return;
    setDropTarget(getTasksDropTarget(state, activeTaskId, event));
  };

  const handleDragEnd = (event: DragEndEvent): void => {
    if (!activeTaskId) return;
    const target = getTasksDropTarget(state, activeTaskId, event);
    if (target) {
      const targetTasks = getTasksListActiveTasks(
        state,
        target.listId,
        activeTaskId,
      );
      dispatch({
        type: "move-task-to-list",
        taskId: activeTaskId,
        targetListId: target.listId,
        targetTaskId: targetTasks[target.index]?.id ?? null,
        ...(state.taskSelection.kind === "system"
          ? { sourceSystemView: state.taskSelection.view }
          : {}),
      });
    }
    clearDragState();
  };

  return (
    <DndContext
      collisionDetection={closestCenter}
      id="tasks-dnd"
      onDragCancel={clearDragState}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      <TasksDndContext.Provider value={{ activeTaskId, dropTarget }}>
        {children}
      </TasksDndContext.Provider>
      <DragOverlay dropAnimation={null}>
        {activeTask ? <TaskRowDragOverlay task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function TaskRowDragOverlay({ task }: { task: PrototypeTask }): JSX.Element {
  return (
    <article
      aria-hidden="true"
      className={["task-row", `task-signal-${task.signal}`, "drag-overlay"]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="task-list-drag-handle">⠿</span>
      <span
        className={
          task.completedAt
            ? "task-completion-checkbox is-completed"
            : "task-completion-checkbox"
        }
      >
        {task.completedAt ? "✓" : ""}
      </span>
      <strong
        className={
          task.completedAt ? "task-row-title is-completed" : "task-row-title"
        }
      >
        {task.title}
      </strong>
      <span className={task.starred ? "star-button active" : "star-button"}>
        ★
      </span>
    </article>
  );
}
