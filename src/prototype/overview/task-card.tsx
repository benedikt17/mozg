"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type JSX,
  type MouseEvent,
} from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { PrototypeTask } from "@/prototype/desktop-mock-data";
import type { DesktopPrototypeAction } from "@/prototype/desktop-state";
import { IconButton } from "@/prototype/desktop-ui";
import {
  taskDragId,
  type OverviewDragData,
} from "@/prototype/overview/overview-dnd";

export function TaskDragOverlay({
  task,
  directionTitle,
}: {
  task: PrototypeTask;
  directionTitle: string;
}): JSX.Element {
  return (
    <article className={`task-card task-signal-${task.signal} drag-overlay`}>
      <div className="task-hit-area">
        <strong>{task.title}</strong>
        <span className="metadata-line">
          {task.area ?? "Общее"} · {directionTitle}
        </span>
      </div>
    </article>
  );
}

export function TaskCard({
  task,
  dispatch,
  editing,
  taskCount,
  taskIndex,
}: {
  task: PrototypeTask;
  dispatch: Dispatch<DesktopPrototypeAction>;
  editing: boolean;
  taskCount: number;
  taskIndex: number;
}): JSX.Element {
  const [titleDraft, setTitleDraft] = useState(task.title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleClickTimerRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  const wasDraggingRef = useRef(false);
  const suppressCardClickUntilRef = useRef(0);
  const doneSubtasks = task.subtasks.filter((subtask) => subtask.done).length;
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: taskDragId(task.id),
    data: {
      type: "overview-task",
      taskId: task.id,
      directionId: task.overviewDirectionId,
    } satisfies OverviewDragData,
  });

  useEffect(() => {
    if (!editing) return;
    cancelledRef.current = false;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [editing]);

  useEffect(
    () => () => {
      if (titleClickTimerRef.current !== null) {
        window.clearTimeout(titleClickTimerRef.current);
      }
    },
    [],
  );

  const clearPendingTitleClick = (): void => {
    if (titleClickTimerRef.current === null) return;
    window.clearTimeout(titleClickTimerRef.current);
    titleClickTimerRef.current = null;
  };

  useEffect(() => {
    if (isDragging) {
      wasDraggingRef.current = true;
      suppressCardClickUntilRef.current = Date.now() + 500;
      clearPendingTitleClick();
      return;
    }

    if (!wasDraggingRef.current) return;
    wasDraggingRef.current = false;
    suppressCardClickUntilRef.current = Date.now() + 400;
  }, [isDragging]);

  const openTaskDetails = (): void => {
    dispatch({
      type: "select-task",
      taskId: task.id,
      section: "overview",
    });
  };

  const beginTitleEdit = (): void => {
    clearPendingTitleClick();
    setTitleDraft(task.title);
    dispatch({ type: "begin-task-title-edit", taskId: task.id });
  };

  const commitTitle = (): void => {
    dispatch({
      type: "commit-task-title-edit",
      taskId: task.id,
      title: titleDraft,
    });
  };

  const handleCardClick = (event: MouseEvent<HTMLElement>): void => {
    if (Date.now() < suppressCardClickUntilRef.current) return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    const titleTrigger = target.closest(".task-title-trigger");
    const detailsTrigger = target.closest(".task-details-trigger");
    const interactiveControl = target.closest(
      "button, input, textarea, select, a, [role='button']",
    );

    if (interactiveControl && !titleTrigger && !detailsTrigger) return;

    if (titleTrigger) {
      clearPendingTitleClick();
      titleClickTimerRef.current = window.setTimeout(() => {
        titleClickTimerRef.current = null;
        openTaskDetails();
      }, 300);
      return;
    }

    clearPendingTitleClick();
    openTaskDetails();
  };

  return (
    <article
      className={[
        "task-card",
        `task-signal-${task.signal}`,
        isDragging ? "is-dragging" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={handleCardClick}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <IconButton
        active={task.starred}
        className="task-star-control"
        icon={task.starred ? "★" : "☆"}
        label={task.starred ? "Убрать из важных" : "Пометить важной"}
        onClick={(event) => {
          event.stopPropagation();
          dispatch({ type: "toggle-task-star", taskId: task.id });
        }}
        onPointerDown={(event) => event.stopPropagation()}
        variant="ghost"
      />
      <button
        {...attributes}
        {...listeners}
        aria-label={`Перетащить задачу ${task.title}`}
        className="task-drag-handle"
        onClick={(event) => event.stopPropagation()}
        onKeyDownCapture={(event) => {
          if (
            !event.altKey ||
            (event.key !== "ArrowUp" && event.key !== "ArrowDown")
          ) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          const targetIndex =
            event.key === "ArrowUp"
              ? Math.max(0, taskIndex - 1)
              : Math.min(taskCount - 1, taskIndex + 1);
          if (targetIndex === taskIndex) return;
          dispatch({
            type: "move-overview-task",
            taskId: task.id,
            targetDirectionId: task.overviewDirectionId,
            targetIndex,
          });
        }}
        ref={setActivatorNodeRef}
        title="Перетащить задачу; Alt+↑/↓ — изменить приоритет"
        type="button"
      >
        ⠿
      </button>
      <div className="task-hit-area" {...listeners}>
        {editing ? (
          <input
            aria-label={`Редактировать название задачи ${task.title}`}
            className="task-title-input"
            onBlur={() => {
              if (cancelledRef.current) {
                cancelledRef.current = false;
                return;
              }
              commitTitle();
            }}
            onChange={(event) => setTitleDraft(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                commitTitle();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                cancelledRef.current = true;
                dispatch({ type: "cancel-task-title-edit" });
              }
            }}
            ref={titleInputRef}
            value={titleDraft}
          />
        ) : (
          <button
            className="task-title-trigger"
            onDoubleClick={(event) => {
              event.preventDefault();
              beginTitleEdit();
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              beginTitleEdit();
            }}
            title="Двойной щелчок или Enter — изменить название"
            type="button"
          >
            <strong>{task.title}</strong>
          </button>
        )}
        <button
          aria-label={`Открыть детали задачи ${task.title}`}
          className="task-details-trigger"
          type="button"
        >
          <span className="metadata-line">
            {task.area ?? "Общее"} · {task.dueDate ?? "без срока"} ·{" "}
            {task.linkedDocumentIds.length} док. · {doneSubtasks}/
            {task.subtasks.length || 0}
          </span>
        </button>
      </div>
    </article>
  );
}
