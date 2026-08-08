import { describe, expect, it } from "vitest";

import {
  desktopPrototypeReducer,
  initialDesktopPrototypeState,
} from "@/prototype/desktop-state";
import type {
  DesktopPrototypeAction,
  DesktopPrototypeState,
} from "@/prototype/state/types";
import { expectPersistentStateValid } from "./helpers/persistent-state-invariant";

function freshState(): DesktopPrototypeState {
  return structuredClone(initialDesktopPrototypeState);
}

function reduceAndAssert(
  state: DesktopPrototypeState,
  action: DesktopPrototypeAction,
): DesktopPrototypeState {
  const nextState = desktopPrototypeReducer(state, action);
  expectPersistentStateValid(nextState);
  return nextState;
}

describe("persistent Desktop state invariant", () => {
  it("validates the initial state through the production snapshot round-trip", () => {
    const snapshot = expectPersistentStateValid(freshState());

    expect(snapshot.schemaVersion).toBe(3);
  });

  it("reports parser diagnostics when the serialized state is invalid", () => {
    const invalidState = freshState();
    invalidState.tasks[0]!.listId = "missing-list";

    expect(() => expectPersistentStateValid(invalidState)).toThrowError(
      /Persistent Desktop state invariant violated[\s\S]*tasks\[0\]\.listId \[missing-list\]/,
    );
  });

  it("keeps task creation valid after persistence serialization and parsing", () => {
    const nextState = reduceAndAssert(freshState(), {
      type: "create-task",
      title: "Persistent invariant task",
    });

    expect(nextState.tasks[0]).toMatchObject({
      title: "Persistent invariant task",
      projectId: "lukomorie",
    });
  });

  it("keeps task title and user list renames valid", () => {
    let state = reduceAndAssert(freshState(), {
      type: "edit-task-title",
      taskId: "luko-first-scene",
      title: "Renamed persistent task",
    });
    state = reduceAndAssert(state, {
      type: "create-task-group",
      title: "Persistent invariant group",
    });
    state = reduceAndAssert(state, {
      type: "create-task-list",
      groupId: "mock-task-group-1",
      title: "Persistent invariant list",
    });
    state = reduceAndAssert(state, {
      type: "rename-task-list",
      listId: "mock-task-list-1",
      title: "Renamed persistent list",
    });

    expect(
      state.tasks.find((task) => task.id === "luko-first-scene"),
    ).toMatchObject({
      title: "Renamed persistent task",
    });
    expect(
      state.taskLists.find((list) => list.id === "mock-task-list-1"),
    ).toMatchObject({ title: "Renamed persistent list" });
  });

  it("keeps moving a task between valid lists valid", () => {
    let state = reduceAndAssert(freshState(), {
      type: "create-task-group",
      title: "Move target group",
    });
    state = reduceAndAssert(state, {
      type: "create-task-list",
      groupId: "mock-task-group-1",
      title: "Move target list",
    });
    state = reduceAndAssert(state, {
      type: "move-task-to-list",
      taskId: "luko-first-scene",
      targetListId: "mock-task-list-1",
      targetTaskId: null,
    });

    expect(
      state.tasks.find((task) => task.id === "luko-first-scene")?.listId,
    ).toBe("mock-task-list-1");
  });

  it("keeps Knowledge Markdown updates valid", () => {
    const nextState = reduceAndAssert(freshState(), {
      type: "update-knowledge-document-markdown",
      documentId: "doc-l-nastenka",
      markdown: "# Persisted Knowledge update\n\nUpdated through the reducer.",
    });

    expect(
      nextState.documents.find((document) => document.id === "doc-l-nastenka")
        ?.content,
    ).toEqual([
      "# Persisted Knowledge update",
      "",
      "Updated through the reducer.",
    ]);
  });

  it("keeps Knowledge soft-delete and restore valid", () => {
    let state = reduceAndAssert(freshState(), {
      type: "soft-delete-knowledge-document",
      documentId: "doc-l-routes",
      deletedAt: "2026-08-08T00:00:00.000Z",
    });
    expect(
      state.documents.find((document) => document.id === "doc-l-routes")
        ?.deletedAt,
    ).toEqual(expect.any(String));

    state = reduceAndAssert(state, {
      type: "restore-knowledge-document",
      documentId: "doc-l-routes",
    });

    expect(
      state.documents.find((document) => document.id === "doc-l-routes"),
    ).not.toHaveProperty("deletedAt");
  });
});
