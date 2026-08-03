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
import type { DesktopCloudBootstrap } from "@/prototype/persistence/cloud-snapshot-bridge";
import {
  desktopPrototypeReducer,
  initialDesktopPrototypeState,
} from "@/prototype/desktop-state";
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
  taskBridge: CanvasTaskBridge;
  taskWorkspaceId: string;
  workspaceId?: string;
};

const DesktopTaskRuntimeContext = createContext<
  DesktopTaskRuntimeContextValue | undefined
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
    desktopPrototypeReducer,
    cloudBootstrap?.snapshot,
    initializeDesktopPrototypeState,
  );
  const persistence = useDesktopPersistence(state, dispatch, {
    enabled: true,
    cloudBootstrap,
    runtimeMode,
  });
  const [stateChangeListeners] = useState(
    () => new TaskBridgeListenerRegistry(),
  );
  const taskBridge = useMemo<CanvasTaskBridge>(
    () =>
      createDesktopTaskBridge({
        getState: () => state,
        dispatch,
        onStateChange: (listener: () => void) =>
          stateChangeListeners.subscribe(listener),
      } satisfies DesktopTaskBridgeOptions),
    [dispatch, state, stateChangeListeners],
  );

  useEffect(() => {
    stateChangeListeners.notify();
  }, [state, stateChangeListeners]);

  useEffect(() => () => stateChangeListeners.clear(), [stateChangeListeners]);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      persistence,
      workspaceAvailable:
        persistence.lifecycle.status !== "loading" &&
        persistence.lifecycle.status !== "load-error",
      taskBridge,
      taskWorkspaceId: state.activeProjectId,
      workspaceId: cloudBootstrap?.workspaceId,
    }),
    [cloudBootstrap, dispatch, persistence, state, taskBridge],
  );

  return (
    <DesktopTaskRuntimeContext.Provider value={value}>
      {children}
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
