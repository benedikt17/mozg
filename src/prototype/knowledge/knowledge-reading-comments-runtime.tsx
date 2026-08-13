"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./knowledge-annotations.module.css";
import {
  createKnowledgeAnnotation,
  createKnowledgeAnnotationSelection,
  loadKnowledgeAnnotations,
  updateKnowledgeAnnotation,
  type KnowledgeAnnotation,
  type KnowledgeAnnotationPersistenceMode,
  type KnowledgeAnnotationSelection,
} from "./knowledge-annotations";

type SelectionAction = {
  left: number;
  top: number;
  selection: KnowledgeAnnotationSelection;
};

function activeReadingPage(): HTMLElement | null {
  const page =
    window.document.querySelector<HTMLElement>(
      ".desktop-prototype .document-page.is-active-pane[data-document-id]",
    ) ??
    window.document.querySelector<HTMLElement>(
      ".document-page.is-active-pane[data-document-id]",
    );
  if (!page || page.classList.contains("is-editing")) return null;
  return page;
}

function readingRoot(page: HTMLElement): HTMLElement | null {
  return page.querySelector<HTMLElement>(".document-page-inner");
}

function rangeInsideRoot(range: Range, root: HTMLElement): boolean {
  return (
    root.contains(range.startContainer) &&
    root.contains(range.endContainer) &&
    root.contains(range.commonAncestorContainer)
  );
}

function selectionOffsets(
  root: HTMLElement,
  range: Range,
): { startOffset: number; endOffset: number } | null {
  if (!rangeInsideRoot(range, root)) return null;
  const start = window.document.createRange();
  start.selectNodeContents(root);
  start.setEnd(range.startContainer, range.startOffset);
  const end = window.document.createRange();
  end.selectNodeContents(root);
  end.setEnd(range.endContainer, range.endOffset);
  const startOffset = start.toString().length;
  const endOffset = end.toString().length;
  return endOffset >= startOffset ? { startOffset, endOffset } : null;
}

function compactQuote(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

export function KnowledgeReadingCommentsRuntime({
  workspaceId,
}: {
  workspaceId: string;
}): React.JSX.Element | null {
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<KnowledgeAnnotation[]>([]);
  const [persistenceMode, setPersistenceMode] =
    useState<KnowledgeAnnotationPersistenceMode>("cloud");
  const [userId, setUserId] = useState<string | null>(null);
  const [selectionAction, setSelectionAction] =
    useState<SelectionAction | null>(null);
  const [draftSelection, setDraftSelection] =
    useState<KnowledgeAnnotationSelection | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const sync = (): void => {
      const page = activeReadingPage();
      const documentId = page?.dataset.documentId ?? null;
      setActiveDocumentId((current) =>
        current === documentId ? current : documentId,
      );
    };
    sync();
    const interval = window.setInterval(sync, 250);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSelectionAction(null);
    setDraftSelection(null);
    setCommentDraft("");
    setPanelOpen(false);
    setError(null);

    if (!activeDocumentId) {
      setAnnotations([]);
      setUserId(null);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    void loadKnowledgeAnnotations(workspaceId, activeDocumentId)
      .then((result) => {
        if (cancelled) return;
        setAnnotations(result.annotations);
        setPersistenceMode(result.persistenceMode);
        setUserId(result.userId);
      })
      .catch(() => {
        if (cancelled) return;
        setAnnotations([]);
        setUserId(null);
        setError("Не удалось загрузить комментарии.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeDocumentId, workspaceId]);

  useEffect(() => {
    const captureSelection = (): void => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        setSelectionAction(null);
        return;
      }
      const range = selection.getRangeAt(0);
      const page = activeReadingPage();
      if (!page) {
        setSelectionAction(null);
        return;
      }
      const root = readingRoot(page);
      if (!root || !rangeInsideRoot(range, root)) {
        setSelectionAction(null);
        return;
      }
      const offsets = selectionOffsets(root, range);
      if (!offsets) {
        setSelectionAction(null);
        return;
      }
      const model = createKnowledgeAnnotationSelection(
        root.textContent ?? "",
        range.toString(),
        offsets.startOffset,
        offsets.endOffset,
      );
      if (!model) {
        setSelectionAction(null);
        return;
      }
      const rects = Array.from(range.getClientRects());
      const rect = rects.at(-1) ?? range.getBoundingClientRect();
      setActiveDocumentId(page.dataset.documentId ?? null);
      setSelectionAction({
        left: Math.max(8, Math.min(window.innerWidth - 158, rect.right + 8)),
        top: Math.max(8, rect.top - 38),
        selection: model,
      });
    };

    const onPointerUp = (event: PointerEvent): void => {
      if (
        event.target instanceof Element &&
        event.target.closest('[data-knowledge-annotations-ui="true"]')
      )
        return;
      window.requestAnimationFrame(captureSelection);
    };
    const onMouseUp = (event: MouseEvent): void => {
      if (
        event.target instanceof Element &&
        event.target.closest('[data-knowledge-annotations-ui="true"]')
      )
        return;
      window.requestAnimationFrame(captureSelection);
    };
    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.shiftKey) window.requestAnimationFrame(captureSelection);
    };

    window.document.addEventListener("pointerup", onPointerUp, true);
    window.document.addEventListener("mouseup", onMouseUp, true);
    window.document.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.document.removeEventListener("pointerup", onPointerUp, true);
      window.document.removeEventListener("mouseup", onMouseUp, true);
      window.document.removeEventListener("keyup", onKeyUp, true);
    };
  }, []);

  useEffect(() => {
    if (panelOpen && draftSelection) commentRef.current?.focus();
  }, [draftSelection, panelOpen]);

  const unresolvedCount = useMemo(
    () =>
      annotations.filter((annotation) => annotation.resolvedAt === null).length,
    [annotations],
  );
  const resolvedCount = annotations.length - unresolvedCount;
  const visibleAnnotations = useMemo(
    () =>
      annotations.filter(
        (annotation) => showResolved || annotation.resolvedAt === null,
      ),
    [annotations, showResolved],
  );

  if (!activeDocumentId) return null;

  const beginComment = (): void => {
    if (!selectionAction) return;
    setDraftSelection(selectionAction.selection);
    setCommentDraft("");
    setPanelOpen(true);
    setSelectionAction(null);
    window.getSelection()?.removeAllRanges();
  };

  const saveComment = async (): Promise<void> => {
    const comment = commentDraft.trim();
    if (!draftSelection || !userId || !comment || saving) return;
    const now = new Date().toISOString();
    const annotation: KnowledgeAnnotation = {
      schemaVersion: 1,
      id: crypto.randomUUID(),
      workspaceId,
      documentId: activeDocumentId,
      createdBy: userId,
      ...draftSelection,
      comment,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
    };
    setSaving(true);
    setError(null);
    try {
      await createKnowledgeAnnotation(annotation, persistenceMode);
      setAnnotations((current) => [...current, annotation]);
      setDraftSelection(null);
      setCommentDraft("");
    } catch {
      setError("Не удалось сохранить комментарий.");
    } finally {
      setSaving(false);
    }
  };

  const toggleResolved = async (
    annotation: KnowledgeAnnotation,
  ): Promise<void> => {
    if (updatingId) return;
    const now = new Date().toISOString();
    const updated: KnowledgeAnnotation = {
      ...annotation,
      updatedAt: now,
      resolvedAt: annotation.resolvedAt ? null : now,
    };
    setUpdatingId(annotation.id);
    try {
      await updateKnowledgeAnnotation(updated, persistenceMode);
      setAnnotations((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch {
      setError("Не удалось обновить комментарий.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <>
      {selectionAction ? (
        <button
          className={styles.selectionAction}
          data-knowledge-annotations-ui="true"
          onClick={beginComment}
          onMouseDown={(event) => event.preventDefault()}
          style={{ left: selectionAction.left, top: selectionAction.top }}
          type="button"
        >
          <span aria-hidden="true">＋</span> Комментарий
        </button>
      ) : null}

      <button
        aria-expanded={panelOpen}
        aria-label={`Комментарии: ${unresolvedCount} открытых`}
        className={styles.toggle}
        data-knowledge-annotations-ui="true"
        onClick={() => setPanelOpen((open) => !open)}
        title="Комментарии к статье"
        type="button"
      >
        <span aria-hidden="true" className={styles.bubbleIcon}>
          ◰
        </span>
        <span>{unresolvedCount}</span>
      </button>

      {panelOpen ? (
        <aside
          aria-label="Комментарии к статье"
          className={styles.panel}
          data-knowledge-annotations-ui="true"
        >
          <header className={styles.panelHeader}>
            <div>
              <strong>Комментарии</strong>
              <span>{unresolvedCount} открытых</span>
            </div>
            <button
              aria-label="Закрыть комментарии"
              className={styles.closeButton}
              onClick={() => setPanelOpen(false)}
              type="button"
            >
              ×
            </button>
          </header>

          {persistenceMode === "preview-local" ? (
            <div className={styles.previewNotice}>
              Preview: комментарии пока сохраняются только в этом браузере.
            </div>
          ) : null}

          {draftSelection ? (
            <section className={styles.composer}>
              <div className={styles.quote}>
                “{compactQuote(draftSelection.selectedText)}”
              </div>
              <textarea
                aria-label="Текст комментария"
                maxLength={10_000}
                onChange={(event) => setCommentDraft(event.target.value)}
                placeholder="Что здесь не так?"
                ref={commentRef}
                rows={5}
                value={commentDraft}
              />
              <div className={styles.composerActions}>
                <button
                  className={styles.secondaryButton}
                  disabled={saving}
                  onClick={() => setDraftSelection(null)}
                  type="button"
                >
                  Отмена
                </button>
                <button
                  className={styles.primaryButton}
                  disabled={saving || commentDraft.trim().length === 0}
                  onClick={() => void saveComment()}
                  type="button"
                >
                  {saving ? "Сохраняю…" : "Добавить"}
                </button>
              </div>
            </section>
          ) : null}

          {error ? <div className={styles.error}>{error}</div> : null}

          <div className={styles.list}>
            {loading ? (
              <div className={styles.empty}>Загружаю комментарии…</div>
            ) : visibleAnnotations.length === 0 && !draftSelection ? (
              <div className={styles.empty}>
                Выделите фрагмент текста и добавьте комментарий.
              </div>
            ) : (
              visibleAnnotations.map((annotation) => (
                <article
                  className={`${styles.commentCard} ${
                    annotation.resolvedAt ? styles.resolved : ""
                  }`}
                  key={annotation.id}
                >
                  <div className={styles.quote}>
                    “{compactQuote(annotation.selectedText)}”
                  </div>
                  <p>{annotation.comment}</p>
                  <footer>
                    <span>
                      {new Intl.DateTimeFormat("ru", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(annotation.createdAt))}
                    </span>
                    <button
                      disabled={updatingId === annotation.id}
                      onClick={() => void toggleResolved(annotation)}
                      type="button"
                    >
                      {annotation.resolvedAt ? "Вернуть" : "Решено ✓"}
                    </button>
                  </footer>
                </article>
              ))
            )}
          </div>

          {resolvedCount > 0 ? (
            <button
              className={styles.resolvedToggle}
              onClick={() => setShowResolved((value) => !value)}
              type="button"
            >
              {showResolved ? "Скрыть решённые" : `Решённые — ${resolvedCount}`}
            </button>
          ) : null}
        </aside>
      ) : null}
    </>
  );
}
