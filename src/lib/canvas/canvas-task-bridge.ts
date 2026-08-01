export type CanvasTaskProjection = {
  id: string;
  title: string;
  completed: boolean;
  signal: "none" | "green" | "yellow" | "red";
  dueDate?: string | null;
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

  openTask(taskId: string): void;

  subscribeToTask(
    workspaceId: string,
    taskId: string,
    listener: (task: CanvasTaskProjection | null) => void,
  ): () => void;
};
