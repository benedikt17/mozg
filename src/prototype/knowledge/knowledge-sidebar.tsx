import React, { useEffect, useRef, useState } from "react";
import {
  getDocumentBreadcrumb,
  getDocumentFolderPath,
  getKnowledgePaneState,
  getKnowledgeTree,
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
  type KnowledgeTreeNode,
} from "@/prototype/desktop-state";
import { UiIcon } from "@/prototype/desktop-icons";
import { IconButton } from "@/prototype/desktop-ui";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

export function KnowledgeSidebar({
  state,
  dispatch,
  onClose,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
  onClose?: () => void;
}): React.JSX.Element {
  const tree = getKnowledgeTree(state);
  const { activeDocument } = getKnowledgePaneState(state);
  const treeRef = useRef<HTMLElement>(null);
  const [knowledgeDropTarget, setKnowledgeDropTarget] =
    useState<KnowledgeDropTarget>(null);
  const [revealDocumentId, setRevealDocumentId] = useState<string | null>(null);
  const [openFolderMenuId, setOpenFolderMenuId] = useState<string | null>(null);
  const treeCollapsed = state.knowledgeExpandedBeforeCollapse !== null;

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
    const closeFolderMenu = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest(".knowledge-folder-menu") ||
        target.closest(".knowledge-folder-menu-trigger")
      ) {
        return;
      }
      setOpenFolderMenuId(null);
    };
    document.addEventListener("pointerdown", closeFolderMenu);
    return () => document.removeEventListener("pointerdown", closeFolderMenu);
  }, []);

  return (
    <aside
      className="tool-sidebar knowledge-sidebar"
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
              onFolderMenuChange={setOpenFolderMenuId}
              onDropTargetChange={setKnowledgeDropTarget}
              openFolderMenuId={openFolderMenuId}
              state={state}
            />
          ))
        ) : (
          <p className="empty-state">Ничего не найдено.</p>
        )}
      </nav>
    </aside>
  );
}

type KnowledgeDropTarget =
  | { kind: "folder"; id: string }
  | { kind: "document"; id: string; position: "before" | "after" }
  | null;

const knowledgeDocumentDragType = "application/x-mozg-knowledge-document";

function KnowledgeTreeNodeView({
  node,
  state,
  activeDocumentId,
  dispatch,
  dropTarget,
  onFolderMenuChange,
  onDropTargetChange,
  openFolderMenuId,
}: {
  node: KnowledgeTreeNode;
  state: DesktopPrototypeState;
  activeDocumentId: string | undefined;
  dispatch: Dispatch;
  dropTarget: KnowledgeDropTarget;
  onFolderMenuChange: (folderId: string | null) => void;
  onDropTargetChange: (target: KnowledgeDropTarget) => void;
  openFolderMenuId: string | null;
}): React.JSX.Element {
  const depth = Math.max(node.path.length - 1, 0);

  if (node.kind === "folder") {
    const expanded =
      state.knowledgeSearchQuery.trim().length > 0 ||
      state.expandedFolderIds.includes(node.id);
    const editing = state.editingKnowledgeFolderId === node.id;
    const folderClassName = [
      "sidebar-tree-row",
      "sidebar-tree-container",
      "knowledge-tree-row",
      "folder",
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
            className="knowledge-folder-row"
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
            className="knowledge-folder-row"
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
              aria-expanded={openFolderMenuId === node.id}
              aria-haspopup="menu"
              className="knowledge-folder-menu-trigger"
              icon={<UiIcon name="more" />}
              label={`Действия папки ${node.title}`}
              onClick={() =>
                onFolderMenuChange(
                  openFolderMenuId === node.id ? null : node.id,
                )
              }
              title={`Действия папки ${node.title}`}
              variant="ghost"
            />
            {openFolderMenuId === node.id ? (
              <div className="knowledge-folder-menu" role="menu">
                <button
                  onClick={() => {
                    dispatch({
                      type: "start-editing-knowledge-folder",
                      folderId: node.id,
                    });
                    onFolderMenuChange(null);
                  }}
                  role="menuitem"
                  type="button"
                >
                  <UiIcon name="pencil" />
                  <span>Переименовать</span>
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Удалить папку «${node.title}»?`)) {
                      dispatch({
                        type: "delete-knowledge-folder",
                        folderId: node.id,
                      });
                    }
                    onFolderMenuChange(null);
                  }}
                  role="menuitem"
                  type="button"
                >
                  <UiIcon name="trash" />
                  <span>Удалить</span>
                </button>
              </div>
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
                onFolderMenuChange={onFolderMenuChange}
                onDropTargetChange={onDropTargetChange}
                openFolderMenuId={openFolderMenuId}
                state={state}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <button
      className={[
        "sidebar-tree-row",
        "sidebar-tree-leaf",
        "knowledge-tree-row",
        "document",
        activeDocumentId === node.document.id ? "is-active" : "",
        dropTarget?.kind === "document" && dropTarget.id === node.document.id
          ? `drop-${dropTarget.position}`
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-knowledge-document-id={node.document.id}
      draggable
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
        event.dataTransfer.setData(knowledgeDocumentDragType, node.document.id);
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const documentId = event.dataTransfer.getData(
          knowledgeDocumentDragType,
        );
        const position =
          dropTarget?.kind === "document" && dropTarget.id === node.document.id
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
      onClick={() =>
        dispatch({
          type: "open-knowledge-document-in-active-pane",
          documentId: node.document.id,
        })
      }
      style={treeDepthStyle(depth)}
      title={getDocumentBreadcrumb(node.document)}
      type="button"
    >
      <span className="tree-disclosure-spacer" />
      <span>{node.title}</span>
    </button>
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
