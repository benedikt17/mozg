"use client";

import { useMemo } from "react";
import {
  InfiniteCanvasLocalShell,
  type CanvasShellCopy,
} from "@/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell";
import {
  createLocalInfiniteCanvasRepository,
  INFINITE_CANVAS_LOCAL_SHELL_USER_ID,
  INFINITE_CANVAS_LOCAL_SHELL_WORKSPACE_ID,
} from "@/prototype/infinite-canvas-local-shell/local-canvas-composition";
import type { CanvasTaskBridge } from "@/lib/canvas/canvas-task-bridge";
import { ContextPanelSlot } from "@/prototype/context-panels/context-panel-slot";
import {
  DesktopTaskRuntimeProvider,
  useDesktopCanvasTaskRuntime,
  useDesktopTaskRuntime,
} from "@/prototype/tasks/desktop-task-runtime";
import styles from "./infinite-canvas-local-shell.module.css";
import "@/prototype/desktop-shell.css";
import "@/prototype/desktop-workspaces.css";

const localCanvasShellCopy: CanvasShellCopy = {
  eyebrow: "Local Canvas",
  defaultTitle: "First Canvas",
  emptyTitle: "Create your first Canvas",
  emptyDescription:
    "Canvas documents, image assets and your personal viewport stay in this isolated local shell.",
  create: "Create Canvas",
  rename: "Rename",
  newCanvas: "New",
  delete: "Delete",
  addImage: "Add image",
  text: "Text",
  saved: "Saved",
  saving: "Saving…",
  conflict: "Conflict",
  loading: "Loading",
  error: "Error",
  reloadWinner: "Reload winner",
  keepLocalChanges: "Keep my changes",
  restoreLocalDraft: "Restore my local copy",
  isolated: "Workspace isolated",
  status: "Private local workspace · no production data",
};

export function getCanvasTaskBridgeProps({
  taskBridge,
  taskProjectId,
  workspaceAvailable,
}: {
  taskBridge: CanvasTaskBridge;
  taskProjectId: string;
  workspaceAvailable: boolean;
}): {
  taskBridge: CanvasTaskBridge | undefined;
  taskWorkspaceId: string | undefined;
} {
  return workspaceAvailable
    ? { taskBridge, taskWorkspaceId: taskProjectId }
    : { taskBridge: undefined, taskWorkspaceId: undefined };
}

function InfiniteCanvasLocalShellComposition(): React.JSX.Element {
  const { dispatch, state, workspaceAvailable } = useDesktopTaskRuntime();
  const { taskBridge, taskProjectId } = useDesktopCanvasTaskRuntime();
  const repository = useMemo(() => createLocalInfiniteCanvasRepository(), []);
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
                taskProjectId,
                workspaceAvailable,
              })}
              activeTaskDetailsTaskId={activeTaskDetailsTaskId}
              assetRepository={repository}
              copy={localCanvasShellCopy}
              groupRepository={repository}
              repository={repository}
              showDiagnostics
              userId={INFINITE_CANVAS_LOCAL_SHELL_USER_ID}
              workspaceId={INFINITE_CANVAS_LOCAL_SHELL_WORKSPACE_ID}
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
