import type { Database } from "@/lib/supabase/database.types";
import { getDesktopRuntimeMode } from "@/lib/local-development-mode";
import { createClient } from "@/lib/supabase/server";
import {
  parseDesktopCloudSnapshotRow,
  type DesktopCloudBootstrap,
  type DesktopCloudSnapshotRow,
} from "@/prototype/persistence/cloud-snapshot-bridge";
import { createDesktopDomainSnapshot } from "@/prototype/persistence/domain-snapshot";
import { initialDesktopPrototypeState } from "@/prototype/desktop-state";

export type DesktopCloudSnapshotLoadResult =
  | { kind: "ready"; bootstrap: DesktopCloudBootstrap }
  | { kind: "unauthenticated" }
  | { kind: "workspace-unavailable" }
  | { kind: "snapshot-missing" }
  | { kind: "unsupported-schema" }
  | { kind: "invalid-snapshot" }
  | { kind: "unavailable" };

type SnapshotRow = Pick<
  Database["public"]["Tables"]["workspace_snapshots"]["Row"],
  "workspace_id" | "schema_version" | "snapshot" | "revision" | "updated_at"
>;

export async function loadDesktopCloudSnapshot(): Promise<DesktopCloudSnapshotLoadResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return getDesktopRuntimeMode() === "local"
      ? { kind: "unavailable" }
      : { kind: "unauthenticated" };
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(2);
  if (membershipError || !memberships || memberships.length !== 1) {
    return { kind: "workspace-unavailable" };
  }
  const workspaceId = memberships[0].workspace_id;

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("id", workspaceId)
    .maybeSingle();
  if (workspaceError || !workspace) return { kind: "workspace-unavailable" };

  const { data: initialRow, error: snapshotError } = await supabase
    .from("workspace_snapshots")
    .select("workspace_id, schema_version, snapshot, revision, updated_at")
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (snapshotError) return { kind: "unavailable" };
  let row = initialRow;
  if (!row && getDesktopRuntimeMode() === "local") {
    const { error: initializeError } = await supabase.rpc(
      "initialize_workspace_snapshot",
      {
        target_workspace_id: workspace.id,
        target_schema_version: 2,
        target_snapshot: createLocalDevelopmentSnapshot(),
      },
    );
    if (initializeError) {
      return { kind: "unavailable" };
    }
    const retry = await supabase
      .from("workspace_snapshots")
      .select("workspace_id, schema_version, snapshot, revision, updated_at")
      .eq("workspace_id", workspace.id)
      .maybeSingle();
    if (retry.error) return { kind: "unavailable" };
    row = retry.data;
  }
  if (!row) return { kind: "snapshot-missing" };

  const parsed = parseDesktopCloudSnapshotRow(
    row as SnapshotRow & DesktopCloudSnapshotRow,
    workspace.name,
  );
  if (parsed.kind === "ready") return parsed;
  if (parsed.kind === "unsupported-schema") return parsed;
  return { kind: "invalid-snapshot" };
}

function createLocalDevelopmentSnapshot(): Database["public"]["Tables"]["workspace_snapshots"]["Insert"]["snapshot"] {
  return createDesktopDomainSnapshot(initialDesktopPrototypeState);
}
