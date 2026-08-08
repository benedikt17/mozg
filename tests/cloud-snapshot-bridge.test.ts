import { describe, expect, it } from "vitest";
import v1Fixture from "./fixtures/desktop-domain-snapshot-v1.json";
import { initialDesktopPrototypeState } from "@/prototype/desktop-state";
import { createDesktopDomainSnapshot } from "@/prototype/persistence/domain-snapshot";
import { parseDesktopCloudSnapshotRow } from "@/prototype/persistence/cloud-snapshot-bridge";

function row(overrides: Record<string, unknown> = {}) {
  return {
    workspace_id: "workspace-local",
    schema_version: 3,
    snapshot: createDesktopDomainSnapshot(initialDesktopPrototypeState),
    revision: 7,
    updated_at: "2026-07-29T10:00:00.000Z",
    ...overrides,
  };
}

describe("parseDesktopCloudSnapshotRow", () => {
  it("returns validated snapshot metadata for the authenticated bootstrap", () => {
    const result = parseDesktopCloudSnapshotRow(row(), "Workspace");
    expect(result).toMatchObject({
      kind: "ready",
      bootstrap: {
        workspaceId: "workspace-local",
        workspaceName: "Workspace",
        schemaVersion: 3,
        revision: 7,
      },
    });
  });

  it("rejects unsupported schema versions", () => {
    expect(
      parseDesktopCloudSnapshotRow(row({ schema_version: 4 }), "Workspace"),
    ).toEqual({
      kind: "unsupported-schema",
      schemaVersion: 4,
    });
  });

  it("rejects invalid payloads and metadata", () => {
    expect(
      parseDesktopCloudSnapshotRow(row({ snapshot: {} }), "Workspace"),
    ).toEqual({ kind: "invalid-snapshot" });
    expect(
      parseDesktopCloudSnapshotRow(row({ revision: 0 }), "Workspace"),
    ).toEqual({ kind: "invalid-metadata" });
  });

  it("normalizes a v1 row to a v3 runtime while preserving revision", () => {
    const result = parseDesktopCloudSnapshotRow(
      row({ schema_version: 1, snapshot: v1Fixture, revision: 11 }),
      "Workspace",
    );

    expect(result).toMatchObject({
      kind: "ready",
      bootstrap: { schemaVersion: 3, revision: 11 },
    });
    if (result.kind !== "ready") return;
    expect(
      result.bootstrap.snapshot.tasks[0]?.subtasks[0]?.detailsMarkdown,
    ).toBe("");
  });

  it("rejects row and payload schema mismatches", () => {
    expect(
      parseDesktopCloudSnapshotRow(row({ schema_version: 1 }), "Workspace"),
    ).toEqual({ kind: "invalid-snapshot" });
    expect(
      parseDesktopCloudSnapshotRow(
        row({ schema_version: 2, snapshot: v1Fixture }),
        "Workspace",
      ),
    ).toEqual({ kind: "invalid-snapshot" });
  });
});
