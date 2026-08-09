import { describe, expect, it } from "vitest";

import v1Fixture from "./fixtures/desktop-domain-snapshot-v1.json";
import v2Fixture from "./fixtures/desktop-domain-snapshot-v2.json";
import { parseDesktopDomainSnapshot } from "@/prototype/persistence/domain-snapshot";

describe("frozen historical Desktop snapshot contracts", () => {
  it("keeps the shipped V1 fixture accepted with only the migration warning", () => {
    const parsed = parseDesktopDomainSnapshot(structuredClone(v1Fixture));

    expect(parsed).toMatchObject({
      ok: true,
      warnings: [expect.objectContaining({ code: "migrated-schema-version" })],
    });
  });

  it("keeps the shipped V2 fixture accepted without migration warnings", () => {
    const parsed = parseDesktopDomainSnapshot(structuredClone(v2Fixture));

    expect(parsed).toMatchObject({ ok: true, warnings: [] });
  });

  it("keeps V1 subtasks frozen without the V2 detailsMarkdown field", () => {
    const snapshot = structuredClone(v1Fixture) as Record<string, unknown>;
    const tasks = snapshot.tasks as Array<Record<string, unknown>>;
    const subtasks = tasks[0]!.subtasks as Array<Record<string, unknown>>;
    subtasks[0]!.detailsMarkdown = "future field";

    const parsed = parseDesktopDomainSnapshot(snapshot);

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "unknown-field" }),
        ]),
      );
    }
  });

  it("keeps V2 subtasks frozen with required detailsMarkdown", () => {
    const snapshot = structuredClone(v2Fixture) as Record<string, unknown>;
    const tasks = snapshot.tasks as Array<Record<string, unknown>>;
    const subtasks = tasks[0]!.subtasks as Array<Record<string, unknown>>;
    delete subtasks[0]!.detailsMarkdown;

    const parsed = parseDesktopDomainSnapshot(snapshot);

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "invalid-string" }),
        ]),
      );
    }
  });

  it("keeps the historical reverse document relation field required", () => {
    const snapshot = structuredClone(v2Fixture) as Record<string, unknown>;
    const documents = snapshot.documents as Array<Record<string, unknown>>;
    delete documents[0]!.linkedTaskIds;

    const parsed = parseDesktopDomainSnapshot(snapshot);

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "invalid-array" }),
        ]),
      );
    }
  });

  it("does not let V3-only schemaVersion values enter the historical parser", () => {
    const snapshot = { ...structuredClone(v2Fixture), schemaVersion: 3 };

    const parsed = parseDesktopDomainSnapshot(snapshot);

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "unsupported-schema-version" }),
        ]),
      );
    }
  });
});
