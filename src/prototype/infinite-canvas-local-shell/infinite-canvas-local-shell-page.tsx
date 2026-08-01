"use client";

import { InfiniteCanvasLocalShell } from "@/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell";
import type { CanvasTaskBridge } from "@/lib/canvas/canvas-task-bridge";
import {
  DesktopTaskRuntimeProvider,
  useDesktopTaskRuntime,
} from "@/prototype/tasks/desktop-task-runtime";

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
  const { taskBridge, taskWorkspaceId, workspaceAvailable } =
    useDesktopTaskRuntime();
  return (
    <InfiniteCanvasLocalShell
      {...getCanvasTaskBridgeProps({
        taskBridge,
        taskWorkspaceId,
        workspaceAvailable,
      })}
    />
  );
}

export function InfiniteCanvasLocalShellPage(): React.JSX.Element {
  return (
    <DesktopTaskRuntimeProvider runtimeMode="local">
      <InfiniteCanvasLocalShellComposition />
    </DesktopTaskRuntimeProvider>
  );
}
