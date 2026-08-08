import {
  DESKTOP_DOMAIN_V1_SCHEMA_VERSION,
  DESKTOP_DOMAIN_V2_SCHEMA_VERSION,
  DESKTOP_DOMAIN_SCHEMA_VERSION,
  parseDesktopSnapshotForRuntime,
  type DesktopDomainSnapshot,
} from "@/prototype/persistence/domain-snapshot";

export type DesktopCloudSnapshotRow = {
  workspace_id: string;
  schema_version: number;
  snapshot: unknown;
  revision: number;
  updated_at: string;
};

export type DesktopCloudBootstrap = {
  workspaceId: string;
  workspaceName: string;
  schemaVersion: number;
  revision: number;
  updatedAt: string;
  snapshot: DesktopDomainSnapshot;
};

export type DesktopCloudSnapshotParseResult =
  | { kind: "ready"; bootstrap: DesktopCloudBootstrap }
  | { kind: "unsupported-schema"; schemaVersion: number }
  | { kind: "invalid-snapshot" }
  | { kind: "invalid-metadata" };

function snapshotSchemaVersion(value: unknown): number | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const schemaVersion = (value as { schemaVersion?: unknown }).schemaVersion;
  return typeof schemaVersion === "number" ? schemaVersion : undefined;
}

export function parseDesktopCloudSnapshotRow(
  row: DesktopCloudSnapshotRow,
  workspaceName: string,
): DesktopCloudSnapshotParseResult {
  if (
    row.workspace_id.trim().length === 0 ||
    workspaceName.trim().length === 0 ||
    !Number.isSafeInteger(row.revision) ||
    row.revision < 1 ||
    typeof row.updated_at !== "string" ||
    row.updated_at.length === 0 ||
    !Number.isFinite(Date.parse(row.updated_at))
  ) {
    return { kind: "invalid-metadata" };
  }
  if (
    row.schema_version !== DESKTOP_DOMAIN_V1_SCHEMA_VERSION &&
    row.schema_version !== DESKTOP_DOMAIN_V2_SCHEMA_VERSION &&
    row.schema_version !== DESKTOP_DOMAIN_SCHEMA_VERSION
  ) {
    return { kind: "unsupported-schema", schemaVersion: row.schema_version };
  }
  if (snapshotSchemaVersion(row.snapshot) !== row.schema_version) {
    return { kind: "invalid-snapshot" };
  }
  const parsed = parseDesktopSnapshotForRuntime(row.snapshot);
  if (!parsed.ok) return { kind: "invalid-snapshot" };
  return {
    kind: "ready",
    bootstrap: {
      workspaceId: row.workspace_id,
      workspaceName,
      schemaVersion: DESKTOP_DOMAIN_SCHEMA_VERSION,
      revision: row.revision,
      updatedAt: row.updated_at,
      snapshot: parsed.snapshot,
    },
  };
}
