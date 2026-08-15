import { LegacyCanvasAssetsMigrationLab } from "@/prototype/files/legacy-canvas-assets-migration-lab";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : (value?.[0] ?? "");
}

export default async function LegacyCanvasAssetsMigrationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const workspaceId = first(params.workspaceId).trim();
  const projectId = first(params.projectId).trim();

  if (!workspaceId || !projectId) {
    return (
      <main style={{ maxWidth: 760, margin: "48px auto", padding: 24 }}>
        <h1>Legacy Canvas assets migration</h1>
        <p role="alert">
          Нужны query-параметры <code>workspaceId</code> и{" "}
          <code>projectId</code>.
        </p>
      </main>
    );
  }

  return (
    <LegacyCanvasAssetsMigrationLab
      projectId={projectId}
      workspaceId={workspaceId}
    />
  );
}
