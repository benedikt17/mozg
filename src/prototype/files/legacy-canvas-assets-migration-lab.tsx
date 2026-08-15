"use client";

import { useMemo, useState } from "react";

import { createCloudCanvasAssetRepository } from "@/lib/canvas/cloud-canvas-asset-repository";
import { createCloudCanvasRepository } from "@/lib/canvas/cloud-canvas-repository";
import { createProjectScopedCloudCanvasRepository } from "@/lib/canvas/project-scoped-cloud-canvas-repository";
import { getPublicEnv } from "@/lib/env";
import { SupabaseProjectFileImageVariantRepository } from "@/lib/files/cloud-project-file-image-variant-repository";
import { SupabaseProjectFileRepository } from "@/lib/files/cloud-project-file-repository";
import {
  planLegacyCanvasAssetsMigration,
  runLegacyCanvasAssetsMigration,
  type LegacyCanvasAssetMigrationPlan,
  type LegacyCanvasAssetMigrationResult,
} from "@/lib/files/legacy-canvas-assets-migration";
import { projectFileResumableUploadEndpoint } from "@/lib/files/project-file-resumable-upload";
import { createClient } from "@/lib/supabase/browser";

export function LegacyCanvasAssetsMigrationLab({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}): React.JSX.Element {
  const dependencies = useMemo(() => {
    const supabase = createClient();
    const baseCanvasRepository = createCloudCanvasRepository({ supabase });
    const canvasRepository = createProjectScopedCloudCanvasRepository({
      supabase,
      repository: baseCanvasRepository,
      workspaceId,
      projectId,
    });
    const legacyAssetRepository = createCloudCanvasAssetRepository({
      supabase,
    });
    const env = getPublicEnv();
    const projectFileRepository = new SupabaseProjectFileRepository({
      supabase,
      resumableUploadEndpoint: projectFileResumableUploadEndpoint(
        env.NEXT_PUBLIC_SUPABASE_URL,
      ),
    });
    const projectFileVariantRepository =
      new SupabaseProjectFileImageVariantRepository(supabase);
    return {
      canvasRepository,
      legacyAssetRepository,
      projectFileRepository,
      projectFileVariantRepository,
    };
  }, [projectId, workspaceId]);

  const [plan, setPlan] = useState<LegacyCanvasAssetMigrationPlan | null>(null);
  const [result, setResult] = useState<LegacyCanvasAssetMigrationResult | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Готов к dry-run.");
  const [error, setError] = useState<string | null>(null);

  const inspect = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    setStatus("Проверяю legacy Canvas assets…");
    try {
      const nextPlan = await planLegacyCanvasAssetsMigration({
        workspaceId,
        projectId,
        ...dependencies,
      });
      setPlan(nextPlan);
      setStatus(
        nextPlan.distinctLegacyAssets === 0
          ? "Legacy assetId больше нет."
          : `Dry-run готов: ${nextPlan.distinctLegacyAssets} assets / ${nextPlan.legacyReferences} refs.`,
      );
    } catch (cause) {
      setPlan(null);
      setError(
        cause instanceof Error ? cause.message : "Dry-run завершился ошибкой.",
      );
      setStatus("Dry-run не пройден.");
    } finally {
      setBusy(false);
    }
  };

  const migrate = async () => {
    if (!plan || plan.distinctLegacyAssets === 0) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setStatus("Запускаю миграцию…");
    try {
      const nextResult = await runLegacyCanvasAssetsMigration({
        plan,
        ...dependencies,
        onProgress: setStatus,
      });
      setResult(nextResult);
      const verification = await planLegacyCanvasAssetsMigration({
        workspaceId,
        projectId,
        ...dependencies,
      });
      setPlan(verification);
      if (verification.legacyReferences !== 0) {
        throw new Error(
          `После миграции осталось legacy refs: ${verification.legacyReferences}.`,
        );
      }
      setStatus("PASS: активные Canvas больше не содержат legacy assetId.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Миграция завершилась ошибкой.",
      );
      setStatus("Миграция остановлена.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main
      style={{
        maxWidth: 920,
        margin: "48px auto",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <p style={{ margin: 0, opacity: 0.65 }}>MOZG · Files B5</p>
      <h1 style={{ marginTop: 8 }}>Legacy Canvas assets migration</h1>
      <p>
        Внутренний migration lab. Legacy storage не удаляется. Сначала выполните
        dry-run; кнопка миграции работает только по зафиксированному плану.
      </p>

      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "180px 1fr",
          gap: 8,
          padding: 16,
          border: "1px solid currentColor",
          borderRadius: 12,
        }}
      >
        <dt>Workspace</dt>
        <dd style={{ margin: 0, overflowWrap: "anywhere" }}>{workspaceId}</dd>
        <dt>Project</dt>
        <dd style={{ margin: 0 }}>{projectId}</dd>
        <dt>Статус</dt>
        <dd style={{ margin: 0 }}>{status}</dd>
      </dl>

      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        <button disabled={busy} onClick={() => void inspect()} type="button">
          {busy ? "Работаю…" : "1. Dry-run"}
        </button>
        <button
          disabled={busy || !plan || plan.distinctLegacyAssets === 0}
          onClick={() => void migrate()}
          type="button"
        >
          2. Мигрировать
        </button>
      </div>

      {error ? (
        <p role="alert" style={{ marginTop: 20 }}>
          Ошибка: {error}
        </p>
      ) : null}

      {plan ? (
        <section style={{ marginTop: 28 }}>
          <h2>Dry-run</h2>
          <ul>
            <li>Canvas проверено: {plan.canvasesScanned}</li>
            <li>Canvas с legacy: {plan.canvasesWithLegacyAssets}</li>
            <li>Legacy refs: {plan.legacyReferences}</li>
            <li>Уникальных assets: {plan.distinctLegacyAssets}</li>
            <li>Уже скопировано идемпотентно: {plan.alreadyMigratedAssets}</li>
          </ul>
          {plan.items.length > 0 ? (
            <details>
              <summary>План файлов ({plan.items.length})</summary>
              <ol>
                {plan.items.map((item) => (
                  <li key={item.assetId} style={{ marginBlock: 8 }}>
                    <strong>{item.targetName}</strong>
                    <br />
                    <code>{item.assetId}</code>
                    {item.alreadyMigrated ? " · уже в Project Files" : ""}
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
        </section>
      ) : null}

      {result ? (
        <section style={{ marginTop: 28 }}>
          <h2>Результат</h2>
          <ul>
            <li>Новых Project Files: {result.migratedAssets}</li>
            <li>Переиспользовано: {result.reusedAssets}</li>
            <li>Canvas переписано: {result.migratedCanvases}</li>
            <li>Ссылок assetId → fileId: {result.legacyReferencesRewritten}</li>
          </ul>
        </section>
      ) : null}
    </main>
  );
}
