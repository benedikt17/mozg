"use client";

import { CloudCanvasWorkspace } from "@/prototype/canvases/cloud-canvas-workspace";

export function DesktopCanvasWorkspace({
  activeTaskDetailsTaskId,
  workspaceId,
}: {
  activeTaskDetailsTaskId?: string;
  workspaceId?: string;
}): React.JSX.Element {
  if (workspaceId) {
    return (
      <CloudCanvasWorkspace
        activeTaskDetailsTaskId={activeTaskDetailsTaskId}
        workspaceId={workspaceId}
      />
    );
  }
  return (
    <p role="alert">Не удалось определить текущее рабочее пространство.</p>
  );
}
