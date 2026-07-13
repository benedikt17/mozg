import { describe, expect, it } from "vitest";
import { getOverviewInsertionIndex } from "@/prototype/desktop-overview-dnd";

describe("Overview insertion geometry", () => {
  it("resolves beginning, middle, end and empty-direction positions", () => {
    expect(
      getOverviewInsertionIndex({
        targetCount: 3,
        overIndex: 0,
        geometry: {
          activeTop: 0,
          activeHeight: 20,
          overTop: 20,
          overHeight: 20,
        },
      }),
    ).toBe(0);

    expect(
      getOverviewInsertionIndex({
        targetCount: 3,
        overIndex: 1,
        geometry: {
          activeTop: 50,
          activeHeight: 20,
          overTop: 40,
          overHeight: 20,
        },
      }),
    ).toBe(2);

    expect(
      getOverviewInsertionIndex({
        targetCount: 3,
        overIndex: 2,
        geometry: {
          activeTop: 90,
          activeHeight: 20,
          overTop: 70,
          overHeight: 20,
        },
      }),
    ).toBe(3);

    expect(
      getOverviewInsertionIndex({
        targetCount: 0,
        overIndex: null,
        geometry: null,
      }),
    ).toBe(0);
  });
});
