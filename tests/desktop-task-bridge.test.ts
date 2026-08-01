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
  it("projects only the stable task summary for the owning project", async () => {
    const harness = createHarness();
    const task = harness.getState().tasks[0]!;
    const bridge = createDesktopTaskBridge({
      getState: harness.getState,
      dispatch: harness.dispatch,
      onStateChange: harness.onStateChange,
    });

    expect(await bridge.resolveTask(task.projectId, task.id)).toEqual({
      status: "resolved",
      task: {
        id: task.id,
        title: task.title,
        completed: false,
        signal: task.signal,
        dueDate: task.dueDate ?? null,
      },
    });
    expect(await bridge.resolveTask("another-project", task.id)).toEqual({
      status: "workspace-mismatch",
    });
    expect(await bridge.resolveTask(task.projectId, "missing-task")).toEqual({
      status: "missing",
    });
  });

  it("searches and toggles tasks through the existing reducer contract", async () => {
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
    expect(harness.getState().tasks[0]!.completedAt).not.toBeNull();
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

  it("does not leak task references across project workspace switches", async () => {
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

    expect(await bridge.resolveTask(firstTask.projectId, otherTask.id)).toEqual(
      {
        status: "workspace-mismatch",
      },
    );
    harness.dispatch({
      type: "switch-project",
      projectId: otherTask.projectId,
    });
    expect(await bridge.resolveTask(otherTask.projectId, otherTask.id)).toEqual(
      expect.objectContaining({ status: "resolved" }),
    );
    expect(await bridge.searchTasks(firstTask.projectId, "")).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: firstTask.id })]),
    );
    expect(
      (await bridge.searchTasks(firstTask.projectId, "")).some(
        (task) => task.id === otherTask.id,
      ),
    ).toBe(false);
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
});
