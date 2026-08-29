"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import type { DesktopRuntimeMode } from "@/lib/desktop-runtime-mode";
import type { PrototypeDocument } from "@/prototype/desktop-mock-data";
import type { DesktopCloudBootstrap } from "@/prototype/persistence/cloud-snapshot-bridge";
import {
  desktopPrototypeReducer,
  initialDesktopPrototypeState,
} from "@/prototype/desktop-state";
import { desktopRuntimeReducer } from "@/prototype/state/desktop-runtime-reducer";
import { getActiveProjectDocumentsForProject } from "@/prototype/state/knowledge-state";
import {
  useDesktopPersistence,
  type UseDesktopPersistenceResult,
} from "@/prototype/persistence/use-desktop-persistence";
import type {
  DesktopPrototypeAction,
  DesktopPrototypeState,
} from "@/prototype/state/types";
import {
  createDesktopTaskBridge,
  type DesktopTaskBridgeOptions,
} from "@/prototype/tasks/desktop-task-bridge";
import type { CanvasTaskBridge } from "@/lib/canvas/canvas-task-bridge";

type DesktopTaskRuntimeContextValue = {
  state: DesktopPrototypeState;
  dispatch: React.Dispatch<DesktopPrototypeAction>;
  persistence: UseDesktopPersistenceResult;
  workspaceAvailable: boolean;
  workspaceId?: string;
};

type DesktopCanvasTaskRuntimeContextValue = {
  knowledgeArticles: readonly PrototypeDocument[];
  taskBridge: CanvasTaskBridge;
  taskProjectId: string;
};

const DesktopTaskRuntimeContext = createContext<
  DesktopTaskRuntimeContextValue | undefined
>(undefined);
const DesktopCanvasTaskRuntimeContext = createContext<
  DesktopCanvasTaskRuntimeContextValue | undefined
>(undefined);

class TaskBridgeListenerRegistry {
  private readonly listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(): void {
    for (const listener of this.listeners) listener();
  }

  clear(): void {
    this.listeners.clear();
  }
}

function openTaskContextId(state: DesktopPrototypeState): string | null {
  return state.contextPanel?.kind === "task" ? state.contextPanel.taskId : null;
}

export function taskBridgeSubscriptionsChanged(
  previous: DesktopPrototypeState,
  next: DesktopPrototypeState,
): boolean {
  return (
    previous.tasks !== next.tasks ||
    openTaskContextId(previous) !== openTaskContextId(next)
  );
}

class TaskBridgeStateSource {
  private state: DesktopPrototypeState;

  constructor(initialState: DesktopPrototypeState) {
    this.state = initialState;
  }

  getState = (): DesktopPrototypeState => this.state;

  update(state: DesktopPrototypeState): boolean {
    const previous = this.state;
    this.state = state;
    return taskBridgeSubscriptionsChanged(previous, state);
  }
}

function initializeDesktopPrototypeState(
  snapshot: DesktopCloudBootstrap["snapshot"] | undefined,
): DesktopPrototypeState {
  if (!snapshot) return initialDesktopPrototypeState;
  return desktopPrototypeReducer(initialDesktopPrototypeState, {
    type: "hydrate-domain",
    snapshot,
  });
}

export function DesktopTaskRuntimeProvider({
  children,
  cloudBootstrap,
  runtimeMode,
}: {
  children?: ReactNode;
  cloudBootstrap?: DesktopCloudBootstrap;
  runtimeMode: DesktopRuntimeMode;
}): React.JSX.Element {
  const [state, dispatch] = useReducer(
    desktopRuntimeReducer,
    cloudBootstrap?.snapshot,
    initializeDesktopPrototypeState,
  );
  const persistence = useDesktopPersistence(state, dispatch, {
    enabled: true,
    cloudBootstrap,
    runtimeMode,
  });
  const [taskBridgeStateSource] = useState(
    () => new TaskBridgeStateSource(state),
  );
  const [stateChangeListeners] = useState(
    () => new TaskBridgeListenerRegistry(),
  );
  const taskBridge = useMemo<CanvasTaskBridge>(
    () =>
      createDesktopTaskBridge({
        getState: taskBridgeStateSource.getState,
        dispatch,
        onStateChange: (listener: () => void) =>
          stateChangeListeners.subscribe(listener),
      } satisfies DesktopTaskBridgeOptions),
    [dispatch, stateChangeListeners, taskBridgeStateSource],
  );

  useEffect(() => {
    const subscriptionsChanged = taskBridgeStateSource.update(state);
    if (subscriptionsChanged) stateChangeListeners.notify();
  }, [state, stateChangeListeners, taskBridgeStateSource]);

  useEffect(() => () => stateChangeListeners.clear(), [stateChangeListeners]);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      persistence,
      workspaceAvailable:
        persistence.lifecycle.status !== "loading" &&
        persistence.lifecycle.status !== "load-error",
      workspaceId: cloudBootstrap?.workspaceId,
    }),
    [cloudBootstrap, dispatch, persistence, state],
  );
  const canvasTaskRuntimeValue = useMemo(
    () => ({
      knowledgeArticles: getActiveProjectDocumentsForProject(
        state.documents,
        state.activeProjectId,
      ),
      taskBridge,
      taskProjectId: state.activeProjectId,
    }),
    [state.activeProjectId, state.documents, taskBridge],
  );

  return (
    <DesktopTaskRuntimeContext.Provider value={value}>
      <DesktopCanvasTaskRuntimeContext.Provider value={canvasTaskRuntimeValue}>
        {children}
      </DesktopCanvasTaskRuntimeContext.Provider>
    </DesktopTaskRuntimeContext.Provider>
  );
}

export function useDesktopTaskRuntime(): DesktopTaskRuntimeContextValue {
  const value = useContext(DesktopTaskRuntimeContext);
  if (!value) {
    throw new Error(
      "useDesktopTaskRuntime must be used within DesktopTaskRuntimeProvider.",
    );
  }
  return value;
}

export function useDesktopCanvasTaskRuntime(): DesktopCanvasTaskRuntimeContextValue {
  const value = useContext(DesktopCanvasTaskRuntimeContext);
  if (!value) {
    throw new Error(
      "useDesktopCanvasTaskRuntime must be used within DesktopTaskRuntimeProvider.",
    );
  }
  return value;
}
