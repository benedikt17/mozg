import React, { useEffect, useRef, useState } from "react";
import type {
  PrototypeDocument,
  PrototypeTask,
} from "@/prototype/desktop-mock-data";
import {
  getProjectOverviewDirections,
  type DesktopPrototypeAction,
} from "@/prototype/desktop-state";
import { UiIcon } from "@/prototype/desktop-icons";
import { MarkdownDocumentPreview } from "@/prototype/knowledge/markdown-document-preview";
import { IconButton, PrototypeButton } from "@/prototype/desktop-ui";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

export function OverviewContextualReader({
  activeDocument,
  direction,
  dispatch,
  documents,
  task,
}: {
  activeDocument: PrototypeDocument;
  direction: ReturnType<typeof getProjectOverviewDirections>[number];
  dispatch: Dispatch;
  documents: PrototypeDocument[];
  task: PrototypeTask;
}): React.JSX.Element {
  const [contextCollapsed, setContextCollapsed] = useState(false);
  const [mobileContextOpen, setMobileContextOpen] = useState(false);
  const articleRef = useRef<HTMLElement>(null);
  const articleScrollDocumentIdRef = useRef(activeDocument.id);
  const articleScrollPositionsRef = useRef(new Map<string, number>());
  const mobileContextCloseRef = useRef<HTMLButtonElement>(null);
  const mobileContextTriggerRef = useRef<HTMLButtonElement>(null);
  const attachedDocuments = task.linkedDocumentIds
    .map((documentId) =>
      documents.find((document) => document.id === documentId),
    )
    .filter(
      (document): document is PrototypeDocument => document !== undefined,
    );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const article = articleRef.current;
      if (!article) return;
      article.scrollTop =
        articleScrollPositionsRef.current.get(activeDocument.id) ?? 0;
      articleScrollDocumentIdRef.current = activeDocument.id;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeDocument.id]);

  useEffect(() => {
    if (!mobileContextOpen) return;
    const frame = window.requestAnimationFrame(() => {
      mobileContextCloseRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mobileContextOpen]);

  const returnToBoard = (): void => {
    dispatch({ type: "close-overview-article-preview" });
  };

  const openTaskOnBoard = (): void => {
    dispatch({ type: "close-overview-article-preview" });
    dispatch({ type: "select-task", taskId: task.id, section: "overview" });
  };

  const closeMobileContext = (): void => {
    setMobileContextOpen(false);
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
        <div className="overview-reader-task-card">
          <h2>{task.title}</h2>
          {task.subtasks.length > 0 ? (
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
          ) : null}
          {task.links.length > 0 ? (
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
          ) : null}
          <section className="overview-reader-context-section">
            <h3>Статьи</h3>
            <ul className="overview-reader-articles">
              {attachedDocuments.map((document) => (
                <li key={document.id}>
                  <button
                    aria-current={
                      document.id === activeDocument.id ? "page" : undefined
                    }
                    className={
                      document.id === activeDocument.id ? "is-active" : ""
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
        </div>
      </aside>
      <IconButton
        className="overview-reader-context-toggle"
        icon={<UiIcon name={contextCollapsed ? "panel-right" : "panel-left"} />}
        label={
          contextCollapsed
            ? "Показать контекст задачи"
            : "Скрыть контекст задачи"
        }
        onClick={() => setContextCollapsed((collapsed) => !collapsed)}
        title={
          contextCollapsed
            ? "Показать контекст задачи"
            : "Скрыть контекст задачи"
        }
        variant="quiet"
      />
      <article
        className="document-page overview-reader-article"
        onScroll={(event) => {
          articleScrollPositionsRef.current.set(
            articleScrollDocumentIdRef.current,
            event.currentTarget.scrollTop,
          );
        }}
        ref={articleRef}
      >
        <div className="document-page-inner">
          <div className="overview-reader-mobile-actions">
            <button
              className="ui-button ui-button-quiet ui-button-compact"
              onClick={() => setMobileContextOpen(true)}
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
          <nav
            aria-label="Контекст статьи"
            className="overview-reader-breadcrumb"
          >
            <ol>
              <li>
                <button
                  onClick={returnToBoard}
                  title={`К направлению «${direction.title}»`}
                  type="button"
                >
                  {direction.title}
                </button>
              </li>
              <li className="is-task">
                <button
                  onClick={openTaskOnBoard}
                  title={task.title}
                  type="button"
                >
                  {task.title}
                </button>
              </li>
              <li aria-current="page" title={activeDocument.title}>
                <span>{activeDocument.title}</span>
              </li>
            </ol>
          </nav>
          <h1>{activeDocument.title}</h1>
          <MarkdownDocumentPreview document={activeDocument} hideLeadingTitle />
        </div>
      </article>
    </section>
  );
}
