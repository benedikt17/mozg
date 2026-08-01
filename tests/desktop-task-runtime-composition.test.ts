import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CanvasTaskBridge } from "@/lib/canvas/canvas-task-bridge";
import {
  DesktopTaskRuntimeProvider,
  useDesktopTaskRuntime,
} from "@/prototype/tasks/desktop-task-runtime";
import { getCanvasTaskBridgeProps } from "@/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell-page";
import { initialDesktopPrototypeState } from "@/prototype/desktop-state";

function source(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function RuntimeProbe(): React.JSX.Element {
  const runtime = useDesktopTaskRuntime();
  const task = runtime.state.tasks[0]!;
  const resolution = runtime.taskBridge.resolveTask(task.projectId, task.id);
  const resolutionStatus =
    resolution instanceof Promise ? "pending" : resolution.status;
  return createElement(
    "output",
    {
      "data-task-id": task.id,
      "data-resolved": resolutionStatus,
      "data-persistence-status": runtime.persistence.lifecycle.status,
      "data-workspace-available": String(runtime.workspaceAvailable),
    },
    task.title,
  );
}

describe("desktop task runtime composition", () => {
  it("exposes the canonical desktop state and bridge from one provider", () => {
    const markup = renderToStaticMarkup(
      createElement(
        DesktopTaskRuntimeProvider,
        { runtimeMode: "local" },
        createElement(RuntimeProbe),
      ),
    );
    const task = initialDesktopPrototypeState.tasks[0]!.id;
    expect(markup).toContain(`data-task-id="${task}"`);
    expect(markup).toContain('data-resolved="resolved"');
    expect(markup).toContain('data-persistence-status="loading"');
    expect(markup).toContain('data-workspace-available="false"');
  });

  it("withholds the Canvas bridge until workspace hydration is ready", () => {
    const bridge = {} as CanvasTaskBridge;
    expect(
      getCanvasTaskBridgeProps({
        taskBridge: bridge,
        taskWorkspaceId: "project-a",
        workspaceAvailable: false,
      }),
    ).toEqual({ taskBridge: undefined, taskWorkspaceId: undefined });
    expect(
      getCanvasTaskBridgeProps({
        taskBridge: bridge,
        taskWorkspaceId: "project-a",
        workspaceAvailable: true,
      }),
    ).toEqual({ taskBridge: bridge, taskWorkspaceId: "project-a" });
  });

  it("keeps both route compositions on the provider and existing persistence hook", () => {
    const desktopShell = source("src/prototype/desktop-shell.tsx");
    const desktopRoute = source("src/app/prototype/desktop/page.tsx");
    const canvasRoute = source(
      "src/app/prototype/infinite-canvas-local-shell/page.tsx",
    );
    const canvasComposition = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell-page.tsx",
    );
    const canvasShell = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
    );
    const canvasAdapter = source("src/lib/canvas/react-flow-canvas-adapter.ts");
    const canvasController = source(
      "src/lib/canvas/local-canvas-shell-controller.ts",
    );
    const runtime = source("src/prototype/tasks/desktop-task-runtime.tsx");

    expect(desktopRoute).toContain("DesktopPrototypeShell");
    expect(desktopShell).toMatch(
      /<DesktopTaskRuntimeProvider[\s\S]*<DesktopPrototypeShellContent/u,
    );
    expect(desktopShell).toContain(
      "<SectionWorkspace state={state} dispatch={dispatch} />",
    );
    expect(canvasRoute).toContain("InfiniteCanvasLocalShellComposition");
    expect(canvasComposition).toMatch(
      /<DesktopTaskRuntimeProvider[\s\S]*<InfiniteCanvasLocalShellComposition \/>/u,
    );
    expect(canvasComposition).toContain("getCanvasTaskBridgeProps");
    expect(canvasComposition).toContain("activeTaskDetailsTaskId");
    expect(canvasComposition).toContain('"section-workspace"');
    expect(canvasComposition).toContain('"section-tasks"');
    expect(canvasComposition).toContain("main-workspace");
    expect(canvasComposition).toContain("canvasMainWorkspace");
    expect(canvasComposition).toMatch(
      /canvasMainWorkspace[\s\S]*<InfiniteCanvasLocalShell[\s\S]*ContextPanelSlot/u,
    );
    expect(canvasShell).toContain("taskBridge?: CanvasTaskBridge");
    expect(canvasShell).toContain("CANVAS_TASK_NODE_TYPE");
    expect(canvasShell).toContain("function TaskNodeBody");
    expect(canvasShell).toContain("subscribeToTask");
    expect(canvasShell).toContain("toggleTaskCompleted");
    expect(canvasShell).toContain("shouldCloseCanvasTaskDetails");
    expect(canvasShell).toContain("taskBridge.closeTaskDetails");
    expect(canvasShell).not.toContain("useReducer");
    expect(canvasComposition).toContain("ContextPanelSlot");
    expect(canvasAdapter).toContain('kind: "task"');
    expect(canvasAdapter).toContain("runtime.type === CANVAS_TASK_NODE_TYPE");
    expect(canvasController).toContain("insertTaskNode");
    expect(runtime).toContain("desktopPrototypeReducer");
    expect(runtime).toContain("useDesktopPersistence(state, dispatch");
    expect(runtime).toContain("stateChangeListeners.clear");
    expect(canvasComposition).not.toContain("initialDesktopPrototypeState");
    expect(canvasComposition).not.toContain("useReducer");
    expect(canvasComposition).not.toContain("useDesktopPersistence");
    expect(canvasShell).not.toContain("PrototypeTask");
    expect(canvasShell).not.toContain("initialDesktopPrototypeState");
    expect(canvasShell).not.toContain("completed:");
    expect(canvasShell).not.toContain("isDetailsOpen");
    expect(canvasShell).not.toContain("isActive");
  });

  it("keeps the Canvas in the desktop workspace beside the task panel", () => {
    const composition = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell-page.tsx",
    );
    const contextPanelSlot = source(
      "src/prototype/context-panels/context-panel-slot.tsx",
    );
    const canvasShell = source(
      "src/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.tsx",
    );

    expect(composition.match(/<ContextPanelSlot/g)).toHaveLength(1);
    expect(composition).not.toContain("TaskDetailsPanel");
    expect(composition).not.toContain("ReactFlow");
    expect(contextPanelSlot).toContain("<TaskDetailsPanel");
    expect(contextPanelSlot).toContain('type: "close-context-panel"');
    expect(composition).toContain('state.contextPanel?.kind === "task"');
    expect(composition).toContain("desktop-prototype");
    expect(composition).toContain("canvasDesktopHost");
    expect(composition).toContain("canvasSectionWorkspace");
    expect(composition).toContain('"has-context-panel"');
    expect(composition).toContain('"has-full-height-drawer"');
    expect(composition).not.toContain("taskDetailsLayer");
    expect(composition).not.toContain("taskDetailsHost");
    expect(canvasShell).toContain("<ReactFlow");
    expect(canvasShell).toContain("onNodesChange={handleNodesChange}");
    expect(canvasShell).toContain("onMoveEnd={onMoveEnd}");
  });
});
