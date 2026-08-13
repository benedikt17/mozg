"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./knowledge-annotations.module.css";
import {
  createKnowledgeAnnotation,
  createKnowledgeAnnotationSelection,
  loadKnowledgeAnnotations,
  resolveKnowledgeAnnotationOffset,
  updateKnowledgeAnnotation,
  type KnowledgeAnnotation,
  type KnowledgeAnnotationPersistenceMode,
  type KnowledgeAnnotationSelection,
} from "./knowledge-annotations";

const HIGHLIGHT_NAME = "mozg-knowledge-annotations";

type SelectionAction = {
  left: number;
  top: number;
  selection: KnowledgeAnnotationSelection;
};

type HighlightRegistryLike = {
  set(name: string, highlight: object): void;
  delete(name: string): boolean;
};

type HighlightConstructorLike = new (...ranges: Range[]) => object;

function activeKnowledgePage(): HTMLElement | null {
  return window.document.querySelector<HTMLElement>(
    ".desktop-prototype.knowledge-active .document-page.is-active-pane[data-document-id]",
  );
}

function activeReadingRoot(): HTMLElement | null {
  return window.document.querySelector<HTMLElement>(
    ".desktop-prototype.knowledge-active .document-page.is-active-pane:not(.is-editing) .document-page-inner",
  );
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
  const startRange = window.document.createRange();
  startRange.selectNodeContents(root);
  startRange.setEnd(range.startContainer, range.startOffset);
  const endRange = window.document.createRange();
  endRange.selectNodeContents(root);
  endRange.setEnd(range.endContainer, range.endOffset);
  const startOffset = startRange.toString().length;
  const endOffset = endRange.toString().length;
  return endOffset >= startOffset ? { startOffset, endOffset } : null;
}

function textRangeFromOffsets(
  root: HTMLElement,
  startOffset: number,
  endOffset: number,
): Range | null {
  if (startOffset < 0 || endOffset < startOffset) return null;
  const walker = window.document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let startNode: Text | null = null;
  let startNodeOffset = 0;
  let endNode: Text | null = null;
  let endNodeOffset = 0;
  let lastTextNode: Text | null = null;

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    lastTextNode = node;
    const nextConsumed = consumed + node.data.length;
    if (!startNode && startOffset <= nextConsumed) {
      startNode = node;
      startNodeOffset = Math.max(0, startOffset - consumed);
    }
    if (endOffset <= nextConsumed) {
      endNode = node;
      endNodeOffset = Math.max(0, endOffset - consumed);
      break;
    }
    consumed = nextConsumed;
  }

  if (!startNode || !endNode) {
    if (
      startNode &&
      lastTextNode &&
      endOffset === (root.textContent ?? "").length
    ) {
      endNode = lastTextNode;
      endNodeOffset = lastTextNode.data.length;
    } else {
      return null;
    }
  }

  const range = window.document.createRange();
  range.setStart(startNode, Math.min(startNodeOffset, startNode.data.length));
  range.setEnd(endNode, Math.min(endNodeOffset, endNode.data.length));
  return range;
}

function clearRegisteredHighlight(): void {
  if (typeof CSS === "undefined") return;
  const registry = (CSS as unknown as { highlights?: HighlightRegistryLike })
    .highlights;
  registry?.delete(HIGHLIGHT_NAME);
}

function registerHighlight(ranges: Range[]): void {
  clearRegisteredHighlight();
  if (ranges.length === 0 || typeof CSS === "undefined") return;
  const registry = (CSS as unknown as { highlights?: HighlightRegistryLike })
    .highlights;
  const HighlightConstructor = (
    window as unknown as { Highlight?: HighlightConstructorLike }
  ).Highlight;
  if (!registry || !HighlightConstructor) return;
  registry.set(HIGHLIGHT_NAME, new HighlightConstructor(...ranges));
}

function setsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false;
  for (const item of left) if (!right.has(item)) return false;
  return true;
}

function compactQuote(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function getAnnotationRange(
  root: HTMLElement,
  annotation: KnowledgeAnnotation,
): Range | null {
  const text = root.textContent ?? "";
  const resolved = resolveKnowledgeAnnotationOffset(text, annotation);
  return resolved
    ? textRangeFromOffsets(root, resolved.startOffset, resolved.endOffset)
    : null;
}

export function KnowledgeAnnotationsRuntime({
  workspaceId,
}: {
  workspaceId: string;
}): React.JSX.Element | null {
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [domEpoch, setDomEpoch] = useState(0);
  const [annotations, setAnnotations] = useState<KnowledgeAnnotation[]>([]);
  const [persistenceMode, setPersistenceMode] =
    useState<KnowledgeAnnotationPersistenceMode>("cloud");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [selectionAction, setSelectionAction] =
    useState<SelectionAction | null>(null);
  const [draftSelection, setDraftSelection] =
    useState<KnowledgeAnnotationSelection | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [orphanIds, setOrphanIds] = useState<Set<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pageRef = useRef<HTMLElement | null>(null);
  const pageSignatureRef = useRef("");

  useEffect(() => {
    const root = window.document.querySelector<HTMLElement>(
      ".desktop-prototype",
    );
    if (!root) return;

    let frame = 0;
    const sync = (): void => {
      frame = 0;
      const page = activeKnowledgePage();
      const documentId = page?.dataset.documentId ?? null;
      const reading = Boolean(page && !page.classList.contains("is-editing"));
      setActiveDocumentId((current) =>
        current === documentId ? current : documentId,
      );
      setIsReading((current) => (current === reading ? current : reading));

      const readingRoot = reading ? activeReadingRoot() : null;
      const text = readingRoot?.textContent ?? "";
      const signature = `${documentId ?? ""}:${reading ? "r" : "e"}:${text.length}:${text.slice(0, 48)}:${text.slice(-48)}`;
      if (pageRef.current !== page || pageSignatureRef.current !== signature) {
        pageRef.current = page;
        pageSignatureRef.current = signature;
        setDomEpoch((value) => value + 1);
      }
    };
    const scheduleSync = (): void => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(sync);
    };
    const observer = new MutationObserver(scheduleSync);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class", "data-document-id"],
      childList: true,
      subtree: true,
    });
    sync();
    return () => {
      observer.disconnect();
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    setSelectionAction(null);
    setDraftSelection(null);
    setCommentDraft("");
    setPanelOpen(false);
    setShowResolved(false);
    setError(null);
    if (!activeDocumentId) {
      setAnnotations([]);
      setUserId(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void loadKnowledgeAnnotations(workspaceId, activeDocumentId)
      .then((result) => {
        if (cancelled) return;
        setAnnotations(result.annotations);
        setPersistenceMode(result.persistenceMode);
        setUserId(result.userId);
      })
      .catch(() => {
        if (!cancelled) {
          setAnnotations([]);
          setUserId(null);
          setError("Не удалось загрузить комментарии.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeDocumentId, workspaceId]);

  useEffect(() => {
    if (!isReading || !activeDocumentId) {
      setSelectionAction(null);
      return;
    }

    const captureSelection = (): void => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        setSelectionAction(null);
        return;
      }
      const root = activeReadingRoot();
      if (!root) {
        setSelectionAction(null);
        return;
      }
      const range = selection.getRangeAt(0);
      const offsets = selectionOffsets(root, range);
      if (!offsets) {
        setSelectionAction(null);
        return;
      }
      const selectionModel = createKnowledgeAnnotationSelection(
        root.textContent ?? "",
        range.toString(),
        offsets.startOffset,
        offsets.endOffset,
      );
      if (!selectionModel) {
        setSelectionAction(null);
        return;
      }
      const rects = Array.from(range.getClientRects());
      const rect = rects.at(-1) ?? range.getBoundingClientRect();
      setSelectionAction({
        left: Math.max(
          8,
          Math.min(window.innerWidth - 158, rect.right + 8),
        ),
        top: Math.max(8, rect.top - 38),
        selection: selectionModel,
      });
    };

    const onPointerUp = (event: PointerEvent): void => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('[data-knowledge-annotations-ui="true"]')
      ) {
        return;
      }
      window.requestAnimationFrame(captureSelection);
    };
    const onKeyUp = (event: KeyboardEvent): void => {
      if (!event.shiftKey) return;
      window.requestAnimationFrame(captureSelection);
    };
    const clearSelectionAction = (): void => setSelectionAction(null);

    window.document.addEventListener("pointerup", onPointerUp);
    window.document.addEventListener("keyup", onKeyUp);
    window.addEventListener("resize", clearSelectionAction);
    window.addEventListener("scroll", clearSelectionAction, true);
    return () => {
      window.document.removeEventListener("pointerup", onPointerUp);
      window.document.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", clearSelectionAction);
      window.removeEventListener("scroll", clearSelectionAction, true);
    };
  }, [activeDocumentId, isReading]);

  useEffect(() => {
    if (!activeDocumentId || !isReading) {
      clearRegisteredHighlight();
      setOrphanIds((current) =>
        current.size === 0 ? current : new Set<string>(),
      );
      return;
    }
    const root = activeReadingRoot();
    if (!root) return;
    const ranges: Range[] = [];
    const nextOrphans = new Set<string>();
    for (const annotation of annotations) {
      if (annotation.resolvedAt !== null) continue;
      const range = getAnnotationRange(root, annotation);
      if (range) ranges.push(range);
      else nextOrphans.add(annotation.id);
    }
    registerHighlight(ranges);
    setOrphanIds((current) =>
      setsEqual(current, nextOrphans) ? current : nextOrphans,
    );
    return clearRegisteredHighlight;
  }, [activeDocumentId, annotations, domEpoch, isReading]);

  useEffect(() => {
    if (panelOpen && draftSelection) textareaRef.current?.focus();
  }, [draftSelection, panelOpen]);

  const unresolvedCount = useMemo(
    () => annotations.filter((annotation) => annotation.resolvedAt === null).length,
    [annotations],
  );
  const resolvedCount = annotations.length - unresolvedCount;
  const visibleAnnotations = useMemo(
    () =>
      annotations
        .filter((annotation) => showResolved || annotation.resolvedAt === null)
        .sort((left, right) => {
          if ((left.resolvedAt === null) !== (right.resolvedAt === null))
            return left.resolvedAt === null ? -1 : 1;
          return right.createdAt.localeCompare(left.createdAt);
        }),
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
    if (!draftSelection || !userId || comment.length === 0 || saving) return;
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
      resolvedAt: annotation.resolvedAt === null ? now : null,
    };
    setUpdatingId(annotation.id);
    setError(null);
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

  const scrollToAnnotation = (annotation: KnowledgeAnnotation): void => {
    const root = activeReadingRoot();
    if (!root) return;
    const range = getAnnotationRange(root, annotation);
    if (!range) return;
    const element =
      range.startContainer instanceof Element
        ? range.startContainer
        : range.startContainer.parentElement;
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <>
      {selectionAction && isReading ? (
        <button
          className={styles.selectionAction}
          data-knowledge-annotations-ui="true"
          onClick={beginComment}
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
                ref={textareaRef}
                rows={5}
                value={commentDraft}
              />
              <div className={styles.composerActions}>
                <button
                  className={styles.secondaryButton}
                  disabled={saving}
                  onClick={() => {
                    setDraftSelection(null);
                    setCommentDraft("");
                  }}
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
                  <button
                    className={styles.quoteButton}
                    disabled={
                      annotation.resolvedAt !== null ||
                      orphanIds.has(annotation.id) ||
                      !isReading
                    }
                    onClick={() => scrollToAnnotation(annotation)}
                    title="Перейти к фрагменту"
                    type="button"
                  >
                    “{compactQuote(annotation.selectedText)}”
                  </button>
                  {orphanIds.has(annotation.id) &&
                  annotation.resolvedAt === null ? (
                    <span className={styles.orphan}>Фрагмент изменён</span>
                  ) : null}
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
