import { describe, expect, it } from "vitest";
import { classifyMobileSidebarSwipe } from "@/prototype/shell/mobile-sidebar-gesture";

const base = {
  drawerOpen: false,
  endX: 90,
  endY: 102,
  startedInsideDrawer: false,
  startX: 8,
  startY: 100,
  viewportWidth: 390,
};

describe("mobile sidebar swipe", () => {
  it("opens on a deliberate left-edge swipe to the right", () => {
    expect(classifyMobileSidebarSwipe(base)).toBe("open");
  });

  it("does not steal horizontal gestures that begin away from the left edge", () => {
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
      classifyMobileSidebarSwipe({ ...base, endX: 45, endY: 104 }),
    ).toBeNull();
    expect(
      classifyMobileSidebarSwipe({ ...base, endX: 70, endY: 190 }),
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
