import { describe, expect, it } from "vitest";
import fixture from "./fixtures/desktop-domain-snapshot-v1.json";
import v2Fixture from "./fixtures/desktop-domain-snapshot-v2.json";
import {
  createDesktopDomainSnapshot,
  parseDesktopDomainSnapshot,
} from "@/prototype/persistence/domain-snapshot";
import { parseDesktopCloudSnapshotRow } from "@/prototype/persistence/cloud-snapshot-bridge";
import {
  desktopPrototypeReducer,
  initialDesktopPrototypeState,
} from "@/prototype/desktop-state";

describe("desktop snapshot v1 compatibility fixture", () => {
  it("parses, round-trips and hydrates without semantic loss", () => {
    const parsed = parseDesktopDomainSnapshot(fixture);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.warnings).toEqual([
      expect.objectContaining({ code: "migrated-schema-version" }),
    ]);
    expect(parsed.snapshot.schemaVersion).toBe(2);
    expect(parsed.snapshot.tasks[0]?.subtasks[0]?.detailsMarkdown).toBe("");

    const hydrated = desktopPrototypeReducer(initialDesktopPrototypeState, {
      type: "hydrate-domain",
      snapshot: parsed.snapshot,
    });
    expect(createDesktopDomainSnapshot(hydrated)).toEqual(parsed.snapshot);
  });

  it("takes the identical domain contract through the cloud bridge", () => {
    const parsed = parseDesktopDomainSnapshot(fixture);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(
      parseDesktopCloudSnapshotRow(
        {
          workspace_id: "workspace-v1",
          schema_version: 1,
          revision: 1,
          updated_at: "2030-01-01T00:00:00.000Z",
          snapshot: fixture,
        },
        "Compatibility workspace",
      ),
    ).toEqual(
      expect.objectContaining({
        kind: "ready",
        bootstrap: expect.objectContaining({
          schemaVersion: 2,
          snapshot: parsed.snapshot,
        }),
      }),
    );
  });

  it("accepts a native v2 fixture without migration", () => {
    const parsed = parseDesktopDomainSnapshot(v2Fixture);

    expect(parsed).toMatchObject({ ok: true, warnings: [] });
    if (!parsed.ok) return;
    expect(parsed.snapshot).toEqual(v2Fixture);
  });
});
