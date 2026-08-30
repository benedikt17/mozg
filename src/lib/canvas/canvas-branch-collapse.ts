import type { Edge, Node } from "@xyflow/react";

export const CANVAS_BRANCH_RUNTIME_KEY = "__mozgBranch";
const CANVAS_BRANCH_EDGE_RUNTIME_KEY = "__mozgBranchHidden";
export const CANVAS_BRANCH_COLLAPSE_EVENT = "mozg:canvas-branch-collapse";

export type CanvasBranchCollapseEventDetail = {
  nodeId: string;
  collapsed: boolean;
};

export type CanvasBranchRuntimeState = {
  collapsed: boolean;
  directChildCount: number;
  hiddenByBranch: boolean;
};

type RuntimeData = Record<string, unknown> & {
  [CANVAS_BRANCH_RUNTIME_KEY]?: CanvasBranchRuntimeState;
};

type RuntimeEdgeData = Record<string, unknown> & {
  [CANVAS_BRANCH_EDGE_RUNTIME_KEY]?: boolean;
};

export function canvasBranchRuntimeState(
  data: unknown,
): CanvasBranchRuntimeState | null {
  if (!data || typeof data !== "object") return null;
  const candidate = (data as RuntimeData)[CANVAS_BRANCH_RUNTIME_KEY];
  if (!candidate || typeof candidate !== "object") return null;
  return typeof candidate.collapsed === "boolean" &&
    typeof candidate.directChildCount === "number" &&
    typeof candidate.hiddenByBranch === "boolean"
    ? candidate
    : null;
}

export function canvasBranchCollapsedNodeIds(
  nodes: readonly { id: string; branchCollapsed?: boolean }[],
): Set<string> {
  return new Set(
    nodes
      .filter((node) => node.branchCollapsed === true)
      .map((node) => node.id),
  );
}

export function dispatchCanvasBranchCollapse(
  detail: CanvasBranchCollapseEventDetail,
): void {
  window.dispatchEvent(
    new CustomEvent<CanvasBranchCollapseEventDetail>(
      CANVAS_BRANCH_COLLAPSE_EVENT,
      { detail },
    ),
  );
}

function adjacencyForEdges(edges: readonly Edge[]): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (edge.source === edge.target) continue;
    const targets = adjacency.get(edge.source) ?? new Set<string>();
    targets.add(edge.target);
    adjacency.set(edge.source, targets);
  }
  return adjacency;
}

function descendantsOf(
  rootId: string,
  adjacency: ReadonlyMap<string, ReadonlySet<string>>,
): Set<string> {
  const descendants = new Set<string>();
  const queue = [...(adjacency.get(rootId) ?? [])];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current === rootId || descendants.has(current)) continue;
    descendants.add(current);
    for (const child of adjacency.get(current) ?? []) queue.push(child);
  }
  return descendants;
}

export function projectCanvasBranchCollapse<
  TNode extends Node,
  TEdge extends Edge,
>(
  nodes: readonly TNode[],
  edges: readonly TEdge[],
  toggledNodeId?: string,
  persistedCollapsedNodeIds: Iterable<string> = [],
): { nodes: TNode[]; edges: TEdge[] } {
  const adjacency = adjacencyForEdges(edges);
  const collapsedIds = new Set(persistedCollapsedNodeIds);

  for (const node of nodes) {
    if (canvasBranchRuntimeState(node.data)?.collapsed)
      collapsedIds.add(node.id);
  }

  if (toggledNodeId && (adjacency.get(toggledNodeId)?.size ?? 0) > 0) {
    if (collapsedIds.has(toggledNodeId)) collapsedIds.delete(toggledNodeId);
    else collapsedIds.add(toggledNodeId);
  }

  const hiddenIds = new Set<string>();
  for (const rootId of collapsedIds) {
    for (const descendantId of descendantsOf(rootId, adjacency)) {
      if (descendantId !== rootId) hiddenIds.add(descendantId);
    }
  }

  const nextNodes = nodes.map((node) => {
    const previous = canvasBranchRuntimeState(node.data);
    const hiddenByBranch = hiddenIds.has(node.id);
    const directChildCount = adjacency.get(node.id)?.size ?? 0;
    const collapsed = directChildCount > 0 && collapsedIds.has(node.id);
    const externallyHidden = Boolean(node.hidden) && !previous?.hiddenByBranch;
    const data = { ...node.data } as RuntimeData;
    delete data[CANVAS_BRANCH_RUNTIME_KEY];
    if (directChildCount > 0 || hiddenByBranch) {
      data[CANVAS_BRANCH_RUNTIME_KEY] = {
        collapsed,
        directChildCount,
        hiddenByBranch,
      };
    }
    return {
      ...node,
      data,
      hidden: externallyHidden || hiddenByBranch,
    } as TNode;
  });

  const nextEdges = edges.map((edge) => {
    const previousData = (edge.data ?? {}) as RuntimeEdgeData;
    const previouslyHiddenByBranch =
      previousData[CANVAS_BRANCH_EDGE_RUNTIME_KEY] === true;
    const hiddenByBranch =
      hiddenIds.has(edge.source) || hiddenIds.has(edge.target);
    const externallyHidden = Boolean(edge.hidden) && !previouslyHiddenByBranch;
    const data = { ...previousData };
    delete data[CANVAS_BRANCH_EDGE_RUNTIME_KEY];
    if (hiddenByBranch) data[CANVAS_BRANCH_EDGE_RUNTIME_KEY] = true;
    return {
      ...edge,
      data,
      hidden: externallyHidden || hiddenByBranch,
    } as TEdge;
  });

  return { nodes: nextNodes, edges: nextEdges };
}
