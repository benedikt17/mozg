import type { DragEvent } from "react";

export const taskDragMimeType = "application/x-mozg-task-id";

export function getDraggedTaskId(event: DragEvent<HTMLElement>): string | null {
  return (
    event.dataTransfer.getData(taskDragMimeType) ||
    event.dataTransfer.getData("text/plain") ||
    null
  );
}
