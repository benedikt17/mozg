import type {
  CanvasDocumentV2,
  CanvasShapeNode,
  CanvasSummaryNode,
  CanvasTextNode,
} from "@/lib/canvas/canvas-document";

export type CanvasSummarySourceNode = CanvasTextNode | CanvasShapeNode;

export type CanvasSummaryEntry = {
  nodeId: string;
  markdown: string;
  order: number;
};

export function isCanvasSummarySourceNode(
  node: CanvasDocumentV2["nodes"][number] | undefined,
): node is CanvasSummarySourceNode {
  return node?.kind === "text" || node?.kind === "shape";
}

export function canvasSummaryEntries(
  document: CanvasDocumentV2,
  summaryNodeId: string,
): CanvasSummaryEntry[] {
  const byId = new Map(document.nodes.map((node) => [node.id, node]));
  const summary = byId.get(summaryNodeId);
  if (summary?.kind !== "summary") return [];

  return document.edges
    .filter(
      (edge) =>
        edge.targetNodeId === summaryNodeId && edge.summaryOrder !== undefined,
    )
    .flatMap((edge) => {
      const source = byId.get(edge.sourceNodeId);
      if (!isCanvasSummarySourceNode(source)) return [];
      return [
        {
          nodeId: source.id,
          markdown: source.markdown,
          order: edge.summaryOrder!,
        },
      ];
    })
    .sort((first, second) => first.order - second.order);
}

export function nextCanvasSummaryOrder(
  document: CanvasDocumentV2,
  summaryNodeId: string,
): number {
  return (
    document.edges.reduce(
      (maximum, edge) =>
        edge.targetNodeId === summaryNodeId && edge.summaryOrder !== undefined
          ? Math.max(maximum, edge.summaryOrder)
          : maximum,
      0,
    ) + 1
  );
}

export function isCanvasSummaryNode(
  node: CanvasDocumentV2["nodes"][number] | undefined,
): node is CanvasSummaryNode {
  return node?.kind === "summary";
}
