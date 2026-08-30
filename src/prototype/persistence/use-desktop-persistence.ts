"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createDesktopDomainSnapshot } from "@/prototype/persistence/domain-snapshot";
import {
  DesktopPersistenceRuntime,
  type DesktopPersistenceLifecycle,
  type DesktopPersistenceRefreshResult,
} from "@/prototype/persistence/desktop-persistence-runtime";
import { IndexedDbDesktopPersistenceAdapter } from "@/prototype/persistence/indexeddb-adapter";
import { CloudDesktopPersistenceAdapter } from "@/prototype/persistence/cloud-persistence-adapter";
import {
  clearDesktopConflictDraft,
  readDesktopConflictDraft,
  saveDesktopConflictDraft,
} from "@/prototype/persistence/desktop-conflict-draft";
import type { DesktopCloudBootstrap } from "@/prototype/persistence/cloud-snapshot-bridge";
import type { DesktopRuntimeMode } from "@/lib/desktop-runtime-mode";
import type { DesktopPersistenceAdapter } from "@/prototype/persistence/persistence-adapter";
import type { DesktopRuntimeAction } from "@/prototype/state/desktop-runtime-reducer";
import type { DesktopPrototypeState } from "@/prototype/state/types";

export type UseDesktopPersistenceResult = {
  lifecycle: DesktopPersistenceLifecycle;
  refreshFromSource: () => Promise<DesktopPersistenceRefreshResult>;
  retryLoad: () => void;
  retrySave: () => void;
  keepLocalChanges: () => Promise<void>;
  discardLocalChanges: () => Promise<void>;
};

export function createDesktopPersistenceAdapter({
  cloudBootstrap,
  runtimeMode,
}: {
  cloudBootstrap?: DesktopCloudBootstrap;
  runtimeMode: DesktopRuntimeMode;
}): DesktopPersistenceAdapter {
  if (runtimeMode === "local") return new IndexedDbDesktopPersistenceAdapter();
  if (!cloudBootstrap) {
    throw new Error("Cloud desktop persistence requires a cloud bootstrap.");
  }
  return new CloudDesktopPersistenceAdapter(cloudBootstrap);
}

export function useDesktopPersistence(
  state: DesktopPrototypeState,
  dispatch: React.Dispatch<DesktopRuntimeAction>,
  options: {
    enabled?: boolean;
    cloudBootstrap?: DesktopCloudBootstrap;
    runtimeMode: DesktopRuntimeMode;
  },
): UseDesktopPersistenceResult {
  const enabled = options.enabled ?? true;
  const cloudBootstrap = options.cloudBootstrap;
  const runtimeMode = options.runtimeMode;
  const {
    documents,
    knowledgeFolders,
    overviewDirections,
    projects,
    taskGroups,
    taskLists,
    tasks,
  } = state;
  const snapshot = useMemo(
    () =>
      createDesktopDomainSnapshot({
        projects,
        overviewDirections,
        taskGroups,
        taskLists,
        tasks,
        knowledgeFolders,
        documents,
      }),
    [
      documents,
      knowledgeFolders,
      overviewDirections,
      projects,
      taskGroups,
      taskLists,
      tasks,
    ],
  );
  const initialSnapshot = useRef(snapshot);
  const runtime = useRef<DesktopPersistenceRuntime | null>(null);
  const conflictDraftScope = `${runtimeMode}:${cloudBootstrap?.workspaceId ?? "local"}`;
  const [lifecycle, setLifecycle] = useState<DesktopPersistenceLifecycle>(() =>
    enabled
      ? { status: "loading" }
      : {
          status: "ready",
          revision: cloudBootstrap?.revision ?? 0,
          savedAt: cloudBootstrap?.updatedAt ?? "cloud-read-only",
        },
  );

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const adapter = createDesktopPersistenceAdapter({
      cloudBootstrap,
      runtimeMode,
    });
    const coordinator = new DesktopPersistenceRuntime({
      adapter,
      initialSnapshot: initialSnapshot.current,
      onHydrate: (loadedSnapshot) => {
        if (active)
          dispatch({ type: "hydrate-domain", snapshot: loadedSnapshot });
      },
      onRefresh: (loadedSnapshot) => {
        if (active)
          dispatch({ type: "refresh-domain", snapshot: loadedSnapshot });
      },
      onLifecycleChange: (nextLifecycle) => {
        if (nextLifecycle.status === "conflict") {
          saveDesktopConflictDraft(
            conflictDraftScope,
            coordinator.getLocalSnapshot(),
          );
        }
        if (active) setLifecycle(nextLifecycle);
      },
    });
    runtime.current = coordinator;
    void coordinator.start().then(() => {
      if (!active) return;
      const draft = readDesktopConflictDraft(conflictDraftScope);
      if (draft) coordinator.restoreConflictDraft(draft);
    });

    const flushWhenHidden = (): void => {
      if (document.visibilityState === "hidden") void coordinator.flush();
    };
    const flushOnPageHide = (): void => {
      void coordinator.flush();
    };
    document.addEventListener("visibilitychange", flushWhenHidden);
    window.addEventListener("pagehide", flushOnPageHide);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", flushWhenHidden);
      window.removeEventListener("pagehide", flushOnPageHide);
      if (runtime.current === coordinator) runtime.current = null;
      coordinator.dispose();
    };
  }, [cloudBootstrap, conflictDraftScope, dispatch, enabled, runtimeMode]);

  useEffect(() => {
    if (!enabled) return;
    runtime.current?.observeSnapshot(snapshot);
  }, [enabled, snapshot]);

  const refreshFromSource = useCallback(() => {
    if (!enabled) {
      return Promise.resolve<DesktopPersistenceRefreshResult>("skipped");
    }
    return (
      runtime.current?.refreshFromSource() ??
      Promise.resolve<DesktopPersistenceRefreshResult>("skipped")
    );
  }, [enabled]);
  const retryLoad = useCallback(() => {
    if (!enabled) return;
    void runtime.current?.retryLoad();
  }, [enabled]);
  const retrySave = useCallback(() => {
    if (!enabled) return;
    void runtime.current?.retrySave();
  }, [enabled]);
  const keepLocalChanges = useCallback(async () => {
    if (!enabled) return;
    const coordinator = runtime.current;
    await coordinator?.keepLocalChanges();
    if (coordinator?.lifecycle.status === "ready") {
      clearDesktopConflictDraft(conflictDraftScope);
    }
  }, [conflictDraftScope, enabled]);
  const discardLocalChanges = useCallback(async () => {
    if (!enabled) return;
    const coordinator = runtime.current;
    await coordinator?.discardLocalChanges();
    if (coordinator?.lifecycle.status === "ready") {
      clearDesktopConflictDraft(conflictDraftScope);
    }
  }, [conflictDraftScope, enabled]);

  return {
    lifecycle,
    refreshFromSource,
    retryLoad,
    retrySave,
    keepLocalChanges,
    discardLocalChanges,
  };
}
