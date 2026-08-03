"use client";

import { useEffect, useMemo, useState } from "react";
import { createCloudCanvasAssetRepository } from "@/lib/canvas/cloud-canvas-asset-repository";
import { createCloudCanvasRepository } from "@/lib/canvas/cloud-canvas-repository";
import { CloudCanvasShellRepository } from "@/lib/canvas/cloud-canvas-shell-adapter";
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
  isolated: "Рабочее пространство",
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
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active) setUserId(data.user?.id ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUserId(session?.user.id ?? null);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);
  const dependencies = useMemo(() => {
    try {
      const canvasRepository = createCloudCanvasRepository({ supabase });
      const assetRepository = createCloudCanvasAssetRepository({ supabase });
      const shellRepository = new CloudCanvasShellRepository(
        workspaceId,
        canvasRepository,
        assetRepository,
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
  }, [supabase, workspaceId]);

  if (!workspaceId.trim()) {
    return (
      <p role="alert">Не удалось определить текущее рабочее пространство.</p>
    );
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
      key={workspaceId}
      repository={dependencies.repository}
      showDiagnostics={false}
      taskBridge={taskBridge}
      taskWorkspaceId={taskWorkspaceId}
      userId={userId}
      workspaceId={workspaceId}
    />
  );
}
