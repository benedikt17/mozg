import { createPortal } from "react-dom";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { CanvasTaskProjection } from "@/lib/canvas/canvas-task-bridge";
import type { ProjectFileRecord } from "@/lib/files/project-file-repository";
import type { PrototypeDocument } from "@/prototype/desktop-mock-data";
import { CanvasProjectFilePicker } from "@/prototype/canvases/canvas-project-file-picker";
import { CanvasAutoLayoutButton } from "@/prototype/canvases/canvas-auto-layout-button";
import type { CanvasBreadcrumbSegment } from "@/prototype/canvases/canvas-breadcrumb";
import type { LocalCanvasShellStatus } from "@/lib/canvas/local-canvas-shell-controller";
import type { CanvasSummary } from "@/lib/canvas/local-canvas-repository";
import {
  CanvasGroupsSidebar,
  type CanvasGroupsSidebarProps,
} from "@/prototype/canvases/canvas-groups-sidebar";
import { UiIcon } from "@/prototype/desktop-icons";
import { IconButton, PrototypeButton } from "@/prototype/desktop-ui";
import type { CanvasShellCopy } from "@/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell";
import styles from "@/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.module.css";

type CanvasListState = "loading" | "ready" | "empty" | "error";

function CanvasBreadcrumb({
  segments,
  highlightedGroupId,
  onSelectCanvas,
  onSelectGroup,
}: {
  segments: readonly CanvasBreadcrumbSegment[];
  highlightedGroupId: string | null;
  onSelectCanvas: (canvasId: string) => void;
  onSelectGroup: (groupId: string) => void;
}): React.JSX.Element | null {
  if (segments.length === 0) return null;
  return (
    <nav
      aria-label="Путь к текущему холсту"
      className={styles.canvasBreadcrumb}
    >
      {segments.map((segment, index) => {
        const selected =
          segment.kind === "group"
            ? segment.id === highlightedGroupId
            : highlightedGroupId === null;
        return (
          <Fragment key={`${segment.kind}:${segment.id}`}>
            {index > 0 ? (
              <span
                aria-hidden="true"
                className={styles.canvasBreadcrumbSeparator}
              >
                /
              </span>
            ) : null}
            <button
              aria-current={selected ? "location" : undefined}
              className={`${styles.canvasBreadcrumbItem} ${selected ? styles.canvasBreadcrumbItemSelected : ""}`}
              onClick={() =>
                segment.kind === "group"
                  ? onSelectGroup(segment.id)
                  : onSelectCanvas(segment.id)
              }
              title={segment.title}
              type="button"
            >
              {segment.title}
            </button>
          </Fragment>
        );
      })}
    </nav>
  );
}

export function LegacyCanvasDesktopSidebar({
  activeCanvasId,
  copy,
  error,
  listState,
  onCreateCanvas,
  onDeleteCanvas,
  onRenameCanvas,
  onRetry,
  onSelectCanvas,
  summaries,
}: {
  activeCanvasId: string | null;
  copy: CanvasShellCopy;
  error: string | null;
  listState: CanvasListState;
  onCreateCanvas: (title: string) => void;
  onDeleteCanvas: () => void;
  onRenameCanvas: (canvasId: string, title: string) => void;
  onRetry: () => void;
  onSelectCanvas: (canvasId: string) => void;
  summaries: readonly CanvasSummary[];
}): React.JSX.Element {
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState(copy.defaultTitle);
  const [searchQuery, setSearchQuery] = useState("");
  const visibleSummaries = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("ru");
    if (!normalizedQuery) return summaries;
    return summaries.filter((summary) =>
      summary.title.toLocaleLowerCase("ru").includes(normalizedQuery),
    );
  }, [searchQuery, summaries]);

  return (
    <aside
      aria-label="Управление холстами"
      className={`${styles.desktopCanvasSidebar} tool-sidebar knowledge-sidebar`}
    >
      <header
        className={`${styles.desktopCanvasSidebarHeader} knowledge-sidebar-header`}
      >
        <div>
          <p className={styles.desktopCanvasSidebarEyebrow}>{copy.eyebrow}</p>
          <h1>Холсты</h1>
        </div>
        <div className="knowledge-toolbar">
          <IconButton
            icon={<UiIcon name="plus" />}
            label="Создать холст"
            onClick={() => {
              setCreateTitle(copy.defaultTitle);
              setCreateOpen(true);
            }}
            title="Создать холст"
            variant="ghost"
          />
        </div>
      </header>

      <div className={`${styles.desktopCanvasSidebarSearch} knowledge-search`}>
        <input
          aria-label="Поиск по холстам"
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Поиск по холстам"
          type="search"
          value={searchQuery}
        />
      </div>

      <div className={styles.desktopCanvasSidebarBody}>
        {createOpen ? (
          <form
            className={styles.desktopCanvasCreateForm}
            onSubmit={(event) => {
              event.preventDefault();
              const title = createTitle.trim();
              if (!title) return;
              onCreateCanvas(title);
              setCreateOpen(false);
            }}
          >
            <label htmlFor="desktop-canvas-create-title">Новый холст</label>
            <input
              autoFocus
              id="desktop-canvas-create-title"
              onChange={(event) => setCreateTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setCreateOpen(false);
                }
              }}
              placeholder={copy.defaultTitle}
              value={createTitle}
            />
            <div className={styles.desktopCanvasCreateActions}>
              <PrototypeButton size="compact" type="submit" variant="primary">
                Создать
              </PrototypeButton>
              <PrototypeButton
                onClick={() => setCreateOpen(false)}
                size="compact"
                type="button"
                variant="quiet"
              >
                Отмена
              </PrototypeButton>
            </div>
          </form>
        ) : null}

        <nav
          aria-label="Список холстов"
          className={`${styles.desktopCanvasSidebarList} knowledge-tree`}
        >
          {listState === "loading" ? (
            <p className={styles.desktopCanvasSidebarMessage} role="status">
              Загружаем холсты…
            </p>
          ) : listState === "error" ? (
            <div className={styles.desktopCanvasSidebarMessage} role="alert">
              <p>{error ?? copy.error}</p>
              <PrototypeButton onClick={onRetry} size="compact" variant="quiet">
                Повторить
              </PrototypeButton>
            </div>
          ) : listState === "empty" ? (
            <p className={styles.desktopCanvasSidebarMessage}>
              Пока нет холстов. Создайте первый сверху.
            </p>
          ) : visibleSummaries.length === 0 ? (
            <p className={styles.desktopCanvasSidebarMessage}>
              Совпадений нет.
            </p>
          ) : (
            visibleSummaries.map((summary) => (
              <LegacyCanvasDesktopSidebarRow
                active={summary.id === activeCanvasId}
                key={summary.id}
                onDelete={
                  summary.id === activeCanvasId ? onDeleteCanvas : undefined
                }
                onRename={onRenameCanvas}
                onSelect={() => onSelectCanvas(summary.id)}
                summary={summary}
              />
            ))
          )}
        </nav>
      </div>
    </aside>
  );
}

function LegacyCanvasDesktopSidebarRow({
  active,
  onDelete,
  onRename,
  onSelect,
  summary,
}: {
  active: boolean;
  onDelete?: () => void;
  onRename: (canvasId: string, title: string) => void;
  onSelect: () => void;
  summary: CanvasSummary;
}): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const menuTriggerRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(summary.title);

  const commitRename = (): void => {
    const title = draft.trim();
    if (title) onRename(summary.id, title);
    setEditing(false);
  };

  return (
    <div
      className={`${styles.desktopCanvasSidebarRow} ${active ? styles.desktopCanvasSidebarRowActive : ""}`}
    >
      {editing ? (
        <input
          aria-label={`Название холста ${summary.title}`}
          autoFocus
          className={styles.desktopCanvasSidebarRename}
          onBlur={commitRename}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              event.preventDefault();
              setDraft(summary.title);
              setEditing(false);
            }
          }}
          value={draft}
        />
      ) : (
        <button
          aria-current={active ? "page" : undefined}
          className={styles.desktopCanvasSidebarSelect}
          onClick={onSelect}
          title={summary.title}
          type="button"
        >
          <UiIcon name="layout" />
          <span>{summary.title}</span>
        </button>
      )}
      {!editing ? (
        <div
          className={styles.desktopCanvasSidebarMenuWrap}
          ref={menuTriggerRef}
        >
          <IconButton
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className={styles.desktopCanvasSidebarMenuTrigger}
            icon={<UiIcon name="more" />}
            label={`Действия холста ${summary.title}`}
            onClick={() => {
              const nextOpen = !menuOpen;
              if (nextOpen && menuTriggerRef.current) {
                const rect = menuTriggerRef.current.getBoundingClientRect();
                setMenuPosition({
                  top: rect.bottom - 2,
                  right: window.innerWidth - rect.right,
                });
              }
              setMenuOpen(nextOpen);
            }}
            title={`Действия холста ${summary.title}`}
            variant="ghost"
          />
          {menuOpen && menuPosition
            ? createPortal(
                <div
                  className={styles.desktopCanvasSidebarMenu}
                  role="menu"
                  style={{ top: menuPosition.top, right: menuPosition.right }}
                >
                  <button
                    onClick={() => {
                      setDraft(summary.title);
                      setEditing(true);
                      setMenuOpen(false);
                    }}
                    role="menuitem"
                    type="button"
                  >
                    <UiIcon name="pencil" />
                    <span>Переименовать</span>
                  </button>
                  {onDelete ? (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onDelete();
                      }}
                      role="menuitem"
                      type="button"
                    >
                      <UiIcon name="trash" />
                      <span>Удалить</span>
                    </button>
                  ) : null}
                </div>,
                document.body,
              )
            : null}
        </div>
      ) : null}
    </div>
  );
}

export function CanvasDesktopSidebar(
  props: CanvasGroupsSidebarProps,
): React.JSX.Element {
  return <CanvasGroupsSidebar {...props} />;
}

export function CanvasDesktopToolbar({
  breadcrumb,
  canRedo,
  canUndo,
  copy,
  error,
  interactive,
  onAddImage,
  onAddPdf,
  onAddText,
  onAddRectangle,
  onAddCircle,
  onAddSummary,
  onExportPortableCopy,
  onCloseFilePicker,
  onCloseArticlePicker,
  onCloseTaskPicker,
  onFileQueryChange,
  onKeepLocalChanges,
  onRedo,
  onReloadWinner,
  onRestoreLocalDraft,
  onRetry,
  onSelectFile,
  onSelectArticle,
  onSelectTask,
  onArticleQueryChange,
  onTaskQueryChange,
  onToggleFilePicker,
  onToggleArticlePicker,
  onToggleSidebar,
  onToggleTaskPicker,
  onUndo,
  filePickerOpen,
  fileQuery,
  fileResults,
  fileSearchStatus,
  fileToolsReady,
  conflictDraftAvailable,
  articlePickerOpen,
  articleQuery,
  articleResults,
  articleToolsReady,
  sidebarOpen,
  status,
  taskPickerOpen,
  taskQuery,
  taskResults,
  taskSearchStatus,
  taskToolsReady,
}: {
  breadcrumb: {
    highlightedGroupId: string | null;
    onSelectCanvas: (canvasId: string) => void;
    onSelectGroup: (groupId: string) => void;
    segments: readonly CanvasBreadcrumbSegment[];
  };
  canRedo: boolean;
  canUndo: boolean;
  copy: CanvasShellCopy;
  error: string | null;
  interactive: boolean;
  onAddImage: (files: File[]) => void;
  onAddPdf: (files: File[]) => void;
  onAddText: () => void;
  onAddRectangle: () => void;
  onAddCircle: () => void;
  onAddSummary: () => void;
  onExportPortableCopy: () => void;
  onCloseFilePicker: () => void;
  onCloseArticlePicker: () => void;
  onCloseTaskPicker: () => void;
  onFileQueryChange: (query: string) => void;
  onKeepLocalChanges: () => void;
  onRedo: () => void;
  onReloadWinner: () => void;
  onRestoreLocalDraft: () => void;
  onRetry: () => void;
  onSelectFile: (file: ProjectFileRecord) => void;
  onSelectArticle: (article: PrototypeDocument) => void;
  onSelectTask: (task: CanvasTaskProjection) => void;
  onArticleQueryChange: (query: string) => void;
  onTaskQueryChange: (query: string) => void;
  onToggleFilePicker: () => void;
  onToggleArticlePicker: () => void;
  onToggleSidebar: () => void;
  onToggleTaskPicker: () => void;
  onUndo: () => void;
  filePickerOpen: boolean;
  fileQuery: string;
  fileResults: readonly ProjectFileRecord[];
  fileSearchStatus: "idle" | "loading" | "ready" | "error";
  fileToolsReady: boolean;
  conflictDraftAvailable: boolean;
  articlePickerOpen: boolean;
  articleQuery: string;
  articleResults: readonly PrototypeDocument[];
  articleToolsReady: boolean;
  sidebarOpen: boolean;
  status: LocalCanvasShellStatus;
  taskPickerOpen: boolean;
  taskQuery: string;
  taskResults: readonly CanvasTaskProjection[];
  taskSearchStatus: "idle" | "loading" | "ready" | "error";
  taskToolsReady: boolean;
}): React.JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const taskPickerTriggerRef = useRef<HTMLDivElement>(null);
  const taskPickerPanelRef = useRef<HTMLDivElement>(null);
  const articlePickerTriggerRef = useRef<HTMLDivElement>(null);
  const articlePickerPanelRef = useRef<HTMLDivElement>(null);
  const [taskPickerPosition, setTaskPickerPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [articlePickerPosition, setArticlePickerPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const isReady = interactive && status !== "conflict" && status !== "error";
  const statusLabel =
    status === "saved"
      ? copy.saved
      : status === "saving"
        ? copy.saving
        : status === "conflict"
          ? copy.conflict
          : status === "loading"
            ? copy.loading
            : copy.error;

  useEffect(() => {
    if (!taskPickerOpen) {
      return;
    }
    const updatePosition = (): void => {
      const trigger = taskPickerTriggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(340, window.innerWidth - 32);
      setTaskPickerPosition({
        top: rect.bottom + 8,
        left: Math.max(
          16,
          Math.min(rect.right - width, window.innerWidth - width - 16),
        ),
      });
    };
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        taskPickerTriggerRef.current?.contains(target) ||
        taskPickerPanelRef.current?.contains(target)
      )
        return;
      onCloseTaskPicker();
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onCloseTaskPicker, taskPickerOpen]);

  useEffect(() => {
    if (!articlePickerOpen) return;
    const updatePosition = (): void => {
      const trigger = articlePickerTriggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(340, window.innerWidth - 32);
      setArticlePickerPosition({
        top: rect.bottom + 8,
        left: Math.max(
          16,
          Math.min(rect.right - width, window.innerWidth - width - 16),
        ),
      });
    };
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        articlePickerTriggerRef.current?.contains(target) ||
        articlePickerPanelRef.current?.contains(target)
      )
        return;
      onCloseArticlePicker();
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [articlePickerOpen, onCloseArticlePicker]);

  return (
    <div
      aria-label="Инструменты холста"
      className={`${styles.desktopCanvasToolbar} document-tabs-row`}
      role="toolbar"
    >
      <div className={`${styles.desktopCanvasToolbarGroup} document-actions`}>
        <IconButton
          icon={<UiIcon name={sidebarOpen ? "panel-left" : "panel-right"} />}
          label={
            sidebarOpen
              ? "Свернуть список холстов"
              : "Развернуть список холстов"
          }
          onClick={onToggleSidebar}
          title={
            sidebarOpen
              ? "Свернуть список холстов"
              : "Развернуть список холстов"
          }
          variant="quiet"
        />
        <IconButton
          className="knowledge-content-history-action"
          disabled={!isReady || !canUndo}
          icon={<UiIcon name="arrow-left" />}
          label="Отменить"
          onClick={onUndo}
          onMouseDown={(event) => event.preventDefault()}
          title="Отменить"
          variant="quiet"
        />
        <IconButton
          className="knowledge-content-history-action"
          disabled={!isReady || !canRedo}
          icon={<UiIcon name="arrow-right" />}
          label="Повторить"
          onClick={onRedo}
          onMouseDown={(event) => event.preventDefault()}
          title="Повторить"
          variant="quiet"
        />
        <CanvasAutoLayoutButton disabled={!isReady} />
        <IconButton
          disabled={!isReady}
          icon={<UiIcon name="share" />}
          label="Скачать автономную копию холста"
          onClick={onExportPortableCopy}
          title="Скачать автономную копию"
          variant="quiet"
        />
        <IconButton
          disabled={!isReady}
          icon={<UiIcon name="file-plus" />}
          label={copy.addImage}
          onClick={() => fileInputRef.current?.click()}
          title={copy.addImage}
          type="button"
          variant="quiet"
        />
        <IconButton
          disabled={!isReady}
          icon={<UiIcon name="file" />}
          label="Добавить PDF"
          onClick={() => pdfInputRef.current?.click()}
          title="Добавить PDF"
          type="button"
          variant="quiet"
        />
        <input
          accept="image/png,image/jpeg,image/webp"
          hidden
          multiple
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length > 0) onAddImage(files);
          }}
          ref={fileInputRef}
          type="file"
        />
        <input
          accept="application/pdf,.pdf"
          hidden
          multiple
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length > 0) onAddPdf(files);
          }}
          ref={pdfInputRef}
          type="file"
        />
        <CanvasProjectFilePicker
          interactive={isReady}
          onClose={onCloseFilePicker}
          onQueryChange={onFileQueryChange}
          onSelect={onSelectFile}
          onToggle={onToggleFilePicker}
          open={filePickerOpen}
          query={fileQuery}
          results={fileResults}
          searchStatus={fileSearchStatus}
          toolsReady={fileToolsReady}
        />
        <IconButton
          disabled={!isReady}
          icon={<UiIcon name="text" />}
          label={copy.text}
          onClick={onAddText}
          title={copy.text}
          variant="quiet"
        />
        <IconButton
          disabled={!isReady}
          icon={
            <svg aria-hidden="true" height="18" viewBox="0 0 18 18" width="18">
              <rect
                fill="none"
                height="11"
                rx="1"
                stroke="currentColor"
                strokeWidth="1.5"
                width="14"
                x="2"
                y="3.5"
              />
            </svg>
          }
          label="Добавить прямоугольник"
          onClick={onAddRectangle}
          title="Прямоугольник"
          variant="quiet"
        />
        <IconButton
          disabled={!isReady}
          icon={
            <svg aria-hidden="true" height="18" viewBox="0 0 18 18" width="18">
              <circle
                cx="9"
                cy="9"
                fill="none"
                r="6"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          }
          label="Добавить круг"
          onClick={onAddCircle}
          title="Круг"
          variant="quiet"
        />
        <IconButton
          disabled={!isReady}
          icon={<span aria-hidden="true">Σ</span>}
          label="Добавить сумму"
          onClick={onAddSummary}
          title="Сумма"
          variant="quiet"
        />
        <div
          className={styles.desktopCanvasTaskPicker}
          ref={taskPickerTriggerRef}
        >
          <IconButton
            aria-expanded={taskPickerOpen}
            disabled={!isReady || !taskToolsReady}
            icon={<UiIcon name="check-circle" />}
            label="Добавить задачу"
            onClick={onToggleTaskPicker}
            title="Добавить задачу"
            variant="quiet"
          />
          {taskPickerOpen && taskPickerPosition
            ? createPortal(
                <div
                  aria-label="Добавить задачу"
                  className={styles.desktopCanvasTaskPickerPanel}
                  ref={taskPickerPanelRef}
                  role="dialog"
                  style={taskPickerPosition}
                >
                  <div className={styles.desktopCanvasTaskPickerHeader}>
                    <strong>Добавить задачу</strong>
                    <IconButton
                      icon={<UiIcon name="close" />}
                      label="Закрыть выбор задачи"
                      onClick={onCloseTaskPicker}
                      title="Закрыть выбор задачи"
                      variant="ghost"
                    />
                  </div>
                  <input
                    aria-label="Поиск задач"
                    autoFocus
                    onChange={(event) => onTaskQueryChange(event.target.value)}
                    placeholder="Поиск по названию"
                    type="search"
                    value={taskQuery}
                  />
                  <div className={styles.desktopCanvasTaskPickerResults}>
                    {taskSearchStatus === "loading" ? (
                      <p>Загрузка задач…</p>
                    ) : taskSearchStatus === "error" ? (
                      <p role="alert">Не удалось загрузить задачи.</p>
                    ) : taskResults.length === 0 ? (
                      <p>
                        {taskQuery.trim()
                          ? "Совпадений нет"
                          : "В этом проекте нет задач"}
                      </p>
                    ) : (
                      taskResults.map((task) => (
                        <button
                          key={task.id}
                          onClick={() => onSelectTask(task)}
                          type="button"
                        >
                          <strong>{task.title}</strong>
                          <span>
                            {task.completed ? "Выполнено" : "В работе"}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>,
                document.body,
              )
            : null}
        </div>
        <div
          className={styles.desktopCanvasTaskPicker}
          ref={articlePickerTriggerRef}
        >
          <IconButton
            aria-expanded={articlePickerOpen}
            disabled={!isReady || !articleToolsReady}
            icon={<UiIcon name="file" />}
            label="Открыть статью"
            onClick={onToggleArticlePicker}
            title="Открыть статью"
            variant="quiet"
          />
          {articlePickerOpen && articlePickerPosition
            ? createPortal(
                <div
                  aria-label="Открыть статью"
                  className={styles.desktopCanvasTaskPickerPanel}
                  ref={articlePickerPanelRef}
                  role="dialog"
                  style={articlePickerPosition}
                >
                  <div className={styles.desktopCanvasTaskPickerHeader}>
                    <strong>Открыть статью</strong>
                    <IconButton
                      icon={<UiIcon name="close" />}
                      label="Закрыть выбор статьи"
                      onClick={onCloseArticlePicker}
                      title="Закрыть выбор статьи"
                      variant="ghost"
                    />
                  </div>
                  <input
                    aria-label="Поиск статей"
                    autoFocus
                    onChange={(event) =>
                      onArticleQueryChange(event.target.value)
                    }
                    placeholder="Поиск по названию"
                    type="search"
                    value={articleQuery}
                  />
                  <div className={styles.desktopCanvasTaskPickerResults}>
                    {articleResults.length === 0 ? (
                      <p>
                        {articleQuery.trim()
                          ? "Совпадений нет"
                          : "В этом проекте нет статей"}
                      </p>
                    ) : (
                      articleResults.map((article) => (
                        <button
                          key={article.id}
                          onClick={() => onSelectArticle(article)}
                          type="button"
                        >
                          <strong>{article.title}</strong>
                          <span>
                            {article.folderPath?.join(" / ") ||
                              article.folder ||
                              "Корень"}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>,
                document.body,
              )
            : null}
        </div>
      </div>
      <div
        className={`${styles.desktopCanvasToolbarStatus} ${status === "conflict" ? styles.desktopCanvasToolbarStatusConflict : status === "error" ? styles.desktopCanvasToolbarStatusError : ""}`}
      >
        <CanvasBreadcrumb {...breadcrumb} />
        <span
          aria-live="polite"
          aria-label={statusLabel}
          className={`${styles.canvasToolbarSaveState} ${status === "saved" ? styles.canvasToolbarSaveStateSaved : ""}`}
        >
          {status === "saved" ? null : statusLabel}
        </span>
        {error ? <span title={error}> · {error}</span> : null}
        {status === "conflict" ? (
          <>
            <PrototypeButton
              onClick={onKeepLocalChanges}
              size="compact"
              variant="quiet"
            >
              {copy.keepLocalChanges}
            </PrototypeButton>
            <PrototypeButton
              onClick={onReloadWinner}
              size="compact"
              variant="quiet"
            >
              {copy.reloadWinner}
            </PrototypeButton>
          </>
        ) : conflictDraftAvailable ? (
          <PrototypeButton
            onClick={onRestoreLocalDraft}
            size="compact"
            variant="quiet"
          >
            {copy.restoreLocalDraft}
          </PrototypeButton>
        ) : status === "error" ? (
          <PrototypeButton onClick={onRetry} size="compact" variant="quiet">
            Повторить
          </PrototypeButton>
        ) : null}
      </div>
    </div>
  );
}
