import React, { useEffect, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  getProjectTaskGroups,
  getProjectTaskLists,
  getTaskListActiveCount,
  getTaskSystemViewCount,
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
} from "@/prototype/desktop-state";
import { UiIcon } from "@/prototype/desktop-icons";
import { IconButton, ToolSidebarItem } from "@/prototype/desktop-ui";
import {
  taskListDropId,
  type TasksListDropData,
} from "@/prototype/tasks/tasks-dnd-context";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

const taskSystemViews = [
  { view: "day", label: "Задачи на день", icon: "check-circle" },
  { view: "important", label: "Важные", icon: "pin" },
  { view: "all", label: "Все", icon: "layout" },
] as const;

function TaskListRow({
  list,
  state,
  dispatch,
}: {
  list: ReturnType<typeof getProjectTaskLists>[number];
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  const active =
    state.taskSelection.kind === "list" &&
    state.taskSelection.listId === list.id;
  const { isOver, setNodeRef } = useDroppable({
    id: taskListDropId(list.id),
    data: {
      type: "tasks-list",
      listId: list.id,
    } satisfies TasksListDropData,
  });
  return (
    <button
      aria-current={active ? "page" : undefined}
      className={[
        "task-custom-list-select",
        active && "is-active",
        isOver && "is-drop-target",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() => dispatch({ type: "select-task-list", listId: list.id })}
      ref={setNodeRef}
      type="button"
    >
      <span>{list.title}</span>
      <span className="task-list-row-count">
        {getTaskListActiveCount(state, list.id)}
      </span>
    </button>
  );
}

function TaskListRows({
  lists,
  state,
  dispatch,
}: {
  lists: ReturnType<typeof getProjectTaskLists>;
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  return (
    <div className="task-custom-list-items">
      {lists.map((list) => (
        <TaskListRow
          dispatch={dispatch}
          key={list.id}
          list={list}
          state={state}
        />
      ))}
    </div>
  );
}

export function TasksSidebar({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  const groups = getProjectTaskGroups(state);
  const lists = getProjectTaskLists(state);
  const baza = groups.find((group) => group.kind === "system");
  const bazaLists = lists.filter((list) => list.groupId === baza?.id);
  const userGroups = groups.filter((group) => group.kind === "user");
  const [newGroupTitle, setNewGroupTitle] = useState("");
  const [groupCreationOpen, setGroupCreationOpen] = useState(false);
  const [listCreationGroupId, setListCreationGroupId] = useState<string | null>(
    null,
  );
  const [newListTitle, setNewListTitle] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupDraft, setGroupDraft] = useState("");
  const [openGroupMenuId, setOpenGroupMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!openGroupMenuId) return;

    const closeMenuOnOutsidePointer = (event: PointerEvent): void => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(".task-group-menu, .task-group-menu-trigger")
      ) {
        return;
      }
      setOpenGroupMenuId(null);
    };

    document.addEventListener("pointerdown", closeMenuOnOutsidePointer);
    return () => {
      document.removeEventListener("pointerdown", closeMenuOnOutsidePointer);
    };
  }, [openGroupMenuId]);

  const cancelGroupCreation = (): void => {
    setGroupCreationOpen(false);
    setNewGroupTitle("");
  };

  const commitGroupCreation = (): void => {
    if (!newGroupTitle.trim()) {
      cancelGroupCreation();
      return;
    }
    dispatch({ type: "create-task-group", title: newGroupTitle });
    cancelGroupCreation();
  };

  const cancelListCreation = (): void => {
    setListCreationGroupId(null);
    setNewListTitle("");
  };

  const commitListCreation = (groupId: string): void => {
    if (!newListTitle.trim()) {
      cancelListCreation();
      return;
    }
    dispatch({ type: "create-task-list", groupId, title: newListTitle });
    cancelListCreation();
  };

  const startGroupEditing = (groupId: string, title: string): void => {
    setEditingGroupId(groupId);
    setGroupDraft(title);
  };

  const cancelGroupEditing = (): void => {
    setEditingGroupId(null);
    setGroupDraft("");
  };

  const commitGroupEditing = (groupId: string): void => {
    if (!groupDraft.trim()) {
      cancelGroupEditing();
      return;
    }
    dispatch({ type: "rename-task-group", groupId, title: groupDraft });
    cancelGroupEditing();
  };

  return (
    <aside className="tool-sidebar tasks-sidebar" aria-label="Задачи проекта">
      <div className="task-sidebar-header">
        <label className="task-sidebar-search">
          <input
            aria-label="Поиск задач"
            onChange={(event) =>
              dispatch({
                type: "set-task-search-query",
                query: event.target.value,
              })
            }
            placeholder="Поиск задач"
            type="search"
            value={state.taskSearchQuery}
          />
        </label>
      </div>
      <div className="tasks-sidebar-scroll">
        <nav
          className="vertical-menu task-sidebar-group"
          aria-label="Системные представления"
        >
          {taskSystemViews.map(({ view, label, icon }) => (
            <ToolSidebarItem
              active={
                state.taskSelection.kind === "system" &&
                state.taskSelection.view === view
              }
              key={view}
              onClick={() =>
                dispatch({ type: "select-task-system-view", view })
              }
            >
              <span className="task-system-view-row">
                <span className="task-system-view-label">
                  <UiIcon name={icon} />
                  {label}
                </span>
                <span>{getTaskSystemViewCount(state, view)}</span>
              </span>
            </ToolSidebarItem>
          ))}
        </nav>
        <div className="task-sidebar-separator" />
        {baza ? (
          <section className="task-group task-group-baza" aria-label="BAZA">
            <div className="task-group-heading-static">
              <span
                aria-hidden="true"
                className="task-group-disclosure-spacer"
              />
              <span>BAZA</span>
            </div>
            <div className="task-group-content">
              <TaskListRows
                dispatch={dispatch}
                lists={bazaLists}
                state={state}
              />
            </div>
          </section>
        ) : null}
        {baza ? <div className="task-sidebar-separator" /> : null}
        <section className="task-groups" aria-label="Группы задач">
          {userGroups.map((group) => {
            const isExpanded = state.expandedTaskGroupIds.includes(group.id);
            const groupLists = lists.filter(
              (list) => list.groupId === group.id,
            );
            return (
              <div className="task-group" key={group.id}>
                {editingGroupId === group.id ? (
                  <div className="task-group-parent-row is-editing">
                    <div className="task-group-row">
                      <UiIcon
                        name={isExpanded ? "chevron-down" : "chevron-right"}
                      />
                      <input
                        aria-label={`Название группы ${group.title}`}
                        autoFocus
                        onBlur={() => commitGroupEditing(group.id)}
                        onChange={(event) => setGroupDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") event.currentTarget.blur();
                          if (event.key === "Escape") {
                            event.preventDefault();
                            cancelGroupEditing();
                          }
                        }}
                        value={groupDraft}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="task-group-parent-row">
                    <button
                      aria-expanded={isExpanded}
                      aria-label={
                        isExpanded
                          ? `Свернуть группу ${group.title}`
                          : `Развернуть группу ${group.title}`
                      }
                      className="sidebar-tree-row sidebar-tree-container task-group-row"
                      onClick={() =>
                        dispatch({
                          type: "toggle-task-group",
                          groupId: group.id,
                        })
                      }
                      type="button"
                    >
                      <UiIcon
                        name={isExpanded ? "chevron-down" : "chevron-right"}
                      />
                      <span>{group.title}</span>
                    </button>
                    <IconButton
                      aria-expanded={openGroupMenuId === group.id}
                      aria-haspopup="menu"
                      className="task-group-menu-trigger"
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
                      <div className="task-group-menu" role="menu">
                        <button
                          onClick={() => {
                            startGroupEditing(group.id, group.title);
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
                                type: "delete-task-group",
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
                  </div>
                )}
                {isExpanded ? (
                  <div className="task-group-content">
                    <TaskListRows
                      dispatch={dispatch}
                      lists={groupLists}
                      state={state}
                    />
                    {listCreationGroupId === group.id ? (
                      <form
                        className="task-list-create"
                        onSubmit={(event) => {
                          event.preventDefault();
                          commitListCreation(group.id);
                        }}
                      >
                        <input
                          aria-label={`Название списка в группе ${group.title}`}
                          autoFocus
                          onChange={(event) =>
                            setNewListTitle(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key !== "Escape") return;
                            event.preventDefault();
                            cancelListCreation();
                          }}
                          placeholder="Новый список"
                          value={newListTitle}
                        />
                      </form>
                    ) : (
                      <button
                        className="task-list-create-trigger"
                        onClick={() => {
                          setListCreationGroupId(group.id);
                          setNewListTitle("");
                        }}
                        type="button"
                      >
                        + Создать список
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>
      </div>
      <div className="task-group-create-area">
        {groupCreationOpen ? (
          <form
            className="task-group-create"
            onSubmit={(event) => {
              event.preventDefault();
              commitGroupCreation();
            }}
          >
            <input
              aria-label="Название новой группы"
              autoFocus
              onChange={(event) => setNewGroupTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                event.preventDefault();
                cancelGroupCreation();
              }}
              placeholder="Новая группа"
              value={newGroupTitle}
            />
          </form>
        ) : (
          <button
            className="task-group-create-trigger"
            onClick={() => setGroupCreationOpen(true)}
            type="button"
          >
            + Создать группу
          </button>
        )}
      </div>
    </aside>
  );
}
