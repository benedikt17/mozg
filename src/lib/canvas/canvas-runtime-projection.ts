import type { NodeChange } from "@xyflow/react";

/** Only a completed NodeResizer action may alter persisted Canvas geometry. */
export function isExplicitCanvasResize(change: NodeChange): boolean {
  return (
    change.type === "dimensions" &&
    change.resizing === false &&
    change.setAttributes === true
  );
}
