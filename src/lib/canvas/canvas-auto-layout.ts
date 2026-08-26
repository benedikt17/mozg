import type { Edge, Node, XYPosition } from "@xyflow/react";

const HORIZONTAL_GAP = 180;
const VERTICAL_GAP = 80;
const COMPONENT_GAP = 180;
const ISOLATED_COLUMNS = 4;
const FALLBACK_WIDTH = 220;
const FALLBACK_HEIGHT = 100;

type NodeMetrics = {
  width: number;
  height: number;
};

function numericStyleValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nodeMetrics(node: Node): NodeMetrics {
  const style = node.style ?? {};
  return {
    width:
      node.measured?.width ??
      node.width ??
      numericStyleValue(style.width) ??
      FALLBACK_WIDTH,
    height:
      node.measured?.height ??
      node.height ??
      numericStyleValue(style.height) ??
      FALLBACK_HEIGHT,
  };
}

function sortByCurrentPosition<TNode extends Node>(
  nodes: readonly TNode[],
): TNode[] {
  return [...nodes].sort(
    (left, right) =>
      left.position.y - right.position.y ||
      left.position.x - right.position.x ||
      left.id.localeCompare(right.id),
  );
}

function weakComponents<TNode extends Node, TEdge extends Edge>(
  nodes: readonly TNode[],
  edges: readonly TEdge[],
): string[][] {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const adjacency = new Map<string, Set<string>>();
  for (const id of nodeIds) adjacency.set(id, new Set());
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }

  const visited = new Set<string>();
  const components: string[][] = [];
  for (const node of sortByCurrentPosition(nodes)) {
    if (visited.has(node.id)) continue;
    const component: string[] = [];
    const queue = [node.id];
    visited.add(node.id);
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      component.push(current);
      for (const neighbor of adjacency.get(current) ?? []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
    components.push(component);
  }
  return components;
}

function stronglyConnectedComponents(
  nodeIds: readonly string[],
  adjacency: ReadonlyMap<string, ReadonlySet<string>>,
): string[][] {
  let index = 0;
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const result: string[][] = [];

  const visit = (nodeId: string): void => {
    indices.set(nodeId, index);
    lowLinks.set(nodeId, index);
    index += 1;
    stack.push(nodeId);
    onStack.add(nodeId);

    for (const target of adjacency.get(nodeId) ?? []) {
      if (!indices.has(target)) {
        visit(target);
        lowLinks.set(
          nodeId,
          Math.min(lowLinks.get(nodeId) ?? 0, lowLinks.get(target) ?? 0),
        );
      } else if (onStack.has(target)) {
        lowLinks.set(
          nodeId,
          Math.min(lowLinks.get(nodeId) ?? 0, indices.get(target) ?? 0),
        );
      }
    }

    if (lowLinks.get(nodeId) !== indices.get(nodeId)) return;
    const component: string[] = [];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) break;
      onStack.delete(current);
      component.push(current);
      if (current === nodeId) break;
    }
    result.push(component);
  };

  for (const nodeId of nodeIds) {
    if (!indices.has(nodeId)) visit(nodeId);
  }
  return result;
}

function componentLayout<TNode extends Node, TEdge extends Edge>(
  nodes: readonly TNode[],
  edges: readonly TEdge[],
): { positions: Map<string, XYPosition>; height: number; width: number } {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const nodeIds = new Set(nodeById.keys());
  const directed = new Map<string, Set<string>>();
  for (const id of nodeIds) directed.set(id, new Set());
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    if (edge.source === edge.target) continue;
    directed.get(edge.source)?.add(edge.target);
  }

  const stronglyConnected = stronglyConnectedComponents([...nodeIds], directed);
  const componentByNode = new Map<string, number>();
  stronglyConnected.forEach((component, componentIndex) => {
    for (const nodeId of component) componentByNode.set(nodeId, componentIndex);
  });

  const condensed = stronglyConnected.map(() => new Set<number>());
  const indegree = stronglyConnected.map(() => 0);
  for (const [source, targets] of directed) {
    const sourceComponent = componentByNode.get(source);
    if (sourceComponent === undefined) continue;
    for (const target of targets) {
      const targetComponent = componentByNode.get(target);
      if (
        targetComponent === undefined ||
        targetComponent === sourceComponent ||
        condensed[sourceComponent].has(targetComponent)
      )
        continue;
      condensed[sourceComponent].add(targetComponent);
      indegree[targetComponent] += 1;
    }
  }

  const ranks = stronglyConnected.map(() => 0);
  const queue = indegree
    .map((value, componentIndex) => ({ value, componentIndex }))
    .filter(({ value }) => value === 0)
    .map(({ componentIndex }) => componentIndex);
  while (queue.length > 0) {
    const source = queue.shift();
    if (source === undefined) continue;
    for (const target of condensed[source]) {
      ranks[target] = Math.max(ranks[target], ranks[source] + 1);
      indegree[target] -= 1;
      if (indegree[target] === 0) queue.push(target);
    }
  }

  const nodesByRank = new Map<number, TNode[]>();
  stronglyConnected.forEach((component, componentIndex) => {
    const rank = ranks[componentIndex];
    const rankNodes = nodesByRank.get(rank) ?? [];
    for (const nodeId of component) {
      const node = nodeById.get(nodeId);
      if (node) rankNodes.push(node);
    }
    nodesByRank.set(rank, rankNodes);
  });
  for (const [rank, rankNodes] of nodesByRank) {
    nodesByRank.set(rank, sortByCurrentPosition(rankNodes));
  }

  const maxRank = Math.max(0, ...nodesByRank.keys());
  const rankWidths: number[] = [];
  const rankHeights: number[] = [];
  for (let rank = 0; rank <= maxRank; rank += 1) {
    const rankNodes = nodesByRank.get(rank) ?? [];
    rankWidths[rank] = Math.max(
      0,
      ...rankNodes.map((node) => nodeMetrics(node).width),
    );
    rankHeights[rank] = rankNodes.reduce(
      (total, node, nodeIndex) =>
        total + nodeMetrics(node).height + (nodeIndex === 0 ? 0 : VERTICAL_GAP),
      0,
    );
  }

  const totalHeight = Math.max(0, ...rankHeights);
  const positions = new Map<string, XYPosition>();
  let x = 0;
  for (let rank = 0; rank <= maxRank; rank += 1) {
    const rankNodes = nodesByRank.get(rank) ?? [];
    let y = (totalHeight - rankHeights[rank]) / 2;
    for (const node of rankNodes) {
      positions.set(node.id, { x, y });
      y += nodeMetrics(node).height + VERTICAL_GAP;
    }
    x += rankWidths[rank] + HORIZONTAL_GAP;
  }

  return {
    positions,
    height: totalHeight,
    width: Math.max(0, x - HORIZONTAL_GAP),
  };
}

export function autoLayoutCanvasNodes<TNode extends Node, TEdge extends Edge>(
  nodes: readonly TNode[],
  edges: readonly TEdge[],
): Map<string, XYPosition> {
  const result = new Map<string, XYPosition>();
  if (nodes.length === 0) return result;

  const minimumX = Math.min(...nodes.map((node) => node.position.x));
  const minimumY = Math.min(...nodes.map((node) => node.position.y));
  const edgeNodeIds = new Set<string>();
  for (const edge of edges) {
    edgeNodeIds.add(edge.source);
    edgeNodeIds.add(edge.target);
  }

  const components = weakComponents(nodes, edges);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const connectedComponents = components.filter(
    (component) => component.length > 1 || edgeNodeIds.has(component[0]),
  );
  const isolatedNodes = sortByCurrentPosition(
    components
      .filter(
        (component) => component.length === 1 && !edgeNodeIds.has(component[0]),
      )
      .flatMap((component) => {
        const node = nodeById.get(component[0]);
        return node ? [node] : [];
      }),
  );

  let yOffset = minimumY;
  for (const componentIds of connectedComponents) {
    const componentIdSet = new Set(componentIds);
    const componentNodes = componentIds.flatMap((nodeId) => {
      const node = nodeById.get(nodeId);
      return node ? [node] : [];
    });
    const componentEdges = edges.filter(
      (edge) =>
        componentIdSet.has(edge.source) && componentIdSet.has(edge.target),
    );
    const layout = componentLayout(componentNodes, componentEdges);
    for (const [nodeId, position] of layout.positions) {
      result.set(nodeId, {
        x: minimumX + position.x,
        y: yOffset + position.y,
      });
    }
    yOffset += layout.height + COMPONENT_GAP;
  }

  if (isolatedNodes.length > 0) {
    const cellWidth =
      Math.max(...isolatedNodes.map((node) => nodeMetrics(node).width)) +
      HORIZONTAL_GAP;
    const cellHeight =
      Math.max(...isolatedNodes.map((node) => nodeMetrics(node).height)) +
      VERTICAL_GAP;
    isolatedNodes.forEach((node, index) => {
      const column = index % ISOLATED_COLUMNS;
      const row = Math.floor(index / ISOLATED_COLUMNS);
      result.set(node.id, {
        x: minimumX + column * cellWidth,
        y: yOffset + row * cellHeight,
      });
    });
  }

  return result;
}
