import { describe, expect, it } from "vitest";
import { initialDesktopPrototypeState } from "@/prototype/desktop-state";
import { desktopPrototypeReducer } from "@/prototype/state/desktop-state";
import type {
  DesktopPrototypeAction,
  DesktopPrototypeState,
} from "@/prototype/state/types";
import { createDesktopTaskBridge } from "@/prototype/tasks/desktop-task-bridge";

function createHarness(): {
  getState: () => DesktopPrototypeState;
  dispatch: (action: DesktopPrototypeAction) => void;
  onStateChange: (listener: () => void) => () => void;
  subscribeCount: () => number;
} {
  let state = structuredClone(initialDesktopPrototypeState);
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    dispatch: (action) => {
      state = desktopPrototypeReducer(state, action);
      for (const listener of listeners) listener();
    },
    onStateChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    subscribeCount: () => listeners.size,
  };
}

describe("desktop task bridge", () => {
  it("projects stable task references independently of current project scope", async () => {
    const harness = createHarness();
    const task = harness.getState().tasks[0]!;
    const bridge = createDesktopTaskBridge({
      getState: harness.getState,
      dispatch: harness.dispatch,
      onStateChange: harness.onStateChange,
    });
    const expected = {
      status: "resolved" as const,
      task: {
        id: task.id,
        title: task.title,
        completed: false,
        signal: task.signal,
        dueDate: task.dueDate ?? null,
        subtasks: task.subtasks.map((subtask) => ({
          id: subtask.id,
          title: subtask.title,
          completed: subtask.done,
        })),
        detailsOpen: false,
      },
    };

    expect(await bridge.resolveTask(task.projectId, task.id)).toEqual(expected);
    expect(await bridge.resolveTask("another-project", task.id)).toEqual(expected);
    expect(await bridge.resolveTask(task.projectId, "missing-task")).toEqual({
      status: "missing",
    });
  });

  it("keeps picker search project-scoped while stable references remain mutable", async () => {
    const harness = createHarness();
    const task = harness.getState().tasks[0]!;
    const bridge = createDesktopTaskBridge({
      getState: harness.getState,
      dispatch: harness.dispatch,
      onStateChange: harness.onStateChange,
    });

    expect(await bridge.searchTasks(task.projectId, "мотиваций")).toEqual([
      expect.objectContaining({ id: task.id, title: task.title }),
    ]);
    expect(await bridge.searchTasks("another-project", "")).toEqual([]);

    bridge.toggleTaskCompleted(task.projectId, task.id);
    expect(harness.getState().tasks[0]!.completedAt).not.toBeNull();
    bridge.toggleTaskCompleted("another-project", task.id);
    expect(harness.getState().tasks[0]!.completedAt).toBeNull();
  });

  it("emits initial and subsequent task projection updates", () => {
    const harness = createHarness();
    const task = harness.getState().tasks[0]!;
    const bridge = createDesktopTaskBridge({
      getState: harness.getState,
      dispatch: harness.dispatch,
      onStateChange: harness.onStateChange,
    });
    const updates: Array<{ completed: boolean } | null> = [];

    const unsubscribe = bridge.subscribeToTask(
      task.projectId,
      task.id,
      (projection) =>
        updates.push(projection ? { completed: projection.completed } : null),
    );
    expect(updates).toEqual([{ completed: false }]);
    expect(harness.subscribeCount()).toBe(1);

    bridge.toggleTaskCompleted(task.projectId, task.id);
    expect(updates).toEqual([{ completed: false }, { completed: true }]);
    unsubscribe();
    expect(harness.subscribeCount()).toBe(0);
  });

  it("keeps persisted task cards live across active project switches", async () => {
    const harness = createHarness();
    const firstTask = harness.getState().tasks[0]!;
    const otherTask = harness
      .getState()
      .tasks.find((task) => task.projectId !== firstTask.projectId)!;
    const bridge = createDesktopTaskBridge({
      getState: harness.getState,
      dispatch: harness.dispatch,
      onStateChange: harness.onStateChange,
    });
    const updates: Array<string | null> = [];
    const unsubscribe = bridge.subscribeToTask(
      firstTask.projectId,
      firstTask.id,
      (projection) => updates.push(projection?.id ?? null),
    );

    expect(await bridge.resolveTask(otherTask.projectId, firstTask.id)).toEqual(
      expect.objectContaining({ status: "resolved" }),
    );
    harness.dispatch({
      type: "switch-project",
      projectId: otherTask.projectId,
    });
    expect(updates.at(-1)).toBe(firstTask.id);
    expect(await bridge.resolveTask(otherTask.projectId, firstTask.id)).toEqual(
      expect.objectContaining({ status: "resolved" }),
    );

    const firstProjectResults = await bridge.searchTasks(firstTask.projectId, "");
    const otherProjectResults = await bridge.searchTasks(otherTask.projectId, "");
    expect(firstProjectResults).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: firstTask.id })]),
    );
    expect(firstProjectResults.some((task) => task.id === otherTask.id)).toBe(
      false,
    );
    expect(otherProjectResults).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: otherTask.id })]),
    );
    expect(otherProjectResults.some((task) => task.id === firstTask.id)).toBe(
      false,
    );
    unsubscribe();
  });

  it("opens the existing task-details lifecycle", () => {
    const harness = createHarness();
    const task = harness.getState().tasks[0]!;
    const otherTask = harness
      .getState()
      .tasks.find((candidate) => candidate.id !== task.id)!;
    const bridge = createDesktopTaskBridge({
      getState: harness.getState,
      dispatch: harness.dispatch,
      onStateChange: harness.onStateChange,
    });

    bridge.openTask(task.id);

    expect(harness.getState().contextPanel).toEqual({
      kind: "task",
      taskId: task.id,
    });
    expect(harness.getState().taskDetailViewTaskId).toBe(task.id);

    bridge.openTask(otherTask.id);

    expect(harness.getState().contextPanel).toEqual({
      kind: "task",
      taskId: otherTask.id,
    });
    expect(harness.getState().taskDetailViewTaskId).toBe(otherTask.id);
  });

  it("opens Canvas task details without changing the top-level section", () => {
    const harness = createHarness();
    const task = harness.getState().tasks[0]!;
    const bridge = createDesktopTaskBridge({
      getState: harness.getState,
      dispatch: harness.dispatch,
      onStateChange: harness.onStateChange,
    });

    harness.dispatch({ type: "switch-section", section: "canvases" });
    bridge.openTask(task.id);

    expect(harness.getState().activeSection).toBe("canvases");
    expect(harness.getState().contextPanel).toEqual({
      kind: "task",
      taskId: task.id,
    });
    expect(harness.getState().taskDetailViewTaskId).toBeNull();
  });

  it("projects and mutates only the direct canonical subtasks", () => {
    const harness = createHarness();
    const task = harness.getState().tasks.find((item) => item.subtasks.length)!;
    const subtask = task.subtasks[0]!;
    const otherTask = harness
      .getState()
      .tasks.find((item) => item.projectId !== task.projectId)!;
    const bridge = createDesktopTaskBridge({
      getState: harness.getState,
      dispatch: harness.dispatch,
      onStateChange: harness.onStateChange,
    });

    const updates: Array<CanvasTaskProjectionLike | null> = [];
    const unsubscribe = bridge.subscribeToTask(
      task.projectId,
      task.id,
      (projection) => updates.push(projection),
    );

    expect(updates[0]?.subtasks).toEqual(
      task.subtasks.map((item) => ({
        id: item.id,
        title: item.title,
        completed: item.done,
      })),
    );
    bridge.toggleSubtaskCompleted(task.projectId, task.id, subtask.id);
    expect(
      harness
        .getState()
        .tasks.find((item) => item.id === task.id)
        ?.subtasks.find((item) => item.id === subtask.id)?.done,
    ).toBe(!subtask.done);
    expect(updates.at(-1)?.subtasks[0]?.completed).toBe(!subtask.done);

    bridge.toggleSubtaskCompleted(otherTask.projectId, task.id, subtask.id);
    expect(
      harness
        .getState()
        .tasks.find((item) => item.id === task.id)
        ?.subtasks.find((item) => item.id === subtask.id)?.done,
    ).toBe(subtask.done);
    unsubscribe();
  });

  it("updates subtask title, additions, and deletions through the live bridge", () => {
    const harness = createHarness();
    const task = harness.getState().tasks.find((item) => item.subtasks.length)!;
    const subtask = task.subtasks[0]!;
    const bridge = createDesktopTaskBridge({
      getState: harness.getState,
      dispatch: harness.dispatch,
      onStateChange: harness.onStateChange,
    });
    const updates: Array<CanvasTaskProjectionLike | null> = [];
    const unsubscribe = bridge.subscribeToTask(
      task.projectId,
      task.id,
      (projection) => updates.push(projection),
    );

    harness.dispatch({
      type: "rename-subtask",
      taskId: task.id,
      subtaskId: subtask.id,
      title: "Renamed directly",
    });
    expect(updates.at(-1)?.subtasks[0]?.title).toBe("Renamed directly");

    harness.dispatch({
      type: "add-subtask",
      taskId: task.id,
      title: "Added directly",
    });
    const added = updates
      .at(-1)
      ?.subtasks.find((item) => item.title === "Added directly");
    expect(added).toBeDefined();

    harness.dispatch({
      type: "delete-subtask",
      taskId: task.id,
      subtaskId: added!.id,
    });
    expect(updates.at(-1)?.subtasks.some((item) => item.id === added!.id)).toBe(
      false,
    );
    unsubscribe();
  });

  it("projects canonical details-open state and closes through the existing action", () => {
    const harness = createHarness();
    const task = harness.getState().tasks[0]!;
    const otherTask = harness
      .getState()
      .tasks.find((item) => item.id !== task.id)!;
    const bridge = createDesktopTaskBridge({
      getState: harness.getState,
      dispatch: harness.dispatch,
      onStateChange: harness.onStateChange,
    });
    const taskUpdates: Array<CanvasTaskProjectionLike | null> = [];
    const otherUpdates: Array<CanvasTaskProjectionLike | null> = [];
    const stopTask = bridge.subscribeToTask(
      task.projectId,
      task.id,
      (projection) => taskUpdates.push(projection),
    );
    const stopOther = bridge.subscribeToTask(
      otherTask.projectId,
      otherTask.id,
      (projection) => otherUpdates.push(projection),
    );

    expect(taskUpdates.at(-1)?.detailsOpen).toBe(false);
    bridge.openTask(task.id);
    expect(taskUpdates.at(-1)?.detailsOpen).toBe(true);
    bridge.closeTaskDetails(task.id);
    expect(taskUpdates.at(-1)?.detailsOpen).toBe(false);
    bridge.openTask(otherTask.id);
    expect(taskUpdates.at(-1)?.detailsOpen).toBe(false);
    expect(otherUpdates.at(-1)?.detailsOpen).toBe(true);
    harness.dispatch({ type: "close-context-panel" });
    expect(otherUpdates.at(-1)?.detailsOpen).toBe(false);
    stopTask();
    stopOther();
  });
});

type CanvasTaskProjectionLike = {
  subtasks: Array<{ id: string; title: string; completed: boolean }>;
  detailsOpen: boolean;
};
