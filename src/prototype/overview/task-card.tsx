"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type JSX,
  type MouseEvent,
} from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  PrototypeDocument,
  PrototypeTask,
} from "@/prototype/desktop-mock-data";
import type { DesktopPrototypeAction } from "@/prototype/desktop-state";
import { IconButton } from "@/prototype/desktop-ui";
import {
  taskDragId,
  type OverviewDragData,
} from "@/prototype/overview/overview-dnd";

export function TaskDragOverlay({
  task,
}: {
  task: PrototypeTask;
}): JSX.Element {
  return (
    <article className={`task-card task-signal-${task.signal} drag-overlay`}>
      <div className="task-hit-area">
        <strong className="task-card-title">{task.title}</strong>
      </div>
    </article>
  );
}

function EditableTaskTitle({
  task,
  dispatch,
}: {
  task: PrototypeTask;
  dispatch: Dispatch<DesktopPrototypeAction>;
}): JSX.Element {
  const titleEditorRef = useRef<HTMLTextAreaElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);

  useLayoutEffect(() => {
    if (!editing) return;
    const editor = titleEditorRef.current;
    if (!editor) return;
    resizeTitleEditor(editor);
    editor.focus();
    const caretPosition = editor.value.length;
    editor.setSelectionRange(caretPosition, caretPosition);
  }, [editing]);

  const commitTitle = (value: string): void => {
    const title = value.trim();
    const nextTitle = title.length > 0 ? title : task.title;
    setDraft(nextTitle);
    setEditing(false);
    if (nextTitle === task.title) return;
    dispatch({ type: "edit-task-title", taskId: task.id, title: nextTitle });
  };

  if (!editing) {
    return (
      <button
        className="task-card-title task-card-title-edit-trigger"
        onClick={(event) => {
          event.stopPropagation();
          setDraft(task.title);
          setEditing(true);
        }}
        onPointerDown={(event) => event.stopPropagation()}
        title="Изменить название задачи"
        type="button"
      >
        {task.title}
      </button>
    );
  }

  return (
    <textarea
      aria-label={`Название задачи ${task.title}`}
      className="task-card-title-input"
      onBlur={(event) => commitTitle(event.currentTarget.value)}
      onChange={(event) => {
        setDraft(event.currentTarget.value);
        resizeTitleEditor(event.currentTarget);
      }}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setDraft(task.title);
          setEditing(false);
        }
      }}
      onPointerDown={(event) => event.stopPropagation()}
      ref={titleEditorRef}
      rows={1}
      value={draft}
    />
  );
}

export function TaskCard({
  task,
  documents,
  dispatch,
  drawerOpen,
  expanded,
  onToggleExpanded,
  taskCount,
  taskIndex,
}: {
  task: PrototypeTask;
  documents: PrototypeDocument[];
  dispatch: Dispatch<DesktopPrototypeAction>;
  drawerOpen: boolean;
  expanded: boolean;
  onToggleExpanded: (taskId: string) => void;
  taskCount: number;
  taskIndex: number;
}): JSX.Element {
  const wasDraggingRef = useRef(false);
  const suppressCardClickUntilRef = useRef(0);
  const attachedDocuments = task.linkedDocumentIds
    .map((documentId) =>
      documents.find((document) => document.id === documentId),
    )
    .filter(
      (document): document is PrototypeDocument => document !== undefined,
    );
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
    if (isDragging) {
      wasDraggingRef.current = true;
      suppressCardClickUntilRef.current = Date.now() + 500;
      return;
    }

    if (!wasDraggingRef.current) return;
    wasDraggingRef.current = false;
    suppressCardClickUntilRef.current = Date.now() + 400;
  }, [isDragging]);

  const handleCardClick = (event: MouseEvent<HTMLElement>): void => {
    if (Date.now() < suppressCardClickUntilRef.current) return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    const interactiveControl = target.closest(
      "button, input, textarea, select, a, [role='button']",
    );
    if (interactiveControl) return;
    onToggleExpanded(task.id);
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
        aria-pressed={task.starred}
        className={["task-star-control", task.starred ? "is-starred" : ""]
          .filter(Boolean)
          .join(" ")}
        icon={
          <svg
            aria-hidden="true"
            fill={task.starred ? "#facc15" : "transparent"}
            height="16"
            viewBox="0 0 24 24"
            width="16"
          >
            <path
              d="m12 2.75 2.78 5.63 6.22.9-4.5 4.39 1.06 6.2L12 16.94l-5.56 2.93 1.06-6.2L3 9.28l6.22-.9L12 2.75Z"
              stroke="#111111"
              strokeLinejoin="round"
              strokeWidth="1"
            />
          </svg>
        }
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
      <div className="task-hit-area">
        <div
          className="task-card-heading"
          style={{ gridTemplateColumns: "minmax(0, 1fr) auto" }}
        >
          {expanded ? (
            <EditableTaskTitle dispatch={dispatch} key={task.id} task={task} />
          ) : (
            <strong className="task-card-title">{task.title}</strong>
          )}
          <IconButton
            aria-controls={`task-card-details-${task.id}`}
            aria-expanded={expanded}
            icon={
              <svg
                aria-hidden="true"
                fill="none"
                height="16"
                viewBox="0 0 24 24"
                width="16"
              >
                <path
                  d={expanded ? "M7 10l5 5 5-5" : "M10 7l5 5-5 5"}
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                />
              </svg>
            }
            label={
              expanded
                ? `Свернуть задачу ${task.title}`
                : `Развернуть задачу ${task.title}`
            }
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpanded(task.id);
            }}
            onPointerDown={(event) => event.stopPropagation()}
            variant="ghost"
          />
        </div>
        {expanded ? (
          <div
            className="task-card-expanded"
            id={`task-card-details-${task.id}`}
          >
            {task.subtasks.length > 0 ? (
              <section className="task-card-expanded-section">
                <h4>Подзадачи</h4>
                <ul className="task-card-subtasks">
                  {task.subtasks.map((subtask) => (
                    <li
                      aria-label={`${subtask.done ? "Выполнено" : "Не выполнено"}: ${subtask.title}`}
                      className={subtask.done ? "is-complete" : ""}
                      key={subtask.id}
                    >
                      <input
                        aria-label={`${subtask.done ? "Отметить невыполненной" : "Отметить выполненной"}: ${subtask.title}`}
                        checked={subtask.done}
                        onChange={() =>
                          dispatch({
                            type: "toggle-subtask",
                            taskId: task.id,
                            subtaskId: subtask.id,
                          })
                        }
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                        type="checkbox"
                      />
                      <span>{subtask.title}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {task.links.length > 0 ? (
              <section className="task-card-expanded-section">
                <h4>Ссылки</h4>
                <ul className="task-card-resource-list">
                  {task.links.map((link) => (
                    <li key={link.id}>
                      <a
                        href={link.url}
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {link.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {attachedDocuments.length > 0 ? (
              <section className="task-card-expanded-section">
                <h4>Статьи</h4>
                <ul className="task-card-resource-list">
                  {attachedDocuments.map((document) => (
                    <li key={document.id}>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          dispatch({
                            type: "open-overview-task-article",
                            taskId: task.id,
                            documentId: document.id,
                          });
                        }}
                        onPointerDown={(event) => event.stopPropagation()}
                        type="button"
                      >
                        {document.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
      {expanded ? (
        <button
          className="quiet-text-link task-card-details-link"
          onClick={(event) => {
            event.stopPropagation();
            if (drawerOpen) {
              dispatch({ type: "close-context-panel" });
              return;
            }
            dispatch({
              type: "select-task",
              taskId: task.id,
              section: "overview",
            });
          }}
          onPointerDown={(event) => event.stopPropagation()}
          type="button"
        >
          {drawerOpen ? "← Проще" : "Подробнее →"}
        </button>
      ) : null}
    </article>
  );
}

function resizeTitleEditor(editor: HTMLTextAreaElement): void {
  editor.style.height = "auto";
  const borderHeight = editor.offsetHeight - editor.clientHeight;
  editor.style.height = `${editor.scrollHeight + borderHeight}px`;
}
