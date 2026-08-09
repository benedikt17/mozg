import { describe, expect, it } from "vitest";

import { initialDesktopPrototypeState } from "@/prototype/desktop-state";
import { desktopRuntimeReducer } from "@/prototype/state/desktop-runtime-reducer";
import { expectPersistentStateValid } from "./helpers/persistent-state-invariant";

describe("Desktop runtime reducer persistence boundary", () => {
  it("accepts a valid precomputed Knowledge structural state", () => {
    const initial = structuredClone(initialDesktopPrototypeState);
    const nextState = {
      ...initial,
      knowledgeSearchQuery: "runtime guard smoke",
    };

    const committed = desktopRuntimeReducer(initial, {
      type: "commit-knowledge-structural-transition",
      nextState,
    });

    expect(committed).toBe(nextState);
    expectPersistentStateValid(committed);
  });

  it("rejects an invalid precomputed Knowledge structural state", () => {
    const initial = structuredClone(initialDesktopPrototypeState);
    const invalidState = {
      ...initial,
      tasks: initial.tasks.map((task, index) =>
        index === 0 ? { ...task, listId: "missing-list" } : task,
      ),
    };

    const committed = desktopRuntimeReducer(initial, {
      type: "commit-knowledge-structural-transition",
      nextState: invalidState,
    });

    expect(committed).toBe(initial);
    expectPersistentStateValid(committed);
  });
});
