import React from "react";
import {
  getCanvasesForGroup,
  getProjectCanvasGroups,
  getProjectCanvases,
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
} from "@/prototype/desktop-state";
import { UiIcon } from "@/prototype/desktop-icons";
import { IconButton, ToolSidebarItem } from "@/prototype/desktop-ui";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;
const canvasDragType = "application/x-mozg-canvas";

function CanvasSidebarRow({
  canvas,
  state,
  dispatch,
  onDragEnd,
  onDragStart,
}: {
  canvas: { id: string; title: string };
  state: DesktopPrototypeState;
  dispatch: Dispatch;
  onDragEnd: () => void;
  onDragStart: (event: React.DragEvent<HTMLButtonElement>) => void;
}): React.JSX.Element {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(canvas.title);
  const commitRename = (): void => {
    dispatch({ type: "rename-canvas", canvasId: canvas.id, title: draft });
    setEditing(false);
  };
  return (
    <div
      className={[
        "canvas-item-parent-row",
        state.selectedCanvasId === canvas.id ? "is-active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {editing ? (
        <input
          aria-label={`Название холста ${canvas.title}`}
          autoFocus
          className="canvas-item-title-input"
          onBlur={commitRename}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              event.preventDefault();
              setEditing(false);
            }
          }}
          value={draft}
        />
      ) : (
        <ToolSidebarItem
          active={state.selectedCanvasId === canvas.id}
          className="canvas-item-row"
          draggable
          onDragEnd={onDragEnd}
          onDragStart={onDragStart}
          onClick={() =>
            dispatch({ type: "select-canvas", canvasId: canvas.id })
          }
        >
          <span>{canvas.title}</span>
        </ToolSidebarItem>
      )}
      {!editing ? (
        <>
          <IconButton
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="canvas-item-menu-trigger"
            icon={<UiIcon name="more" />}
            label={`Действия холста ${canvas.title}`}
            onClick={() => setMenuOpen((open) => !open)}
            title={`Действия холста ${canvas.title}`}
            variant="ghost"
          />
          {menuOpen ? (
            <div className="canvas-item-menu" role="menu">
              <button
                onClick={() => {
                  setDraft(canvas.title);
                  setEditing(true);
                  setMenuOpen(false);
                }}
                role="menuitem"
                type="button"
              >
                <UiIcon name="pencil" />
                <span>Переименовать</span>
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Удалить холст «${canvas.title}»?`)) {
                    dispatch({ type: "delete-canvas", canvasId: canvas.id });
                  }
                  setMenuOpen(false);
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

export function CanvasesSidebar({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  const canvases = getProjectCanvases(state);
  const groups = getProjectCanvasGroups(state);
  const [creatingGroup, setCreatingGroup] = React.useState(false);
  const [creatingCanvas, setCreatingCanvas] = React.useState(false);
  const [groupTitle, setGroupTitle] = React.useState("");
  const [canvasTitle, setCanvasTitle] = React.useState("");
  const [canvasGroupId, setCanvasGroupId] = React.useState<string | null>(null);
  const [dropTargetGroupId, setDropTargetGroupId] = React.useState<
    string | null
  >(null);
  const [openGroupMenuId, setOpenGroupMenuId] = React.useState<string | null>(
    null,
  );
  const [editingGroupId, setEditingGroupId] = React.useState<string | null>(
    null,
  );
  const [groupDraft, setGroupDraft] = React.useState("");

  React.useEffect(() => {
    const clearDropTarget = (): void => setDropTargetGroupId(null);
    window.addEventListener("dragend", clearDropTarget);
    window.addEventListener("drop", clearDropTarget);
    return () => {
      window.removeEventListener("dragend", clearDropTarget);
      window.removeEventListener("drop", clearDropTarget);
    };
  }, []);

  const commitGroup = (): void => {
    if (!groupTitle.trim()) return;
    dispatch({ type: "create-canvas-group", title: groupTitle });
    setGroupTitle("");
    setCreatingGroup(false);
  };

  const commitCanvas = (): void => {
    if (!canvasTitle.trim()) return;
    dispatch({
      type: "create-canvas",
      title: canvasTitle,
      groupId: canvasGroupId,
    });
    setCanvasTitle("");
    setCanvasGroupId(null);
    setCreatingCanvas(false);
  };

  const commitGroupRename = (groupId: string): void => {
    dispatch({ type: "rename-canvas-group", groupId, title: groupDraft });
    setEditingGroupId(null);
  };

  return (
    <aside
      className="tool-sidebar canvases-sidebar"
      aria-label="Список холстов"
    >
      <nav className="vertical-menu">
        {canvases
          .filter((canvas) => !canvas.groupId)
          .map((canvas) => (
            <CanvasSidebarRow
              canvas={canvas}
              dispatch={dispatch}
              key={canvas.id}
              onDragEnd={() => setDropTargetGroupId(null)}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData(canvasDragType, canvas.id);
              }}
              state={state}
            />
          ))}
        {groups.map((group) => {
          const isExpanded = state.expandedCanvasGroupIds.includes(group.id);
          return (
            <section className="canvas-group" key={group.id}>
              <div
                className={[
                  "canvas-group-parent-row",
                  dropTargetGroupId === group.id ? "is-drop-target" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {editingGroupId === group.id ? (
                  <input
                    aria-label={`Название группы ${group.title}`}
                    autoFocus
                    className="canvas-group-title-input"
                    onBlur={() => commitGroupRename(group.id)}
                    onChange={(event) => setGroupDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setEditingGroupId(null);
                      }
                    }}
                    value={groupDraft}
                  />
                ) : (
                  <button
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? "Свернуть" : "Развернуть"} группу ${group.title}`}
                    className={[
                      "canvas-group-row",
                      dropTargetGroupId === group.id ? "is-drop-target" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() =>
                      dispatch({
                        type: "toggle-canvas-group",
                        groupId: group.id,
                      })
                    }
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      event.dataTransfer.dropEffect = "move";
                      setDropTargetGroupId(group.id);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      const canvasId =
                        event.dataTransfer.getData(canvasDragType);
                      setDropTargetGroupId(null);
                      if (canvasId) {
                        dispatch({
                          type: "move-canvas-to-group",
                          canvasId,
                          groupId: group.id,
                        });
                      }
                    }}
                    type="button"
                  >
                    <UiIcon
                      name={isExpanded ? "chevron-down" : "chevron-right"}
                    />
                    <span>{group.title}</span>
                  </button>
                )}
                {editingGroupId !== group.id ? (
                  <>
                    <IconButton
                      aria-expanded={openGroupMenuId === group.id}
                      aria-haspopup="menu"
                      className="canvas-group-menu-trigger"
                      icon={<UiIcon name="more" />}
                      label={`Действия группы ${group.title}`}
                      onClick={() =>
                        setOpenGroupMenuId((current) =>
                          current === group.id ? null : group.id,
                        )
                      }
                      title={`Действия группы ${group.title}`}
                      variant="ghost"
                    />
                    {openGroupMenuId === group.id ? (
                      <div className="canvas-group-menu" role="menu">
                        <button
                          onClick={() => {
                            setGroupDraft(group.title);
                            setEditingGroupId(group.id);
                            setOpenGroupMenuId(null);
                          }}
                          role="menuitem"
                          type="button"
                        >
                          <UiIcon name="pencil" />
                          <span>Переименовать</span>
                        </button>
                        <button
                          onClick={() => {
                            if (
                              window.confirm(`Удалить группу «${group.title}»?`)
                            ) {
                              dispatch({
                                type: "delete-canvas-group",
                                groupId: group.id,
                              });
                            }
                            setOpenGroupMenuId(null);
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
              {isExpanded ? (
                <div className="canvas-group-content">
                  {getCanvasesForGroup(state, group.id).map((canvas) => (
                    <CanvasSidebarRow
                      canvas={canvas}
                      dispatch={dispatch}
                      key={canvas.id}
                      onDragEnd={() => setDropTargetGroupId(null)}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData(canvasDragType, canvas.id);
                      }}
                      state={state}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </nav>
      <div className="canvases-sidebar-actions">
        {creatingGroup ? (
          <form
            className="canvases-sidebar-create-form"
            onSubmit={(event) => {
              event.preventDefault();
              commitGroup();
            }}
          >
            <input
              aria-label="Название группы холстов"
              autoFocus
              onChange={(event) => setGroupTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setCreatingGroup(false);
                  setGroupTitle("");
                }
              }}
              placeholder="Новая группа"
              value={groupTitle}
            />
          </form>
        ) : null}
        {creatingCanvas ? (
          <form
            className="canvases-sidebar-create-form"
            onSubmit={(event) => {
              event.preventDefault();
              commitCanvas();
            }}
          >
            <input
              aria-label="Название холста"
              autoFocus
              onChange={(event) => setCanvasTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setCreatingCanvas(false);
                  setCanvasTitle("");
                }
              }}
              placeholder="Новый холст"
              value={canvasTitle}
            />
            <select
              aria-label="Группа холста"
              onChange={(event) => setCanvasGroupId(event.target.value || null)}
              value={canvasGroupId ?? ""}
            >
              <option value="">Без группы</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.title}
                </option>
              ))}
            </select>
          </form>
        ) : null}
        {!creatingGroup && !creatingCanvas ? (
          <>
            <button
              className="canvases-sidebar-action"
              onClick={() => setCreatingGroup(true)}
              type="button"
            >
              + Создать группу
            </button>
            <button
              className="canvases-sidebar-action"
              onClick={() => setCreatingCanvas(true)}
              type="button"
            >
              + Создать холст
            </button>
          </>
        ) : null}
      </div>
    </aside>
  );
}
