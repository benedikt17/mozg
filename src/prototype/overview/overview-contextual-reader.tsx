import React, { useEffect, useRef, useState } from "react";
import type {
  PrototypeDocument,
  PrototypeTask,
} from "@/prototype/desktop-mock-data";
import {
  getOverviewTaskDetailSplitDocument,
  type DesktopPrototypeState,
  type DesktopPrototypeAction,
} from "@/prototype/desktop-state";
import type { OverviewTaskDetailMaterial } from "@/prototype/state/types";
import { UiIcon } from "@/prototype/desktop-icons";
import {
  getDocumentHeadings,
  MarkdownDocumentPreview,
  toggleTaskListMarker,
} from "@/prototype/knowledge/markdown-document-preview";
import { IconButton, PrototypeButton } from "@/prototype/desktop-ui";
import { TaskDetailsPanel } from "@/prototype/context-panels/task-details-panel";
import { TaskSubtasksDocument } from "@/prototype/overview/task-subtasks-document";
import { useKnowledgeContentHistory } from "@/prototype/knowledge/knowledge-content-history-runtime";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

function OverviewReaderOutline({
  document,
  onSelectHeading,
}: {
  document: PrototypeDocument | undefined;
  onSelectHeading: (headingId: string) => void;
}): React.JSX.Element | null {
  if (!document) return null;
  const headings = getDocumentHeadings(document).filter(
    (heading) => heading.level <= 2,
  );
  if (headings.length === 0) return null;

  return (
    <aside className="overview-reader-outline" aria-label="Содержание статьи">
      <nav>
        {headings.map((heading) => (
          <button
            className={`level-${heading.level}`}
            key={heading.id}
            onClick={() => onSelectHeading(heading.id)}
            type="button"
          >
            {heading.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

function TaskDetailsWorkspaceToolbar({
  attachedDocuments,
  contextCollapsed,
  editing,
  material,
  onToggleContext,
  onToggleEditing,
  onToggleSplit,
  splitDocument,
}: {
  attachedDocuments: PrototypeDocument[];
  contextCollapsed: boolean;
  editing: boolean;
  material: OverviewTaskDetailMaterial;
  onToggleContext: () => void;
  onToggleEditing: () => void;
  onToggleSplit: () => void;
  splitDocument: PrototypeDocument | undefined;
}): React.JSX.Element {
  const subtasksMaterial = material.kind === "subtasks";
  const splitEnabled = splitDocument !== undefined;
  const splitAvailable = attachedDocuments.length > 0;
  const editLabel = editing ? "Готово" : "Редактировать";

  return (
    <div className="document-tabs-row task-details-workspace-toolbar">
      <div aria-hidden="true" className="task-details-toolbar-spacer" />
      <div className="document-actions">
        <IconButton
          icon={
            <UiIcon name={contextCollapsed ? "panel-right" : "panel-left"} />
          }
          label={
            contextCollapsed ? "Показать контекст задачи" : "Скрыть контекст задачи"
          }
          onClick={onToggleContext}
          title={
            contextCollapsed ? "Показать контекст задачи" : "Скрыть контекст задачи"
          }
          variant="quiet"
        />
        <IconButton
          active={editing}
          aria-pressed={editing}
          disabled={!subtasksMaterial}
          icon={<UiIcon name={editing ? "eye" : "pencil"} />}
          label={
            subtasksMaterial ? editLabel : "Редактировать подзадачи"
          }
          onClick={onToggleEditing}
          title={editLabel}
          variant="quiet"
        />
        <IconButton
          active={splitEnabled}
          aria-pressed={splitEnabled}
          disabled={!splitAvailable && !splitEnabled}
          icon={<UiIcon name="split" />}
          label="Включить или выключить Split"
          onClick={onToggleSplit}
          title="Включить или выключить Split"
          variant="quiet"
        />
      </div>
    </div>
  );
}

export function OverviewContextualReader({
  activeDocument,
  dispatch,
  documents,
  material,
  mobileContextOpen,
  onMobileContextOpenChange,
  task,
  state,
}: {
  activeDocument: PrototypeDocument | undefined;
  dispatch: Dispatch;
  documents: PrototypeDocument[];
  material: OverviewTaskDetailMaterial;
  mobileContextOpen: boolean;
  onMobileContextOpenChange?: (open: boolean) => void;
  task: PrototypeTask;
  state: DesktopPrototypeState;
}): React.JSX.Element {
  const [contextCollapsed, setContextCollapsed] = useState(false);
  const [subtasksEditing, setSubtasksEditing] = useState(false);
  const articleRef = useRef<HTMLElement>(null);
  const articleScrollDocumentIdRef = useRef<string | null>(
    activeDocument?.id ?? null,
  );
  const articleScrollPositionsRef = useRef(new Map<string, number>());
  const mobileContextCloseRef = useRef<HTMLButtonElement>(null);
  const mobileContextTriggerRef = useRef<HTMLButtonElement>(null);
  const contentHistory = useKnowledgeContentHistory();
  const attachedDocuments = task.linkedDocumentIds
    .map((documentId) =>
      documents.find((document) => document.id === documentId),
    )
    .filter(
      (document): document is PrototypeDocument => document !== undefined,
    );
  const splitDocument = getOverviewTaskDetailSplitDocument(state, task.id);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setSubtasksEditing(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [material.kind, task.id]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const article = articleRef.current;
      if (!article) return;
      if (!activeDocument) {
        article.scrollTop = 0;
        articleScrollDocumentIdRef.current = null;
        return;
      }
      article.scrollTop =
        articleScrollPositionsRef.current.get(activeDocument.id) ?? 0;
      articleScrollDocumentIdRef.current = activeDocument.id;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeDocument]);

  useEffect(() => {
    if (!mobileContextOpen) return;
    if (window.matchMedia("(max-width: 767px)").matches) return;
    const frame = window.requestAnimationFrame(() => {
      mobileContextCloseRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mobileContextOpen]);

  const scrollToHeading = (headingId: string): void => {
    const article = articleRef.current;
    const heading = window.document.getElementById(headingId);
    if (!article || !heading) return;

    const articleRect = article.getBoundingClientRect();
    const headingRect = heading.getBoundingClientRect();
    const nextScrollTop =
      article.scrollTop + headingRect.top - articleRect.top - 16;

    article.scrollTo({
      behavior: "smooth",
      top: Math.max(0, nextScrollTop),
    });
  };

  const returnToBoard = (): void => {
    onMobileContextOpenChange?.(false);
    dispatch({ type: "close-overview-article-preview" });
  };

  const closeMobileContext = (): void => {
    onMobileContextOpenChange?.(false);
    if (window.matchMedia("(max-width: 767px)").matches) return;
    window.requestAnimationFrame(() => {
      mobileContextTriggerRef.current?.focus();
    });
  };

  return (
    <section
      className={[
        "overview-contextual-reader",
        contextCollapsed ? "is-context-collapsed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !mobileContextOpen) return;
        event.preventDefault();
        closeMobileContext();
      }}
    >
      {mobileContextOpen ? (
        <button
          aria-label="Закрыть контекст задачи"
          className="overview-reader-context-backdrop"
          onClick={closeMobileContext}
          type="button"
        />
      ) : null}
      <aside
        aria-hidden={contextCollapsed && !mobileContextOpen}
        aria-label={`Контекст задачи: ${task.title}`}
        aria-modal={mobileContextOpen || undefined}
        className={[
          "overview-reader-task-context",
          `task-signal-${task.signal}`,
          mobileContextOpen ? "is-mobile-open" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        role={mobileContextOpen ? "dialog" : undefined}
      >
        <button
          aria-label="Закрыть контекст задачи"
          className="overview-reader-mobile-close"
          onClick={closeMobileContext}
          ref={mobileContextCloseRef}
          title="Закрыть контекст задачи"
          type="button"
        >
          <span aria-hidden="true">×</span>
        </button>
        <PrototypeButton
          aria-label="Вернуться к доске Обзора"
          className="overview-reader-back"
          onClick={returnToBoard}
          size="compact"
          variant="ghost"
        >
          ← К доске
        </PrototypeButton>
        <div className="overview-reader-task-details">
          <TaskDetailsPanel
            dispatch={dispatch}
            overviewMode
            state={state}
            task={task}
          />
        </div>
        {/* Legacy inline task sections are intentionally replaced by the shared task details content above. */}
        {false ? <h2>{task.title}</h2> : null}
        {false &&
          (task.subtasks.length > 0 ? (
            <section className="overview-reader-context-section">
              <h3>Подзадачи</h3>
              <ul className="overview-reader-subtasks">
                {task.subtasks.map((subtask) => (
                  <li
                    className={subtask.done ? "is-complete" : ""}
                    key={subtask.id}
                  >
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
                    <span>{subtask.title}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null)}
        {false &&
          (task.links.length > 0 ? (
            <section className="overview-reader-context-section">
              <h3>Ссылки</h3>
              <ul className="overview-reader-resources">
                {task.links.map((link) => (
                  <li key={link.id}>
                    <a href={link.url} rel="noreferrer" target="_blank">
                      {link.title}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null)}
        {false && (
          <section className="overview-reader-context-section">
            <h3>Статьи</h3>
            <ul className="overview-reader-articles">
              {attachedDocuments.map((document) => (
                <li key={document.id}>
                  <button
                    aria-current={
                      document.id === activeDocument?.id ? "page" : undefined
                    }
                    className={
                      document.id === activeDocument?.id ? "is-active" : ""
                    }
                    onClick={() =>
                      dispatch({
                        type: "open-overview-task-article",
                        taskId: task.id,
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
        )}
      </aside>
      <div className="overview-reader-main">
        <TaskDetailsWorkspaceToolbar
          attachedDocuments={attachedDocuments}
          contextCollapsed={contextCollapsed}
          editing={subtasksEditing}
          material={material}
          onToggleContext={() => setContextCollapsed((collapsed) => !collapsed)}
          onToggleEditing={() => setSubtasksEditing((editing) => !editing)}
          onToggleSplit={() => {
            if (splitDocument) {
              dispatch({ type: "close-overview-task-split" });
            } else {
              dispatch({ type: "open-overview-task-split", taskId: task.id });
            }
          }}
          splitDocument={splitDocument}
        />
        <div
          className={`overview-reader-material-surface ${splitDocument ? "is-split" : ""}`}
        >
          <article
            className={`document-page overview-reader-article ${material.kind === "subtasks" ? "is-subtasks-material" : ""}`}
            onScroll={(event) => {
              const documentId = articleScrollDocumentIdRef.current;
              if (documentId) {
                articleScrollPositionsRef.current.set(
                  documentId,
                  event.currentTarget.scrollTop,
                );
              }
            }}
            ref={articleRef}
          >
            {material.kind === "knowledge" ? (
              <OverviewReaderOutline
                document={activeDocument}
                onSelectHeading={scrollToHeading}
              />
            ) : null}
            <div className="document-page-inner overview-reader-pane-content">
              <div className="overview-reader-mobile-actions">
                <button
                  className="ui-button ui-button-quiet ui-button-compact"
                  onClick={() => onMobileContextOpenChange?.(true)}
                  ref={mobileContextTriggerRef}
                  type="button"
                >
                  Контекст задачи
                </button>
                <PrototypeButton
                  onClick={returnToBoard}
                  size="compact"
                  variant="ghost"
                >
                  ← К доске
                </PrototypeButton>
              </div>
              {material.kind === "knowledge" && activeDocument ? (
                <>
                  <h1 id={getDocumentHeadings(activeDocument)[0]?.id}>
                    {activeDocument.title}
                  </h1>
                  <MarkdownDocumentPreview
                    document={activeDocument}
                    hideLeadingTitle
                    onTaskToggle={(lineIndex, checked) =>
                      contentHistory.commitMarkdown(
                        activeDocument.id,
                        toggleTaskListMarker(
                          activeDocument.content.join("\n"),
                          lineIndex,
                          checked,
                        ),
                        {
                          origin: "checklist",
                        },
                      )
                    }
                  />
                </>
              ) : (
                <TaskSubtasksDocument
                  key={task.id}
                  dispatch={dispatch}
                  editing={subtasksEditing}
                  task={task}
                />
              )}
            </div>
          </article>
          {splitDocument ? (
            <article className="document-page overview-reader-article overview-reader-secondary-article is-split-pane">
              <div className="document-page-inner overview-reader-pane-content">
                <h1>{splitDocument.title}</h1>
                <MarkdownDocumentPreview
                  document={splitDocument}
                  hideLeadingTitle
                  onTaskToggle={(lineIndex, checked) =>
                    contentHistory.commitMarkdown(
                      splitDocument.id,
                      toggleTaskListMarker(
                        splitDocument.content.join("\n"),
                        lineIndex,
                        checked,
                      ),
                      {
                        origin: "checklist",
                      },
                    )
                  }
                />
              </div>
            </article>
          ) : null}
        </div>
      </div>
    </section>
  );
}
