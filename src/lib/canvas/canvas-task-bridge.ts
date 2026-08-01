export type CanvasSubtaskProjection = {
  id: string;
  title: string;
  completed: boolean;
};

export type CanvasTaskProjection = {
  id: string;
  title: string;
  completed: boolean;
  signal: "none" | "green" | "yellow" | "red";
  dueDate?: string | null;
  subtasks: CanvasSubtaskProjection[];
  detailsOpen: boolean;
};

export type CanvasTaskResolveResult =
  | {
      status: "resolved";
      task: CanvasTaskProjection;
    }
  | {
      status: "missing" | "workspace-mismatch";
    };

export type CanvasTaskBridge = {
  resolveTask(
    workspaceId: string,
    taskId: string,
  ): CanvasTaskResolveResult | Promise<CanvasTaskResolveResult>;

  searchTasks(
    workspaceId: string,
    query: string,
  ): CanvasTaskProjection[] | Promise<CanvasTaskProjection[]>;

  toggleTaskCompleted(
    workspaceId: string,
    taskId: string,
  ): void | Promise<void>;

  toggleSubtaskCompleted(
    workspaceId: string,
    taskId: string,
    subtaskId: string,
  ): void | Promise<void>;

  openTask(taskId: string): void;

  closeTaskDetails(taskId: string): void;

  subscribeToTask(
    workspaceId: string,
    taskId: string,
    listener: (task: CanvasTaskProjection | null) => void,
  ): () => void;
};
