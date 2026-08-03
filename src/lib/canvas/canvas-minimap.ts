import type { Node } from "@xyflow/react";
import {
  CANVAS_IMAGE_NODE_TYPE,
  CANVAS_TASK_NODE_TYPE,
  CANVAS_TEXT_NODE_TYPE,
} from "@/lib/canvas/react-flow-canvas-adapter";

export function canvasMiniMapNodeColor(node: Pick<Node, "type">): string {
  switch (node.type) {
    case CANVAS_IMAGE_NODE_TYPE:
      return "#9a3412";
    case CANVAS_TASK_NODE_TYPE:
      return "#0f766e";
    case CANVAS_TEXT_NODE_TYPE:
    default:
      return "#57534e";
  }
}
