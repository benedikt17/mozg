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
  role?: "heading";
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

  const comparePosition = (first: CanvasSummarySourceNode, second: CanvasSummarySourceNode) =>
    first.position.y - second.position.y ||
    first.position.x - second.position.x ||
    (first.id < second.id ? -1 : first.id > second.id ? 1 : 0);
  const sources = document.edges
    .filter((edge) => edge.targetNodeId === summaryNodeId && edge.summaryOrder !== undefined)
    .flatMap((edge) => {
      const node = byId.get(edge.sourceNodeId);
      return isCanvasSummarySourceNode(node) ? [{ node, order: edge.summaryOrder! }] : [];
    })
    .sort((first, second) => comparePosition(first.node, second.node));
  const parents = new Map<string, CanvasSummarySourceNode>();
  for (const edge of document.edges) {
    if (edge.summaryOrder !== undefined || edge.sourceNodeId === edge.targetNodeId) continue;
    const parent = byId.get(edge.sourceNodeId);
    if (!isCanvasSummarySourceNode(parent) || !parent.markdown.trim()) continue;
    const previous = parents.get(edge.targetNodeId);
    if (!previous || comparePosition(parent, previous) < 0) parents.set(edge.targetNodeId, parent);
  }
  const headingIds = new Set(sources.flatMap(({node}) => {
    const parent = parents.get(node.id);
    return parent ? [parent.id] : [];
  }));
  const emitted = new Set<string>();
  const entries: CanvasSummaryEntry[] = [];
  for (const {node, order} of sources) {
    const parent = parents.get(node.id);
    if (parent && !emitted.has(parent.id)) {
      entries.push({nodeId: parent.id, markdown: parent.markdown, order, role: "heading"});
      emitted.add(parent.id);
    }
    if (emitted.has(node.id)) continue;
    entries.push({
      nodeId: node.id, markdown: node.markdown, order,
      ...(headingIds.has(node.id) ? {role: "heading" as const} : {}),
    });
    emitted.add(node.id);
  }
  return entries;
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
