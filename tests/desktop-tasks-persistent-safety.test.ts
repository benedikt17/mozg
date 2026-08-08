import { describe, expect, it } from "vitest";

import {
  desktopPrototypeReducer,
  initialDesktopPrototypeState,
} from "@/prototype/desktop-state";
import type { DesktopPrototypeState } from "@/prototype/state/types";
import { getLinkedTaskIdsForDocument } from "@/prototype/state/selectors";
import { expectPersistentStateValid } from "./helpers/persistent-state-invariant";

function freshState(): DesktopPrototypeState {
  return structuredClone(initialDesktopPrototypeState);
}

function reduceAndAssert(
  state: DesktopPrototypeState,
  action: Parameters<typeof desktopPrototypeReducer>[1],
): DesktopPrototypeState {
  const nextState = desktopPrototypeReducer(state, action);
  expectPersistentStateValid(nextState);
  return nextState;
}

describe("Tasks persistent safety", () => {
  it("deletes an empty user group while keeping the persisted state valid", () => {
    const state = reduceAndAssert(freshState(), {
      type: "create-task-group",
      title: "Empty group",
    });
    const deleted = reduceAndAssert(state, {
      type: "delete-task-group",
      groupId: "mock-task-group-1",
    });

    expect(deleted.taskGroups).not.toContainEqual(
      expect.objectContaining({ id: "mock-task-group-1" }),
    );
  });

  it("rejects deleting a non-empty user group without changing persisted state", () => {
    let state = reduceAndAssert(freshState(), {
      type: "create-task-group",
      title: "Non-empty group",
    });
    state = reduceAndAssert(state, {
      type: "create-task-list",
      groupId: "mock-task-group-1",
      title: "User list",
    });

    const rejected = desktopPrototypeReducer(state, {
      type: "delete-task-group",
      groupId: "mock-task-group-1",
    });
    expect(rejected).toBe(state);
    expectPersistentStateValid(rejected);
  });

  it("rejects deleting the system BAZA group while keeping the persisted state valid", () => {
    const state = freshState();
    const rejected = desktopPrototypeReducer(state, {
      type: "delete-task-group",
      groupId: "lukomorie-baza",
    });

    expect(rejected).toBe(state);
    expectPersistentStateValid(rejected);
  });

  it("derives Knowledge reverse references after deleting a Task", () => {
    const state = freshState();
    const documentBefore = state.documents.find(
      (document) => document.id === "doc-l-nastenka",
    );
    if (!documentBefore)
      throw new Error("Expected the linked Knowledge document");

    const deleted = reduceAndAssert(state, {
      type: "delete-task",
      taskId: "luko-characters-map",
    });

    expect(deleted.tasks).not.toContainEqual(
      expect.objectContaining({ id: "luko-characters-map" }),
    );
    expect(getLinkedTaskIdsForDocument(deleted, "doc-l-nastenka")).toEqual([]);
    expect(
      deleted.documents.find((document) => document.id === "doc-l-nastenka"),
    ).toMatchObject({
      content: documentBefore.content,
      backlinks: documentBefore.backlinks,
    });
  });

  it("rejects enabling Overview for a task in a user list", () => {
    let state = reduceAndAssert(freshState(), {
      type: "create-task-group",
      title: "Overview guard group",
    });
    state = reduceAndAssert(state, {
      type: "create-task-list",
      groupId: "mock-task-group-1",
      title: "Overview guard list",
    });
    state = reduceAndAssert(state, {
      type: "move-task-to-list",
      taskId: "luko-first-scene",
      targetListId: "mock-task-list-1",
      targetTaskId: null,
    });

    const rejected = desktopPrototypeReducer(state, {
      type: "set-task-overview",
      taskId: "luko-first-scene",
      visible: true,
    });

    expect(rejected).toBe(state);
    expect(
      rejected.tasks.find((task) => task.id === "luko-first-scene"),
    ).toMatchObject({
      listId: "mock-task-list-1",
      overviewDirectionId: "",
      showOnOverview: false,
    });
    expectPersistentStateValid(rejected);
  });
});
