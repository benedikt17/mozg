import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { initialDesktopPrototypeState } from "@/prototype/desktop-state";
import { taskBridgeSubscriptionsChanged } from "@/prototype/tasks/desktop-task-runtime";

describe("Desktop Canvas task runtime boundary", () => {
  it("keeps the task bridge identity independent from Desktop state snapshots", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/prototype/tasks/desktop-task-runtime.tsx"),
      "utf8",
    );

    expect(source).toContain("getState: taskBridgeStateSource.getState");
    expect(source).toContain(
      "[dispatch, stateChangeListeners, taskBridgeStateSource]",
    );
    expect(source).not.toContain("[dispatch, state, stateChangeListeners]");
    expect(source).toContain("taskBridgeStateSource.update(state)");
  });

  it("notifies Canvas task subscriptions only for task projections or task-details changes", () => {
    const state = initialDesktopPrototypeState;
    const taskId = state.tasks[0]!.id;

    expect(
      taskBridgeSubscriptionsChanged(state, {
        ...state,
        projectRailCollapsed: !state.projectRailCollapsed,
      }),
    ).toBe(false);
    expect(
      taskBridgeSubscriptionsChanged(state, {
        ...state,
        knowledgeSearchQuery: "unrelated UI state",
      }),
    ).toBe(false);
    expect(
      taskBridgeSubscriptionsChanged(state, {
        ...state,
        tasks: [...state.tasks],
      }),
    ).toBe(true);
    expect(
      taskBridgeSubscriptionsChanged(state, {
        ...state,
        contextPanel: { kind: "task", taskId },
      }),
    ).toBe(true);
  });

  it("gives Cloud Canvas a narrow task runtime context instead of the full Desktop state context", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/prototype/canvases/cloud-canvas-workspace.tsx"),
      "utf8",
    );

    expect(source).toContain("useDesktopCanvasTaskRuntime");
    expect(source).not.toContain("useDesktopTaskRuntime();");
  });
});
