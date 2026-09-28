"use client";

import { useEffect, useState } from "react";
import { useDesktopTaskRuntime } from "@/prototype/tasks/desktop-task-runtime";
import styles from "./knowledge-neuro-drafts.module.css";

type DraftDocument = { title: string; markdown: string; selected: boolean };
type Draft = {
  id: string;
  workspace_id: string;
  project_id: string;
  folder_path: string[];
  documents: DraftDocument[];
  revision: number;
  created_at: string;
};

export function KnowledgeNeuroDrafts({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const { persistence } = useDesktopTaskRuntime();
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const active = drafts.find((draft) => draft.id === activeId);

  const reload = async () => {
    const result = await fetch("/api/knowledge-neuro-drafts", {
      cache: "no-store",
    });
    const body = (await result.json()) as { drafts?: Draft[]; error?: string };
    if (!result.ok)
      throw new Error(body.error ?? "Не удалось загрузить черновики.");
    const items = (body.drafts ?? []).filter(
      (draft) =>
        draft.workspace_id === workspaceId && draft.project_id === projectId,
    );
    setDrafts(items);
    setActiveId((current) =>
      items.some((item) => item.id === current)
        ? current
        : (items[0]?.id ?? null),
    );
  };
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.resolve()
      .then(() => reload())
      .catch((failure) => {
        if (!cancelled)
          setError(
            failure instanceof Error
              ? failure.message
              : "Не удалось загрузить черновики.",
          );
      });
    return () => {
      cancelled = true;
    };
    // Fresh fetch when opening or changing project; local editing is never overwritten by a timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workspaceId, projectId]);

  const change = (edit: (draft: Draft) => Draft) => {
    setDrafts((current) =>
      current.map((draft) => (draft.id === activeId ? edit(draft) : draft)),
    );
    setNotice(null);
  };
  const request = async (body: unknown): Promise<{ revision: number }> => {
    const result = await fetch("/api/knowledge-neuro-drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await result.json()) as {
      revision?: number;
      error?: string;
    };
    if (!result.ok)
      throw new Error(payload.error ?? "Не удалось обработать черновик.");
    return { revision: payload.revision ?? 0 };
  };
  const save = async (publish: boolean) => {
    if (!active || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await request({
        action: "save",
        id: active.id,
        revision: active.revision,
        folderPath: active.folder_path,
        documents: active.documents,
      });
      setDrafts((current) =>
        current.map((draft) =>
          draft.id === active.id
            ? { ...draft, revision: saved.revision }
            : draft,
        ),
      );
      if (!publish) {
        setNotice("Черновик сохранён.");
        return;
      }
      await request({
        action: "publish",
        id: active.id,
        revision: saved.revision,
      });
      await reload();
      const refreshed = await persistence.refreshFromSource();
      setNotice(
        refreshed === "skipped"
          ? "Опубликовано. Обновите данные знаний, чтобы увидеть документы."
          : "Папка и выбранные документы опубликованы. Остальные остаются черновиками.",
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Не удалось обработать черновик.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={styles.launch}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        title="Нейро-черновики папок и MD-документов"
      >
        Нейро‑MD
      </button>
      {open ? (
        <div className={styles.backdrop} role="presentation">
          <section
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-label="Нейро-черновики Markdown"
          >
            <header className={styles.header}>
              <h2>Нейро‑MD</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </header>
            <p>
              Предложенные папки и документы. Изменения появятся в знаниях после
              публикации.
            </p>
            <button
              type="button"
              onClick={() =>
                void reload().catch((failure) => setError(String(failure)))
              }
              disabled={busy}
            >
              Обновить список
            </button>
            {drafts.length === 0 ? (
              <p>Для этого проекта пока нет нейро-черновиков.</p>
            ) : (
              <nav className={styles.list} aria-label="Черновики">
                {drafts.map((draft) => (
                  <button
                    key={draft.id}
                    type="button"
                    aria-pressed={activeId === draft.id}
                    onClick={() => {
                      setActiveId(draft.id);
                      setError(null);
                    }}
                  >
                    {draft.folder_path.join(" / ")} · {draft.documents.length}{" "}
                    MD
                  </button>
                ))}
              </nav>
            )}
            {active ? (
              <div className={styles.form} key={active.id}>
                <label>
                  Папка (уровни через /)
                  <input
                    value={active.folder_path.join(" / ")}
                    onChange={(event) =>
                      change((draft) => ({
                        ...draft,
                        folder_path: event.target.value
                          .split("/")
                          .map((part) => part.trim()),
                      }))
                    }
                  />
                </label>
                {active.documents.map((document, index) => (
                  <div className={styles.file} key={index}>
                    <label className={styles.select}>
                      <input
                        type="checkbox"
                        checked={document.selected}
                        onChange={(event) =>
                          change((draft) => ({
                            ...draft,
                            documents: draft.documents.map((item, at) =>
                              at === index
                                ? { ...item, selected: event.target.checked }
                                : item,
                            ),
                          }))
                        }
                      />
                      Публиковать документ {index + 1}
                    </label>
                    <label>
                      Название
                      <input
                        value={document.title}
                        onChange={(event) =>
                          change((draft) => ({
                            ...draft,
                            documents: draft.documents.map((item, at) =>
                              at === index
                                ? { ...item, title: event.target.value }
                                : item,
                            ),
                          }))
                        }
                      />
                    </label>
                    <label>
                      Markdown
                      <textarea
                        rows={12}
                        value={document.markdown}
                        onChange={(event) =>
                          change((draft) => ({
                            ...draft,
                            documents: draft.documents.map((item, at) =>
                              at === index
                                ? { ...item, markdown: event.target.value }
                                : item,
                            ),
                          }))
                        }
                      />
                    </label>
                  </div>
                ))}
                <div className={styles.actions}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void save(false)}
                  >
                    Сохранить черновик
                  </button>
                  <button
                    type="button"
                    disabled={
                      busy || !active.documents.some((item) => item.selected)
                    }
                    onClick={() => void save(true)}
                  >
                    Опубликовать выбранные
                  </button>
                </div>
              </div>
            ) : null}
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
            {notice ? <p role="status">{notice}</p> : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
