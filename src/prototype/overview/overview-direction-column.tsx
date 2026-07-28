"use client";

import { useState, type Dispatch, type JSX } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type {
  PrototypeDocument,
  PrototypeOverviewDirection,
  PrototypeTask,
} from "@/prototype/desktop-mock-data";
import type { DesktopPrototypeAction } from "@/prototype/desktop-state";
import {
  directionDropId,
  getOverviewDirectionTasks,
  taskDragId,
  type OverviewDirectionDropData,
  type OverviewDropTarget,
} from "@/prototype/overview/overview-dnd";
import { TaskCard } from "@/prototype/overview/task-card";
import { TaskDropGap } from "@/prototype/dnd/task-dnd-primitives";

export function OverviewDirectionColumn({
  tasks: overviewTasks,
  documents,
  dispatch,
  direction,
  activeTaskId,
  dropTarget,
  expandedTaskId,
  openTaskId,
  onToggleTaskExpanded,
}: {
  tasks: PrototypeTask[];
  documents: PrototypeDocument[];
  dispatch: Dispatch<DesktopPrototypeAction>;
  direction: PrototypeOverviewDirection;
  activeTaskId: string | null;
  dropTarget: OverviewDropTarget | null;
  expandedTaskId: string | null;
  openTaskId: string | null;
  onToggleTaskExpanded: (taskId: string) => void;
}): JSX.Element {
  const tasks = getOverviewDirectionTasks(overviewTasks, direction.id);
  const positionedTasks = tasks.filter((task) => task.id !== activeTaskId);
  const { isOver, setNodeRef } = useDroppable({
    id: directionDropId(direction.id),
    data: {
      type: "overview-direction",
      directionId: direction.id,
    } satisfies OverviewDirectionDropData,
  });
  const directionDropTarget =
    dropTarget?.directionId === direction.id ? dropTarget : null;
  return (
    <article
      className={["board-column", isOver ? "is-drag-over" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <header>
        <DirectionTitleInput direction={direction} dispatch={dispatch} />
        <div className="lane-header-actions">
          <button
            aria-label={`Создать задачу в направлении «${direction.title}»`}
            className="lane-add-task"
            onClick={() =>
              dispatch({
                type: "create-task",
                overviewDirectionId: direction.id,
              })
            }
            title="Добавить задачу"
            type="button"
          >
            +
          </button>
        </div>
      </header>
      <div className="task-stack" ref={setNodeRef}>
        <SortableContext
          items={tasks.map((task) => taskDragId(task.id))}
          strategy={verticalListSortingStrategy}
        >
          {tasks.length > 0 ? (
            tasks.map((task, taskIndex) => {
              const visibleIndex = positionedTasks.findIndex(
                (item) => item.id === task.id,
              );
              const showIndicatorBefore =
                task.id !== activeTaskId &&
                directionDropTarget?.index === visibleIndex;
              return (
                <div className="task-sort-slot" key={task.id}>
                  {showIndicatorBefore ? <TaskDropGap /> : null}
                  <TaskCard
                    dispatch={dispatch}
                    documents={documents}
                    drawerOpen={openTaskId === task.id}
                    expanded={expandedTaskId === task.id}
                    isSelected={
                      openTaskId !== null
                        ? openTaskId === task.id
                        : expandedTaskId === task.id
                    }
                    onSelectTask={
                      openTaskId !== null
                        ? (taskId) =>
                            dispatch({
                              type: "select-task",
                              taskId,
                              section: "overview",
                            })
                        : undefined
                    }
                    onToggleExpanded={onToggleTaskExpanded}
                    task={task}
                    taskCount={tasks.length}
                    taskIndex={taskIndex}
                  />
                </div>
              );
            })
          ) : (
            <p className="empty-state">Нет задач в этом направлении.</p>
          )}
          {directionDropTarget?.index === positionedTasks.length ? (
            <TaskDropGap />
          ) : null}
        </SortableContext>
      </div>
    </article>
  );
}

function DirectionTitleInput({
  direction,
  dispatch,
}: {
  direction: PrototypeOverviewDirection;
  dispatch: Dispatch<DesktopPrototypeAction>;
}): JSX.Element {
  const [draft, setDraft] = useState(direction.title);

  const commit = (value: string): void => {
    const title = value.trim();
    if (title.length === 0) {
      setDraft(direction.title);
      return;
    }
    dispatch({
      type: "rename-overview-direction",
      directionId: direction.id,
      title,
    });
    setDraft(title);
  };

  return (
    <input
      aria-label={`Название направления ${direction.title}`}
      className="direction-title-input"
      onBlur={(event) => commit(event.currentTarget.value)}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          event.currentTarget.value = direction.title;
          setDraft(direction.title);
          event.currentTarget.blur();
        }
      }}
      title="Изменить название направления"
      value={draft}
    />
  );
}
