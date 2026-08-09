"use client";

import { useEffect, useMemo, useState } from "react";
import { createCloudCanvasAssetRepository } from "@/lib/canvas/cloud-canvas-asset-repository";
import { createCloudCanvasRepository } from "@/lib/canvas/cloud-canvas-repository";
import { createProjectScopedCloudCanvasRepository } from "@/lib/canvas/project-scoped-cloud-canvas-repository";
import { CloudCanvasShellRepository } from "@/lib/canvas/cloud-canvas-shell-adapter";
import { CloudCanvasRuntimeCache } from "@/lib/canvas/cloud-canvas-runtime-cache";
import { createClient } from "@/lib/supabase/browser";
import {
  InfiniteCanvasLocalShell,
  type CanvasShellCopy,
} from "@/prototype/infinite-canvas-local-shell/infinite-canvas-local-shell";
import { useDesktopTaskRuntime } from "@/prototype/tasks/desktop-task-runtime";

const cloudCanvasShellCopy: CanvasShellCopy = {
  eyebrow: "Холсты",
  defaultTitle: "Новый холст",
  emptyTitle: "Создайте первый холст",
  emptyDescription:
    "Документ, изображения и ваш viewport сохраняются в облачном рабочем пространстве.",
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
  const { taskBridge, taskWorkspaceId } = useDesktopTaskRuntime();
  const projectId = taskWorkspaceId;
  const supabase = useMemo(() => createClient(), []);
  const runtimeCache = useMemo(
    () => new CloudCanvasRuntimeCache(),
    [projectId, workspaceId],
  );
  const cloudAssetRepository = useMemo(
    () => createCloudCanvasAssetRepository({ supabase }),
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
      runtimeCache.clearAllExcept(session?.user.id ?? null);
      if (active) setUserId(session?.user.id ?? null);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [cloudAssetRepository, runtimeCache, supabase]);
  const dependencies = useMemo(() => {
    try {
      const baseCanvasRepository = createCloudCanvasRepository({ supabase });
      const canvasRepository = createProjectScopedCloudCanvasRepository({
        supabase,
        repository: baseCanvasRepository,
        workspaceId,
        projectId,
      });
      const shellRepository = new CloudCanvasShellRepository(
        workspaceId,
        canvasRepository,
        cloudAssetRepository,
      );
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
  }, [cloudAssetRepository, projectId, supabase, workspaceId]);

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
      runtimeCache={runtimeCache}
      showDiagnostics={false}
      taskBridge={taskBridge}
      taskWorkspaceId={projectId}
      userId={userId}
      workspaceId={workspaceId}
    />
  );
}
