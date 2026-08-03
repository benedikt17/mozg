import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import type { CanvasTaskProjection } from "@/lib/canvas/canvas-task-bridge";
import type { LocalCanvasShellStatus } from "@/lib/canvas/local-canvas-shell-controller";
import { UiIcon } from "@/prototype/desktop-icons";
import { IconButton, PrototypeButton } from "@/prototype/desktop-ui";
import type { CanvasShellCopy } from "@/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell";
import styles from "@/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.module.css";

export function CanvasDesktopToolbar({
  copy,
  error,
  onAddImage,
  onAddText,
  onCloseTaskPicker,
  onReloadWinner,
  onRetry,
  onSelectTask,
  onTaskQueryChange,
  onToggleSidebar,
  onToggleTaskPicker,
  sidebarOpen,
  status,
  taskPickerOpen,
  taskQuery,
  taskResults,
  taskSearchStatus,
  taskToolsReady,
}: {
  copy: CanvasShellCopy;
  error: string | null;
  onAddImage: (files: File[]) => void;
  onAddText: () => void;
  onCloseTaskPicker: () => void;
  onReloadWinner: () => void;
  onRetry: () => void;
  onSelectTask: (task: CanvasTaskProjection) => void;
  onTaskQueryChange: (query: string) => void;
  onToggleSidebar: () => void;
  onToggleTaskPicker: () => void;
  sidebarOpen: boolean;
  status: LocalCanvasShellStatus;
  taskPickerOpen: boolean;
  taskQuery: string;
  taskResults: readonly CanvasTaskProjection[];
  taskSearchStatus: "idle" | "loading" | "ready" | "error";
  taskToolsReady: boolean;
}): React.JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const taskPickerTriggerRef = useRef<HTMLDivElement>(null);
  const taskPickerPanelRef = useRef<HTMLDivElement>(null);
  const [taskPickerPosition, setTaskPickerPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const isReady = status === "saved" || status === "saving";
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
          disabled={!isReady}
          icon={<UiIcon name="file-plus" />}
          label={copy.addImage}
          onClick={() => fileInputRef.current?.click()}
          title={copy.addImage}
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
        <IconButton
          disabled={!isReady}
          icon={<UiIcon name="text" />}
          label={copy.text}
          onClick={onAddText}
          title={copy.text}
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
      </div>
      <div
        aria-live="polite"
        className={`${styles.desktopCanvasToolbarStatus} ${status === "conflict" ? styles.desktopCanvasToolbarStatusConflict : status === "error" ? styles.desktopCanvasToolbarStatusError : ""}`}
      >
        <span>{statusLabel}</span>
        {error ? <span title={error}> · {error}</span> : null}
        {status === "conflict" ? (
          <PrototypeButton
            onClick={onReloadWinner}
            size="compact"
            variant="quiet"
          >
            {copy.reloadWinner}
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
