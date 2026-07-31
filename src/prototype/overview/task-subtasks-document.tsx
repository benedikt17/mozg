"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  PrototypeSubtask,
  PrototypeTask,
} from "@/prototype/desktop-mock-data";
import type { DesktopPrototypeAction } from "@/prototype/state/types";
import { MarkdownStringPreview } from "@/prototype/knowledge/markdown-document-preview";
import { createTaskTitleEditLifecycle } from "@/prototype/context-panels/task-title-edit-lifecycle";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;
type MoveDirection = "up" | "down";

export function getSubtaskMoveTarget(
  subtasks: PrototypeSubtask[],
  subtaskId: string,
  direction: MoveDirection,
): string | null {
  const index = subtasks.findIndex((subtask) => subtask.id === subtaskId);
  if (index < 0) return null;
  if (direction === "up") return subtasks[index - 1]?.id ?? null;
  return subtasks[index + 2]?.id ?? null;
}

export function getTaskSubtasksDocumentLayout(): {
  showRedundantHeading: boolean;
  showSequenceNumbers: boolean;
} {
  return { showRedundantHeading: false, showSequenceNumbers: false };
}

function resizeDetailsEditor(editor: HTMLTextAreaElement): void {
  editor.style.height = "auto";
  editor.style.height = `${editor.scrollHeight}px`;
}

function SubtaskCheckbox({
  subtask,
  taskId,
  dispatch,
}: {
  subtask: PrototypeSubtask;
  taskId: string;
  dispatch: Dispatch;
}): React.JSX.Element {
  return (
    <input
      aria-label={`${subtask.done ? "Отметить невыполненной" : "Отметить выполненной"}: ${subtask.title}`}
      checked={subtask.done}
      className="task-subtask-document-checkbox"
      onChange={() =>
        dispatch({
          type: "toggle-subtask",
          taskId,
          subtaskId: subtask.id,
        })
      }
      type="checkbox"
    />
  );
}

export function TaskSubtasksDocument({
  dispatch,
  editing,
  task,
}: {
  dispatch: Dispatch;
  editing: boolean;
  task: PrototypeTask;
}): React.JSX.Element {
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [subtaskTitleDraft, setSubtaskTitleDraft] = useState("");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const newSubtaskInputRef = useRef<HTMLInputElement>(null);
  const detailsEditorRefs = useRef(new Map<string, HTMLTextAreaElement>());
  const titleEditLifecycleRef = useRef(createTaskTitleEditLifecycle());
  useEffect(() => {
    if (!editingSubtaskId) return;
    titleInputRef.current?.focus();
    titleInputRef.current?.setSelectionRange(
      titleInputRef.current.value.length,
      titleInputRef.current.value.length,
    );
  }, [editingSubtaskId]);

  useEffect(() => {
    if (editing) newSubtaskInputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (editing) return;
    const frame = window.requestAnimationFrame(() => {
      setEditingSubtaskId(null);
      titleEditLifecycleRef.current.cancel();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editing]);

  useLayoutEffect(() => {
    detailsEditorRefs.current.forEach(resizeDetailsEditor);
  }, [task.subtasks, editing]);

  const startRename = (subtask: PrototypeSubtask): void => {
    titleEditLifecycleRef.current.begin(subtask.id, subtask.title);
    setEditingSubtaskId(subtask.id);
    setSubtaskTitleDraft(subtask.title);
  };

  const finishRename = (value?: string): void => {
    const transition = titleEditLifecycleRef.current.commit(
      value ?? subtaskTitleDraft,
    );
    if (!transition) return;
    const subtask = task.subtasks.find((item) => item.id === transition.taskId);
    const normalizedTitle = transition.title.trim();
    if (
      subtask &&
      normalizedTitle.length > 0 &&
      normalizedTitle !== subtask.title
    ) {
      dispatch({
        type: "rename-subtask",
        taskId: task.id,
        subtaskId: transition.taskId,
        title: transition.title,
      });
    }
    setEditingSubtaskId(null);
    setSubtaskTitleDraft("");
  };

  const cancelRename = (): void => {
    titleEditLifecycleRef.current.cancel();
    setEditingSubtaskId(null);
    setSubtaskTitleDraft("");
  };

  const moveSubtask = (subtaskId: string, direction: MoveDirection): void => {
    const targetSubtaskId = getSubtaskMoveTarget(
      task.subtasks,
      subtaskId,
      direction,
    );
    if (direction === "up" && targetSubtaskId === null) return;
    const index = task.subtasks.findIndex(
      (subtask) => subtask.id === subtaskId,
    );
    if (
      index < 0 ||
      (direction === "down" && index === task.subtasks.length - 1)
    ) {
      return;
    }
    dispatch({
      type: "move-subtask",
      taskId: task.id,
      subtaskId,
      targetSubtaskId,
    });
  };

  const addSubtask = (): void => {
    if (newSubtaskTitle.trim().length === 0) return;
    dispatch({
      type: "add-subtask",
      taskId: task.id,
      title: newSubtaskTitle,
    });
    setNewSubtaskTitle("");
  };

  const requestDelete = (subtask: PrototypeSubtask): void => {
    if (subtask.detailsMarkdown.length > 0) {
      setPendingDeleteId(subtask.id);
      return;
    }
    dispatch({
      type: "delete-subtask",
      taskId: task.id,
      subtaskId: subtask.id,
    });
  };

  const confirmDelete = (subtaskId: string): void => {
    dispatch({ type: "delete-subtask", taskId: task.id, subtaskId });
    setPendingDeleteId(null);
  };

  return (
    <div className="task-subtasks-document">
      {task.subtasks.length === 0 ? (
        <div className="task-subtasks-empty" role="status">
          <strong>Подзадач пока нет</strong>
          <span>
            {editing
              ? "Добавьте первый шаг внизу документа."
              : "Откройте редактирование, чтобы добавить первый шаг."}
          </span>
        </div>
      ) : (
        <div className="task-subtasks-sections">
          {task.subtasks.map((subtask, index) => {
            const isEditingTitle = editingSubtaskId === subtask.id;
            const isPendingDelete = pendingDeleteId === subtask.id;
            return (
              <article
                className={`task-subtask-section ${subtask.done ? "is-complete" : ""}`}
                key={subtask.id}
              >
                <div className="task-subtask-section-grid">
                  <SubtaskCheckbox
                    dispatch={dispatch}
                    subtask={subtask}
                    taskId={task.id}
                  />
                  <div className="task-subtask-section-content">
                    <div className="task-subtask-section-heading">
                      {editing && isEditingTitle ? (
                        <input
                          aria-label={`Название подзадачи: ${subtask.title}`}
                          className="task-subtask-title-input"
                          onBlur={(event) =>
                            finishRename(event.currentTarget.value)
                          }
                          onChange={(event) => {
                            titleEditLifecycleRef.current.update(
                              event.target.value,
                            );
                            setSubtaskTitleDraft(event.target.value);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              finishRename(event.currentTarget.value);
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              cancelRename();
                            }
                          }}
                          ref={titleInputRef}
                          value={subtaskTitleDraft}
                        />
                      ) : (
                        <button
                          className="task-subtask-title"
                          onClick={() =>
                            editing ? startRename(subtask) : undefined
                          }
                          type="button"
                        >
                          {subtask.title}
                        </button>
                      )}
                    </div>

                    {subtask.detailsMarkdown.length > 0 ? (
                      <div className="task-subtask-details-markdown">
                        {editing ? (
                          <textarea
                            aria-label={`Объяснение подзадачи: ${subtask.title}`}
                            onChange={(event) => {
                              dispatch({
                                type: "update-subtask-details-markdown",
                                taskId: task.id,
                                subtaskId: subtask.id,
                                markdown: event.target.value,
                              });
                              resizeDetailsEditor(event.currentTarget);
                            }}
                            placeholder="Добавьте пояснение в Markdown"
                            ref={(element) => {
                              if (element)
                                detailsEditorRefs.current.set(
                                  subtask.id,
                                  element,
                                );
                              else detailsEditorRefs.current.delete(subtask.id);
                            }}
                            value={subtask.detailsMarkdown}
                          />
                        ) : (
                          <MarkdownStringPreview
                            contentId={`subtask-${subtask.id}`}
                            markdown={subtask.detailsMarkdown}
                          />
                        )}
                      </div>
                    ) : editing ? (
                      <div className="task-subtask-details-markdown">
                        <textarea
                          aria-label={`Объяснение подзадачи: ${subtask.title}`}
                          onChange={(event) => {
                            dispatch({
                              type: "update-subtask-details-markdown",
                              taskId: task.id,
                              subtaskId: subtask.id,
                              markdown: event.target.value,
                            });
                            resizeDetailsEditor(event.currentTarget);
                          }}
                          placeholder="Добавьте пояснение в Markdown"
                          ref={(element) => {
                            if (element)
                              detailsEditorRefs.current.set(
                                subtask.id,
                                element,
                              );
                            else detailsEditorRefs.current.delete(subtask.id);
                          }}
                          value={subtask.detailsMarkdown}
                        />
                      </div>
                    ) : null}

                    {editing ? (
                      <div className="task-subtask-edit-controls">
                        <button
                          aria-label={`Переместить вверх: ${subtask.title}`}
                          disabled={index === 0}
                          onClick={() => moveSubtask(subtask.id, "up")}
                          type="button"
                        >
                          ↑ Вверх
                        </button>
                        <button
                          aria-label={`Переместить вниз: ${subtask.title}`}
                          disabled={index === task.subtasks.length - 1}
                          onClick={() => moveSubtask(subtask.id, "down")}
                          type="button"
                        >
                          ↓ Вниз
                        </button>
                        <button
                          className="is-danger"
                          onClick={() => requestDelete(subtask)}
                          type="button"
                        >
                          Удалить
                        </button>
                      </div>
                    ) : null}
                    {isPendingDelete ? (
                      <div
                        aria-label={`Подтверждение удаления: ${subtask.title}`}
                        className="task-subtask-delete-confirmation"
                        role="alertdialog"
                      >
                        <strong>Удалить пояснение вместе с подзадачей?</strong>
                        <span>Это действие удалит весь текст объяснения.</span>
                        <div>
                          <button
                            onClick={() => setPendingDeleteId(null)}
                            type="button"
                          >
                            Отмена
                          </button>
                          <button
                            className="is-danger"
                            onClick={() => confirmDelete(subtask.id)}
                            type="button"
                          >
                            Удалить подзадачу
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editing ? (
        <form
          className="task-subtask-create-row"
          onSubmit={(event) => {
            event.preventDefault();
            addSubtask();
          }}
        >
          <span aria-hidden="true" className="task-subtask-create-marker">
            □
          </span>
          <input
            aria-label="Новая подзадача"
            onChange={(event) => setNewSubtaskTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setNewSubtaskTitle("");
              }
            }}
            placeholder="Добавить подзадачу"
            ref={newSubtaskInputRef}
            value={newSubtaskTitle}
          />
          <button aria-label="Добавить подзадачу" type="submit">
            +
          </button>
        </form>
      ) : null}
    </div>
  );
}
