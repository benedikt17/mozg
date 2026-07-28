"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createDesktopDomainSnapshot } from "@/prototype/persistence/domain-snapshot";
import {
  DesktopPersistenceRuntime,
  type DesktopPersistenceLifecycle,
} from "@/prototype/persistence/desktop-persistence-runtime";
import { IndexedDbDesktopPersistenceAdapter } from "@/prototype/persistence/indexeddb-adapter";
import type {
  DesktopPrototypeAction,
  DesktopPrototypeState,
} from "@/prototype/state/types";

export type UseDesktopPersistenceResult = {
  lifecycle: DesktopPersistenceLifecycle;
  retryLoad: () => void;
  retrySave: () => void;
};

export function useDesktopPersistence(
  state: DesktopPrototypeState,
  dispatch: React.Dispatch<DesktopPrototypeAction>,
): UseDesktopPersistenceResult {
  const snapshot = useMemo(() => createDesktopDomainSnapshot(state), [state]);
  const initialSnapshot = useRef(snapshot);
  const runtime = useRef<DesktopPersistenceRuntime | null>(null);
  const [lifecycle, setLifecycle] = useState<DesktopPersistenceLifecycle>({
    status: "loading",
  });

  useEffect(() => {
    let active = true;
    const adapter = new IndexedDbDesktopPersistenceAdapter();
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
  }, [dispatch]);

  useEffect(() => {
    runtime.current?.observeSnapshot(snapshot);
  }, [snapshot]);

  const retryLoad = useCallback(() => {
    void runtime.current?.retryLoad();
  }, []);
  const retrySave = useCallback(() => {
    void runtime.current?.retrySave();
  }, []);

  return { lifecycle, retryLoad, retrySave };
}
