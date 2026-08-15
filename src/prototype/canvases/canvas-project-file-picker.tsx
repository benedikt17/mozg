import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

import type { ProjectFileRecord } from "@/lib/files/project-file-repository";
import { UiIcon } from "@/prototype/desktop-icons";
import { IconButton } from "@/prototype/desktop-ui";
import styles from "@/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.module.css";

export type CanvasProjectFilePickerProps = {
  interactive: boolean;
  open: boolean;
  query: string;
  results: readonly ProjectFileRecord[];
  searchStatus: "idle" | "loading" | "ready" | "error";
  toolsReady: boolean;
  onClose: () => void;
  onQueryChange: (query: string) => void;
  onSelect: (file: ProjectFileRecord) => void;
  onToggle: () => void;
};

export function CanvasProjectFilePicker({
  interactive,
  open,
  query,
  results,
  searchStatus,
  toolsReady,
  onClose,
  onQueryChange,
  onSelect,
  onToggle,
}: CanvasProjectFilePickerProps): React.JSX.Element {
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    const updatePosition = (): void => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(360, window.innerWidth - 32);
      setPosition({
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
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      )
        return;
      onClose();
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
  }, [onClose, open]);

  return (
    <div className={styles.desktopCanvasTaskPicker} ref={triggerRef}>
      <IconButton
        aria-expanded={open}
        disabled={!interactive || !toolsReady}
        icon={<UiIcon name="folder-open" />}
        label="Добавить из Files"
        onClick={onToggle}
        title="Добавить из Files"
        variant="quiet"
      />
      {open && position
        ? createPortal(
            <div
              aria-label="Добавить из Files"
              className={styles.desktopCanvasTaskPickerPanel}
              ref={panelRef}
              role="dialog"
              style={position}
            >
              <div className={styles.desktopCanvasTaskPickerHeader}>
                <strong>Добавить из Files</strong>
                <IconButton
                  icon={<UiIcon name="close" />}
                  label="Закрыть выбор файла"
                  onClick={onClose}
                  title="Закрыть выбор файла"
                  variant="ghost"
                />
              </div>
              <input
                aria-label="Поиск файлов"
                autoFocus
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Поиск по файлам"
                type="search"
                value={query}
              />
              <div className={styles.desktopCanvasTaskPickerResults}>
                {searchStatus === "loading" ? (
                  <p>Загрузка файлов…</p>
                ) : searchStatus === "error" ? (
                  <p role="alert">Не удалось загрузить Files.</p>
                ) : results.length === 0 ? (
                  <p>
                    {query.trim()
                      ? "Совпадений нет"
                      : "В этом проекте нет изображений"}
                  </p>
                ) : (
                  results.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => onSelect(file)}
                      type="button"
                    >
                      <strong>{file.name}</strong>
                      <span>
                        {file.width}×{file.height} · {file.mimeType}
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
  );
}
