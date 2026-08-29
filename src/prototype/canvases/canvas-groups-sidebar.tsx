import React, { useEffect, useMemo, useState } from "react";
import type { CanvasGroup } from "@/lib/canvas/canvas-group-repository";
import type { CanvasSummary } from "@/lib/canvas/local-canvas-repository";
import { getCanvasGroupAncestorIds } from "@/prototype/canvases/canvas-breadcrumb";
import { canCreateCanvasFromSidebar } from "@/prototype/canvases/canvas-create-readiness";
import { UiIcon } from "@/prototype/desktop-icons";
import { IconButton, PrototypeButton } from "@/prototype/desktop-ui";
import styles from "@/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.module.css";

const canvasDragType = "application/x-mozg-canvas";
const groupDragType = "application/x-mozg-canvas-group";

export type CanvasGroupsSidebarProps = {
  activeCanvasId: string | null;
  copy: { defaultTitle: string };
  error: string | null;
  groups: readonly CanvasGroup[];
  groupsError: string | null;
  highlightedGroupId: string | null;
  listState: "loading" | "ready" | "empty" | "error";
  onCreateCanvas: (title: string, groupId: string | null) => void;
  onCreateGroup: (title: string, parentGroupId: string | null) => void;
  onDeleteCanvas: (canvasId: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onMoveCanvas: (canvasId: string, groupId: string | null) => void;
  onMoveGroup: (groupId: string, parentGroupId: string | null) => void;
  onRenameCanvas: (canvasId: string, title: string) => void;
  onRenameGroup: (groupId: string, title: string) => void;
  onRetry: () => void;
  onSelectCanvas: (canvasId: string) => void;
  summaries: readonly CanvasSummary[];
};

type CreateMode = {
  kind: "canvas" | "group";
  parentGroupId: string | null;
} | null;
type GroupTree = CanvasGroup & {
  children: GroupTree[];
  canvases: CanvasSummary[];
};

function sortByOrder<T extends { sortOrder?: number; title: string }>(
  items: T[],
): T[] {
  return items.sort(
    (a, b) =>
      (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.title.localeCompare(b.title),
  );
}

function buildTree(
  groups: readonly CanvasGroup[],
  summaries: readonly CanvasSummary[],
  query: string,
): { roots: GroupTree[]; rootCanvases: CanvasSummary[] } {
  const normalized = query.trim().toLocaleLowerCase("ru");
  const byId = new Map<string, GroupTree>();
  groups.forEach((group) =>
    byId.set(group.id, { ...group, children: [], canvases: [] }),
  );
  const roots: GroupTree[] = [];
  byId.forEach((group) => {
    const parent = group.parentGroupId
      ? byId.get(group.parentGroupId)
      : undefined;
    if (parent) parent.children.push(group);
    else roots.push(group);
  });
  summaries.forEach((summary) => {
    const parent = summary.groupId ? byId.get(summary.groupId) : undefined;
    if (parent) parent.canvases.push(summary);
  });
  const matches = (value: string) =>
    !normalized || value.toLocaleLowerCase("ru").includes(normalized);
  const filter = (group: GroupTree): GroupTree | null => {
    const children = group.children
      .map(filter)
      .filter((item): item is GroupTree => Boolean(item));
    const canvases = sortByOrder(
      group.canvases.filter((canvas) => matches(canvas.title)),
    );
    return matches(group.title) || children.length || canvases.length
      ? { ...group, children, canvases }
      : null;
  };
  const filteredRoots = sortByOrder(roots)
    .map(filter)
    .filter((item): item is GroupTree => Boolean(item));
  const rootCanvases = sortByOrder(
    summaries.filter((summary) => !summary.groupId && matches(summary.title)),
  );
  return { roots: filteredRoots, rootCanvases };
}

function confirmDelete(label: string): boolean {
  return window.confirm(
    `Удалить «${label}»? Холсты внутри будут перемещены в родительскую группу или корень.`,
  );
}

type GroupTreeProps = {
  activeCanvasId: string | null;
  dropTargetId: string | null;
  editingCanvasId: string | null;
  editingGroupId: string | null;
  expandedGroupIds: Set<string>;
  group: GroupTree;
  highlightedGroupId: string | null;
  draft: string;
  searching: boolean;
  onCreate: (kind: "canvas" | "group", parentGroupId: string | null) => void;
  onDeleteGroup: (groupId: string) => void;
  onDeleteCanvas: (canvasId: string) => void;
  onMoveDrop: (
    event: React.DragEvent<HTMLElement>,
    targetGroupId: string | null,
  ) => void;
  onRename: (kind: "canvas" | "group", id: string) => void;
  onSelectCanvas: (canvasId: string) => void;
  onStartCanvasRename: (id: string, title: string) => void;
  onStartGroupRename: (id: string, title: string) => void;
  onCancelRename: () => void;
  onToggle: (id: string) => void;
  onDraftChange: (value: string) => void;
  onOpenMenu: (id: string | null) => void;
  openMenuId: string | null;
  setDropTargetId: (id: string | null) => void;
};

function CanvasTreeRow({
  active,
  canvas,
  draft,
  editing,
  onDelete,
  onDragStart,
  onRename,
  onCancelRename,
  onOpenMenu,
  openMenuId,
  onSelect,
  onStartRename,
  onDraftChange,
}: {
  active: boolean;
  canvas: CanvasSummary;
  draft: string;
  editing: boolean;
  onDelete: () => void;
  onDragStart: (event: React.DragEvent<HTMLButtonElement>) => void;
  onRename: () => void;
  onCancelRename: () => void;
  onOpenMenu: (id: string | null) => void;
  openMenuId: string | null;
  onSelect: () => void;
  onStartRename: () => void;
  onDraftChange: (value: string) => void;
}): React.JSX.Element {
  const menuId = `canvas:${canvas.id}`;
  return (
    <div
      className={`${styles.canvasTreeRow} ${active ? styles.canvasTreeRowActive : ""}`}
      data-canvas-id={canvas.id}
    >
      {editing ? (
        <input
          aria-label={`Название холста ${canvas.title}`}
          autoFocus
          className={styles.canvasTreeRenameInput}
          onBlur={onRename}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              onCancelRename();
            }
          }}
          value={draft}
        />
      ) : (
        <button
          aria-current={active ? "page" : undefined}
          className={styles.canvasTreeSelect}
          draggable
          onClick={onSelect}
          onDragStart={onDragStart}
          title={canvas.title}
          type="button"
        >
          <UiIcon name="layout" />
          <span>{canvas.title}</span>
        </button>
      )}
      {!editing ? (
        <>
          <IconButton
            aria-expanded={openMenuId === menuId}
            aria-haspopup="menu"
            className={styles.canvasTreeMenuTrigger}
            data-canvas-menu-trigger={menuId}
            icon={<UiIcon name="more" />}
            label={`Действия холста ${canvas.title}`}
            onClick={() => onOpenMenu(openMenuId === menuId ? null : menuId)}
            title={`Действия холста ${canvas.title}`}
            variant="ghost"
          />
          {openMenuId === menuId ? (
            <div
              className={styles.canvasTreeMenu}
              data-canvas-menu={menuId}
              role="menu"
            >
              <button
                onClick={() => {
                  onOpenMenu(null);
                  onStartRename();
                }}
                role="menuitem"
                type="button"
              >
                <UiIcon name="pencil" />
                <span>Переименовать</span>
              </button>
              <button
                onClick={() => {
                  onOpenMenu(null);
                  onDelete();
                }}
                role="menuitem"
                type="button"
              >
                <UiIcon name="trash" />
                <span>Удалить</span>
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function CanvasGroupTree(props: GroupTreeProps): React.JSX.Element {
  const {
    activeCanvasId,
    dropTargetId,
    editingCanvasId,
    editingGroupId,
    expandedGroupIds,
    group,
    highlightedGroupId,
    draft,
    searching,
    onCreate,
    onDeleteGroup,
    onDeleteCanvas,
    onMoveDrop,
    onRename,
    onSelectCanvas,
    onStartCanvasRename,
    onStartGroupRename,
    onCancelRename,
    onToggle,
    onDraftChange,
    onOpenMenu,
    openMenuId,
    setDropTargetId,
  } = props;
  const expanded = searching || expandedGroupIds.has(group.id);
  const menuId = `group:${group.id}`;
  return (
    <section
      className={styles.canvasTreeBranch}
      data-canvas-group-id={group.id}
    >
      <div
        className={`${styles.canvasTreeRow} ${dropTargetId === group.id ? styles.canvasTreeRowDropTarget : ""} ${highlightedGroupId === group.id ? styles.canvasTreeRowBreadcrumbTarget : ""}`}
      >
        {editingGroupId === group.id ? (
          <input
            aria-label={`Название группы ${group.title}`}
            autoFocus
            className={styles.canvasTreeRenameInput}
            onBlur={() => onRename("group", group.id)}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                onCancelRename();
              }
            }}
            value={draft}
          />
        ) : (
          <button
            aria-expanded={expanded}
            aria-label={`${expanded ? "Свернуть" : "Развернуть"} группу ${group.title}`}
            className={`${styles.canvasTreeSelect} ${styles.canvasTreeGroupSelect}`}
            draggable
            onClick={() => onToggle(group.id)}
            onDragStart={(event) => {
              event.stopPropagation();
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData(groupDragType, group.id);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setDropTargetId(group.id);
            }}
            onDrop={(event) => onMoveDrop(event, group.id)}
            type="button"
          >
            <UiIcon name={expanded ? "chevron-down" : "chevron-right"} />
            <UiIcon name="folder" />
            <span>{group.title}</span>
          </button>
        )}
        {editingGroupId !== group.id ? (
          <>
            <IconButton
              aria-expanded={openMenuId === menuId}
              aria-haspopup="menu"
              className={styles.canvasTreeMenuTrigger}
              data-canvas-menu-trigger={menuId}
              icon={<UiIcon name="more" />}
              label={`Действия группы ${group.title}`}
              onClick={() => onOpenMenu(openMenuId === menuId ? null : menuId)}
              title={`Действия группы ${group.title}`}
              variant="ghost"
            />
            {openMenuId === menuId ? (
              <div
                className={styles.canvasTreeMenu}
                data-canvas-menu={menuId}
                role="menu"
              >
                <button
                  onClick={() => onCreate("canvas", group.id)}
                  role="menuitem"
                  type="button"
                >
                  <UiIcon name="file-plus" />
                  <span>Новый холст</span>
                </button>
                <button
                  onClick={() => onCreate("group", group.id)}
                  role="menuitem"
                  type="button"
                >
                  <UiIcon name="folder-plus" />
                  <span>Новая группа</span>
                </button>
                <button
                  onClick={() => onStartGroupRename(group.id, group.title)}
                  role="menuitem"
                  type="button"
                >
                  <UiIcon name="pencil" />
                  <span>Переименовать</span>
                </button>
                <button
                  onClick={() => {
                    onOpenMenu(null);
                    if (confirmDelete(group.title)) onDeleteGroup(group.id);
                  }}
                  role="menuitem"
                  type="button"
                >
                  <UiIcon name="trash" />
                  <span>Удалить</span>
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
      {expanded ? (
        <div className={styles.canvasTreeChildren}>
          {group.canvases.map((canvas) => (
            <CanvasTreeRow
              active={activeCanvasId === canvas.id}
              canvas={canvas}
              draft={draft}
              editing={editingCanvasId === canvas.id}
              key={canvas.id}
              onDelete={() => onDeleteCanvas(canvas.id)}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData(canvasDragType, canvas.id);
              }}
              onDraftChange={onDraftChange}
              onRename={() => onRename("canvas", canvas.id)}
              onCancelRename={onCancelRename}
              onOpenMenu={onOpenMenu}
              openMenuId={openMenuId}
              onSelect={() => onSelectCanvas(canvas.id)}
              onStartRename={() => onStartCanvasRename(canvas.id, canvas.title)}
            />
          ))}
          {group.children.map((child) => (
            <CanvasGroupTree {...props} group={child} key={child.id} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function CanvasGroupsSidebar({
  activeCanvasId,
  copy,
  error,
  groups,
  groupsError,
  highlightedGroupId,
  listState,
  onCreateCanvas,
  onCreateGroup,
  onDeleteCanvas,
  onDeleteGroup,
  onMoveCanvas,
  onMoveGroup,
  onRenameCanvas,
  onRenameGroup,
  onRetry,
  onSelectCanvas,
  summaries,
}: CanvasGroupsSidebarProps): React.JSX.Element {
  const [query, setQuery] = useState("");
  const [createMode, setCreateMode] = useState<CreateMode>(null);
  const [createTitle, setCreateTitle] = useState(copy.defaultTitle);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(
    () => new Set(groups.map((group) => group.id)),
  );
  const [collapsedBeforeAll, setCollapsedBeforeAll] =
    useState<Set<string> | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  useEffect(() => {
    if (!openMenuId) return;
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("[data-canvas-menu-trigger], [data-canvas-menu]")
      ) {
        return;
      }
      setOpenMenuId(null);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpenMenuId(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenuId]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingCanvasId, setEditingCanvasId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const tree = useMemo(
    () => buildTree(groups, summaries, query),
    [groups, query, summaries],
  );
  const searching = query.trim().length > 0;
  const canvasCreationReady = canCreateCanvasFromSidebar(
    listState,
    activeCanvasId,
  );
  const effectiveExpandedGroupIds = useMemo(() => {
    if (!highlightedGroupId) return expandedGroupIds;
    return new Set([
      ...expandedGroupIds,
      ...getCanvasGroupAncestorIds(groups, highlightedGroupId),
    ]);
  }, [expandedGroupIds, groups, highlightedGroupId]);

  const openCreate = (
    kind: "canvas" | "group",
    parentGroupId: string | null,
  ): void => {
    if (kind === "canvas" && !canvasCreationReady) return;
    setCreateMode({ kind, parentGroupId });
    setCreateTitle(kind === "canvas" ? copy.defaultTitle : "Новая группа");
    setOpenMenuId(null);
  };
  const finishRename = (kind: "canvas" | "group", id: string): void => {
    const title = draft.trim();
    if (title) {
      if (kind === "canvas") onRenameCanvas(id, title);
      else onRenameGroup(id, title);
    }
    setEditingCanvasId(null);
    setEditingGroupId(null);
  };
  const moveFromDrop = (
    event: React.DragEvent<HTMLElement>,
    targetGroupId: string | null,
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    setDropTargetId(null);
    const canvasId = event.dataTransfer.getData(canvasDragType);
    const groupId = event.dataTransfer.getData(groupDragType);
    if (canvasId) onMoveCanvas(canvasId, targetGroupId);
    if (groupId) onMoveGroup(groupId, targetGroupId);
  };
  const toggleAll = (): void => {
    if (collapsedBeforeAll) {
      setExpandedGroupIds(collapsedBeforeAll);
      setCollapsedBeforeAll(null);
    } else {
      setCollapsedBeforeAll(expandedGroupIds);
      setExpandedGroupIds(new Set());
    }
  };
  const groupProps = (group: GroupTree): GroupTreeProps => ({
    activeCanvasId,
    dropTargetId,
    editingCanvasId,
    editingGroupId,
    expandedGroupIds: effectiveExpandedGroupIds,
    group,
    highlightedGroupId,
    draft,
    searching,
    onCreate: openCreate,
    onDeleteGroup,
    onDeleteCanvas,
    onMoveDrop: moveFromDrop,
    onRename: finishRename,
    onSelectCanvas,
    onStartCanvasRename: (id, title) => {
      setEditingCanvasId(id);
      setDraft(title);
      setOpenMenuId(null);
    },
    onStartGroupRename: (id, title) => {
      setEditingGroupId(id);
      setDraft(title);
      setOpenMenuId(null);
    },
    onCancelRename: () => {
      setEditingCanvasId(null);
      setEditingGroupId(null);
    },
    onToggle: (id) =>
      setExpandedGroupIds((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    onDraftChange: setDraft,
    onOpenMenu: setOpenMenuId,
    openMenuId,
    setDropTargetId,
  });

  return (
    <aside
      aria-label="Дерево холстов"
      className={styles.desktopCanvasSidebar}
      data-mobile-section-drawer="true"
    >
      <header className={styles.desktopCanvasSidebarHeader}>
        <div
          className={styles.canvasTreeToolbar}
          aria-label="Действия с холстами"
        >
          <IconButton
            disabled={!canvasCreationReady}
            icon={<UiIcon name="file-plus" />}
            label="Новый холст"
            onClick={() => openCreate("canvas", null)}
            title="Новый холст"
            variant="ghost"
          />
          <IconButton
            icon={<UiIcon name="folder-plus" />}
            label="Новая группа"
            onClick={() => openCreate("group", null)}
            title="Новая группа"
            variant="ghost"
          />
          <IconButton
            icon={<UiIcon name={collapsedBeforeAll ? "expand" : "collapse"} />}
            label={collapsedBeforeAll ? "Развернуть группы" : "Свернуть группы"}
            onClick={toggleAll}
            title={collapsedBeforeAll ? "Развернуть группы" : "Свернуть группы"}
            variant="ghost"
          />
        </div>
      </header>
      <div className={styles.desktopCanvasSidebarSearch}>
        <input
          aria-label="Поиск холста или группы"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск холста или группы"
          type="search"
          value={query}
        />
      </div>
      {createMode ? (
        <form
          className={styles.desktopCanvasCreateForm}
          onSubmit={(event) => {
            event.preventDefault();
            const title = createTitle.trim();
            if (!title) return;
            if (createMode.kind === "canvas")
              onCreateCanvas(title, createMode.parentGroupId);
            else onCreateGroup(title, createMode.parentGroupId);
            setCreateMode(null);
          }}
        >
          <label htmlFor="canvas-tree-create-title">
            {createMode.kind === "canvas" ? "Новый холст" : "Новая группа"}
          </label>
          <input
            autoFocus
            id="canvas-tree-create-title"
            onChange={(event) => setCreateTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setCreateMode(null);
            }}
            placeholder={copy.defaultTitle}
            value={createTitle}
          />
          <div className={styles.desktopCanvasCreateActions}>
            <PrototypeButton size="compact" type="submit" variant="primary">
              Создать
            </PrototypeButton>
            <PrototypeButton
              onClick={() => setCreateMode(null)}
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
        aria-label="Дерево холстов"
        className={styles.desktopCanvasSidebarList}
        onDragOver={(event) => {
          if (
            event.dataTransfer.types.includes(canvasDragType) ||
            event.dataTransfer.types.includes(groupDragType)
          ) {
            event.preventDefault();
            setDropTargetId("root");
          }
        }}
        onDragLeave={() => setDropTargetId(null)}
        onDrop={(event) => moveFromDrop(event, null)}
      >
        {listState === "loading" ? (
          <p className={styles.desktopCanvasSidebarMessage} role="status">
            Загрузка холстов…
          </p>
        ) : null}
        {listState === "error" ? (
          <div className={styles.desktopCanvasSidebarMessage} role="alert">
            <p>{error ?? "Не удалось загрузить холсты."}</p>
            <PrototypeButton onClick={onRetry} size="compact" variant="quiet">
              Повторить
            </PrototypeButton>
          </div>
        ) : null}
        {groupsError ? (
          <p className={styles.desktopCanvasSidebarMessage} role="alert">
            {groupsError}
          </p>
        ) : null}
        {listState === "ready"
          ? tree.rootCanvases.map((canvas) => (
              <CanvasTreeRow
                active={activeCanvasId === canvas.id}
                canvas={canvas}
                draft={draft}
                editing={editingCanvasId === canvas.id}
                key={canvas.id}
                onDelete={() => onDeleteCanvas(canvas.id)}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData(canvasDragType, canvas.id);
                }}
                onDraftChange={setDraft}
                onRename={() => finishRename("canvas", canvas.id)}
                onCancelRename={() => {
                  setEditingCanvasId(null);
                  setEditingGroupId(null);
                }}
                onOpenMenu={setOpenMenuId}
                openMenuId={openMenuId}
                onSelect={() => onSelectCanvas(canvas.id)}
                onStartRename={() => {
                  setEditingCanvasId(canvas.id);
                  setDraft(canvas.title);
                }}
              />
            ))
          : null}
        {listState === "ready"
          ? tree.roots.map((group) => (
              <CanvasGroupTree {...groupProps(group)} key={group.id} />
            ))
          : null}
        {listState === "ready" &&
        tree.rootCanvases.length === 0 &&
        tree.roots.length === 0 ? (
          <p className={styles.desktopCanvasSidebarMessage}>
            {query ? "Совпадений нет." : "Холстов пока нет."}
          </p>
        ) : null}
        {dropTargetId === "root" ? (
          <p
            className={`${styles.desktopCanvasSidebarMessage} ${styles.desktopCanvasDropTarget}`}
          >
            Переместить в корень
          </p>
        ) : null}
      </nav>
    </aside>
  );
}
