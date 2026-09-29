export type CanvasImageViewportBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type PositionedImage = {
  position: { x: number; y: number };
  size: { width: number; height: number };
};

/** Start visible downloads first while preserving document order for ties. */
export function imageLoadOrder<T extends PositionedImage>(
  images: readonly T[],
  viewport?: CanvasImageViewportBounds,
): number[] {
  const indices = images.map((_, index) => index);
  if (!viewport || viewport.width <= 0 || viewport.height <= 0) return indices;
  const centerX = viewport.x + viewport.width / 2;
  const centerY = viewport.y + viewport.height / 2;
  const rank = (image: T) => {
    const left = image.position.x;
    const top = image.position.y;
    const right = left + image.size.width;
    const bottom = top + image.size.height;
    const visible =
      right >= viewport.x &&
      left <= viewport.x + viewport.width &&
      bottom >= viewport.y &&
      top <= viewport.y + viewport.height;
    const dx = Math.max(left - centerX, 0, centerX - right);
    const dy = Math.max(top - centerY, 0, centerY - bottom);
    return { visible, distance: dx * dx + dy * dy };
  };
  const ranks = images.map(rank);
  return indices.sort((left, right) => {
    const a = ranks[left]!;
    const b = ranks[right]!;
    if (a.visible !== b.visible) return a.visible ? -1 : 1;
    return a.distance - b.distance || left - right;
  });
}
