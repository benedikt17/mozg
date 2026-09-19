export type CanvasScalableNode = {
  id: string;
  position: { x: number; y: number };
  width: number;
  height: number;
};

export type CanvasGroupBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function canvasGroupBounds(
  nodes: readonly CanvasScalableNode[],
): CanvasGroupBounds | null {
  if (nodes.length < 2) return null;
  const left = Math.min(...nodes.map((node) => node.position.x));
  const top = Math.min(...nodes.map((node) => node.position.y));
  const right = Math.max(...nodes.map((node) => node.position.x + node.width));
  const bottom = Math.max(
    ...nodes.map((node) => node.position.y + node.height),
  );
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Scales positions and bounds around an anchor. A single factor deliberately
 * preserves image aspect ratios and the relative geometry of the group.
 */
export function scaleCanvasGroup(
  nodes: readonly CanvasScalableNode[],
  anchor: { x: number; y: number },
  scale: number,
): CanvasScalableNode[] {
  const safeScale = Math.min(4, Math.max(0.15, scale));
  return nodes.map((node) => ({
    ...node,
    position: {
      x: anchor.x + (node.position.x - anchor.x) * safeScale,
      y: anchor.y + (node.position.y - anchor.y) * safeScale,
    },
    width: Math.max(1, node.width * safeScale),
    height: Math.max(1, node.height * safeScale),
  }));
}
