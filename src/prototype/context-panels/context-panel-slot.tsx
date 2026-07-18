import React, { useState } from "react";
import {
  getCanvasObjectById,
  getDocumentById,
  getInboxItemById,
  getTaskById,
  type ContextPanelState,
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
} from "@/prototype/desktop-state";
import { UiIcon } from "@/prototype/desktop-icons";
import { IconButton, PrototypeButton } from "@/prototype/desktop-ui";
import {
  DocumentContextPanel,
  KnowledgeTaskLinkPanel,
  KnowledgeTaskReferencePanel,
} from "./knowledge-context-panels";
import { TaskDetailsPanel } from "./task-details-panel";
import {
  AiPanel,
  CanvasInspectorPanel,
  InboxContextPanel,
} from "./utility-context-panels";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

export function ContextPanelSlot({
  state,
  dispatch,
  contextPanel,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
  contextPanel: ContextPanelState;
}): React.JSX.Element | null {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  if (!contextPanel) return null;
  const usesIconClose =
    contextPanel.kind === "task" || contextPanel.kind === "knowledge-tasks";
  return (
    <>
      <aside
        className={[
          "context-panel",
          state.activeSection === "knowledge" && contextPanel.kind === "ai"
            ? "knowledge-ai-panel"
            : "",
          contextPanel.kind === "task"
            ? "task-context-panel"
            : contextPanel.kind === "knowledge-tasks"
              ? "knowledge-task-link-drawer"
              : contextPanel.kind === "knowledge-task-reference"
                ? "knowledge-task-reference-drawer"
                : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label="Контекстная панель"
      >
        <header className={usesIconClose ? "task-context-header" : undefined}>
          {usesIconClose ? null : (
            <div>
              <span>Контекст</span>
              <h2>{contextTitle(contextPanel)}</h2>
            </div>
          )}
          {usesIconClose ? (
            <IconButton
              className="task-context-close"
              icon={<span aria-hidden="true">×</span>}
              label={
                contextPanel.kind === "task"
                  ? "Закрыть панель задачи"
                  : "Закрыть панель задач"
              }
              onClick={() => dispatch({ type: "close-context-panel" })}
              title={
                contextPanel.kind === "task"
                  ? "Закрыть панель задачи"
                  : "Закрыть панель задач"
              }
            />
          ) : (
            <PrototypeButton
              onClick={() =>
                dispatch({
                  type:
                    contextPanel.kind === "ai"
                      ? "close-ai-panel"
                      : "close-context-panel",
                })
              }
              variant="quiet"
            >
              Закрыть
            </PrototypeButton>
          )}
        </header>
        {renderContextPanelContent(state, dispatch, contextPanel)}
        {contextPanel.kind === "task" ? (
          <footer className="task-context-footer">
            <IconButton
              className="task-context-delete"
              icon={<UiIcon name="trash" />}
              label="Удалить задачу"
              onClick={() => setDeleteConfirmOpen(true)}
              title="Удалить задачу"
              variant="ghost"
            />
          </footer>
        ) : null}
      </aside>
      {contextPanel.kind === "task" && deleteConfirmOpen ? (
        <div
          className="task-delete-confirm-backdrop"
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            setDeleteConfirmOpen(false);
          }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setDeleteConfirmOpen(false);
            }
          }}
        >
          <section
            aria-describedby="task-delete-confirm-description"
            aria-labelledby="task-delete-confirm-title"
            aria-modal="true"
            className="task-delete-confirm-dialog"
            role="alertdialog"
          >
            <h2 id="task-delete-confirm-title">Удалить задачу?</h2>
            <p id="task-delete-confirm-description">
              Это действие нельзя отменить.
            </p>
            <div className="task-delete-confirm-actions">
              <PrototypeButton
                autoFocus
                onClick={() => setDeleteConfirmOpen(false)}
                variant="quiet"
              >
                Отмена
              </PrototypeButton>
              <PrototypeButton
                className="task-delete-confirm-submit"
                onClick={() =>
                  dispatch({ type: "delete-task", taskId: contextPanel.taskId })
                }
                variant="quiet"
              >
                Удалить
              </PrototypeButton>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function contextTitle(
  contextPanel: Exclude<
    NonNullable<ContextPanelState>,
    { kind: "task" } | { kind: "knowledge-tasks" }
  >,
): string {
  if (contextPanel.kind === "document-context") return "Документ";
  if (contextPanel.kind === "canvas-inspector") return "Инспектор";
  if (contextPanel.kind === "inbox-item") return "Захват";
  return "AI";
}

function renderContextPanelContent(
  state: DesktopPrototypeState,
  dispatch: Dispatch,
  contextPanel: Exclude<ContextPanelState, null>,
): React.JSX.Element {
  if (contextPanel.kind === "task") {
    const task = getTaskById(state, contextPanel.taskId);
    return task ? (
      <TaskDetailsPanel
        dispatch={dispatch}
        key={task.id}
        state={state}
        task={task}
      />
    ) : (
      <p>Задача не найдена.</p>
    );
  }
  if (contextPanel.kind === "knowledge-tasks") {
    const document = getDocumentById(state, state.selectedDocumentId);
    return document ? (
      <KnowledgeTaskLinkPanel
        dispatch={dispatch}
        document={document}
        state={state}
      />
    ) : (
      <p>Документ не найден.</p>
    );
  }
  if (contextPanel.kind === "knowledge-task-reference") {
    const task = getTaskById(state, contextPanel.taskId);
    return task ? (
      <KnowledgeTaskReferencePanel
        dispatch={dispatch}
        state={state}
        task={task}
      />
    ) : (
      <p>Задача не найдена.</p>
    );
  }
  if (contextPanel.kind === "document-context") {
    const document = getDocumentById(state, contextPanel.documentId);
    return document ? (
      <DocumentContextPanel
        dispatch={dispatch}
        document={document}
        state={state}
      />
    ) : (
      <p>Документ не найден.</p>
    );
  }
  if (contextPanel.kind === "canvas-inspector") {
    const object = getCanvasObjectById(
      state,
      contextPanel.canvasId,
      contextPanel.objectId,
    );
    return object ? (
      <CanvasInspectorPanel
        objectTitle={object.title}
        objectBody={object.body}
      />
    ) : (
      <p>Объект не выбран.</p>
    );
  }
  if (contextPanel.kind === "inbox-item") {
    const item = getInboxItemById(state, contextPanel.itemId);
    return item ? <InboxContextPanel item={item} /> : <p>Захват не найден.</p>;
  }
  return <AiPanel dispatch={dispatch} state={state} />;
}
