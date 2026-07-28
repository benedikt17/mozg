import React, { useEffect, useRef, useState } from "react";
import type {
  PrototypeDocument,
  PrototypeTask,
} from "@/prototype/desktop-mock-data";
import {
  getProjectOverviewDirections,
  type DesktopPrototypeState,
  type DesktopPrototypeAction,
} from "@/prototype/desktop-state";
import { UiIcon } from "@/prototype/desktop-icons";
import {
  getDocumentHeadings,
  MarkdownDocumentPreview,
  toggleTaskListMarker,
} from "@/prototype/knowledge/markdown-document-preview";
import { IconButton, PrototypeButton } from "@/prototype/desktop-ui";
import { TaskDetailsPanel } from "@/prototype/context-panels/task-details-panel";

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

export function OverviewContextualReader({
  activeDocument,
  direction,
  dispatch,
  documents,
  task,
  state,
}: {
  activeDocument: PrototypeDocument | undefined;
  direction: ReturnType<typeof getProjectOverviewDirections>[number];
  dispatch: Dispatch;
  documents: PrototypeDocument[];
  task: PrototypeTask;
  state: DesktopPrototypeState;
}): React.JSX.Element {
  const [contextCollapsed, setContextCollapsed] = useState(false);
  const [mobileContextOpen, setMobileContextOpen] = useState(false);
  const articleRef = useRef<HTMLElement>(null);
  const articleScrollDocumentIdRef = useRef<string | null>(
    activeDocument?.id ?? null,
  );
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
    dispatch({ type: "close-overview-article-preview" });
  };

  const openTaskOnBoard = (): void => {
    returnToBoard();
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
        <OverviewReaderOutline
          document={activeDocument}
          onSelectHeading={scrollToHeading}
        />
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
              {activeDocument ? (
                <li aria-current="page" title={activeDocument.title}>
                  <span>{activeDocument.title}</span>
                </li>
              ) : null}
            </ol>
          </nav>
          {activeDocument ? (
            <>
              <h1 id={getDocumentHeadings(activeDocument)[0]?.id}>
                {activeDocument.title}
              </h1>
              <MarkdownDocumentPreview
                document={activeDocument}
                hideLeadingTitle
                onTaskToggle={(lineIndex, checked) =>
                  dispatch({
                    type: "update-knowledge-document-markdown",
                    documentId: activeDocument.id,
                    markdown: toggleTaskListMarker(
                      activeDocument.content.join("\n"),
                      lineIndex,
                      checked,
                    ),
                  })
                }
              />
            </>
          ) : (
            <p className="overview-reader-empty-state" role="status">
              К задаче пока не прикреплены статьи
            </p>
          )}
        </div>
      </article>
    </section>
  );
}
