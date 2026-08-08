import { describe, expect, it } from "vitest";
import fixture from "./fixtures/desktop-domain-snapshot-v1.json";
import v2Fixture from "./fixtures/desktop-domain-snapshot-v2.json";
import {
  createDesktopDomainSnapshot,
  normalizeDesktopDomainSnapshot,
  parseDesktopDomainSnapshot,
} from "@/prototype/persistence/domain-snapshot";
import { getLinkedTaskIdsForDocument } from "@/prototype/state/selectors";
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
      snapshot: normalizeDesktopDomainSnapshot(parsed.snapshot),
    });
    expect(createDesktopDomainSnapshot(hydrated)).toMatchObject({
      schemaVersion: 3,
      tasks: parsed.snapshot.tasks,
    });
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
          schemaVersion: 3,
          snapshot: expect.objectContaining({ schemaVersion: 3 }),
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

  it("keeps the V2 task-owned relation when the reverse side is empty", () => {
    const snapshot = structuredClone(v2Fixture);
    snapshot.documents[0]!.linkedTaskIds = [];

    const parsed = parseDesktopDomainSnapshot(snapshot);
    expect(parsed).toMatchObject({ ok: true, warnings: [] });
    if (!parsed.ok) return;

    const hydrated = desktopPrototypeReducer(initialDesktopPrototypeState, {
      type: "hydrate-domain",
      snapshot: normalizeDesktopDomainSnapshot(parsed.snapshot),
    });

    expect(hydrated.tasks[0]?.linkedDocumentIds).toEqual(["document-v2"]);
    expect(getLinkedTaskIdsForDocument(hydrated, "document-v2")).toEqual([
      "task-v2",
    ]);
  });

  it("does not resurrect a V2 reverse-only relation", () => {
    const snapshot = structuredClone(v2Fixture);
    snapshot.tasks[0]!.linkedDocumentIds = [];

    const parsed = parseDesktopDomainSnapshot(snapshot);
    expect(parsed).toMatchObject({ ok: true, warnings: [] });
    if (!parsed.ok) return;

    const hydrated = desktopPrototypeReducer(initialDesktopPrototypeState, {
      type: "hydrate-domain",
      snapshot: normalizeDesktopDomainSnapshot(parsed.snapshot),
    });

    expect(hydrated.tasks[0]?.linkedDocumentIds).toEqual([]);
    expect(getLinkedTaskIdsForDocument(hydrated, "document-v2")).toEqual([]);
    expect(hydrated.documents[0]).not.toHaveProperty("linkedTaskIds");
  });
});
