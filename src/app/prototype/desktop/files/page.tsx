import { redirect } from "next/navigation";

import type { DesktopCloudSnapshotLoadResult } from "@/lib/supabase/desktop-snapshot-loader";
import { FilesPreviewShell } from "@/prototype/files/files-preview-shell";

export const dynamic = "force-dynamic";

export default async function ProjectFilesPreviewPage() {
  const { loadDesktopCloudSnapshot } =
    await import("@/lib/supabase/desktop-snapshot-loader");
  const result = await loadDesktopCloudSnapshot();

  if (result.kind === "unauthenticated") {
    redirect("/sign-in?next=%2Fprototype%2Fdesktop%2Ffiles");
  }

  if (result.kind !== "ready") {
    return <FilesPreviewBoundary kind={result.kind} />;
  }

  return (
    <FilesPreviewShell
      projects={result.bootstrap.snapshot.projects}
      workspaceId={result.bootstrap.workspaceId}
      workspaceName={result.bootstrap.workspaceName}
    />
  );
}

function FilesPreviewBoundary({
  kind,
}: {
  kind: Exclude<
    DesktopCloudSnapshotLoadResult["kind"],
    "ready" | "unauthenticated"
  >;
}): React.JSX.Element {
  const message =
    kind === "workspace-unavailable"
      ? "Для пользователя недоступно workspace."
      : kind === "snapshot-missing"
        ? "Для workspace ещё нет облачного snapshot."
        : kind === "unsupported-schema"
          ? "Облачный snapshot имеет неподдерживаемую версию."
          : "Не удалось загрузить облачное состояние workspace.";

  return (
    <main className="desktop-prototype desktop-persistence-boundary">
      <div className="desktop-persistence-message" role="alert">
        <strong>{message}</strong>
      </div>
    </main>
  );
}
