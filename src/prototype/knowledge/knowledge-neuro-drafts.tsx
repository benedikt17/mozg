"use client";

import { useCallback, useEffect, useState } from "react";
import { useDesktopTaskRuntime } from "@/prototype/tasks/desktop-task-runtime";
import { MarkdownStringPreview } from "./markdown-document-preview";
import styles from "./knowledge-neuro-drafts.module.css";

export type NeuroDraftDocument = {
  title: string;
  markdown: string;
  selected: boolean;
};
export type NeuroDraft = {
  id: string;
  workspace_id: string;
  project_id: string;
  folder_path: string[];
  documents: NeuroDraftDocument[];
  revision: number;
  created_at: string;
};
export type NeuroDraftSelection = { draftId: string; index: number };

export function selectDraftDocumentForPublication(
  documents: NeuroDraftDocument[],
  selectedIndex: number,
): NeuroDraftDocument[] {
  return documents.map((document, index) => ({
    ...document,
    selected: index === selectedIndex,
  }));
}

export function useKnowledgeNeuroDrafts(
  workspaceId: string | undefined,
  projectId: string,
) {
  const { persistence } = useDesktopTaskRuntime();
  const [visible, setVisible] = useState(false);
  const [drafts, setDrafts] = useState<NeuroDraft[]>([]);
  const [selection, setSelection] = useState<NeuroDraftSelection | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const result = await fetch("/api/knowledge-neuro-drafts", {
        cache: "no-store",
      });
      const body = (await result.json()) as {
        drafts?: NeuroDraft[];
        error?: string;
      };
      if (!result.ok)
        throw new Error(body.error ?? "Не удалось загрузить нейро‑MD.");
      const items = (body.drafts ?? []).filter(
        (draft) =>
          draft.workspace_id === workspaceId && draft.project_id === projectId,
      );
      setDrafts(items);
      setSelection((current) =>
        current &&
        items.some(
          (draft) =>
            draft.id === current.draftId && draft.documents[current.index],
        )
          ? current
          : null,
      );
      setError(null);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Не удалось загрузить нейро‑MD.",
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId, projectId]);

  useEffect(() => {
    if (!visible) return;
    void Promise.resolve().then(reload);
  }, [visible, reload]);

  const toggle = () => {
    setVisible((current) => !current);
    setSelection(null);
    setNotice(null);
  };
  const select = (value: NeuroDraftSelection | null) => {
    setSelection(value);
    setNotice(null);
    setError(null);
  };
  const change = (edit: (draft: NeuroDraft) => NeuroDraft) => {
    if (!selection) return;
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === selection.draftId ? edit(draft) : draft,
      ),
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
      throw new Error(payload.error ?? "Не удалось обработать нейро‑MD.");
    return { revision: payload.revision ?? 0 };
  };
  const save = async (publish: boolean) => {
    const active = drafts.find((draft) => draft.id === selection?.draftId);
    if (!active || !selection || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const documents = publish
        ? selectDraftDocumentForPublication(active.documents, selection.index)
        : active.documents;
      const saved = await request({
        action: "save",
        id: active.id,
        revision: active.revision,
        folderPath: active.folder_path,
        documents,
      });
      setDrafts((current) =>
        current.map((draft) =>
          draft.id === active.id
            ? { ...draft, revision: saved.revision, documents }
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
          ? "Опубликовано. Обновите данные знаний, чтобы увидеть статью."
          : "Статья опубликована. Остальные нейро‑MD остались черновиками.",
      );
      setSelection(null);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Не удалось обработать нейро‑MD.",
      );
    } finally {
      setBusy(false);
    }
  };

  return {
    visible,
    drafts,
    selection,
    busy,
    loading,
    error,
    notice,
    toggle,
    select,
    change,
    reload,
    save,
  };
}

export type NeuroDraftsController = ReturnType<typeof useKnowledgeNeuroDrafts>;

export function KnowledgeNeuroDraftsToggle({
  controller,
  onShow,
}: {
  controller: NeuroDraftsController;
  onShow?: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.launch}
      aria-pressed={controller.visible}
      onClick={() => {
        if (!controller.visible) onShow?.();
        controller.toggle();
      }}
      title="Показать предложенные Markdown в дереве"
    >
      Нейро‑MD
    </button>
  );
}

export function KnowledgeNeuroDraftNodes({
  controller,
  path,
  existingFolders,
}: {
  controller: NeuroDraftsController;
  path: string[];
  existingFolders: string[];
}) {
  const [collapsed, setCollapsed] = useState<string[]>([]);
  if (!controller.visible) return null;
  const pathMatches = (target: string[]) =>
    path.every((part, index) => target[index] === part);
  const direct = controller.drafts.filter(
    (draft) =>
      draft.folder_path.length === path.length &&
      pathMatches(draft.folder_path),
  );
  const proposedFolders = Array.from(
    new Set(
      controller.drafts
        .filter(
          (draft) =>
            draft.folder_path.length > path.length &&
            pathMatches(draft.folder_path),
        )
        .map((draft) => draft.folder_path[path.length]!)
        .filter((name) => !existingFolders.includes(name)),
    ),
  );
  return (
    <>
      {direct.flatMap((draft) =>
        draft.documents.map((document, index) => (
          <button
            type="button"
            key={`${draft.id}:${index}`}
            className={[
              styles.treeDocument,
              controller.selection?.draftId === draft.id &&
              controller.selection.index === index
                ? styles.active
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              paddingLeft: `calc(18px + ${path.length} * var(--sidebar-tree-indent))`,
            }}
            onClick={() => controller.select({ draftId: draft.id, index })}
            title={`${draft.folder_path.join(" / ")} / ${document.title} · нейро‑MD`}
          >
            <span className={styles.draftMark} aria-hidden="true">
              ◆
            </span>
            <span className={styles.treeTitle}>{document.title}</span>
          </button>
        )),
      )}
      {proposedFolders.map((name) => {
        const childPath = [...path, name];
        const key = childPath.join("/");
        const expanded = !collapsed.includes(key);
        return (
          <div key={key} className={styles.treeBranch}>
            <button
              type="button"
              className={styles.treeFolder}
              style={{
                paddingLeft: `calc(8px + ${path.length} * var(--sidebar-tree-indent))`,
              }}
              aria-expanded={expanded}
              onClick={() =>
                setCollapsed((current) =>
                  expanded
                    ? [...current, key]
                    : current.filter((item) => item !== key),
                )
              }
              title={`Предложенная папка: ${childPath.join(" / ")}`}
            >
              <span aria-hidden="true">{expanded ? "⌄" : "›"}</span>
              <span className={styles.treeTitle}>{name}</span>
              <span className={styles.draftMark} aria-hidden="true">
                ◆
              </span>
            </button>
            {expanded ? (
              <KnowledgeNeuroDraftNodes
                controller={controller}
                path={childPath}
                existingFolders={[]}
              />
            ) : null}
          </div>
        );
      })}
    </>
  );
}

export function KnowledgeNeuroDraftPreview({
  controller,
}: {
  controller: NeuroDraftsController;
}) {
  const active = controller.drafts.find(
    (draft) => draft.id === controller.selection?.draftId,
  );
  const index = controller.selection?.index ?? -1;
  const document = active?.documents[index];
  if (!active || !document) return null;
  return (
    <article className={styles.preview} aria-label="Просмотр нейро‑MD">
      <header className={styles.previewHeader}>
        <div>
          <small>Нейро‑MD · {active.folder_path.join(" / ")}</small>
          <h2>{document.title}</h2>
        </div>
        <button
          type="button"
          onClick={() => controller.select(null)}
          aria-label="Закрыть нейро‑MD"
        >
          ×
        </button>
      </header>
      <div className={styles.previewActions}>
        <button
          type="button"
          onClick={() => void controller.save(false)}
          disabled={controller.busy}
        >
          Сохранить черновик
        </button>
        <button
          type="button"
          className={styles.publish}
          onClick={() => void controller.save(true)}
          disabled={controller.busy}
        >
          Принять и опубликовать
        </button>
      </div>
      <details className={styles.settings}>
        <summary>Название и папка публикации</summary>
        <label>
          Папка (уровни через /)
          <input
            value={active.folder_path.join(" / ")}
            onChange={(event) =>
              controller.change((draft) => ({
                ...draft,
                folder_path: event.target.value
                  .split("/")
                  .map((part) => part.trim()),
              }))
            }
          />
        </label>
        <label>
          Название
          <input
            value={document.title}
            onChange={(event) =>
              controller.change((draft) => ({
                ...draft,
                documents: draft.documents.map((item, at) =>
                  at === index ? { ...item, title: event.target.value } : item,
                ),
              }))
            }
          />
        </label>
      </details>
      {controller.error ? (
        <p className={styles.error} role="alert">
          {controller.error}
        </p>
      ) : null}
      {controller.notice ? <p role="status">{controller.notice}</p> : null}
      <div className={styles.markdownPreview}>
        <MarkdownStringPreview
          contentId={`neuro-md-${active.id}-${index}`}
          markdown={document.markdown}
        />
      </div>
      <details className={styles.settings}>
        <summary>Редактировать Markdown</summary>
        <textarea
          aria-label="Markdown нейро‑MD"
          rows={18}
          value={document.markdown}
          onChange={(event) =>
            controller.change((draft) => ({
              ...draft,
              documents: draft.documents.map((item, at) =>
                at === index ? { ...item, markdown: event.target.value } : item,
              ),
            }))
          }
        />
      </details>
    </article>
  );
}
