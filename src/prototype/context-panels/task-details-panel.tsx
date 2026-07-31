import React, { useEffect, useRef, useState } from "react";
import type {
  PrototypeDocument,
  PrototypeTask,
} from "@/prototype/desktop-mock-data";
import {
  getDocumentById,
  getOverviewTaskDetailMaterial,
  getOverviewTaskDetailSplitDocument,
  isValidTaskLinkUrl,
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
} from "@/prototype/desktop-state";
import {
  ContextPanelSection,
  IconButton,
  PrototypeButton,
} from "@/prototype/desktop-ui";
import { getKnowledgePaneState } from "@/prototype/state/knowledge-state";
import { createTaskTitleEditLifecycle } from "./task-title-edit-lifecycle";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

export function TaskDetailsPanel({
  task,
  state,
  dispatch,
  overviewMode = false,
}: {
  task: PrototypeTask;
  state: DesktopPrototypeState;
  dispatch: Dispatch;
  overviewMode?: boolean;
}): React.JSX.Element {
  const [editingTaskTitle, setEditingTaskTitle] = useState(false);
  const [taskTitleDraft, setTaskTitleDraft] = useState(task.title);
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [subtaskTitleDraft, setSubtaskTitleDraft] = useState("");
  const [openSubtaskMenuId, setOpenSubtaskMenuId] = useState<string | null>(
    null,
  );
  const [openArticleMenuId, setOpenArticleMenuId] = useState<string | null>(
    null,
  );
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [linkTitleDraft, setLinkTitleDraft] = useState("");
  const [linkUrlDraft, setLinkUrlDraft] = useState("");
  const subtaskAddButtonRef = useRef<HTMLButtonElement>(null);
  const subtaskAddInputRef = useRef<HTMLInputElement>(null);
  const subtaskEditInputRef = useRef<HTMLInputElement>(null);
  const taskTitleInputRef = useRef<HTMLInputElement>(null);
  const taskTitleEditLifecycleRef = useRef(createTaskTitleEditLifecycle());
  const subtaskRenameCancelledRef = useRef(false);
  const attachedDocuments = task.linkedDocumentIds
    .map((documentId) => getDocumentById(state, documentId))
    .filter(
      (document): document is PrototypeDocument =>
        document !== undefined && document.projectId === task.projectId,
    );
  const overviewMaterial = overviewMode
    ? getOverviewTaskDetailMaterial(state, task.id)
    : null;
  const overviewSplitDocument = overviewMode
    ? getOverviewTaskDetailSplitDocument(state, task.id)
    : undefined;
  const activeKnowledgeDocumentId = overviewMode
    ? overviewSplitDocument
      ? overviewSplitDocument.id
      : overviewMaterial?.kind === "knowledge"
        ? overviewMaterial.documentId
        : null
    : getKnowledgePaneState(state).activeDocument?.id;

  useEffect(() => {
    if (!editingTaskTitle) return;
    const input = taskTitleInputRef.current;
    if (!input) return;
    input.focus();
    const caretPosition = task.title.length;
    input.setSelectionRange(caretPosition, caretPosition);
  }, [editingTaskTitle, task.title]);

  function startTaskTitleEdit(event: React.MouseEvent<HTMLElement>): void {
    event.stopPropagation();
    setTaskTitleDraft(task.title);
    taskTitleEditLifecycleRef.current.begin(task.id, task.title);
    setEditingTaskTitle(true);
    dispatch({ type: "begin-task-title-edit", taskId: task.id });
  }

  function commitTaskTitleEdit(title?: string): void {
    const transition = taskTitleEditLifecycleRef.current.commit(
      title ?? taskTitleInputRef.current?.value,
    );
    if (!transition) return;
    setEditingTaskTitle(false);
    dispatch({
      type: "commit-task-title-edit",
      taskId: transition.taskId,
      title: transition.title,
    });
  }

  function cancelTaskTitleEdit(): void {
    const transition = taskTitleEditLifecycleRef.current.cancel();
    if (!transition) return;
    setTaskTitleDraft(transition.originalTitle);
    setEditingTaskTitle(false);
    dispatch({ type: "cancel-task-title-edit" });
  }

  useEffect(() => {
    if (!editingSubtaskId) return;
    const input = subtaskEditInputRef.current;
    input?.focus();
    if (input) {
      const caretPosition = input.value.length;
      input.setSelectionRange(caretPosition, caretPosition);
    }
  }, [editingSubtaskId]);

  useEffect(() => {
    if (!isAddingSubtask) return;
    subtaskAddInputRef.current?.focus();
  }, [isAddingSubtask]);

  function addSubtask(): void {
    const trimmedTitle = newSubtaskTitle.trim();
    if (trimmedTitle.length === 0) return;
    dispatch({
      type: "add-subtask",
      taskId: task.id,
      title: trimmedTitle,
    });
    setNewSubtaskTitle("");
  }

  function closeSubtaskComposer({
    restoreFocus = false,
  }: {
    restoreFocus?: boolean;
  } = {}): void {
    setNewSubtaskTitle("");
    setIsAddingSubtask(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => subtaskAddButtonRef.current?.focus());
    }
  }

  function startSubtaskRename(subtaskId: string, title: string): void {
    setOpenSubtaskMenuId(null);
    subtaskRenameCancelledRef.current = false;
    setEditingSubtaskId(subtaskId);
    setSubtaskTitleDraft(title);
  }

  function commitSubtaskRename(): void {
    if (!editingSubtaskId) return;
    if (subtaskTitleDraft.trim().length > 0) {
      dispatch({
        type: "rename-subtask",
        taskId: task.id,
        subtaskId: editingSubtaskId,
        title: subtaskTitleDraft,
      });
    }
    setEditingSubtaskId(null);
    setSubtaskTitleDraft("");
  }

  function cancelSubtaskRename(): void {
    setEditingSubtaskId(null);
    setSubtaskTitleDraft("");
  }

  function addTaskLink(): void {
    if (newLinkTitle.trim().length === 0 || !isValidTaskLinkUrl(newLinkUrl)) {
      return;
    }

    dispatch({
      type: "add-task-link",
      taskId: task.id,
      title: newLinkTitle,
      url: newLinkUrl,
    });
    setNewLinkTitle("");
    setNewLinkUrl("");
  }

  function startTaskLinkEdit(linkId: string): void {
    const link = task.links.find((item) => item.id === linkId);
    if (!link) return;
    setEditingLinkId(link.id);
    setLinkTitleDraft(link.title);
    setLinkUrlDraft(link.url);
  }

  function commitTaskLinkEdit(): void {
    if (
      !editingLinkId ||
      linkTitleDraft.trim().length === 0 ||
      !isValidTaskLinkUrl(linkUrlDraft)
    ) {
      return;
    }

    dispatch({
      type: "edit-task-link",
      taskId: task.id,
      linkId: editingLinkId,
      title: linkTitleDraft,
      url: linkUrlDraft,
    });
    setEditingLinkId(null);
    setLinkTitleDraft("");
    setLinkUrlDraft("");
  }

  function cancelTaskLinkEdit(): void {
    setEditingLinkId(null);
    setLinkTitleDraft("");
    setLinkUrlDraft("");
  }

  return (
    <div
      className="panel-stack overview-reader-task-details"
      onPointerDownCapture={(event) => {
        if (
          taskTitleEditLifecycleRef.current.activeTaskId === null ||
          event.target === taskTitleInputRef.current
        ) {
          return;
        }
        commitTaskTitleEdit();
      }}
    >
      {editingTaskTitle ? (
        <input
          aria-label={`Название задачи: ${task.title}`}
          className="subtask-title-input task-details-inline-title-input"
          onBlur={(event) => commitTaskTitleEdit(event.currentTarget.value)}
          onChange={(event) => {
            taskTitleEditLifecycleRef.current.update(event.target.value);
            setTaskTitleDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitTaskTitleEdit(event.currentTarget.value);
            }
            if (event.key === "Escape") {
              event.preventDefault();
              cancelTaskTitleEdit();
            }
          }}
          onPointerDown={(event) => event.stopPropagation()}
          ref={taskTitleInputRef}
          value={taskTitleDraft}
        />
      ) : (
        <button
          className="task-details-title-button overview-reader-task-title"
          onClick={startTaskTitleEdit}
          onPointerDown={(event) => event.stopPropagation()}
          type="button"
        >
          {task.title}
        </button>
      )}
      <div
        aria-label="Подзадачи"
        className="task-details-tab-panel"
        id={`task-details-${task.id}-subtasks-panel`}
        role="region"
      >
        {overviewMode ? (
          <button
            aria-current={
              overviewMaterial?.kind === "subtasks" ? "page" : undefined
            }
            className="task-details-section-heading-button"
            onClick={(event) => {
              event.stopPropagation();
              dispatch({
                type: "open-overview-task-subtasks",
                taskId: task.id,
              });
            }}
            onPointerDown={(event) => event.stopPropagation()}
            type="button"
          >
            Подзадачи
          </button>
        ) : (
          <h3>Подзадачи</h3>
        )}
        <section className="context-section task-subtasks-section">
          {task.subtasks.map((subtask) => (
            <div className="subtask-row" key={subtask.id}>
              <button
                aria-checked={subtask.done}
                aria-label={subtask.title}
                className="subtask-checkbox"
                onClick={(event) => {
                  event.stopPropagation();
                  dispatch({
                    type: "toggle-subtask",
                    taskId: task.id,
                    subtaskId: subtask.id,
                  });
                }}
                role="checkbox"
                type="button"
              />
              {editingSubtaskId === subtask.id ? (
                <input
                  aria-label={`Название подзадачи: ${subtask.title}`}
                  className="subtask-title-input"
                  onBlur={() => {
                    if (subtaskRenameCancelledRef.current) {
                      subtaskRenameCancelledRef.current = false;
                      return;
                    }
                    commitSubtaskRename();
                  }}
                  onChange={(event) => setSubtaskTitleDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitSubtaskRename();
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      subtaskRenameCancelledRef.current = true;
                      cancelSubtaskRename();
                    }
                  }}
                  ref={subtaskEditInputRef}
                  value={subtaskTitleDraft}
                />
              ) : (
                <button
                  className="subtask-title-button"
                  onClick={() => startSubtaskRename(subtask.id, subtask.title)}
                  type="button"
                >
                  {subtask.title}
                </button>
              )}
              <div
                className="subtask-actions"
                onKeyDown={(event) => {
                  if (event.key !== "Escape") return;
                  event.preventDefault();
                  event.stopPropagation();
                  setOpenSubtaskMenuId(null);
                }}
              >
                <IconButton
                  aria-expanded={openSubtaskMenuId === subtask.id}
                  aria-haspopup="menu"
                  className="subtask-actions-button"
                  icon={
                    <span aria-hidden="true" className="task-details-more-icon">
                      <span />
                      <span />
                      <span />
                    </span>
                  }
                  label={`Действия подзадачи: ${subtask.title}`}
                  onClick={() =>
                    setOpenSubtaskMenuId((currentId) =>
                      currentId === subtask.id ? null : subtask.id,
                    )
                  }
                  title={`Действия подзадачи: ${subtask.title}`}
                />
                {openSubtaskMenuId === subtask.id ? (
                  <>
                    <button
                      aria-label="Закрыть меню подзадачи"
                      className="subtask-menu-dismiss"
                      onClick={() => setOpenSubtaskMenuId(null)}
                      tabIndex={-1}
                      type="button"
                    />
                    <div className="subtask-actions-menu" role="menu">
                      <button
                        className="subtask-delete-action"
                        onClick={() => {
                          dispatch({
                            type: "delete-subtask",
                            taskId: task.id,
                            subtaskId: subtask.id,
                          });
                          if (editingSubtaskId === subtask.id) {
                            cancelSubtaskRename();
                          }
                          setOpenSubtaskMenuId(null);
                        }}
                        role="menuitem"
                        type="button"
                      >
                        Удалить подзадачу
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ))}
          {isAddingSubtask ? (
            <form
              className="subtask-add-editor"
              onSubmit={(event) => {
                event.preventDefault();
                addSubtask();
              }}
            >
              <span aria-hidden="true" className="subtask-add-circle" />
              <input
                aria-label="Новая подзадача"
                onBlur={() => closeSubtaskComposer()}
                onChange={(event) => setNewSubtaskTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Escape") return;
                  event.preventDefault();
                  closeSubtaskComposer({ restoreFocus: true });
                }}
                placeholder="Введите следующий шаг"
                ref={subtaskAddInputRef}
                value={newSubtaskTitle}
              />
            </form>
          ) : (
            <button
              aria-label="Добавить следующий шаг"
              className="subtask-add-trigger"
              onClick={() => setIsAddingSubtask(true)}
              ref={subtaskAddButtonRef}
              type="button"
            >
              <span aria-hidden="true">+</span>
              <span>Следующий шаг</span>
            </button>
          )}
        </section>
      </div>
      <div
        aria-label="Статьи"
        className="task-details-tab-panel"
        id={`task-details-${task.id}-articles-panel`}
        role="region"
      >
        <ContextPanelSection title="Статьи">
          {attachedDocuments.map((document) => (
            <div
              className={`task-article-row ${
                activeKnowledgeDocumentId === document.id ? "is-active" : ""
              }`}
              key={document.id}
            >
              <button
                className="task-article-link"
                onClick={() =>
                  dispatch(
                    overviewMode
                      ? {
                          type: state.overviewTaskDetailSplit.enabled
                            ? "select-overview-task-split-article"
                            : "open-overview-task-article",
                          taskId: task.id,
                          documentId: document.id,
                        }
                      : {
                          type: "select-document",
                          documentId: document.id,
                        },
                  )
                }
                type="button"
              >
                {document.title}
              </button>
              <IconButton
                aria-expanded={openArticleMenuId === document.id}
                className="subtask-actions-button"
                label={`Открепить статью: ${document.title}`}
                title={`Открепить статью: ${document.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpenArticleMenuId((currentId) =>
                    currentId === document.id ? null : document.id,
                  );
                }}
                icon={
                  <span aria-hidden="true" className="task-details-more-icon">
                    <span />
                    <span />
                    <span />
                  </span>
                }
              />
              {openArticleMenuId === document.id ? (
                <div className="subtask-actions-menu" role="menu">
                  <button
                    className="subtask-delete-action"
                    onClick={() => {
                      dispatch({
                        type: "detach-task-document",
                        taskId: task.id,
                        documentId: document.id,
                      });
                      setOpenArticleMenuId(null);
                    }}
                    role="menuitem"
                    type="button"
                  >
                    Удалить
                  </button>
                </div>
              ) : null}
            </div>
          ))}
          <PrototypeButton
            onClick={() => {
              dispatch({
                type: "open-knowledge-article-attach",
                taskId: task.id,
                origin: {
                  section:
                    state.activeSection === "overview" ? "overview" : "tasks",
                  taskId: task.id,
                  documentId:
                    state.activeSection === "overview"
                      ? state.overviewArticlePreviewDocumentId
                      : undefined,
                },
              });
            }}
            className="task-article-attach-trigger"
          >
            + Прикрепить статью
          </PrototypeButton>
        </ContextPanelSection>
      </div>
      <div
        aria-label="Ссылки"
        className="task-details-tab-panel"
        id={`task-details-${task.id}-links-panel`}
        role="region"
      >
        <ContextPanelSection title="Ссылки">
          <form
            className="task-link-add-form"
            onSubmit={(event) => {
              event.preventDefault();
              addTaskLink();
            }}
          >
            <input
              aria-label="Описание ссылки"
              onChange={(event) => setNewLinkTitle(event.target.value)}
              placeholder="Описание"
              value={newLinkTitle}
            />
            <input
              aria-label="URL ссылки"
              inputMode="url"
              onChange={(event) => setNewLinkUrl(event.target.value)}
              placeholder="https://…"
              type="url"
              value={newLinkUrl}
            />
            <IconButton
              icon={<span aria-hidden="true">+</span>}
              label="Добавить ссылку"
              title="Добавить ссылку"
              type="submit"
              variant="quiet"
            />
          </form>
          {task.links.map((link) =>
            editingLinkId === link.id ? (
              <form
                className="task-link-edit-form"
                key={link.id}
                onSubmit={(event) => {
                  event.preventDefault();
                  commitTaskLinkEdit();
                }}
              >
                <input
                  aria-label={`Описание ссылки: ${link.title}`}
                  onChange={(event) => setLinkTitleDraft(event.target.value)}
                  value={linkTitleDraft}
                />
                <input
                  aria-label={`URL ссылки: ${link.title}`}
                  inputMode="url"
                  onChange={(event) => setLinkUrlDraft(event.target.value)}
                  type="url"
                  value={linkUrlDraft}
                />
                <div className="task-link-edit-actions">
                  <PrototypeButton size="compact" type="submit" variant="quiet">
                    Сохранить
                  </PrototypeButton>
                  <PrototypeButton
                    onClick={cancelTaskLinkEdit}
                    size="compact"
                    type="button"
                    variant="quiet"
                  >
                    Отмена
                  </PrototypeButton>
                </div>
              </form>
            ) : (
              <div className="task-link-row" key={link.id}>
                <a href={link.url} rel="noreferrer" target="_blank">
                  {link.title}
                </a>
                <IconButton
                  icon={<span aria-hidden="true">✎</span>}
                  label={`Изменить ссылку: ${link.title}`}
                  onClick={() => startTaskLinkEdit(link.id)}
                  title={`Изменить ссылку: ${link.title}`}
                  variant="ghost"
                />
                <IconButton
                  icon={<span aria-hidden="true">×</span>}
                  label={`Удалить ссылку: ${link.title}`}
                  onClick={() =>
                    dispatch({
                      type: "delete-task-link",
                      taskId: task.id,
                      linkId: link.id,
                    })
                  }
                  title={`Удалить ссылку: ${link.title}`}
                  variant="ghost"
                />
              </div>
            ),
          )}
        </ContextPanelSection>
      </div>
    </div>
  );
}
