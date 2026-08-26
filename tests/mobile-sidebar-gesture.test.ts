import { describe, expect, it } from "vitest";
import {
  classifyMobileSidebarSwipe,
  MOBILE_SIDEBAR_EDGE_MAX_START_PX,
  MOBILE_SIDEBAR_EDGE_MIN_START_PX,
} from "@/prototype/shell/mobile-sidebar-gesture";

const base = {
  drawerOpen: false,
  endX: 110,
  endY: 102,
  startedInsideDrawer: false,
  startX: 32,
  startY: 100,
  viewportWidth: 390,
};

describe("mobile sidebar swipe", () => {
  it("opens on a deliberate swipe from the safe left-side gesture zone", () => {
    expect(classifyMobileSidebarSwipe(base)).toBe("open");
  });

  it("opens from the physical left edge and keeps a bounded start zone", () => {
    expect(MOBILE_SIDEBAR_EDGE_MIN_START_PX).toBe(0);
    expect(MOBILE_SIDEBAR_EDGE_MAX_START_PX).toBeGreaterThanOrEqual(64);
    expect(
      classifyMobileSidebarSwipe({
        ...base,
        startX: 0,
        endX: 84,
      }),
    ).toBe("open");
    expect(
      classifyMobileSidebarSwipe({
        ...base,
        startX: 40,
        endX: 120,
      }),
    ).toBe("open");
    expect(
      classifyMobileSidebarSwipe({
        ...base,
        startX: 96,
        endX: 180,
      }),
    ).toBeNull();
  });

  it("ignores short and mostly vertical gestures", () => {
    expect(
      classifyMobileSidebarSwipe({ ...base, endX: 70, endY: 104 }),
    ).toBeNull();
    expect(
      classifyMobileSidebarSwipe({ ...base, endX: 94, endY: 190 }),
    ).toBeNull();
  });

  it("closes on a deliberate right-to-left swipe started inside the drawer", () => {
    expect(
      classifyMobileSidebarSwipe({
        ...base,
        drawerOpen: true,
        startedInsideDrawer: true,
        startX: 250,
        endX: 150,
      }),
    ).toBe("close");
  });

  it("does not close from a gesture that starts outside the drawer", () => {
    expect(
      classifyMobileSidebarSwipe({
        ...base,
        drawerOpen: true,
        startedInsideDrawer: false,
        startX: 380,
        endX: 270,
      }),
    ).toBeNull();
  });
});
