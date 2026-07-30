export type TaskTitleEditCommit = {
  taskId: string;
  title: string;
};

export type TaskTitleEditCancel = {
  taskId: string;
  originalTitle: string;
};

export function createTaskTitleEditLifecycle() {
  let activeTaskId: string | null = null;
  let originalTitle = "";
  let latestTitle = "";

  return {
    get activeTaskId(): string | null {
      return activeTaskId;
    },
    begin(taskId: string, title: string): void {
      activeTaskId = taskId;
      originalTitle = title;
      latestTitle = title;
    },
    update(title: string): void {
      if (activeTaskId !== null) latestTitle = title;
    },
    commit(title?: string): TaskTitleEditCommit | null {
      if (activeTaskId === null) return null;
      const transition = {
        taskId: activeTaskId,
        title: title ?? latestTitle,
      };
      activeTaskId = null;
      originalTitle = "";
      latestTitle = "";
      return transition;
    },
    cancel(): TaskTitleEditCancel | null {
      if (activeTaskId === null) return null;
      const transition = {
        taskId: activeTaskId,
        originalTitle,
      };
      activeTaskId = null;
      originalTitle = "";
      latestTitle = "";
      return transition;
    },
  };
}
