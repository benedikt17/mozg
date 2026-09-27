import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";
import { parseDesktopCloudSnapshotRow } from "@/prototype/persistence/cloud-snapshot-bridge";

export type KnowledgeLoadResult =
  | {
      kind: "ready";
      snapshot: Extract<
        ReturnType<typeof parseDesktopCloudSnapshotRow>,
        { kind: "ready" }
      >["bootstrap"];
    }
  | {
      kind: "unauthorized" | "unavailable";
      reason?: "credential" | "membership" | "workspace" | "snapshot";
    };

/** Read as a server-only privileged client after a scoped MCP token has been
 * verified. Explicit membership lookup mirrors the workspace RLS boundary.
 * Do not expose this client or its credential to the OAuth caller. */
export async function loadKnowledgeForUser(
  userId: string,
): Promise<KnowledgeLoadResult> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return { kind: "unavailable", reason: "credential" };
  const env = getPublicEnv();
  const client = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: memberships, error: membershipError } = await client
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(2);
  if (membershipError || !memberships || memberships.length !== 1)
    return { kind: "unavailable", reason: "membership" };
  const workspaceId = memberships[0].workspace_id;
  const [
    { data: workspace, error: workspaceError },
    { data: row, error: snapshotError },
  ] = await Promise.all([
    client
      .from("workspaces")
      .select("id, name")
      .eq("id", workspaceId)
      .maybeSingle(),
    client
      .from("workspace_snapshots")
      .select("workspace_id, schema_version, snapshot, revision, updated_at")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
  ]);
  if (workspaceError || !workspace)
    return { kind: "unavailable", reason: "workspace" };
  if (snapshotError || !row) return { kind: "unavailable", reason: "snapshot" };
  const parsed = parseDesktopCloudSnapshotRow(row, workspace.name);
  return parsed.kind === "ready"
    ? { kind: "ready", snapshot: parsed.bootstrap }
    : { kind: "unavailable", reason: "snapshot" };
}
