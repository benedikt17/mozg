import React, { useEffect, useRef, useState } from "react";
import type {
  PrototypeDocument,
  PrototypeTask,
} from "@/prototype/desktop-mock-data";
import {
  getDocumentById,
  getProjectDocuments,
  isValidTaskLinkUrl,
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
} from "@/prototype/desktop-state";
import {
  ContextPanelSection,
  IconButton,
  PrototypeButton,
} from "@/prototype/desktop-ui";
import { taskSignalOptions } from "./task-signal-options";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

export function TaskDetailsPanel({
  task,
  state,
  dispatch,
}: {
  task: PrototypeTask;
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [subtaskTitleDraft, setSubtaskTitleDraft] = useState("");
  const [openSubtaskMenuId, setOpenSubtaskMenuId] = useState<string | null>(
    null,
  );
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [linkTitleDraft, setLinkTitleDraft] = useState("");
  const [linkUrlDraft, setLinkUrlDraft] = useState("");
  const [articlePickerOpen, setArticlePickerOpen] = useState(false);
  const [articleSearchQuery, setArticleSearchQuery] = useState("");
  const subtaskEditInputRef = useRef<HTMLInputElement>(null);
  const subtaskRenameCancelledRef = useRef(false);
  const attachedDocuments = task.linkedDocumentIds
    .map((documentId) => getDocumentById(state, documentId))
    .filter(
      (document): document is PrototypeDocument =>
        document !== undefined && document.projectId === task.projectId,
    );
  const normalizedArticleQuery = articleSearchQuery.trim().toLocaleLowerCase();
  const availableDocuments = getProjectDocuments(state, task.projectId).filter(
    (document) =>
      !task.linkedDocumentIds.includes(document.id) &&
      (normalizedArticleQuery.length === 0 ||
        document.title.toLocaleLowerCase().includes(normalizedArticleQuery)),
  );

  useEffect(() => {
    if (!editingSubtaskId) return;
    subtaskEditInputRef.current?.focus();
    subtaskEditInputRef.current?.select();
  }, [editingSubtaskId]);

  function addSubtask(): void {
    if (newSubtaskTitle.trim().length === 0) return;
    dispatch({
      type: "add-subtask",
      taskId: task.id,
      title: newSubtaskTitle,
    });
    setNewSubtaskTitle("");
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
    <div className="panel-stack">
      <div className="field">
        <textarea
          aria-label="Название"
          onChange={(event) =>
            dispatch({
              type: "edit-task-title",
              taskId: task.id,
              title: event.target.value,
            })
          }
          value={task.title}
        />
      </div>
      <fieldset aria-label="Сигнал задачи" className="task-signal-selector">
        <div className="task-signal-options">
          {taskSignalOptions.map((option) => (
            <label
              className={`task-signal-option task-signal-${option.id}`}
              key={option.id}
              title={option.label}
            >
              <input
                aria-label={option.label}
                checked={task.signal === option.id}
                name={`task-signal-${task.id}`}
                onChange={() =>
                  dispatch({
                    type: "set-task-signal",
                    taskId: task.id,
                    signal: option.id,
                  })
                }
                type="radio"
                value={option.id}
              />
              <span className="task-signal-swatch" aria-hidden="true" />
            </label>
          ))}
        </div>
      </fieldset>
      <ContextPanelSection title="Подзадачи">
        <form
          className="subtask-add-form"
          onSubmit={(event) => {
            event.preventDefault();
            addSubtask();
          }}
        >
          <input
            aria-label="Новая подзадача"
            onChange={(event) => setNewSubtaskTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              addSubtask();
            }}
            placeholder="Новая подзадача"
            value={newSubtaskTitle}
          />
          <IconButton
            icon={<span aria-hidden="true">+</span>}
            label="Добавить подзадачу"
            title="Добавить подзадачу"
            type="submit"
            variant="quiet"
          />
        </form>
        {task.subtasks.length > 0 ? (
          task.subtasks.map((subtask) => (
            <div className="subtask-row" key={subtask.id}>
              <input
                aria-label={subtask.title}
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
                  icon={<span aria-hidden="true">⋮</span>}
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
          ))
        ) : (
          <p>Подзадач пока нет.</p>
        )}
      </ContextPanelSection>
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
      <ContextPanelSection title="Статьи">
        {attachedDocuments.map((document) => (
          <div className="task-article-row" key={document.id}>
            <button
              className="task-article-link"
              onClick={() =>
                dispatch({ type: "select-document", documentId: document.id })
              }
              type="button"
            >
              {document.title}
            </button>
            <IconButton
              icon={<span aria-hidden="true">×</span>}
              label={`Открепить статью: ${document.title}`}
              onClick={() =>
                dispatch({
                  type: "detach-task-document",
                  taskId: task.id,
                  documentId: document.id,
                })
              }
              title={`Открепить статью: ${document.title}`}
              variant="ghost"
            />
          </div>
        ))}
        <PrototypeButton
          aria-expanded={
            state.activeSection === "overview" ? undefined : articlePickerOpen
          }
          onClick={() => {
            if (state.activeSection === "overview") {
              dispatch({
                type: "open-overview-task-article-linker",
                taskId: task.id,
              });
              return;
            }
            setArticlePickerOpen((open) => !open);
          }}
          size="compact"
          variant="quiet"
        >
          + Прикрепить статью
        </PrototypeButton>
        {state.activeSection !== "overview" && articlePickerOpen ? (
          <div className="task-article-picker">
            <input
              aria-label="Поиск статьи"
              onChange={(event) => setArticleSearchQuery(event.target.value)}
              placeholder="Поиск по статьям"
              type="search"
              value={articleSearchQuery}
            />
            <div className="task-article-picker-results">
              {availableDocuments.length > 0 ? (
                availableDocuments.map((document) => (
                  <button
                    key={document.id}
                    onClick={() =>
                      dispatch({
                        type: "attach-task-document",
                        taskId: task.id,
                        documentId: document.id,
                      })
                    }
                    type="button"
                  >
                    {document.title}
                  </button>
                ))
              ) : (
                <p>Нет доступных статей.</p>
              )}
            </div>
          </div>
        ) : null}
      </ContextPanelSection>
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
