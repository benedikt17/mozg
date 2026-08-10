import { describe, expect, it } from "vitest";
import { initialDesktopPrototypeState } from "@/prototype/desktop-state";
import { createDesktopDomainSnapshot } from "@/prototype/persistence/domain-snapshot";

describe("Desktop persistence runtime boundary", () => {
  it("produces the same V3 snapshot from only persisted state slices", () => {
    const state = initialDesktopPrototypeState;
    const {
      documents,
      knowledgeFolders,
      overviewDirections,
      projects,
      taskGroups,
      taskLists,
      tasks,
    } = state;

    const sliceSnapshot = createDesktopDomainSnapshot({
      projects,
      overviewDirections,
      taskGroups,
      taskLists,
      tasks,
      knowledgeFolders,
      documents,
    });

    expect(sliceSnapshot).toEqual(createDesktopDomainSnapshot(state));
    expect(sliceSnapshot.schemaVersion).toBe(3);
  });
});
