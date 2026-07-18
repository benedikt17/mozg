import React, { useState } from "react";
import {
  getProjectOverviewDirections,
  getProjectTaskFolders,
  type DesktopPrototypeAction,
  type DesktopPrototypeState,
} from "@/prototype/desktop-state";
import { ToolSidebarItem } from "@/prototype/desktop-ui";
import { getDraggedTaskId } from "./task-drag";

type Dispatch = React.Dispatch<DesktopPrototypeAction>;

export function TasksSidebar({
  state,
  dispatch,
}: {
  state: DesktopPrototypeState;
  dispatch: Dispatch;
}): React.JSX.Element {
  const folders = getProjectTaskFolders(state);
  const directions = getProjectOverviewDirections(state);
  const [newFolderTitle, setNewFolderTitle] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [folderTitleDraft, setFolderTitleDraft] = useState("");

  const commitFolderRename = (): void => {
    if (!editingFolderId) return;
    if (folderTitleDraft.trim()) {
      dispatch({
        type: "rename-task-folder",
        folderId: editingFolderId,
        title: folderTitleDraft,
      });
    }
    setEditingFolderId(null);
    setFolderTitleDraft("");
  };

  return (
    <aside className="tool-sidebar tasks-sidebar" aria-label="Фильтры задач">
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
      <nav className="vertical-menu task-sidebar-group">
        <ToolSidebarItem
          active={state.taskDayViewActive}
          onClick={() => dispatch({ type: "select-task-day" })}
        >
          <strong>Задачи на день</strong>
        </ToolSidebarItem>
        <ToolSidebarItem
          active={
            !state.taskDayViewActive &&
            state.selectedTaskDirectionId === null &&
            state.selectedTaskFolderId === null &&
            state.taskFilter === "important"
          }
          onClick={() =>
            dispatch({ type: "set-task-filter", filter: "important" })
          }
        >
          <strong>Важные</strong>
        </ToolSidebarItem>
        <div
          className="task-sidebar-drop-target"
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
          onDrop={(event) => {
            event.preventDefault();
            const taskId = getDraggedTaskId(event);
            if (!taskId) return;
            dispatch({ type: "assign-task-folder", taskId, folderId: null });
          }}
        >
          <ToolSidebarItem
            active={
              !state.taskDayViewActive &&
              state.selectedTaskDirectionId === null &&
              state.selectedTaskFolderId === null &&
              state.taskFilter === "all"
            }
            onClick={() => dispatch({ type: "set-task-filter", filter: "all" })}
          >
            <strong>Все</strong>
          </ToolSidebarItem>
        </div>
      </nav>
      <div className="task-sidebar-separator" />
      <nav
        className="vertical-menu task-sidebar-group"
        aria-label="Направления проекта"
      >
        {directions.map((direction) => (
          <ToolSidebarItem
            active={state.selectedTaskDirectionId === direction.id}
            key={direction.id}
            onClick={() =>
              dispatch({
                type: "select-task-direction",
                directionId: direction.id,
              })
            }
          >
            <strong>{direction.title}</strong>
          </ToolSidebarItem>
        ))}
      </nav>
      <div className="task-sidebar-separator" />
      <section className="task-folders" aria-label="Папки задач">
        <ToolSidebarItem
          active={
            !state.taskDayViewActive &&
            state.selectedTaskDirectionId === null &&
            state.selectedTaskFolderId === null &&
            state.taskFilter === "completed"
          }
          onClick={() =>
            dispatch({ type: "set-task-filter", filter: "completed" })
          }
        >
          <strong>Завершённые</strong>
        </ToolSidebarItem>
        <div className="task-folders-heading">Папки</div>
        <div className="task-folder-list">
          {folders.map((folder) => {
            const folderHasTasks = state.tasks.some(
              (task) => task.taskFolderId === folder.id,
            );
            return (
              <div
                className={
                  state.selectedTaskFolderId === folder.id
                    ? "task-folder-row is-active"
                    : "task-folder-row"
                }
                key={folder.id}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const taskId = getDraggedTaskId(event);
                  if (!taskId) return;
                  dispatch({
                    type: "assign-task-folder",
                    taskId,
                    folderId: folder.id,
                  });
                }}
              >
                {editingFolderId === folder.id ? (
                  <input
                    aria-label={`Название папки: ${folder.title}`}
                    autoFocus
                    onBlur={commitFolderRename}
                    onChange={(event) =>
                      setFolderTitleDraft(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitFolderRename();
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setEditingFolderId(null);
                        setFolderTitleDraft("");
                      }
                    }}
                    value={folderTitleDraft}
                  />
                ) : (
                  <button
                    className="task-folder-select"
                    onClick={() =>
                      dispatch({
                        type: "select-task-folder",
                        folderId: folder.id,
                      })
                    }
                    type="button"
                  >
                    {folder.title}
                  </button>
                )}
                <button
                  aria-label={`Переименовать папку: ${folder.title}`}
                  className="task-folder-action"
                  onClick={() => {
                    setEditingFolderId(folder.id);
                    setFolderTitleDraft(folder.title);
                  }}
                  title="Переименовать папку"
                  type="button"
                >
                  ✎
                </button>
                <button
                  aria-label={`Удалить папку: ${folder.title}`}
                  className="task-folder-action"
                  disabled={folderHasTasks}
                  onClick={() =>
                    dispatch({
                      type: "delete-task-folder",
                      folderId: folder.id,
                    })
                  }
                  title={
                    folderHasTasks
                      ? "Сначала переместите задачи из папки"
                      : "Удалить папку"
                  }
                  type="button"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
        <form
          className="task-folder-create"
          onSubmit={(event) => {
            event.preventDefault();
            if (!newFolderTitle.trim()) return;
            dispatch({ type: "create-task-folder", title: newFolderTitle });
            setNewFolderTitle("");
          }}
        >
          <input
            aria-label="Название новой папки задач"
            onChange={(event) => setNewFolderTitle(event.target.value)}
            placeholder="Новая папка"
            value={newFolderTitle}
          />
          <button aria-label="Создать папку" type="submit">
            +
          </button>
        </form>
      </section>
    </aside>
  );
}
