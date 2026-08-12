"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useEffect,
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
  const [dropTarget, setDropTarget] = useState<OverviewDropTarget | null>(null);
  const boardRef = useRef<HTMLElement>(null);
  const mobileAlignmentInProgressRef = useRef(false);
  const mobileAlignmentTimerRef = useRef<number | null>(null);
  const mobileGestureSettleTimerRef = useRef<number | null>(null);
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

  const commitBoardScroll = useCallback(
    (board: HTMLElement): void => {
      dispatch({
        type: "set-overview-scroll-left",
        scrollLeft: board.scrollLeft,
      });
    },
    [dispatch],
  );

  const alignMobileColumn = useCallback(
    (column: HTMLElement): void => {
      if (!window.matchMedia("(max-width: 767px)").matches) return;
      const board = boardRef.current;
      if (!board || !board.contains(column)) return;

      const boardRect = board.getBoundingClientRect();
      const columnRect = column.getBoundingClientRect();
      const targetLeft = Math.max(
        0,
        board.scrollLeft + columnRect.left - boardRect.left,
      );
      if (Math.abs(board.scrollLeft - targetLeft) < 1) return;

      mobileAlignmentInProgressRef.current = true;
      if (mobileGestureSettleTimerRef.current !== null) {
        window.clearTimeout(mobileGestureSettleTimerRef.current);
        mobileGestureSettleTimerRef.current = null;
      }
      if (mobileAlignmentTimerRef.current !== null) {
        window.clearTimeout(mobileAlignmentTimerRef.current);
      }
      board.scrollTo({
        behavior: "smooth",
        left: targetLeft,
      });
      mobileAlignmentTimerRef.current = window.setTimeout(() => {
        mobileAlignmentInProgressRef.current = false;
        mobileAlignmentTimerRef.current = null;
        commitBoardScroll(board);
      }, 420);
    },
    [commitBoardScroll],
  );

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (
      board &&
      !mobileAlignmentInProgressRef.current &&
      board.scrollLeft !== overviewScrollLeft
    ) {
      board.scrollLeft = overviewScrollLeft;
    }
  }, [overviewScrollLeft]);

  useLayoutEffect(() => {
    if (!expandedTaskId) return;
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    const board = boardRef.current;
    if (!board) return;

    let settleFrame = 0;
    const frame = window.requestAnimationFrame(() => {
      settleFrame = window.requestAnimationFrame(() => {
        const details = window.document.getElementById(
          `task-card-details-${expandedTaskId}`,
        );
        const column = details?.closest<HTMLElement>(".board-column");
        if (!column || !board.contains(column)) return;
        alignMobileColumn(column);
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (settleFrame) window.cancelAnimationFrame(settleFrame);
    };
  }, [alignMobileColumn, expandedTaskId]);

  useEffect(
    () => () => {
      if (mobileAlignmentTimerRef.current !== null) {
        window.clearTimeout(mobileAlignmentTimerRef.current);
      }
      if (mobileGestureSettleTimerRef.current !== null) {
        window.clearTimeout(mobileGestureSettleTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!expandedTaskId) return;

    const handleDocumentPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".task-card")) return;
      if (!target.closest(".overview-board-mode")) return;
      dispatch({
        type: "toggle-overview-task-expanded",
        taskId: expandedTaskId,
      });
    };

    document.addEventListener("pointerdown", handleDocumentPointerDown);
    return () =>
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
  }, [dispatch, expandedTaskId]);

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
      <DndContext
        collisionDetection={closestCenter}
        id="overview-dnd"
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
          onScroll={(event) => {
            if (mobileAlignmentInProgressRef.current) return;
            const board = event.currentTarget;
            if (!window.matchMedia("(max-width: 767px)").matches) {
              commitBoardScroll(board);
              return;
            }
            if (mobileGestureSettleTimerRef.current !== null) {
              window.clearTimeout(mobileGestureSettleTimerRef.current);
            }
            mobileGestureSettleTimerRef.current = window.setTimeout(() => {
              mobileGestureSettleTimerRef.current = null;
              commitBoardScroll(board);
            }, 180);
          }}
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
              onActivateColumn={alignMobileColumn}
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
