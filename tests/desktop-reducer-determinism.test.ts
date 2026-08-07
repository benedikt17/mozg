import { describe, expect, it } from "vitest";

import {
  desktopPrototypeReducer,
  initialDesktopPrototypeState,
} from "@/prototype/desktop-state";
import type { DesktopPrototypeState } from "@/prototype/state/types";
import { expectPersistentStateValid } from "./helpers/persistent-state-invariant";

function freshState(): DesktopPrototypeState {
  return structuredClone(initialDesktopPrototypeState);
}

describe("Desktop reducer determinism", () => {
  it("produces the same completed Task for the same explicit timestamp action", () => {
    const state = freshState();
    const action = {
      type: "toggle-task-completed" as const,
      taskId: "luko-first-scene",
      completedAt: "2026-08-08T00:00:00.000Z",
    };

    const first = desktopPrototypeReducer(state, action);
    const second = desktopPrototypeReducer(state, action);

    expect(first).toEqual(second);
    expect(first.tasks.find((task) => task.id === action.taskId)).toMatchObject(
      {
        completedAt: action.completedAt,
      },
    );
    expectPersistentStateValid(first);
  });

  it("produces the same soft-deleted Knowledge document for the same explicit timestamp action", () => {
    const state = freshState();
    const action = {
      type: "soft-delete-knowledge-document" as const,
      documentId: "doc-l-routes",
      deletedAt: "2026-08-08T00:00:00.000Z",
    };

    const first = desktopPrototypeReducer(state, action);
    const second = desktopPrototypeReducer(state, action);

    expect(first).toEqual(second);
    expect(
      first.documents.find((document) => document.id === action.documentId),
    ).toMatchObject({ deletedAt: action.deletedAt });
    expectPersistentStateValid(first);
  });
});
