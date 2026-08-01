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
    expect(canvasShell).toContain("taskBridge?: CanvasTaskBridge");
    expect(runtime).toContain("desktopPrototypeReducer");
    expect(runtime).toContain("useDesktopPersistence(state, dispatch");
    expect(runtime).toContain("stateChangeListeners.clear");
    expect(canvasComposition).not.toContain("initialDesktopPrototypeState");
    expect(canvasComposition).not.toContain("useReducer");
    expect(canvasComposition).not.toContain("useDesktopPersistence");
    expect(canvasShell).not.toContain("PrototypeTask");
  });
});
