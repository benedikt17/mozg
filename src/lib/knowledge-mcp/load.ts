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
  | { kind: "unauthorized" | "unavailable" };

export async function loadKnowledgeForToken(
  token: string,
): Promise<KnowledgeLoadResult> {
  const env = getPublicEnv();
  const client = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser(token);
  if (authError || !user) return { kind: "unauthorized" };

  const { data: memberships, error: membershipError } = await client
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(2);
  if (membershipError || !memberships || memberships.length !== 1) {
    return { kind: "unavailable" };
  }
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
  if (workspaceError || snapshotError || !workspace || !row)
    return { kind: "unavailable" };
  const parsed = parseDesktopCloudSnapshotRow(row, workspace.name);
  return parsed.kind === "ready"
    ? { kind: "ready", snapshot: parsed.bootstrap }
    : { kind: "unavailable" };
}
