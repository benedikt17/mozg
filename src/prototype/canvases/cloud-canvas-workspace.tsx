"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  InfiniteCanvasLocalShell,
  type CanvasShellCopy,
} from "@/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell";
import { useDesktopCanvasTaskRuntime } from "@/prototype/tasks/desktop-task-runtime";

const PROJECT_RUNTIME_CACHE_LIMIT = 8;
const projectRuntimeCaches = new Map<string, CloudCanvasRuntimeCache>();

function projectRuntimeCache(
  workspaceId: string,
  projectId: string,
): CloudCanvasRuntimeCache {
  const key = `${workspaceId}:${projectId}`;
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
  const { taskBridge, taskProjectId: projectId } =
    useDesktopCanvasTaskRuntime();
  const supabase = useMemo(() => createClient(), []);
  const runtimeCache = useMemo(
    () => projectRuntimeCache(workspaceId, projectId),
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
      const baseShellRepository = new CloudCanvasShellRepository(
        workspaceId,
        canvasRepository,
        cloudAssetRepository,
        runtimeCache,
      );
      const shellRepository = createProjectFileBackedCanvasShellRepository({
        repository: baseShellRepository,
        projectFileRepository,
        projectFileVariantRepository,
        workspaceId,
        projectId,
      });
      return {
        assetRepository: shellRepository,
        repository: shellRepository,
        error: null,
      };
    } catch {
      return {
        assetRepository: null,
        repository: null,
        error: "Не удалось настроить облачное хранилище холстов.",
      };
    }
  }, [
    cloudAssetRepository,
    projectFileRepository,
    projectFileVariantRepository,
    projectId,
    runtimeCache,
    supabase,
    workspaceId,
  ]);

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
    !dependencies.repository ||
    !dependencies.assetRepository
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

  return (
    <InfiniteCanvasLocalShell
      activeTaskDetailsTaskId={activeTaskDetailsTaskId}
      assetRepository={dependencies.assetRepository}
      copy={cloudCanvasShellCopy}
      embedded
      key={`${workspaceId}:${projectId}`}
      repository={dependencies.repository}
      groupRepository={dependencies.repository}
      projectFileRepository={projectFileRepository}
      projectFileVariantRepository={projectFileVariantRepository}
      projectId={projectId}
      runtimeCache={runtimeCache}
      showDiagnostics={false}
      taskBridge={taskBridge}
      taskWorkspaceId={projectId}
      userId={userId}
      workspaceId={workspaceId}
    />
  );
}
