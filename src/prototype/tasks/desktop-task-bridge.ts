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

function projectTask(
  state: DesktopPrototypeState,
  task: PrototypeTask,
): CanvasTaskProjection {
  return {
    id: task.id,
    title: task.title,
    completed: task.completedAt !== null,
    signal: task.signal,
    dueDate: task.dueDate ?? null,
    subtasks: task.subtasks.map((subtask) => ({
      id: subtask.id,
      title: subtask.title,
      completed: subtask.done,
    })),
    detailsOpen:
      state.contextPanel?.kind === "task" &&
      state.contextPanel.taskId === task.id,
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
  return { status: "resolved", task: projectTask(state, task) };
}

export function createDesktopTaskBridge(
  options: DesktopTaskBridgeOptions,
): CanvasTaskBridge {
  return {
    resolveTask: (workspaceId, taskId) =>
      resolveDesktopTask(options.getState(), workspaceId, taskId),
    searchTasks: (workspaceId, query) => {
      const normalizedQuery = query.trim().toLocaleLowerCase("ru");
      const state = options.getState();
      return state.tasks
        .filter(
          (task) =>
            task.projectId === workspaceId &&
            (normalizedQuery.length === 0 ||
              task.title.toLocaleLowerCase("ru").includes(normalizedQuery)),
        )
        .map((task) => projectTask(state, task));
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
    toggleSubtaskCompleted: (workspaceId, taskId, subtaskId) => {
      const state = options.getState();
      const result = resolveDesktopTask(state, workspaceId, taskId);
      const task = state.tasks.find((item) => item.id === taskId);
      if (
        result.status !== "resolved" ||
        !task?.subtasks.some((subtask) => subtask.id === subtaskId)
      ) {
        return;
      }
      options.dispatch({ type: "toggle-subtask", taskId, subtaskId });
    },
    openTask: (taskId) => {
      const state = options.getState();
      if (!state.tasks.some((task) => task.id === taskId)) return;
      options.dispatch({
        type:
          state.activeSection === "canvases"
            ? "open-canvas-task-details"
            : "open-task-detail-view",
        taskId,
      });
    },
    closeTaskDetails: (taskId) => {
      const state = options.getState();
      if (
        state.contextPanel?.kind === "task" &&
        state.contextPanel.taskId === taskId
      ) {
        options.dispatch({ type: "close-context-panel" });
      } else if (state.taskDetailViewTaskId === taskId) {
        options.dispatch({ type: "close-task-detail-view" });
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
