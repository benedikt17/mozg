"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createDesktopDomainSnapshot } from "@/prototype/persistence/domain-snapshot";
import {
  DesktopPersistenceRuntime,
  type DesktopPersistenceLifecycle,
} from "@/prototype/persistence/desktop-persistence-runtime";
import { IndexedDbDesktopPersistenceAdapter } from "@/prototype/persistence/indexeddb-adapter";
import { CloudDesktopPersistenceAdapter } from "@/prototype/persistence/cloud-persistence-adapter";
import type { DesktopCloudBootstrap } from "@/prototype/persistence/cloud-snapshot-bridge";
import type { DesktopRuntimeMode } from "@/lib/desktop-runtime-mode";
import type { DesktopPersistenceAdapter } from "@/prototype/persistence/persistence-adapter";
import type {
  DesktopPrototypeAction,
  DesktopPrototypeState,
} from "@/prototype/state/types";

export type UseDesktopPersistenceResult = {
  lifecycle: DesktopPersistenceLifecycle;
  retryLoad: () => void;
  retrySave: () => void;
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
  dispatch: React.Dispatch<DesktopPrototypeAction>,
  options: {
    enabled?: boolean;
    cloudBootstrap?: DesktopCloudBootstrap;
    runtimeMode: DesktopRuntimeMode;
  },
): UseDesktopPersistenceResult {
  const enabled = options.enabled ?? true;
  const cloudBootstrap = options.cloudBootstrap;
  const runtimeMode = options.runtimeMode;
  const snapshot = useMemo(() => createDesktopDomainSnapshot(state), [state]);
  const initialSnapshot = useRef(snapshot);
  const runtime = useRef<DesktopPersistenceRuntime | null>(null);
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
      onLifecycleChange: (nextLifecycle) => {
        if (active) setLifecycle(nextLifecycle);
      },
    });
    runtime.current = coordinator;
    void coordinator.start();

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
  }, [cloudBootstrap, dispatch, enabled, runtimeMode]);

  useEffect(() => {
    if (!enabled) return;
    runtime.current?.observeSnapshot(snapshot);
  }, [enabled, snapshot]);

  const retryLoad = useCallback(() => {
    if (!enabled) return;
    void runtime.current?.retryLoad();
  }, [enabled]);
  const retrySave = useCallback(() => {
    if (!enabled) return;
    void runtime.current?.retrySave();
  }, [enabled]);

  return { lifecycle, retryLoad, retrySave };
}
