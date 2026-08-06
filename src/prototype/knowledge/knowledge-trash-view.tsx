import React, { useEffect, useState } from "react";
import type { PrototypeDocument } from "@/prototype/desktop-mock-data";
import {
  getDocumentFolderPath,
  getDocumentTitle,
  getKnowledgeTrashDocuments,
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
} from "@/prototype/desktop-state";
import { UiIcon } from "@/prototype/desktop-icons";
import { IconButton, PrototypeButton } from "@/prototype/desktop-ui";
import { KnowledgeTreeActionMenu } from "./knowledge-sidebar";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

function formatDeletionDate(deletedAt: string | undefined): string {
  if (!deletedAt) return "Дата неизвестна";
  const date = new Date(deletedAt);
  if (Number.isNaN(date.getTime())) return "Дата неизвестна";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function folderLabel(document: PrototypeDocument): string {
  const path = getDocumentFolderPath(document);
  return path.length > 0 ? path.join(" / ") : "Корень базы знаний";
}

export function KnowledgeTrashView({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  const documents = getKnowledgeTrashDocuments(state);
  const [openDocumentId, setOpenDocumentId] = useState<string | null>(null);
  const [deleteDocumentId, setDeleteDocumentId] = useState<string | null>(null);
  const deleteDocument = deleteDocumentId
    ? documents.find((document) => document.id === deleteDocumentId)
    : undefined;

  useEffect(() => {
    if (!openDocumentId) return;
    const closeOnOutsidePointer = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest(".knowledge-folder-menu") ||
        target.closest(".knowledge-trash-item-menu-trigger")
      ) {
        return;
      }
      setOpenDocumentId(null);
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpenDocumentId(null);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openDocumentId]);

  useEffect(() => {
    if (!deleteDocumentId) return;
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setDeleteDocumentId(null);
      window.document
        .querySelector<HTMLButtonElement>(
          `[data-knowledge-trash-document-id="${deleteDocumentId}"]`,
        )
        ?.focus();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [deleteDocumentId]);

  return (
    <section
      className="knowledge-trash-view"
      aria-labelledby="knowledge-trash-title"
    >
      <header className="knowledge-trash-view-header">
        <div>
          <p className="knowledge-trash-view-eyebrow">Knowledge</p>
          <h1 id="knowledge-trash-title">Корзина</h1>
        </div>
        <span
          className="knowledge-trash-view-count"
          aria-label={`${documents.length} статей`}
        >
          {documents.length}
        </span>
      </header>
      {documents.length === 0 ? (
        <div className="knowledge-trash-empty empty-state">
          <UiIcon name="trash" />
          <h2>Корзина пуста</h2>
          <p>Удалённые статьи появятся здесь.</p>
        </div>
      ) : (
        <ul className="knowledge-trash-list" aria-label="Удалённые статьи">
          {documents.map((document) => {
            const menuOpen = openDocumentId === document.id;
            return (
              <li className="knowledge-trash-item" key={document.id}>
                <div className="knowledge-trash-item-content">
                  <h2>{getDocumentTitle(document)}</h2>
                  <p className="knowledge-trash-item-path">
                    {folderLabel(document)}
                  </p>
                  <time dateTime={document.deletedAt}>
                    Удалена: {formatDeletionDate(document.deletedAt)}
                  </time>
                </div>
                <div className="knowledge-trash-item-actions">
                  <IconButton
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                    className="knowledge-trash-item-menu-trigger"
                    icon={<UiIcon name="more" />}
                    label={`Действия статьи ${getDocumentTitle(document)}`}
                    onClick={() =>
                      setOpenDocumentId(menuOpen ? null : document.id)
                    }
                    data-knowledge-trash-document-id={document.id}
                    title={`Действия статьи ${getDocumentTitle(document)}`}
                    variant="ghost"
                  />
                  {menuOpen ? (
                    <KnowledgeTreeActionMenu
                      dispatch={dispatch}
                      kind="trash-document"
                      label={getDocumentTitle(document)}
                      onClose={() => setOpenDocumentId(null)}
                      onPermanentDelete={() => setDeleteDocumentId(document.id)}
                      targetId={document.id}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {deleteDocument ? (
        <div
          className="task-delete-confirm-backdrop"
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            setDeleteDocumentId(null);
            window.document
              .querySelector<HTMLButtonElement>(
                `[data-knowledge-trash-document-id="${deleteDocument.id}"]`,
              )
              ?.focus();
          }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setDeleteDocumentId(null);
              window.document
                .querySelector<HTMLButtonElement>(
                  `[data-knowledge-trash-document-id="${deleteDocument.id}"]`,
                )
                ?.focus();
            }
          }}
        >
          <section
            aria-describedby="knowledge-permanent-delete-description"
            aria-labelledby="knowledge-permanent-delete-title"
            aria-modal="true"
            className="task-delete-confirm-dialog"
            role="alertdialog"
          >
            <h2 id="knowledge-permanent-delete-title">
              Удалить статью «{getDocumentTitle(deleteDocument)}» навсегда?
            </h2>
            <p id="knowledge-permanent-delete-description">
              Это действие нельзя отменить.
            </p>
            <div className="task-delete-confirm-actions">
              <PrototypeButton
                autoFocus
                onClick={() => {
                  setDeleteDocumentId(null);
                  window.document
                    .querySelector<HTMLButtonElement>(
                      `[data-knowledge-trash-document-id="${deleteDocument.id}"]`,
                    )
                    ?.focus();
                }}
                variant="quiet"
              >
                Отмена
              </PrototypeButton>
              <PrototypeButton
                className="task-delete-confirm-submit"
                onClick={() => {
                  dispatch({
                    type: "permanently-delete-knowledge-document",
                    documentId: deleteDocument.id,
                  });
                  setDeleteDocumentId(null);
                }}
                variant="quiet"
              >
                Удалить навсегда
              </PrototypeButton>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
