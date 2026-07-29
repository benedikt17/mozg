import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import {
  parseDesktopCloudSnapshotRow,
  type DesktopCloudBootstrap,
  type DesktopCloudSnapshotRow,
} from "@/prototype/persistence/cloud-snapshot-bridge";

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
  if (userError || !user) return { kind: "unauthenticated" };

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

  const { data: row, error: snapshotError } = await supabase
    .from("workspace_snapshots")
    .select("workspace_id, schema_version, snapshot, revision, updated_at")
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (snapshotError) return { kind: "unavailable" };
  if (!row) return { kind: "snapshot-missing" };

  const parsed = parseDesktopCloudSnapshotRow(
    row as SnapshotRow & DesktopCloudSnapshotRow,
    workspace.name,
  );
  if (parsed.kind === "ready") return parsed;
  if (parsed.kind === "unsupported-schema") return parsed;
  return { kind: "invalid-snapshot" };
}
