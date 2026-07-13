"use client";

import { useState, type Dispatch, type JSX } from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type {
  PrototypeOverviewDirection,
  PrototypeTask,
} from "@/prototype/desktop-mock-data";
import type { DesktopPrototypeAction } from "@/prototype/desktop-state";
import { PrototypeButton } from "@/prototype/desktop-ui";
import {
  getOverviewDropTarget,
  isOverviewTaskDragData,
  type OverviewDropTarget,
} from "@/prototype/overview/overview-dnd";
import { OverviewDirectionColumn } from "@/prototype/overview/overview-direction-column";
import { TaskDragOverlay } from "@/prototype/overview/task-card";

export type OverviewWorkspaceProps = {
  directions: PrototypeOverviewDirection[];
  tasks: PrototypeTask[];
  editingTaskTitleId: string | null;
  dispatch: Dispatch<DesktopPrototypeAction>;
};

export function OverviewWorkspace({
  directions,
  tasks,
  editingTaskTitleId,
  dispatch,
}: OverviewWorkspaceProps): JSX.Element {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<OverviewDropTarget | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const activeTask = tasks.find((task) => task.id === activeTaskId);
  const activeTaskDirection = activeTask
    ? directions.find(
        (direction) => direction.id === activeTask.overviewDirectionId,
      )
    : undefined;

  const clearDragState = (): void => {
    setActiveTaskId(null);
    setDropTarget(null);
  };

  const handleDragStart = (event: DragStartEvent): void => {
    const dragData = event.active.data.current;
    if (!isOverviewTaskDragData(dragData)) return;
    setActiveTaskId(dragData.taskId);
  };

  const handleDragOver = (event: DragOverEvent): void => {
    if (!activeTaskId) return;
    setDropTarget(getOverviewDropTarget(tasks, activeTaskId, event));
  };

  const handleDragEnd = (event: DragEndEvent): void => {
    if (!activeTaskId) return;
    const target = getOverviewDropTarget(tasks, activeTaskId, event);
    if (target) {
      dispatch({
        type: "move-overview-task",
        taskId: activeTaskId,
        targetDirectionId: target.directionId,
        targetIndex: target.index,
      });
    }
    clearDragState();
  };

  return (
    <div className="overview-workspace">
      <section className="overview-command-bar" aria-label="Действия доски">
        <div className="overview-controls">
          <PrototypeButton
            onClick={() => dispatch({ type: "create-task" })}
            size="compact"
            variant="primary"
          >
            + Задача
          </PrototypeButton>
        </div>
      </section>
      <DndContext
        collisionDetection={closestCenter}
        onDragCancel={clearDragState}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
        <section
          className={["overview-board", `directions-${directions.length}`]
            .filter(Boolean)
            .join(" ")}
          aria-label="Рабочие направления проекта"
        >
          {directions.map((direction) => (
            <OverviewDirectionColumn
              activeTaskId={activeTaskId}
              direction={direction}
              dispatch={dispatch}
              dropTarget={dropTarget}
              editingTaskTitleId={editingTaskTitleId}
              key={direction.id}
              tasks={tasks}
            />
          ))}
        </section>
        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <TaskDragOverlay
              directionTitle={activeTaskDirection?.title ?? "Направление"}
              task={activeTask}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
