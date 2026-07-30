import { describe, expect, it } from "vitest";
import {
  createDesktopDomainSnapshot,
  parseDesktopDomainSnapshot,
} from "@/prototype/persistence/domain-snapshot";
import {
  desktopPrototypeReducer,
  initialDesktopPrototypeState,
} from "@/prototype/desktop-state";
import { createTaskTitleEditLifecycle } from "@/prototype/context-panels/task-title-edit-lifecycle";

const taskId = "luko-characters-map";

function commitLifecycleTitle(
  state: typeof initialDesktopPrototypeState,
  lifecycle: ReturnType<typeof createTaskTitleEditLifecycle>,
  title?: string,
) {
  const transition = lifecycle.commit(title);
  if (!transition) throw new Error("Expected an active title edit.");
  return desktopPrototypeReducer(state, {
    type: "commit-task-title-edit",
    taskId: transition.taskId,
    title: transition.title,
  });
}

describe("expanded task title lifecycle", () => {
  it("begins editing the requested task", () => {
    const state = desktopPrototypeReducer(initialDesktopPrototypeState, {
      type: "begin-task-title-edit",
      taskId,
    });

    expect(state.editingTaskTitleId).toBe(taskId);
  });

  it("commits the latest draft and clears editing state", () => {
    let state = desktopPrototypeReducer(initialDesktopPrototypeState, {
      type: "begin-task-title-edit",
      taskId,
    });
    const lifecycle = createTaskTitleEditLifecycle();
    lifecycle.begin(taskId, "original");
    lifecycle.update("  Accepted title  ");

    state = commitLifecycleTitle(state, lifecycle);

    expect(state.editingTaskTitleId).toBeNull();
    expect(state.tasks.find((task) => task.id === taskId)?.title).toBe(
      "Accepted title",
    );
  });

  it("closes an unchanged edit without replacing the task record", () => {
    const state = desktopPrototypeReducer(initialDesktopPrototypeState, {
      type: "begin-task-title-edit",
      taskId,
    });
    const taskBefore = state.tasks.find((task) => task.id === taskId);
    const lifecycle = createTaskTitleEditLifecycle();
    lifecycle.begin(taskId, taskBefore?.title ?? "");

    const nextState = commitLifecycleTitle(state, lifecycle);

    expect(nextState.editingTaskTitleId).toBeNull();
    expect(nextState.tasks).toBe(state.tasks);
  });

  it("does not erase the title for a whitespace-only draft", () => {
    let state = desktopPrototypeReducer(initialDesktopPrototypeState, {
      type: "begin-task-title-edit",
      taskId,
    });
    const originalTitle = state.tasks.find((task) => task.id === taskId)?.title;
    const lifecycle = createTaskTitleEditLifecycle();
    lifecycle.begin(taskId, originalTitle ?? "");
    lifecycle.update("   ");

    state = commitLifecycleTitle(state, lifecycle);

    expect(state.editingTaskTitleId).toBeNull();
    expect(state.tasks.find((task) => task.id === taskId)?.title).toBe(
      originalTitle,
    );
  });

  it("makes Escape idempotent and prevents a later blur commit", () => {
    let state = desktopPrototypeReducer(initialDesktopPrototypeState, {
      type: "begin-task-title-edit",
      taskId,
    });
    const originalTitle = state.tasks.find((task) => task.id === taskId)?.title;
    const lifecycle = createTaskTitleEditLifecycle();
    lifecycle.begin(taskId, originalTitle ?? "");
    lifecycle.update("Cancelled title");

    const cancel = lifecycle.cancel();
    expect(cancel).toEqual({ taskId, originalTitle });
    state = desktopPrototypeReducer(state, { type: "cancel-task-title-edit" });
    expect(lifecycle.cancel()).toBeNull();
    expect(lifecycle.commit()).toBeNull();
    expect(state.tasks.find((task) => task.id === taskId)?.title).toBe(
      originalTitle,
    );
  });

  it("allows only one commit across Enter, blur and internal-control transitions", () => {
    const lifecycle = createTaskTitleEditLifecycle();
    lifecycle.begin(taskId, "original");
    lifecycle.update("Committed once");

    expect(lifecycle.commit()).toEqual({
      taskId,
      title: "Committed once",
    });
    expect(lifecycle.commit("A second title")).toBeNull();
  });

  it("commits before selection or collapse can leave the expanded task", () => {
    let state = desktopPrototypeReducer(initialDesktopPrototypeState, {
      type: "begin-task-title-edit",
      taskId,
    });
    state = desktopPrototypeReducer(state, {
      type: "toggle-overview-task-expanded",
      taskId,
    });
    const lifecycle = createTaskTitleEditLifecycle();
    lifecycle.begin(taskId, "original");
    lifecycle.update("Accepted before leaving");

    state = commitLifecycleTitle(state, lifecycle);
    state = desktopPrototypeReducer(state, {
      type: "switch-section",
      section: "tasks",
    });

    expect(state.tasks.find((task) => task.id === taskId)?.title).toBe(
      "Accepted before leaving",
    );
  });

  it("retains the committed title through snapshot serialization and hydration", () => {
    let state = desktopPrototypeReducer(initialDesktopPrototypeState, {
      type: "begin-task-title-edit",
      taskId,
    });
    const lifecycle = createTaskTitleEditLifecycle();
    lifecycle.begin(taskId, "original");
    lifecycle.update("Hydrated title");
    state = commitLifecycleTitle(state, lifecycle);

    const parsed = parseDesktopDomainSnapshot(
      createDesktopDomainSnapshot(state),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const hydrated = desktopPrototypeReducer(initialDesktopPrototypeState, {
      type: "hydrate-domain",
      snapshot: parsed.snapshot,
    });

    expect(hydrated.tasks.find((task) => task.id === taskId)?.title).toBe(
      "Hydrated title",
    );
  });

  it("leaves the direct edit-task-title path unchanged", () => {
    const state = desktopPrototypeReducer(initialDesktopPrototypeState, {
      type: "edit-task-title",
      taskId,
      title: "Direct editor title",
    });

    expect(state.editingTaskTitleId).toBeNull();
    expect(state.tasks.find((task) => task.id === taskId)?.title).toBe(
      "Direct editor title",
    );
  });
});
