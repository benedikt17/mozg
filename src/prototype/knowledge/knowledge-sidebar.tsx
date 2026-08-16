import React, { useEffect, useRef, useState } from "react";
import {
  getDocumentBreadcrumb,
  getDocumentFolderPath,
  getKnowledgePaneState,
  getKnowledgeTrashDocuments,
  getKnowledgeTree,
  knowledgePathsEqual,
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
  type KnowledgeTreeNode,
} from "@/prototype/desktop-state";
import { UiIcon } from "@/prototype/desktop-icons";
import { IconButton } from "@/prototype/desktop-ui";
import { getKnowledgeHistoryShortcutAction } from "./knowledge-content-history";
import { useKnowledgeContentHistory } from "./knowledge-content-history-runtime";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export function KnowledgeSidebar({
  state,
  dispatch,
  onClose,
  linkPickerSourceDocumentId,
  onCancelLinkPick,
  onPickLinkTarget,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
  onClose?: () => void;
  linkPickerSourceDocumentId?: string | null;
  onCancelLinkPick?: () => void;
  onPickLinkTarget?: (documentId: string) => void;
}): React.JSX.Element {
  const contentHistory = useKnowledgeContentHistory();
  const tree = getKnowledgeTree(state);
  const { activeDocument } = getKnowledgePaneState(state);
  const treeRef = useRef<HTMLElement>(null);
  const [knowledgeDropTarget, setKnowledgeDropTarget] =
    useState<KnowledgeDropTarget>(null);
  const [revealDocumentId, setRevealDocumentId] = useState<string | null>(null);
  const [openKnowledgeMenu, setOpenKnowledgeMenu] =
    useState<KnowledgeMenuTarget>(null);
  const treeCollapsed = state.knowledgeExpandedBeforeCollapse !== null;
  const linkPickerActive = Boolean(linkPickerSourceDocumentId);

  useEffect(() => {
    if (!revealDocumentId) return;
    const frame = window.requestAnimationFrame(() => {
      treeRef.current
        ?.querySelector<HTMLElement>(
          `[data-knowledge-document-id="${revealDocumentId}"]`,
        )
        ?.scrollIntoView({ block: "nearest" });
      setRevealDocumentId(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [revealDocumentId, state.expandedFolderIds]);

  useEffect(() => {
    const closeKnowledgeMenu = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest(".knowledge-folder-menu") ||
        target.closest(".knowledge-folder-menu-trigger")
      ) {
        return;
      }
      setOpenKnowledgeMenu(null);
    };
    document.addEventListener("pointerdown", closeKnowledgeMenu);
    return () =>
      document.removeEventListener("pointerdown", closeKnowledgeMenu);
  }, []);

  useEffect(() => {
    if (!openKnowledgeMenu) return;
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpenKnowledgeMenu(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [openKnowledgeMenu]);

  return (
    <aside
      className={`tool-sidebar knowledge-sidebar ${
        linkPickerActive ? "is-link-picker" : ""
      }`}
      onKeyDown={(event) => {
        if (isEditableTarget(event.target)) return;
        const shortcut = getKnowledgeHistoryShortcutAction(event);
        if (!shortcut) return;
        event.preventDefault();
        if (shortcut === "undo") contentHistory.undoActive(undefined);
        else contentHistory.redoActive(undefined);
      }}
      onPointerDownCapture={(event) => {
        if (!isEditableTarget(event.target)) {
          contentHistory.activateStructuralScope();
        }
      }}
      aria-label="Дерево документов"
    >
      <header className="knowledge-sidebar-header">
        <div
          className="knowledge-toolbar"
          aria-label="Действия с деревом документов"
        >
          <IconButton
            icon={<UiIcon name="file-plus" />}
            label="Создать документ"
            onClick={() => dispatch({ type: "create-knowledge-document" })}
            title="Создать документ"
            variant="ghost"
          />
          <IconButton
            icon={<UiIcon name="folder-plus" />}
            label="Создать папку"
            onClick={() => dispatch({ type: "create-knowledge-folder" })}
            title="Создать папку"
            variant="ghost"
          />
          <IconButton
            disabled={!state.selectedDocumentId}
            icon={<UiIcon name="locate" />}
            label="Показать текущий документ в дереве"
            onClick={() => {
              if (!state.selectedDocumentId) return;
              dispatch({ type: "reveal-current-knowledge-document" });
              setRevealDocumentId(state.selectedDocumentId);
            }}
            title="Показать текущий документ в дереве"
            variant="ghost"
          />
          <IconButton
            icon={<UiIcon name={treeCollapsed ? "expand" : "collapse"} />}
            label={treeCollapsed ? "Восстановить папки" : "Свернуть все папки"}
            onClick={() => dispatch({ type: "toggle-all-knowledge-folders" })}
            title={treeCollapsed ? "Восстановить папки" : "Свернуть все папки"}
            variant="ghost"
          />
        </div>
        <IconButton
          className="knowledge-responsive-close"
          icon={<UiIcon name="close" />}
          label="Закрыть дерево документов"
          onClick={onClose}
          title="Закрыть дерево документов"
          variant="ghost"
        />
      </header>
      <div className="knowledge-search">
        <input
          aria-label="Поиск по проекту"
          onChange={(event) =>
            dispatch({
              type: "set-knowledge-search",
              query: event.target.value,
            })
          }
          placeholder="Документ, папка или связь"
          value={state.knowledgeSearchQuery}
        />
      </div>
      {linkPickerActive ? (
        <div className="knowledge-link-picker-banner" role="status">
          <span>Выберите статью для ссылки</span>
          <button onClick={onCancelLinkPick} type="button">
            Отмена
          </button>
        </div>
      ) : null}
      <nav
        className="knowledge-tree"
        aria-label="Иерархия документов"
        ref={treeRef}
      >
        {tree.length > 0 ? (
          tree.map((node) => (
            <KnowledgeTreeNodeView
              dispatch={dispatch}
              dropTarget={knowledgeDropTarget}
              activeDocumentId={activeDocument?.id}
              key={node.id}
              node={node}
              onKnowledgeMenuChange={setOpenKnowledgeMenu}
              onDropTargetChange={setKnowledgeDropTarget}
              openKnowledgeMenu={openKnowledgeMenu}
              state={state}
              linkPickerSourceDocumentId={linkPickerSourceDocumentId}
              onPickLinkTarget={onPickLinkTarget}
            />
          ))
        ) : (
          <p className="empty-state">Ничего не найдено.</p>
        )}
      </nav>
      <footer className="knowledge-sidebar-footer">
        <button
          aria-current={
            state.knowledgeWorkspaceView === "trash" ? "page" : undefined
          }
          aria-label={`Корзина, ${getKnowledgeTrashDocuments(state).length} статей`}
          className={[
            "knowledge-trash-toggle",
            state.knowledgeWorkspaceView === "trash" ? "is-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => dispatch({ type: "open-knowledge-trash" })}
          type="button"
        >
          <UiIcon name="trash" />
          <span>Корзина</span>
          <span className="knowledge-trash-count" aria-hidden="true">
            {getKnowledgeTrashDocuments(state).length}
          </span>
        </button>
      </footer>
    </aside>
  );
}

type KnowledgeDropTarget =
  | { kind: "folder"; id: string }
  | { kind: "document"; id: string; position: "before" | "after" }
  | null;

type KnowledgeMenuTarget = {
  kind: "folder" | "document" | "trash-document";
  id: string;
} | null;

const knowledgeDocumentDragType = "application/x-mozg-knowledge-document";

function KnowledgeTreeNodeView({
  node,
  state,
  activeDocumentId,
  dispatch,
  dropTarget,
  onKnowledgeMenuChange,
  onDropTargetChange,
  openKnowledgeMenu,
  linkPickerSourceDocumentId,
  onPickLinkTarget,
}: {
  node: KnowledgeTreeNode;
  state: DesktopPrototypeState;
  activeDocumentId: string | undefined;
  dispatch: Dispatch;
  dropTarget: KnowledgeDropTarget;
  onKnowledgeMenuChange: (target: KnowledgeMenuTarget) => void;
  onDropTargetChange: (target: KnowledgeDropTarget) => void;
  openKnowledgeMenu: KnowledgeMenuTarget;
  linkPickerSourceDocumentId?: string | null;
  onPickLinkTarget?: (documentId: string) => void;
}): React.JSX.Element {
  const depth = Math.max(node.path.length - 1, 0);

  if (node.kind === "folder") {
    const expanded =
      state.knowledgeSearchQuery.trim().length > 0 ||
      state.expandedFolderIds.includes(node.id);
    const editing = state.editingKnowledgeFolderId === node.id;
    const isPathSelected =
      state.knowledgeBreadcrumbHighlightVisible &&
      state.selectedKnowledgePath?.kind === "folder" &&
      knowledgePathsEqual(state.selectedKnowledgePath.path, node.path);
    const folderClassName = [
      "sidebar-tree-row",
      "sidebar-tree-container",
      "knowledge-tree-row",
      "folder",
      isPathSelected ? "is-path-selected" : "",
      dropTarget?.kind === "folder" && dropTarget.id === node.id
        ? "is-drop-target"
        : "",
    ]
      .filter(Boolean)
      .join(" ");
    const handleFolderDragOver = (
      event: React.DragEvent<HTMLElement>,
    ): void => {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      onDropTargetChange({ kind: "folder", id: node.id });
    };
    const handleFolderDrop = (event: React.DragEvent<HTMLElement>): void => {
      event.preventDefault();
      event.stopPropagation();
      const documentId = event.dataTransfer.getData(knowledgeDocumentDragType);
      onDropTargetChange(null);
      if (!documentId) return;
      dispatch({
        type: "move-knowledge-document",
        documentId,
        targetFolderPath: node.path,
        position: "end",
      });
    };
    const toggleFolder = (): void => {
      dispatch({
        type: "toggle-knowledge-folder",
        folderId: node.id,
        path: node.path,
      });
    };
    return (
      <div className="knowledge-tree-branch">
        {editing ? (
          <div
            className={`knowledge-folder-row ${
              isPathSelected ? "is-path-selected" : ""
            }`}
            onDragOver={handleFolderDragOver}
            onDrop={handleFolderDrop}
            style={treeDepthStyle(depth)}
            title={node.path.join(" / ")}
          >
            <div className={folderClassName}>
              <UiIcon name={expanded ? "chevron-down" : "chevron-right"} />
              <KnowledgeFolderTitleEditor
                dispatch={dispatch}
                folderId={node.id}
                title={node.title}
              />
            </div>
          </div>
        ) : (
          <div
            className={`knowledge-folder-row ${
              isPathSelected ? "is-path-selected" : ""
            }`}
            onDragOver={handleFolderDragOver}
            onDrop={handleFolderDrop}
            style={treeDepthStyle(depth)}
            title={node.path.join(" / ")}
          >
            <button
              aria-expanded={expanded}
              className={folderClassName}
              onClick={toggleFolder}
              type="button"
            >
              <UiIcon name={expanded ? "chevron-down" : "chevron-right"} />
              <span>{node.title}</span>
            </button>
            <IconButton
              aria-expanded={
                openKnowledgeMenu?.kind === "folder" &&
                openKnowledgeMenu.id === node.id
              }
              aria-haspopup="menu"
              className="knowledge-folder-menu-trigger"
              icon={<UiIcon name="more" />}
              label={`Действия папки ${node.title}`}
              onClick={(event) => {
                event.stopPropagation();
                onKnowledgeMenuChange(
                  openKnowledgeMenu?.kind === "folder" &&
                    openKnowledgeMenu.id === node.id
                    ? null
                    : { kind: "folder", id: node.id },
                );
              }}
              onPointerDown={(event) => event.stopPropagation()}
              title={`Действия папки ${node.title}`}
              variant="ghost"
            />
            {openKnowledgeMenu?.kind === "folder" &&
            openKnowledgeMenu.id === node.id ? (
              <KnowledgeTreeActionMenu
                dispatch={dispatch}
                kind="folder"
                label={node.title}
                onClose={() => onKnowledgeMenuChange(null)}
                targetId={node.id}
              />
            ) : null}
          </div>
        )}
        {expanded ? (
          <div className="knowledge-tree-children">
            {node.children.map((child) => (
              <KnowledgeTreeNodeView
                dispatch={dispatch}
                dropTarget={dropTarget}
                activeDocumentId={activeDocumentId}
                key={child.id}
                node={child}
                onKnowledgeMenuChange={onKnowledgeMenuChange}
                onDropTargetChange={onDropTargetChange}
                openKnowledgeMenu={openKnowledgeMenu}
                state={state}
                linkPickerSourceDocumentId={linkPickerSourceDocumentId}
                onPickLinkTarget={onPickLinkTarget}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }
  const documentIsActive = activeDocumentId === node.document.id;
  const documentPathIsSelected =
    state.knowledgeBreadcrumbHighlightVisible &&
    state.selectedKnowledgePath?.kind === "document" &&
    state.selectedKnowledgePath.documentId === node.document.id;
  const documentRowClassName = [
    "knowledge-action-row",
    "knowledge-document-row",
    documentIsActive ? "is-active" : "",
    documentPathIsSelected ? "is-path-selected" : "",
    linkPickerSourceDocumentId && node.document.id !== linkPickerSourceDocumentId
      ? "is-link-picker-target"
      : "",
    linkPickerSourceDocumentId === node.document.id
      ? "is-link-picker-source"
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      className={documentRowClassName}
      data-knowledge-document-id={node.document.id}
      style={treeDepthStyle(depth)}
      title={getDocumentBreadcrumb(node.document)}
    >
      <button
        className={[
          "sidebar-tree-row",
          "sidebar-tree-leaf",
          "knowledge-tree-row",
          "document",
          dropTarget?.kind === "document" && dropTarget.id === node.document.id
            ? `drop-${dropTarget.position}`
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
        draggable={!linkPickerSourceDocumentId}
        onDragEnd={() => onDropTargetChange(null)}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = "move";
          const bounds = event.currentTarget.getBoundingClientRect();
          const position =
            event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
          onDropTargetChange({
            kind: "document",
            id: node.document.id,
            position,
          });
        }}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData(
            knowledgeDocumentDragType,
            node.document.id,
          );
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const documentId = event.dataTransfer.getData(
            knowledgeDocumentDragType,
          );
          const position =
            dropTarget?.kind === "document" &&
            dropTarget.id === node.document.id
              ? dropTarget.position
              : "before";
          onDropTargetChange(null);
          if (!documentId) return;
          dispatch({
            type: "move-knowledge-document",
            documentId,
            targetFolderPath: getDocumentFolderPath(node.document),
            targetDocumentId: node.document.id,
            position,
          });
        }}
        disabled={linkPickerSourceDocumentId === node.document.id}
        onClick={() => {
          if (linkPickerSourceDocumentId) {
            if (node.document.id === linkPickerSourceDocumentId) return;
            onPickLinkTarget?.(node.document.id);
            return;
          }
          dispatch({
            type: "open-knowledge-document-in-active-pane",
            documentId: node.document.id,
          });
        }}
        type="button"
      >
        <span className="tree-disclosure-spacer" />
        <span>{node.title}</span>
      </button>
      {!linkPickerSourceDocumentId ? (
        <IconButton
        aria-expanded={
          openKnowledgeMenu?.kind === "document" &&
          openKnowledgeMenu.id === node.document.id
        }
        aria-haspopup="menu"
        className="knowledge-folder-menu-trigger"
        icon={<UiIcon name="more" />}
        label={`Действия статьи ${node.title}`}
        onClick={(event) => {
          event.stopPropagation();
          onKnowledgeMenuChange(
            openKnowledgeMenu?.kind === "document" &&
              openKnowledgeMenu.id === node.document.id
              ? null
              : { kind: "document", id: node.document.id },
          );
        }}
        onPointerDown={(event) => event.stopPropagation()}
        title={`Действия статьи ${node.title}`}
        variant="ghost"
        />
      ) : null}
      {!linkPickerSourceDocumentId &&
      openKnowledgeMenu?.kind === "document" &&
      openKnowledgeMenu.id === node.document.id ? (
        <KnowledgeTreeActionMenu
          dispatch={dispatch}
          kind="document"
          label={node.title}
          onClose={() => onKnowledgeMenuChange(null)}
          targetId={node.document.id}
        />
      ) : null}
    </div>
  );
}

export function KnowledgeTreeActionMenu({
  dispatch,
  kind,
  label,
  onClose,
  onPermanentDelete,
  targetId,
}: {
  dispatch: Dispatch;
  kind: "folder" | "document" | "trash-document";
  label: string;
  onClose: () => void;
  onPermanentDelete?: () => void;
  targetId: string;
}): React.JSX.Element {
  const deleteDocument = (): void => {
    if (window.confirm(`Удалить статью «${label}»?`)) {
      dispatch({
        type: "soft-delete-knowledge-document",
        documentId: targetId,
        deletedAt: new Date().toISOString(),
      });
    }
    onClose();
  };
  const deleteFolder = (): void => {
    if (window.confirm(`Удалить папку «${label}»?`)) {
      dispatch({ type: "delete-knowledge-folder", folderId: targetId });
    }
    onClose();
  };

  return (
    <div className="knowledge-folder-menu" role="menu">
      {kind === "folder" ? (
        <button
          onClick={() => {
            dispatch({
              type: "start-editing-knowledge-folder",
              folderId: targetId,
            });
            onClose();
          }}
          role="menuitem"
          type="button"
        >
          <UiIcon name="pencil" />
          <span>Переименовать</span>
        </button>
      ) : null}
      {kind === "trash-document" ? (
        <>
          <button
            onClick={() => {
              dispatch({
                type: "restore-knowledge-document",
                documentId: targetId,
              });
              onClose();
            }}
            role="menuitem"
            type="button"
          >
            <UiIcon name="arrow-left" />
            <span>Восстановить</span>
          </button>
          <button
            className="is-destructive"
            onClick={() => {
              onPermanentDelete?.();
              onClose();
            }}
            role="menuitem"
            type="button"
          >
            <UiIcon name="trash" />
            <span>Удалить навсегда</span>
          </button>
        </>
      ) : (
        <button
          onClick={kind === "folder" ? deleteFolder : deleteDocument}
          role="menuitem"
          type="button"
        >
          <UiIcon name="trash" />
          <span>Удалить</span>
        </button>
      )}
    </div>
  );
}

function KnowledgeFolderTitleEditor({
  dispatch,
  folderId,
  title,
}: {
  dispatch: Dispatch;
  folderId: string;
  title: string;
}): React.JSX.Element {
  const [draft, setDraft] = useState(title);

  return (
    <input
      aria-label="Название папки"
      autoFocus
      className="knowledge-folder-title-input"
      onBlur={() =>
        dispatch({
          type: "rename-knowledge-folder",
          folderId,
          title: draft,
        })
      }
      onChange={(event) => setDraft(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          event.preventDefault();
          dispatch({ type: "finish-editing-knowledge-folder" });
        }
      }}
      value={draft}
    />
  );
}

function treeDepthStyle(
  depth: number,
): React.CSSProperties & { "--tree-depth": number } {
  return { "--tree-depth": depth };
}
