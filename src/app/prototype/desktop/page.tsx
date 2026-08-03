import type { DesktopCloudSnapshotLoadResult } from "@/lib/supabase/desktop-snapshot-loader";
import { DesktopPrototypeShell } from "@/prototype/desktop-shell";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DesktopPrototypePage() {
  const { loadDesktopCloudSnapshot } =
    await import("@/lib/supabase/desktop-snapshot-loader");
  const result = await loadDesktopCloudSnapshot();
  if (result.kind === "unauthenticated") {
    redirect("/sign-in?next=%2Fprototype%2Fdesktop");
  }
  if (result.kind !== "ready")
    return <DesktopSnapshotBoundary kind={result.kind} />;
  return (
    <DesktopPrototypeShell
      cloudBootstrap={result.bootstrap}
      runtimeMode="cloud"
    />
  );
}

function DesktopSnapshotBoundary({
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
