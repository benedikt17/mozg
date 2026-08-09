import React, { useLayoutEffect, useRef, useState, useEffect } from "react";
import type { PrototypeDocument } from "@/prototype/desktop-mock-data";
import {
  getActiveProjectDocuments,
  getKnowledgePaneState,
  getOpenDocuments,
  getDocumentBreadcrumb,
  getDocumentFolderPath,
  getDocumentTitle,
  knowledgePathsEqual,
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
} from "@/prototype/desktop-state";
import { IconButton, PrototypeButton } from "@/prototype/desktop-ui";
import { UiIcon } from "@/prototype/desktop-icons";
import { EmptySection } from "@/prototype/empty-section";
import { MarkdownSourceEditor } from "./markdown-source-editor";
import { KnowledgeTrashView } from "./knowledge-trash-view";
import { getKnowledgeHistoryShortcutAction } from "./knowledge-content-history";
import { useKnowledgeContentHistory } from "./knowledge-content-history-runtime";
import {
  getDocumentHeadings,
  MarkdownDocumentPreview,
  toggleTaskListMarker,
} from "./markdown-document-preview";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

type DocumentScrollSnapshot = {
  availableScroll: number;
  documentId: string;
  progress: number;
  scrollTop: number;
};

function getKnowledgeDocumentPage(documentId: string): HTMLElement | null {
  return (
    Array.from(
      window.document.querySelectorAll<HTMLElement>(".document-page"),
    ).find((element) => element.dataset.documentId === documentId) ?? null
  );
}

function markdownDownloadName(title: string): string {
  const safeTitle = title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim();
  return `${safeTitle || "document"}.md`;
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

type KnowledgeWorkspaceProps = {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
  aiPanel?: React.ReactNode;
  onOpenTree?: () => void;
  onToggleTree?: () => void;
  treeOpen?: boolean;
};

export function KnowledgeWorkspace(
  props: KnowledgeWorkspaceProps,
): React.JSX.Element {
  if (props.state.knowledgeWorkspaceView === "trash") {
    return <KnowledgeTrashView state={props.state} dispatch={props.dispatch} />;
  }
  return <KnowledgeDocumentWorkspace {...props} />;
}

function KnowledgeDocumentWorkspace({
  state,
  dispatch,
  aiPanel,
  onOpenTree,
  onToggleTree,
  treeOpen = true,
}: KnowledgeWorkspaceProps): React.JSX.Element {
  const {
    primaryDocument: selectedDocument,
    secondaryDocument: splitDocument,
    splitEnabled,
    activePane,
    activeDocument,
  } = getKnowledgePaneState(state);
  const activePaneDocumentId = activeDocument?.id ?? "";
  const openTabs = getOpenDocuments(state);
  const editingDocumentId = state.editingKnowledgeDocumentId;
  const currentDocument = activeDocument ?? selectedDocument;
  const activeDocuments = getActiveProjectDocuments(state);
  const contentHistory = useKnowledgeContentHistory();
  const markdownFileInputRef = useRef<HTMLInputElement>(null);
  const printDocumentRef = useRef<HTMLElement>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const shareMenuPanelRef = useRef<HTMLDivElement>(null);
  const pendingScrollRestoreRef = useRef<DocumentScrollSnapshot | null>(null);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);

  useEffect(() => {
    if (!shareMenuOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent): void => {
      if (
        event.target instanceof Node &&
        !shareMenuRef.current?.contains(event.target) &&
        !shareMenuPanelRef.current?.contains(event.target)
      ) {
        setShareMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setShareMenuOpen(false);
    };
    window.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [shareMenuOpen]);

  useLayoutEffect(() => {
    const snapshot = pendingScrollRestoreRef.current;
    if (!snapshot || snapshot.documentId !== activePaneDocumentId) return;
    const page = getKnowledgeDocumentPage(snapshot.documentId);
    pendingScrollRestoreRef.current = null;
    if (!page) return;
    const editor = page.querySelector<HTMLElement>(".markdown-source-editor");
    if (editor) {
      const pagePaddingBottom = Number.parseFloat(
        window.getComputedStyle(page).paddingBottom,
      );
      editor.style.minHeight = `${Math.max(
        page.clientHeight + snapshot.availableScroll - pagePaddingBottom,
        0,
      )}px`;
    }
    const availableScroll = Math.max(page.scrollHeight - page.clientHeight, 0);
    page.scrollTop =
      availableScroll > 0
        ? snapshot.progress * availableScroll
        : snapshot.scrollTop;
  }, [activePaneDocumentId, editingDocumentId]);

  const activatePane = (pane: "primary" | "secondary"): void => {
    dispatch({ type: "activate-knowledge-pane", pane });
  };

  const toggleMarkdownEditing = (): void => {
    const page = getKnowledgeDocumentPage(activePaneDocumentId);
    if (page) {
      const availableScroll = Math.max(
        page.scrollHeight - page.clientHeight,
        0,
      );
      pendingScrollRestoreRef.current = {
        availableScroll,
        documentId: activePaneDocumentId,
        progress: availableScroll > 0 ? page.scrollTop / availableScroll : 0,
        scrollTop: page.scrollTop,
      };
    }
    dispatch({
      type: "toggle-knowledge-document-edit",
      documentId: activePaneDocumentId,
    });
  };

  const loadMarkdown = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || !currentDocument) return;
    try {
      contentHistory.commitMarkdown(currentDocument.id, await file.text(), {
        origin: "load",
      });
    } finally {
      input.value = "";
    }
  };

  const saveMarkdown = (): void => {
    if (!currentDocument) return;
    const blob = new Blob([currentDocument.content.join("\n")], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.download = markdownDownloadName(currentDocument.title);
    link.href = url;
    link.click();
    queueMicrotask(() => URL.revokeObjectURL(url));
  };

  const openMarkdownFilePicker = (): void => {
    markdownFileInputRef.current?.click();
  };

  const handleLoadPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
  ): void => {
    if (event.button === 0 && event.detail <= 1) openMarkdownFilePicker();
  };

  const handleLoadClick = (
    event: React.MouseEvent<HTMLButtonElement>,
  ): void => {
    if (event.detail === 0) openMarkdownFilePicker();
  };

  const handleSavePointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
  ): void => {
    if (event.button === 0 && event.detail <= 1) saveMarkdown();
  };

  const handleSaveClick = (
    event: React.MouseEvent<HTMLButtonElement>,
  ): void => {
    if (event.detail === 0) saveMarkdown();
  };

  const printArticleAsPdf = (): void => {
    if (!currentDocument || !printDocumentRef.current) return;
    const printWindow = window.open(
      "",
      "_blank",
      "popup,width=900,height=1000",
    );
    if (!printWindow) return;
    printWindow.opener = null;
    printWindow.document.open();
    printWindow.document.write(
      '<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>' +
        "@page{margin:20mm}body{margin:0;color:#1f2328;font:16px/1.65 Arial,sans-serif}" +
        "main{max-width:720px;margin:0 auto}small{display:block;margin-bottom:24px;color:#6b7280}" +
        "h1{font-size:32px;line-height:1.25}h2{margin-top:28px;font-size:22px}h3{margin-top:22px;font-size:18px}" +
        "p{margin:10px 0}pre{overflow-wrap:anywhere;white-space:pre-wrap;background:#f5f5f5;padding:14px}" +
        "blockquote{border-left:3px solid #bbb;margin-left:0;padding-left:16px}a{color:#303f9f}" +
        'hr{border:0;border-top:1px solid #ddd}</style></head><body><main id="article"></main></body></html>',
    );
    printWindow.document.close();
    printWindow.document.title = currentDocument.title;
    const printTarget = printWindow.document.getElementById("article");
    if (printTarget) printTarget.innerHTML = printDocumentRef.current.innerHTML;
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const shareArticle = (channel: "email" | "telegram" | "whatsapp"): void => {
    if (!currentDocument) return;
    const articleUrl = window.location.href;
    const title = `Статья «${currentDocument.title}»`;
    const urls = {
      email: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${title}\n\n${articleUrl}`)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(articleUrl)}&text=${encodeURIComponent(title)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title}\n${articleUrl}`)}`,
    };
    if (channel === "email") {
      window.location.href = urls.email;
    } else {
      window.open(urls[channel], "_blank", "noopener,noreferrer");
    }
    setShareMenuOpen(false);
  };

  if (!selectedDocument) {
    return <EmptySection title="Знания" />;
  }

  return (
    <div
      className={`document-workspace ${
        state.contextPanel?.kind === "knowledge-task-attach"
          ? "is-task-attachment-mode"
          : ""
      }`}
    >
      <div className="document-tabs-row">
        <div
          className="document-tabs"
          role="tablist"
          aria-label="Открытые документы"
        >
          {openTabs.map((document) => (
            <div
              className={[
                "document-tab-item",
                document.id === selectedDocument.id ? "active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={document.id}
            >
              <button
                aria-selected={document.id === selectedDocument.id}
                className="document-tab-activate"
                onClick={() =>
                  dispatch({
                    type: "activate-document-tab",
                    documentId: document.id,
                  })
                }
                role="tab"
                type="button"
              >
                <span title={document.title}>{document.title}</span>
                {document.id === "doc-l-magic" ? (
                  <span
                    className="tab-unsaved"
                    aria-label="Есть несохранённые mock-правки"
                  />
                ) : null}
              </button>
              <IconButton
                className="tab-close"
                icon={<UiIcon name="close" />}
                label={`Закрыть ${document.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  dispatch({
                    type: "close-document-tab",
                    documentId: document.id,
                  });
                }}
                title={`Закрыть ${document.title}`}
                variant="ghost"
              />
            </div>
          ))}
          <button
            className="document-tab-add"
            onClick={() => dispatch({ type: "create-knowledge-document" })}
            type="button"
            title="Создать документ"
            aria-label="Создать документ"
          >
            <UiIcon name="plus" />
          </button>
        </div>
        <div className="document-actions">
          <div className="knowledge-responsive-actions">
            <IconButton
              icon={<UiIcon name={treeOpen ? "panel-left" : "panel-right"} />}
              label={
                treeOpen
                  ? "Скрыть дерево документов"
                  : "Показать дерево документов"
              }
              onClick={onToggleTree ?? onOpenTree}
              title={
                treeOpen
                  ? "Скрыть дерево документов"
                  : "Показать дерево документов"
              }
              variant="quiet"
            />
          </div>
          <IconButton
            className="knowledge-content-history-action"
            disabled={!contentHistory.canUndoActive(activeDocument?.id)}
            icon={<UiIcon name="arrow-left" />}
            label="Отменить"
            onClick={() => {
              contentHistory.undoActive(activeDocument?.id);
            }}
            onMouseDown={(event) => event.preventDefault()}
            title={contentHistory.getUndoTitle(activeDocument?.id)}
            variant="quiet"
          />
          <IconButton
            className="knowledge-content-history-action"
            disabled={!contentHistory.canRedoActive(activeDocument?.id)}
            icon={<UiIcon name="arrow-right" />}
            label="Повторить"
            onClick={() => {
              contentHistory.redoActive(activeDocument?.id);
            }}
            onMouseDown={(event) => event.preventDefault()}
            title={contentHistory.getRedoTitle(activeDocument?.id)}
            variant="quiet"
          />
          <IconButton
            className="knowledge-edit-action"
            active={editingDocumentId === activePaneDocumentId}
            icon={
              <UiIcon
                name={
                  editingDocumentId === activePaneDocumentId ? "eye" : "pencil"
                }
              />
            }
            label={
              editingDocumentId === activePaneDocumentId
                ? "Перейти в режим чтения"
                : "Редактировать Markdown"
            }
            onClick={toggleMarkdownEditing}
            title={
              editingDocumentId === activePaneDocumentId
                ? "Режим чтения"
                : "Редактировать Markdown"
            }
            variant="quiet"
          />
          <input
            accept=".md,text/markdown,text/plain"
            className="knowledge-document-file-input"
            onChange={loadMarkdown}
            ref={markdownFileInputRef}
            type="file"
          />
          <PrototypeButton
            aria-label="Загрузить Markdown в текущую статью"
            onClick={handleLoadClick}
            onPointerDown={handleLoadPointerDown}
            size="compact"
            variant="quiet"
          >
            Load
          </PrototypeButton>
          <PrototypeButton
            aria-label="Скачать текущую статью в Markdown"
            onClick={handleSaveClick}
            onPointerDown={handleSavePointerDown}
            size="compact"
            variant="quiet"
          >
            Save
          </PrototypeButton>
          <div className="document-share-control" ref={shareMenuRef}>
            <PrototypeButton
              aria-expanded={shareMenuOpen}
              aria-label="Поделиться статьёй"
              aria-haspopup="menu"
              onClick={() => setShareMenuOpen((open) => !open)}
              size="icon"
              title="Поделиться статьёй"
              variant="quiet"
            >
              <UiIcon name="share" />
            </PrototypeButton>
          </div>
          <PrototypeButton
            className="knowledge-legacy-task-button"
            active={state.contextPanel?.kind === "knowledge-tasks"}
            onClick={() => dispatch({ type: "open-knowledge-task-linker" })}
            size="compact"
            variant="quiet"
          >
            Задачи
          </PrototypeButton>
          <PrototypeButton
            active={splitEnabled}
            onClick={() => dispatch({ type: "toggle-knowledge-split-view" })}
            aria-label="Включить или выключить Split"
            size="icon"
            title="Включить или выключить Split"
            variant="quiet"
          >
            <UiIcon name="split" />
          </PrototypeButton>
          <PrototypeButton
            active={state.contextPanel?.kind === "ai"}
            onClick={() => dispatch({ type: "open-ai-panel" })}
            size="compact"
            variant="quiet"
          >
            AI
          </PrototypeButton>
        </div>
      </div>
      {shareMenuOpen ? (
        <div
          aria-label="Поделиться статьёй"
          className="document-share-menu"
          ref={shareMenuPanelRef}
          role="menu"
        >
          <span>PDF</span>
          <PrototypeButton
            onClick={printArticleAsPdf}
            role="menuitem"
            size="compact"
            variant="quiet"
          >
            Сохранить PDF
          </PrototypeButton>
          <span>Отправить</span>
          <div className="document-share-channels">
            <PrototypeButton
              onClick={() => shareArticle("email")}
              role="menuitem"
              size="compact"
              variant="quiet"
            >
              Почта
            </PrototypeButton>
            <PrototypeButton
              onClick={() => shareArticle("telegram")}
              role="menuitem"
              size="compact"
              variant="quiet"
            >
              Telegram
            </PrototypeButton>
            <PrototypeButton
              onClick={() => shareArticle("whatsapp")}
              role="menuitem"
              size="compact"
              variant="quiet"
            >
              WhatsApp
            </PrototypeButton>
          </div>
          <small>Прикрепите сохранённый PDF в выбранном сервисе.</small>
        </div>
      ) : null}
      <div
        className={
          aiPanel
            ? "knowledge-ai-content-region"
            : "knowledge-document-content-wrapper"
        }
      >
        <div
          className={
            aiPanel
              ? "knowledge-ai-document-pane"
              : "knowledge-document-content-wrapper"
          }
        >
          <div
            className={[
              "document-body",
              splitEnabled ? "is-split-view" : "",
              editingDocumentId ? "is-markdown-editing" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {!splitEnabled ? (
              <DocumentOutline document={selectedDocument} />
            ) : null}
            <DocumentBreadcrumb
              active={activePane === "primary"}
              dispatch={dispatch}
              document={selectedDocument}
              state={state}
            />
            {splitEnabled && splitDocument ? (
              <DocumentBreadcrumb
                active={activePane === "secondary"}
                dispatch={dispatch}
                document={splitDocument}
                secondary
                state={state}
              />
            ) : null}
            {splitEnabled ? (
              <div
                aria-label="Выбор документа Split"
                className="knowledge-split-switcher"
                role="tablist"
              >
                {splitDocument ? (
                  <div
                    aria-selected={activePane === "secondary"}
                    className="knowledge-split-tab active"
                    role="tab"
                  >
                    <button
                      className="knowledge-split-tab-label"
                      onClick={() => activatePane("secondary")}
                      title={`${getDocumentFolderPath(splitDocument).join(" / ")} / ${getDocumentTitle(splitDocument)}`}
                      type="button"
                    >
                      {getDocumentFolderPath(splitDocument).at(-1) ?? "Корень"}{" "}
                      / {getDocumentTitle(splitDocument)}
                    </button>
                    <IconButton
                      aria-label={`Закрыть Split: ${getDocumentTitle(splitDocument)}`}
                      className="knowledge-split-tab-close"
                      icon={<UiIcon name="close" />}
                      label={`Закрыть Split: ${getDocumentTitle(splitDocument)}`}
                      onClick={() =>
                        dispatch({ type: "close-knowledge-split-view" })
                      }
                      title={`Закрыть Split: ${getDocumentTitle(splitDocument)}`}
                      variant="ghost"
                    />
                  </div>
                ) : null}
                <button
                  aria-selected={activePane === "primary"}
                  className={activePane === "primary" ? "active" : ""}
                  onClick={() => activatePane("primary")}
                  role="tab"
                  type="button"
                >
                  Левый: {selectedDocument.title}
                </button>
                <button
                  aria-selected={activePane === "secondary"}
                  className={activePane === "secondary" ? "active" : ""}
                  onClick={() => activatePane("secondary")}
                  role="tab"
                  type="button"
                >
                  Правый: {splitDocument?.title ?? "Выберите документ"}
                </button>
              </div>
            ) : null}
            <div
              className={[
                "document-editor-surface",
                splitEnabled ? "is-split-view" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={(event) => {
                const target = event.target;
                if (!(target instanceof Element)) return;
                if (
                  target.closest(
                    'button, a, input, textarea, select, [contenteditable="true"], .markdown-toolbar, .document-tabs-row',
                  )
                )
                  return;
                dispatch({ type: "clear-knowledge-breadcrumb-highlight" });
              }}
            >
              <DocumentArticle
                active={activePane === "primary"}
                dispatch={dispatch}
                document={selectedDocument}
                documents={activeDocuments}
                activeProjectId={state.activeProjectId}
                editing={editingDocumentId === selectedDocument.id}
                onActivate={() => activatePane("primary")}
              />
              {splitEnabled ? (
                <DocumentArticle
                  active={activePane === "secondary"}
                  dispatch={dispatch}
                  document={splitDocument}
                  documents={activeDocuments}
                  activeProjectId={state.activeProjectId}
                  editing={
                    Boolean(splitDocument) &&
                    editingDocumentId === splitDocument?.id
                  }
                  onActivate={() => activatePane("secondary")}
                  secondary
                />
              ) : null}
            </div>
          </div>
        </div>
        {aiPanel}
      </div>
      {currentDocument ? (
        <article
          className="knowledge-print-document"
          data-print-document-id={currentDocument.id}
          ref={printDocumentRef}
        >
          <small>{getDocumentBreadcrumb(currentDocument)}</small>
          <MarkdownDocumentPreview
            document={currentDocument}
            headingIdPrefix="print-"
          />
        </article>
      ) : null}
    </div>
  );
}

function DocumentOutline({
  document,
}: {
  document: PrototypeDocument | undefined;
}): React.JSX.Element {
  const headings = (document ? getDocumentHeadings(document) : []).filter(
    (heading) => heading.level <= 2,
  );
  return (
    <aside className="document-outline" aria-label="Навигация по статье">
      <nav>
        {headings.map((heading) => (
          <button
            className={`level-${heading.level}`}
            key={heading.id}
            onClick={() =>
              window.document
                .getElementById(heading.id)
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            type="button"
          >
            {heading.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

function DocumentBreadcrumb({
  document,
  state,
  dispatch,
  secondary = false,
  active,
}: {
  document: PrototypeDocument;
  state: DesktopPrototypeState;
  dispatch: Dispatch;
  secondary?: boolean;
  active: boolean;
}): React.JSX.Element {
  const folderPath = getDocumentFolderPath(document);
  const segments = [...folderPath, getDocumentTitle(document)];
  const selectedPath = state.selectedKnowledgePath;

  return (
    <div
      className={`document-breadcrumb-row ${
        secondary ? "is-secondary" : "is-primary"
      } ${active ? "is-active" : ""}`}
      aria-label="РџСѓС‚СЊ Рє СЃС‚Р°С‚СЊРµ"
    >
      {segments.map((segment, index) => {
        const isDocument = index === folderPath.length;
        const path = folderPath.slice(0, index + 1);
        const isSelected =
          state.knowledgeBreadcrumbHighlightVisible &&
          (isDocument
            ? selectedPath?.kind === "document" &&
              selectedPath.documentId === document.id
            : selectedPath?.kind === "folder" &&
              knowledgePathsEqual(selectedPath.path, path));
        return (
          <React.Fragment key={`${segment}-${index}`}>
            {index > 0 ? (
              <span
                aria-hidden="true"
                className="document-breadcrumb-separator"
              >
                /
              </span>
            ) : null}
            <button
              aria-current={isSelected ? "location" : undefined}
              className={`document-breadcrumb-item ${
                isSelected ? "is-selected" : ""
              }`}
              data-breadcrumb-kind={isDocument ? "document" : "folder"}
              data-breadcrumb-path={isDocument ? document.id : path.join("/")}
              onClick={() =>
                isDocument
                  ? dispatch({
                      type: "open-knowledge-document-from-breadcrumb",
                      documentId: document.id,
                    })
                  : dispatch({
                      type: "select-knowledge-folder-from-breadcrumb",
                      path,
                    })
              }
              title={segment}
              type="button"
            >
              {segment}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function DocumentArticle({
  document,
  documents,
  activeProjectId,
  secondary = false,
  active,
  editing,
  dispatch,
  onActivate,
}: {
  document: PrototypeDocument | undefined;
  documents: PrototypeDocument[];
  activeProjectId: string;
  secondary?: boolean;
  active: boolean;
  editing: boolean;
  dispatch: Dispatch;
  onActivate: () => void;
}): React.JSX.Element {
  const contentHistory = useKnowledgeContentHistory();

  return (
    <article
      className={[
        "document-page",
        secondary ? "secondary" : "",
        active ? "is-active-pane" : "",
        editing ? "is-editing" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={
        document?.title ?? "Выберите документ в дереве, чтобы открыть его здесь"
      }
      data-document-id={document?.id}
      onFocusCapture={onActivate}
      onKeyDown={(event) => {
        if (!active || isEditableTarget(event.target)) return;
        const shortcut = getKnowledgeHistoryShortcutAction(event);
        if (!shortcut) return;
        event.preventDefault();
        if (shortcut === "undo") contentHistory.undoActive(document?.id);
        else contentHistory.redoActive(document?.id);
      }}
      onPointerDown={onActivate}
      tabIndex={0}
    >
      {!document ? (
        <div className="knowledge-empty-pane">
          Выберите документ в дереве, чтобы открыть его здесь.
        </div>
      ) : editing ? (
        <MarkdownSourceEditor
          document={document}
          documents={documents}
          key={document.id}
        />
      ) : (
        <div className="document-page-inner">
          <MarkdownDocumentPreview
            document={document}
            onTaskToggle={(lineIndex, checked) =>
              contentHistory.commitMarkdown(
                document.id,
                toggleTaskListMarker(
                  document.content.join("\n"),
                  lineIndex,
                  checked,
                ),
                {
                  origin: "checklist",
                },
              )
            }
            onInternalLink={(documentId) => {
              const target = documents.find((item) => item.id === documentId);
              if (
                !target ||
                target.projectId !== activeProjectId ||
                target.id === document.id
              )
                return;
              dispatch({
                type: "open-knowledge-document-in-active-pane",
                documentId: target.id,
              });
            }}
          />
        </div>
      )}
    </article>
  );
}
