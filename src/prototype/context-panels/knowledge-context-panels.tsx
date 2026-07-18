import React, { useState } from "react";
import type {
  PrototypeDocument,
  PrototypeTask,
} from "@/prototype/desktop-mock-data";
import {
  getDocumentBreadcrumb,
  getDocumentById,
  getProjectTasks,
  getTaskById,
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
  type KnowledgeContextMode,
} from "@/prototype/desktop-state";
import { ContextPanelSection, PrototypeButton } from "@/prototype/desktop-ui";
import { taskSignalOptions } from "./task-signal-options";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

export function KnowledgeTaskLinkPanel({
  document,
  state,
  dispatch,
}: {
  document: PrototypeDocument;
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  const [requestedTaskId, setRequestedTaskId] = useState<string | null>(null);
  const tasks = [...getProjectTasks(state, document.projectId)].sort(
    (first, second) =>
      first.taskListOrder - second.taskListOrder ||
      first.id.localeCompare(second.id),
  );
  const selectedTaskId = tasks.some((task) => task.id === requestedTaskId)
    ? requestedTaskId
    : null;

  return (
    <div className="knowledge-task-link-panel">
      <h2>Задачи</h2>
      <div className="knowledge-task-link-list">
        {tasks.map((task) => {
          const attached = task.linkedDocumentIds.includes(document.id);
          const selected = task.id === selectedTaskId;
          const signalLabel =
            taskSignalOptions.find((option) => option.id === task.signal)
              ?.label ?? "Без сигнала";
          return (
            <div className="knowledge-task-link-item" key={task.id}>
              <button
                aria-pressed={selected}
                className={[
                  "knowledge-task-link-card",
                  selected ? "is-selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setRequestedTaskId(task.id)}
                type="button"
              >
                <span
                  aria-label={`Сигнал: ${signalLabel}`}
                  className={`knowledge-task-signal task-signal-${task.signal}`}
                  role="img"
                  title={signalLabel}
                />
                <strong>{task.title}</strong>
                <svg
                  aria-label={task.starred ? "Важная задача" : "Обычная задача"}
                  className="knowledge-task-star"
                  fill={task.starred ? "#facc15" : "transparent"}
                  role="img"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="m12 2.75 2.78 5.63 6.22.9-4.5 4.39 1.06 6.2L12 16.94l-5.56 2.93 1.06-6.2L3 9.28l6.22-.9L12 2.75Z"
                    stroke="currentColor"
                    strokeLinejoin="round"
                    strokeWidth="1"
                  />
                </svg>
                <small>
                  {attached ? "Статья привязана" : "Статья не привязана"}
                </small>
              </button>
              {selected ? (
                <PrototypeButton
                  className="knowledge-task-link-action"
                  onClick={() =>
                    dispatch({
                      type: attached
                        ? "detach-task-document"
                        : "attach-task-document",
                      taskId: task.id,
                      documentId: document.id,
                    })
                  }
                  variant={attached ? "quiet" : "primary"}
                >
                  {attached ? "Отвязать эту статью" : "+ Привязать эту статью"}
                </PrototypeButton>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function KnowledgeTaskReferencePanel({
  task,
  state,
  dispatch,
}: {
  task: PrototypeTask;
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  const attachedDocuments = task.linkedDocumentIds
    .map((documentId) => getDocumentById(state, documentId))
    .filter(
      (document): document is PrototypeDocument => document !== undefined,
    );
  const currentDocument = getDocumentById(state, state.selectedDocumentId);
  const currentDocumentAttached = currentDocument
    ? task.linkedDocumentIds.includes(currentDocument.id)
    : false;

  return (
    <div className="knowledge-task-reference-content">
      <article
        className={`knowledge-task-reference-card task-signal-${task.signal}`}
      >
        <header>
          <strong>{task.title}</strong>
          <svg
            aria-label={task.starred ? "Важная задача" : "Обычная задача"}
            className="knowledge-task-star"
            fill={task.starred ? "#facc15" : "transparent"}
            role="img"
            viewBox="0 0 24 24"
          >
            <path
              d="m12 2.75 2.78 5.63 6.22.9-4.5 4.39 1.06 6.2L12 16.94l-5.56 2.93 1.06-6.2L3 9.28l6.22-.9L12 2.75Z"
              stroke="currentColor"
              strokeLinejoin="round"
              strokeWidth="1"
            />
          </svg>
        </header>
        {task.subtasks.length > 0 ? (
          <section>
            <h3>Подзадачи</h3>
            <ul className="knowledge-task-reference-subtasks">
              {task.subtasks.map((subtask) => (
                <li
                  className={subtask.done ? "is-complete" : ""}
                  key={subtask.id}
                >
                  <span aria-hidden="true">{subtask.done ? "✓" : "○"}</span>
                  <span>{subtask.title}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {task.links.length > 0 ? (
          <section>
            <h3>Ссылки</h3>
            <ul className="knowledge-task-reference-resources">
              {task.links.map((link) => (
                <li key={link.id}>
                  <a href={link.url} rel="noreferrer" target="_blank">
                    {link.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {attachedDocuments.length > 0 ? (
          <section>
            <h3>Статьи</h3>
            <ul className="knowledge-task-reference-resources">
              {attachedDocuments.map((document) => (
                <li key={document.id}>
                  <button
                    onClick={() =>
                      dispatch({
                        type: "select-document",
                        documentId: document.id,
                      })
                    }
                    type="button"
                  >
                    {document.title}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
      {currentDocument ? (
        <PrototypeButton
          className="knowledge-task-reference-action"
          onClick={() =>
            dispatch({
              type: currentDocumentAttached
                ? "detach-task-document"
                : "attach-task-document",
              taskId: task.id,
              documentId: currentDocument.id,
            })
          }
          size="compact"
          variant={currentDocumentAttached ? "quiet" : "primary"}
        >
          {currentDocumentAttached ? "Отвязать статью" : "+ Прикрепить статью"}
        </PrototypeButton>
      ) : null}
      <button
        className="quiet-text-link knowledge-task-reference-back"
        onClick={() =>
          dispatch({ type: "return-to-overview-from-task-article" })
        }
        type="button"
      >
        ← Назад
      </button>
    </div>
  );
}

export function DocumentContextPanel({
  dispatch,
  document,
  state,
}: {
  dispatch: Dispatch;
  document: PrototypeDocument;
  state: DesktopPrototypeState;
}): React.JSX.Element {
  const linkedTasks = document.linkedTaskIds
    .map((taskId) => getTaskById(state, taskId))
    .filter((task): task is PrototypeTask => Boolean(task));
  const outgoingLinks = document.content
    .join(" ")
    .match(/\[\[([^\]]+)\]\]/g)
    ?.map((link) => link.slice(2, -2)) ?? ["Правила магии", "Список сцен"];
  const modes: { id: KnowledgeContextMode; label: string }[] = [
    { id: "outline", label: "Структура" },
    { id: "backlinks", label: "Обратные" },
    { id: "outgoing", label: "Исходящие" },
    { id: "tasks", label: "Задачи" },
    { id: "history", label: "История" },
  ];
  return (
    <div className="panel-stack">
      <div
        className="context-mode-tabs"
        role="tablist"
        aria-label="Режим контекста документа"
      >
        {modes.map((mode) => (
          <button
            aria-selected={state.knowledgeContextMode === mode.id}
            className={state.knowledgeContextMode === mode.id ? "active" : ""}
            key={mode.id}
            onClick={() =>
              dispatch({ type: "set-knowledge-context-mode", mode: mode.id })
            }
            role="tab"
            type="button"
          >
            {mode.label}
          </button>
        ))}
      </div>
      {state.knowledgeContextMode === "outline" ? (
        <ContextPanelSection title="Структура">
          <p>{getDocumentBreadcrumb(document)}</p>
          <p>{document.excerpt}</p>
        </ContextPanelSection>
      ) : null}
      {state.knowledgeContextMode === "backlinks" ? (
        <ContextPanelSection title="Обратные ссылки">
          {document.backlinks.map((backlink) => (
            <span className="document-pill" key={backlink}>
              {backlink}
            </span>
          ))}
        </ContextPanelSection>
      ) : null}
      {state.knowledgeContextMode === "outgoing" ? (
        <ContextPanelSection title="Исходящие ссылки">
          {outgoingLinks.map((link) => (
            <span className="document-pill" key={link}>
              {link}
            </span>
          ))}
        </ContextPanelSection>
      ) : null}
      {state.knowledgeContextMode === "tasks" ? (
        <ContextPanelSection title="Связанные задачи">
          {linkedTasks.length > 0 ? (
            linkedTasks.map((task) => <p key={task.id}>{task.title}</p>)
          ) : (
            <p>Связанных mock-задач пока нет.</p>
          )}
        </ContextPanelSection>
      ) : null}
      {state.knowledgeContextMode === "history" ? (
        <ContextPanelSection title="История">
          <p>Сегодня: документ открыт в структурном прототипе shell.</p>
          <p>Вчера: уточнены связи с соседними заметками и задачами.</p>
        </ContextPanelSection>
      ) : null}
    </div>
  );
}
