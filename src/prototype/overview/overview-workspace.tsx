"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type JSX,
} from "react";
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
  PrototypeDocument,
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
  documents: PrototypeDocument[];
  tasks: PrototypeTask[];
  dispatch: Dispatch<DesktopPrototypeAction>;
  expandedTaskId: string | null;
  hiddenDirectionIds: string[];
  openTaskId: string | null;
  overviewScrollLeft: number;
};

export function OverviewWorkspace({
  directions,
  documents,
  tasks,
  dispatch,
  expandedTaskId,
  hiddenDirectionIds,
  openTaskId,
  overviewScrollLeft,
}: OverviewWorkspaceProps): JSX.Element {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [dropTarget, setDropTarget] = useState<OverviewDropTarget | null>(null);
  const boardRef = useRef<HTMLElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const activeTask = tasks.find((task) => task.id === activeTaskId);
  const visibleDirections = directions.filter(
    (direction) => !hiddenDirectionIds.includes(direction.id),
  );

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (board && board.scrollLeft !== overviewScrollLeft) {
      board.scrollLeft = overviewScrollLeft;
    }
  }, [overviewScrollLeft]);

  const setDirectionVisible = (directionId: string, visible: boolean): void => {
    dispatch({
      type: "set-overview-direction-visible",
      directionId,
      visible,
    });
  };

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
          <div
            className="overview-view-control"
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.preventDefault();
              event.stopPropagation();
              setViewMenuOpen(false);
            }}
          >
            <PrototypeButton
              aria-expanded={viewMenuOpen}
              aria-haspopup="menu"
              onClick={() => setViewMenuOpen((open) => !open)}
              size="compact"
              variant="quiet"
            >
              Вид
            </PrototypeButton>
            {viewMenuOpen ? (
              <>
                <button
                  aria-label="Закрыть меню вида"
                  className="overview-view-dismiss"
                  onClick={() => setViewMenuOpen(false)}
                  tabIndex={-1}
                  type="button"
                />
                <div
                  aria-label="Видимые направления проекта"
                  className="overview-view-menu"
                  role="menu"
                >
                  {directions.map((direction) => (
                    <label className="overview-view-option" key={direction.id}>
                      <input
                        checked={!hiddenDirectionIds.includes(direction.id)}
                        onChange={(event) =>
                          setDirectionVisible(
                            direction.id,
                            event.currentTarget.checked,
                          )
                        }
                        type="checkbox"
                      />
                      <span>{direction.title}</span>
                    </label>
                  ))}
                </div>
              </>
            ) : null}
          </div>
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
          className={[
            "overview-board",
            `directions-${visibleDirections.length}`,
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label="Рабочие направления проекта"
          onScroll={(event) =>
            dispatch({
              type: "set-overview-scroll-left",
              scrollLeft: event.currentTarget.scrollLeft,
            })
          }
          ref={boardRef}
        >
          {visibleDirections.map((direction) => (
            <OverviewDirectionColumn
              activeTaskId={activeTaskId}
              direction={direction}
              dispatch={dispatch}
              documents={documents}
              dropTarget={dropTarget}
              expandedTaskId={expandedTaskId}
              key={direction.id}
              openTaskId={openTaskId}
              onToggleTaskExpanded={(taskId) =>
                dispatch({ type: "toggle-overview-task-expanded", taskId })
              }
              tasks={tasks}
            />
          ))}
        </section>
        <DragOverlay dropAnimation={null}>
          {activeTask ? <TaskDragOverlay task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
