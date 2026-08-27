import type { CanvasDocument } from "@/lib/canvas/canvas-document";
import type { CanvasTaskBridge } from "@/lib/canvas/canvas-task-bridge";
import {
  canvasDocumentToImageNodes,
  canvasDocumentToPdfNodes,
  canvasDocumentToShapeNodes,
  canvasDocumentToTaskNodes,
  canvasDocumentToTextNodes,
  type CanvasFlowNode,
} from "@/lib/canvas/react-flow-canvas-adapter";

export type CanvasRuntimeSkeletonOptions = {
  taskBridge?: CanvasTaskBridge;
  taskWorkspaceId?: string;
  onContentHeightChange?: (nodeId: string, height: number) => void;
};

export function canvasDocumentToRuntimeSkeleton(
  document: CanvasDocument,
  options: CanvasRuntimeSkeletonOptions = {},
): CanvasFlowNode[] {
  return [
    ...canvasDocumentToImageNodes(document),
    ...canvasDocumentToPdfNodes(document),
    ...canvasDocumentToTaskNodes(document, options),
    ...canvasDocumentToTextNodes(document),
    ...canvasDocumentToShapeNodes(document),
  ];
}
