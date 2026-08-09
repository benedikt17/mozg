import { describe, expect, it } from "vitest";

import {
  desktopPrototypeReducer,
  initialDesktopPrototypeState,
} from "@/prototype/desktop-state";
import { desktopRuntimeReducer } from "@/prototype/state/desktop-runtime-reducer";
import { expectPersistentStateValid } from "./helpers/persistent-state-invariant";

describe("Desktop runtime reducer persistence boundary", () => {
  it("accepts a valid precomputed Knowledge structural state", () => {
    const initial = structuredClone(initialDesktopPrototypeState);
    const nextState = desktopPrototypeReducer(initial, {
      type: "create-knowledge-folder",
    });

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

  it("rejects a structural history replay that would violate V3 integrity", () => {
    const initial = structuredClone(initialDesktopPrototypeState);
    const sourceDocument = initial.documents[0];
    if (!sourceDocument) throw new Error("Expected fixture document");

    const committed = desktopRuntimeReducer(initial, {
      type: "apply-knowledge-structural-history",
      direction: "redo",
      entry: {
        id: "invalid-history-entry",
        kind: "create-document",
        label: "Invalid history replay",
        previousSelectedDocumentId: null,
        wasOpened: false,
        document: {
          ...sourceDocument,
          id: "invalid-history-document",
          projectId: "missing-project",
        },
      },
    });

    expect(committed).toBe(initial);
    expectPersistentStateValid(committed);
  });
});
