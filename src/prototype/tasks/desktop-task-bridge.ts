import type {
  CanvasTaskBridge,
  CanvasTaskProjection,
  CanvasTaskResolveResult,
} from "@/lib/canvas/canvas-task-bridge";
import type { PrototypeTask } from "@/prototype/desktop-mock-data";
import type {
  DesktopPrototypeAction,
  DesktopPrototypeState,
} from "@/prototype/state/types";

export type DesktopTaskBridgeOptions = {
  getState: () => DesktopPrototypeState;
  dispatch: React.Dispatch<DesktopPrototypeAction>;
  onStateChange: (listener: () => void) => () => void;
};

function projectTask(task: PrototypeTask): CanvasTaskProjection {
  return {
    id: task.id,
    title: task.title,
    completed: task.completedAt !== null,
    signal: task.signal,
    dueDate: task.dueDate ?? null,
  };
}

export function resolveDesktopTask(
  state: DesktopPrototypeState,
  workspaceId: string,
  taskId: string,
): CanvasTaskResolveResult {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return { status: "missing" };
  if (task.projectId !== workspaceId) return { status: "workspace-mismatch" };
  return { status: "resolved", task: projectTask(task) };
}

export function createDesktopTaskBridge(
  options: DesktopTaskBridgeOptions,
): CanvasTaskBridge {
  return {
    resolveTask: (workspaceId, taskId) =>
      resolveDesktopTask(options.getState(), workspaceId, taskId),
    searchTasks: (workspaceId, query) => {
      const normalizedQuery = query.trim().toLocaleLowerCase("ru");
      return options
        .getState()
        .tasks.filter(
          (task) =>
            task.projectId === workspaceId &&
            (normalizedQuery.length === 0 ||
              task.title.toLocaleLowerCase("ru").includes(normalizedQuery)),
        )
        .map(projectTask);
    },
    toggleTaskCompleted: (workspaceId, taskId) => {
      if (
        resolveDesktopTask(options.getState(), workspaceId, taskId).status !==
        "resolved"
      ) {
        return;
      }
      options.dispatch({ type: "toggle-task-completed", taskId });
    },
    openTask: (taskId) => {
      if (options.getState().tasks.some((task) => task.id === taskId)) {
        options.dispatch({ type: "select-task", taskId, section: "tasks" });
      }
    },
    subscribeToTask: (workspaceId, taskId, listener) => {
      const emit = (): void => {
        const result = resolveDesktopTask(
          options.getState(),
          workspaceId,
          taskId,
        );
        listener(result.status === "resolved" ? result.task : null);
      };
      emit();
      return options.onStateChange(emit);
    },
  };
}
