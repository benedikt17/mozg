import { describe, expect, it } from "vitest";
import { initialDesktopPrototypeState } from "@/prototype/desktop-state";
import { createDesktopDomainSnapshot } from "@/prototype/persistence/domain-snapshot";
import { parseDesktopCloudSnapshotRow } from "@/prototype/persistence/cloud-snapshot-bridge";

function row(overrides: Record<string, unknown> = {}) {
  return {
    workspace_id: "workspace-local",
    schema_version: 1,
    snapshot: createDesktopDomainSnapshot(initialDesktopPrototypeState),
    revision: 7,
    updated_at: "2026-07-29T10:00:00.000Z",
    ...overrides,
  };
}

describe("parseDesktopCloudSnapshotRow", () => {
  it("returns validated snapshot metadata for the authenticated bootstrap", () => {
    const result = parseDesktopCloudSnapshotRow(row(), "Лукоморье");
    expect(result).toMatchObject({
      kind: "ready",
      bootstrap: {
        workspaceId: "workspace-local",
        workspaceName: "Лукоморье",
        schemaVersion: 1,
        revision: 7,
      },
    });
  });

  it("rejects unsupported schema versions", () => {
    expect(
      parseDesktopCloudSnapshotRow(row({ schema_version: 2 }), "Лукоморье"),
    ).toEqual({ kind: "unsupported-schema", schemaVersion: 2 });
  });

  it("rejects invalid payloads and metadata", () => {
    expect(
      parseDesktopCloudSnapshotRow(row({ snapshot: {} }), "Лукоморье"),
    ).toEqual({ kind: "invalid-snapshot" });
    expect(
      parseDesktopCloudSnapshotRow(row({ revision: 0 }), "Лукоморье"),
    ).toEqual({ kind: "invalid-metadata" });
  });
});
