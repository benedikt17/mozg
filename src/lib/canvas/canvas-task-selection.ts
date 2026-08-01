import {
  CANVAS_TASK_NODE_TYPE,
  type CanvasFlowNode,
} from "@/lib/canvas/react-flow-canvas-adapter";

export function shouldCloseCanvasTaskDetails(
  activeTaskId: string | undefined,
  nodes: readonly CanvasFlowNode[],
): boolean {
  if (!activeTaskId) return false;
  return !nodes.some(
    (node) =>
      node.type === CANVAS_TASK_NODE_TYPE &&
      node.data.taskId === activeTaskId &&
      node.selected === true,
  );
}
