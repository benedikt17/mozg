export const MOBILE_SIDEBAR_EDGE_START_PX = 28;
export const MOBILE_SIDEBAR_SWIPE_DISTANCE_PX = 56;
export const MOBILE_SIDEBAR_MAX_WIDTH_PX = 340;
export const MOBILE_SIDEBAR_WIDTH_RATIO = 0.88;

export type MobileSidebarSwipeDirection = "open" | "close";

export type MobileSidebarSwipeInput = {
  drawerOpen: boolean;
  endX: number;
  endY: number;
  startedInsideDrawer: boolean;
  startX: number;
  startY: number;
  viewportWidth: number;
};

export function classifyMobileSidebarSwipe(
  input: MobileSidebarSwipeInput,
): MobileSidebarSwipeDirection | null {
  const deltaX = input.endX - input.startX;
  const deltaY = input.endY - input.startY;
  const horizontalDistance = Math.abs(deltaX);
  const verticalDistance = Math.abs(deltaY);

  if (horizontalDistance < MOBILE_SIDEBAR_SWIPE_DISTANCE_PX) return null;
  if (horizontalDistance <= verticalDistance * 1.2) return null;

  if (!input.drawerOpen) {
    return input.startX <= MOBILE_SIDEBAR_EDGE_START_PX && deltaX > 0
      ? "open"
      : null;
  }

  const drawerWidth = Math.min(
    input.viewportWidth * MOBILE_SIDEBAR_WIDTH_RATIO,
    MOBILE_SIDEBAR_MAX_WIDTH_PX,
  );
  return input.startedInsideDrawer &&
    input.startX <= drawerWidth + 12 &&
    deltaX < 0
    ? "close"
    : null;
}
