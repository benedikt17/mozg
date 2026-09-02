"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createCloudCanvasAssetRepository } from "@/lib/canvas/cloud-canvas-asset-repository";
import { createCloudCanvasRepository } from "@/lib/canvas/cloud-canvas-repository";
import { createProjectScopedCloudCanvasRepository } from "@/lib/canvas/project-scoped-cloud-canvas-repository";
import { CloudCanvasShellRepository } from "@/lib/canvas/cloud-canvas-shell-adapter";
import { CloudCanvasRuntimeCache } from "@/lib/canvas/cloud-canvas-runtime-cache";
import { createProjectFileBackedCanvasShellRepository } from "@/lib/canvas/project-file-backed-canvas-shell-repository";
import { getPublicEnv } from "@/lib/env";
import { SupabaseProjectFileRepository } from "@/lib/files/cloud-project-file-repository";
import { SupabaseProjectFileImageVariantRepository } from "@/lib/files/cloud-project-file-image-variant-repository";
import { projectFileResumableUploadEndpoint } from "@/lib/files/project-file-resumable-upload";
import { createClient } from "@/lib/supabase/browser";
import type { CanvasTaskBridge } from "@/lib/canvas/canvas-task-bridge";
import {
  resolveCanvasPaneSelection,
  type CanvasPaneId,
} from "@/lib/canvas/canvas-dual-pane";
import {
  InfiniteCanvasLocalShell,
  type CanvasShellCopy,
} from "@/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell";
import { useDesktopCanvasTaskRuntime } from "@/prototype/tasks/desktop-task-runtime";
import type { PrototypeDocument } from "@/prototype/desktop-mock-data";
import styles from "@/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell.module.css";

const PROJECT_RUNTIME_CACHE_LIMIT = 8;
const projectRuntimeCaches = new Map<string, CloudCanvasRuntimeCache>();

type CloudCanvasDualPaneRuntimeState = {
  activePane: CanvasPaneId;
  primaryCanvasId: string | null;
  secondaryCanvasId: string | null;
  splitViewActive: boolean;
  userId: string;
};

const PROJECT_DUAL_PANE_RUNTIME_LIMIT = 8;
const projectDualPaneRuntimeStates = new Map<
  string,
  CloudCanvasDualPaneRuntimeState
>();

function projectDualPaneRuntimeKey(
  workspaceId: string,
  projectId: string,
): string {
  return `${workspaceId}:${projectId}`;
}

function getProjectDualPaneRuntimeState(
  workspaceId: string,
  projectId: string,
  userId: string,
): CloudCanvasDualPaneRuntimeState | null {
  const key = projectDualPaneRuntimeKey(workspaceId, projectId);
  const state = projectDualPaneRuntimeStates.get(key);
  if (!state || state.userId !== userId) return null;
  projectDualPaneRuntimeStates.delete(key);
  projectDualPaneRuntimeStates.set(key, state);
  return state;
}

function setProjectDualPaneRuntimeState(
  workspaceId: string,
  projectId: string,
  state: CloudCanvasDualPaneRuntimeState,
): void {
  const key = projectDualPaneRuntimeKey(workspaceId, projectId);
  projectDualPaneRuntimeStates.delete(key);
  projectDualPaneRuntimeStates.set(key, state);
  while (projectDualPaneRuntimeStates.size > PROJECT_DUAL_PANE_RUNTIME_LIMIT) {
    const oldest = projectDualPaneRuntimeStates.entries().next().value as
      [string, CloudCanvasDualPaneRuntimeState] | undefined;
    if (!oldest) return;
    projectDualPaneRuntimeStates.delete(oldest[0]);
  }
}

function projectRuntimeCache(
  workspaceId: string,
  projectId: string,
  pane: CanvasPaneId,
): CloudCanvasRuntimeCache {
  const key = `${workspaceId}:${projectId}:${pane}`;
  const existing = projectRuntimeCaches.get(key);
  if (existing) {
    projectRuntimeCaches.delete(key);
    projectRuntimeCaches.set(key, existing);
    return existing;
  }
  const created = new CloudCanvasRuntimeCache();
  projectRuntimeCaches.set(key, created);
  while (projectRuntimeCaches.size > PROJECT_RUNTIME_CACHE_LIMIT) {
    const oldest = projectRuntimeCaches.entries().next().value as
      [string, CloudCanvasRuntimeCache] | undefined;
    if (!oldest) break;
    projectRuntimeCaches.delete(oldest[0]);
    oldest[1].clearAllExcept(null);
  }
  return created;
}

function clearProjectRuntimeCachesExcept(userId: string | null): void {
  for (const cache of projectRuntimeCaches.values()) {
    cache.clearAllExcept(userId);
  }
  for (const [key, state] of projectDualPaneRuntimeStates) {
    if (userId && state.userId === userId) continue;
    projectDualPaneRuntimeStates.delete(key);
  }
}

const cloudCanvasShellCopy: CanvasShellCopy = {
  eyebrow: "Холсты",
  defaultTitle: "Новый холст",
  emptyTitle: "Создайте первый холст",
  emptyDescription:
    "Документ, изображения и ваш viewport сохраняются внутри текущего проекта.",
  create: "Создать холст",
  rename: "Переименовать",
  newCanvas: "Новый",
  delete: "Удалить",
  addImage: "Добавить изображение",
  text: "Текст",
  saved: "Сохранено",
  saving: "Сохраняется…",
  conflict: "Конфликт",
  loading: "Загрузка",
  error: "Ошибка",
  reloadWinner: "Загрузить актуальную версию",
  keepLocalChanges: "Сохранить мои изменения",
  restoreLocalDraft: "Вернуть мою локальную копию",
  isolated: "Проект",
  status: "Облачное сохранение · V2",
};

export function CloudCanvasWorkspace({
  activeTaskDetailsTaskId,
  workspaceId,
}: {
  activeTaskDetailsTaskId?: string;
  workspaceId: string;
}): React.JSX.Element {
  const {
    knowledgeArticles,
    taskBridge,
    taskProjectId: projectId,
  } = useDesktopCanvasTaskRuntime();
  return (
    <CloudCanvasProjectWorkspace
      activeTaskDetailsTaskId={activeTaskDetailsTaskId}
      key={`${workspaceId}:${projectId}`}
      knowledgeArticles={knowledgeArticles}
      projectId={projectId}
      taskBridge={taskBridge}
      workspaceId={workspaceId}
    />
  );
}

function CloudCanvasProjectWorkspace({
  activeTaskDetailsTaskId,
  knowledgeArticles,
  projectId,
  taskBridge,
  workspaceId,
}: {
  activeTaskDetailsTaskId?: string;
  knowledgeArticles: readonly PrototypeDocument[];
  projectId: string;
  taskBridge: CanvasTaskBridge;
  workspaceId: string;
}): React.JSX.Element {
  const supabase = useMemo(() => createClient(), []);
  const primaryRuntimeCache = useMemo(
    () => projectRuntimeCache(workspaceId, projectId, "primary"),
    [projectId, workspaceId],
  );
  const secondaryRuntimeCache = useMemo(
    () => projectRuntimeCache(workspaceId, projectId, "secondary"),
    [projectId, workspaceId],
  );
  const cloudAssetRepository = useMemo(
    () => createCloudCanvasAssetRepository({ supabase }),
    [supabase],
  );
  const projectFileRepository = useMemo(() => {
    const env = getPublicEnv();
    return new SupabaseProjectFileRepository({
      supabase,
      resumableUploadEndpoint: projectFileResumableUploadEndpoint(
        env.NEXT_PUBLIC_SUPABASE_URL,
      ),
    });
  }, [supabase]);
  const projectFileVariantRepository = useMemo(
    () => new SupabaseProjectFileImageVariantRepository(supabase),
    [supabase],
  );
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active) setUserId(data.user?.id ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      cloudAssetRepository.invalidateAuthentication();
      projectFileRepository.invalidateAuthentication();
      projectFileVariantRepository.invalidateAuthentication();
      clearProjectRuntimeCachesExcept(session?.user.id ?? null);
      if (active) setUserId(session?.user.id ?? null);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [
    cloudAssetRepository,
    projectFileRepository,
    projectFileVariantRepository,
    supabase,
  ]);

  const dependencies = useMemo(() => {
    try {
      const baseCanvasRepository = createCloudCanvasRepository({ supabase });
      const canvasRepository = createProjectScopedCloudCanvasRepository({
        supabase,
        repository: baseCanvasRepository,
        workspaceId,
        projectId,
      });
      const createPaneRepository = (runtimeCache: CloudCanvasRuntimeCache) => {
        const baseShellRepository = new CloudCanvasShellRepository(
          workspaceId,
          canvasRepository,
          cloudAssetRepository,
          runtimeCache,
        );
        return createProjectFileBackedCanvasShellRepository({
          repository: baseShellRepository,
          projectFileRepository,
          projectFileVariantRepository,
          workspaceId,
          projectId,
        });
      };
      const primaryRepository = createPaneRepository(primaryRuntimeCache);
      const secondaryRepository = createPaneRepository(secondaryRuntimeCache);
      return {
        primaryRepository,
        secondaryRepository,
        error: null,
      };
    } catch {
      return {
        primaryRepository: null,
        secondaryRepository: null,
        error: "Не удалось настроить облачное хранилище холстов.",
      };
    }
  }, [
    cloudAssetRepository,
    projectFileRepository,
    projectFileVariantRepository,
    projectId,
    primaryRuntimeCache,
    secondaryRuntimeCache,
    supabase,
    workspaceId,
  ]);

  const [splitViewActive, setSplitViewActive] = useState(false);
  const [activePane, setActivePane] = useState<CanvasPaneId>("primary");
  const [primaryCanvasId, setPrimaryCanvasId] = useState<string | null>(null);
  const [secondaryCanvasId, setSecondaryCanvasId] = useState<string | null>(
    null,
  );
  const [primaryOpenRequest, setPrimaryOpenRequest] = useState<{
    canvasId: string;
    requestId: number;
  } | null>(null);
  const [secondaryOpenRequest, setSecondaryOpenRequest] = useState<{
    canvasId: string;
    requestId: number;
  } | null>(null);
  const [dualPaneRuntimeReady, setDualPaneRuntimeReady] = useState(false);
  const openRequestSequence = useRef(0);

  useEffect(() => {
    if (!userId) return;
    const restored = getProjectDualPaneRuntimeState(
      workspaceId,
      projectId,
      userId,
    );
    const frame = window.requestAnimationFrame(() => {
      if (restored) {
        setSplitViewActive(restored.splitViewActive);
        setActivePane(restored.activePane);
        setPrimaryCanvasId(restored.primaryCanvasId);
        setSecondaryCanvasId(restored.secondaryCanvasId);
      }
      // Do not mount the primary React Flow pane at its one-pane width and
      // then turn on split mode one frame later. Its saved x/y viewport is in
      // pane pixels, so the first mount must already have the final layout.
      setDualPaneRuntimeReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [projectId, userId, workspaceId]);

  useEffect(() => {
    if (!userId || !dualPaneRuntimeReady) return;
    setProjectDualPaneRuntimeState(workspaceId, projectId, {
      userId,
      splitViewActive,
      activePane,
      primaryCanvasId,
      secondaryCanvasId,
    });
  }, [
    activePane,
    dualPaneRuntimeReady,
    primaryCanvasId,
    projectId,
    secondaryCanvasId,
    splitViewActive,
    userId,
    workspaceId,
  ]);

  const toggleSplitView = useCallback(() => {
    if (splitViewActive) setActivePane("primary");
    setSplitViewActive(!splitViewActive);
  }, [splitViewActive]);

  const requestCanvasInPane = useCallback(
    (pane: CanvasPaneId, canvasId: string): void => {
      const request = { canvasId, requestId: ++openRequestSequence.current };
      if (pane === "primary") setPrimaryOpenRequest(request);
      else setSecondaryOpenRequest(request);
    },
    [],
  );

  const selectCanvasFromSidebar = useCallback(
    (requestedCanvasId: string): void => {
      if (!splitViewActive) {
        setActivePane("primary");
        requestCanvasInPane("primary", requestedCanvasId);
        return;
      }
      const selection = resolveCanvasPaneSelection({
        activePane,
        primaryCanvasId,
        requestedCanvasId,
        secondaryCanvasId,
      });
      setActivePane(selection.activePane);
      if (selection.openCanvasId)
        requestCanvasInPane(selection.targetPane, selection.openCanvasId);
    },
    [
      activePane,
      primaryCanvasId,
      requestCanvasInPane,
      secondaryCanvasId,
      splitViewActive,
    ],
  );

  const selectCanvasInPane = useCallback(
    (pane: CanvasPaneId, requestedCanvasId: string): void => {
      const selection = resolveCanvasPaneSelection({
        activePane: pane,
        primaryCanvasId,
        requestedCanvasId,
        secondaryCanvasId,
      });
      setActivePane(selection.activePane);
      if (selection.openCanvasId)
        requestCanvasInPane(selection.targetPane, selection.openCanvasId);
    },
    [primaryCanvasId, requestCanvasInPane, secondaryCanvasId],
  );

  const handleCanvasDeleted = useCallback(
    (canvasId: string): void => {
      if (canvasId !== secondaryCanvasId) return;
      setSplitViewActive(false);
      setSecondaryCanvasId(null);
      setSecondaryOpenRequest(null);
      setActivePane("primary");
    },
    [secondaryCanvasId],
  );

  if (!workspaceId.trim()) {
    return (
      <p role="alert">Не удалось определить текущее рабочее пространство.</p>
    );
  }
  if (!projectId.trim()) {
    return <p role="alert">Не удалось определить текущий проект.</p>;
  }
  if (
    dependencies.error ||
    !dependencies.primaryRepository ||
    !dependencies.secondaryRepository
  ) {
    return <p role="alert">{dependencies.error}</p>;
  }
  if (!userId) {
    return (
      <main className="cloud-canvas-session-shell" aria-busy="true">
        <p role="status">Подключение к Canvas…</p>
      </main>
    );
  }
  if (!dualPaneRuntimeReady) {
    return (
      <main className="cloud-canvas-session-shell" aria-busy="true">
        <p role="status">Восстанавливаем рабочее место Canvas…</p>
      </main>
    );
  }

  const secondaryPane = splitViewActive ? (
    <div
      className={`${styles.desktopCanvasPane} ${activePane === "secondary" ? styles.desktopCanvasPaneActive : ""}`}
      onPointerDownCapture={() => setActivePane("secondary")}
    >
      <InfiniteCanvasLocalShell
        activeTaskDetailsTaskId={activeTaskDetailsTaskId}
        assetRepository={dependencies.secondaryRepository}
        canvasOpenRequest={secondaryOpenRequest}
        clipboardActive={activePane === "secondary"}
        copy={cloudCanvasShellCopy}
        embedded
        excludedCanvasId={primaryCanvasId}
        groupRepository={dependencies.secondaryRepository}
        hideDesktopSidebar
        key={`${workspaceId}:${projectId}:secondary`}
        knowledgeArticles={knowledgeArticles}
        onActiveCanvasChange={setSecondaryCanvasId}
        onCanvasDeleted={handleCanvasDeleted}
        onPaneActivate={() => setActivePane("secondary")}
        onToolbarSelectCanvas={(canvasId) =>
          selectCanvasInPane("secondary", canvasId)
        }
        onToggleSplitView={toggleSplitView}
        paneActive={activePane === "secondary"}
        projectFileRepository={projectFileRepository}
        projectFileVariantRepository={projectFileVariantRepository}
        projectId={projectId}
        repository={dependencies.secondaryRepository}
        runtimeCache={secondaryRuntimeCache}
        showDiagnostics={false}
        splitViewActive
        taskBridge={taskBridge}
        taskWorkspaceId={projectId}
        userId={userId}
        workspaceId={workspaceId}
      />
    </div>
  ) : null;

  return (
    <InfiniteCanvasLocalShell
      activeTaskDetailsTaskId={activeTaskDetailsTaskId}
      assetRepository={dependencies.primaryRepository}
      canvasOpenRequest={primaryOpenRequest}
      clipboardActive={!splitViewActive || activePane === "primary"}
      copy={cloudCanvasShellCopy}
      embedded
      key={`${workspaceId}:${projectId}`}
      repository={dependencies.primaryRepository}
      groupRepository={dependencies.primaryRepository}
      knowledgeArticles={knowledgeArticles}
      onActiveCanvasChange={setPrimaryCanvasId}
      onCanvasDeleted={handleCanvasDeleted}
      onPaneActivate={() => setActivePane("primary")}
      onSidebarSelectCanvas={selectCanvasFromSidebar}
      onToolbarSelectCanvas={(canvasId) =>
        selectCanvasInPane("primary", canvasId)
      }
      onToggleSplitView={toggleSplitView}
      paneActive={!splitViewActive || activePane === "primary"}
      projectFileRepository={projectFileRepository}
      projectFileVariantRepository={projectFileVariantRepository}
      projectId={projectId}
      runtimeCache={primaryRuntimeCache}
      secondaryPane={secondaryPane}
      showDiagnostics={false}
      sidebarActiveCanvasId={
        splitViewActive && activePane === "secondary"
          ? secondaryCanvasId
          : primaryCanvasId
      }
      splitViewActive={splitViewActive}
      taskBridge={taskBridge}
      taskWorkspaceId={projectId}
      userId={userId}
      workspaceId={workspaceId}
    />
  );
}
