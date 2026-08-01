"use client";

import { InfiniteCanvasLocalShell } from "@/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell";
import type { CanvasTaskBridge } from "@/lib/canvas/canvas-task-bridge";
import { ContextPanelSlot } from "@/prototype/context-panels/context-panel-slot";
import {
  DesktopTaskRuntimeProvider,
  useDesktopTaskRuntime,
} from "@/prototype/tasks/desktop-task-runtime";
import styles from "./infinite-canvas-local-shell.module.css";
import "@/prototype/desktop-shell.css";
import "@/prototype/desktop-workspaces.css";

export function getCanvasTaskBridgeProps({
  taskBridge,
  taskWorkspaceId,
  workspaceAvailable,
}: {
  taskBridge: CanvasTaskBridge;
  taskWorkspaceId: string;
  workspaceAvailable: boolean;
}): {
  taskBridge: CanvasTaskBridge | undefined;
  taskWorkspaceId: string | undefined;
} {
  return workspaceAvailable
    ? { taskBridge, taskWorkspaceId }
    : { taskBridge: undefined, taskWorkspaceId: undefined };
}

function InfiniteCanvasLocalShellComposition(): React.JSX.Element {
  const { dispatch, state, taskBridge, taskWorkspaceId, workspaceAvailable } =
    useDesktopTaskRuntime();
  const activeTaskDetailsTaskId =
    workspaceAvailable && state.contextPanel?.kind === "task"
      ? state.contextPanel.taskId
      : undefined;
  const hasTaskContextPanel = activeTaskDetailsTaskId !== undefined;
  const canvasSectionClasses = [
    styles.canvasSectionWorkspace,
    "section-workspace",
    "section-tasks",
    ...(hasTaskContextPanel
      ? ["has-context-panel", "has-full-height-drawer"]
      : []),
  ].join(" ");

  return (
    <div className={styles.canvasDesktopHost}>
      <div className={`${styles.canvasDesktopPrototype} desktop-prototype`}>
        <div className={canvasSectionClasses}>
          <section className={`main-workspace ${styles.canvasMainWorkspace}`}>
            <InfiniteCanvasLocalShell
              {...getCanvasTaskBridgeProps({
                taskBridge,
                taskWorkspaceId,
                workspaceAvailable,
              })}
              activeTaskDetailsTaskId={activeTaskDetailsTaskId}
            />
          </section>
          {hasTaskContextPanel ? (
            <ContextPanelSlot
              contextPanel={state.contextPanel}
              dispatch={dispatch}
              state={state}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function InfiniteCanvasLocalShellPage(): React.JSX.Element {
  return (
    <DesktopTaskRuntimeProvider runtimeMode="local">
      <InfiniteCanvasLocalShellComposition />
    </DesktopTaskRuntimeProvider>
  );
}
