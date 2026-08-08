import { describe, expect, it } from "vitest";
import v1Fixture from "./fixtures/desktop-domain-snapshot-v1.json";
import v2Fixture from "./fixtures/desktop-domain-snapshot-v2.json";
import { parseDesktopDomainSnapshot } from "@/prototype/persistence/domain-snapshot";

describe("desktop snapshot historical contracts", () => {
  it("keeps the V1 fixture shape separate from the V2 subtask shape", () => {
    expect(Object.keys(v1Fixture.tasks[0]!.subtasks[0]!)).toEqual([
      "id",
      "title",
      "done",
    ]);
    expect(Object.keys(v2Fixture.tasks[0]!.subtasks[0]!)).toEqual([
      "id",
      "title",
      "done",
      "detailsMarkdown",
    ]);
  });

  it("rejects V2-only subtask fields in a V1 payload", () => {
    const payload = structuredClone(v1Fixture) as {
      tasks: Array<{ subtasks: Array<Record<string, unknown>> }>;
    };
    payload.tasks[0]!.subtasks[0]!.detailsMarkdown = "future V2 field";

    const parsed = parseDesktopDomainSnapshot(payload);

    expect(parsed).toMatchObject({ ok: false });
    if (!parsed.ok) {
      expect(parsed.errors).toContainEqual(
        expect.objectContaining({
          code: "unknown-field",
          path: "tasks[0].subtasks[0].detailsMarkdown",
        }),
      );
    }
  });

  it("requires and preserves V2 subtask detailsMarkdown", () => {
    const missingDetails = structuredClone(v2Fixture) as {
      tasks: Array<{ subtasks: Array<Record<string, unknown>> }>;
    };
    delete missingDetails.tasks[0]!.subtasks[0]!.detailsMarkdown;

    const invalid = parseDesktopDomainSnapshot(missingDetails);
    expect(invalid).toMatchObject({ ok: false });
    if (!invalid.ok) {
      expect(invalid.errors).toContainEqual(
        expect.objectContaining({
          code: "invalid-string",
          path: "tasks[0].subtasks[0].detailsMarkdown",
        }),
      );
    }

    const preserved = parseDesktopDomainSnapshot(v2Fixture);
    expect(preserved).toMatchObject({ ok: true, warnings: [] });
    if (!preserved.ok) return;
    expect(preserved.snapshot.tasks[0]!.subtasks[1]!.detailsMarkdown).toContain(
      "Reference",
    );
  });

  it("keeps the shipped V2 task and document relation fields intact", () => {
    const payload = structuredClone(v2Fixture) as {
      tasks: Array<{ linkedDocumentIds: string[] }>;
      documents: Array<{ linkedTaskIds: string[]; deletedAt?: string }>;
    };
    payload.documents[0]!.deletedAt = "2030-01-01T00:00:00.000Z";

    const parsed = parseDesktopDomainSnapshot(payload);

    expect(parsed).toMatchObject({ ok: true, warnings: [] });
    if (!parsed.ok) return;
    expect(parsed.snapshot.tasks[0]!.linkedDocumentIds).toEqual([
      "document-v2",
    ]);
    expect(parsed.snapshot.documents[0]!.linkedTaskIds).toEqual(["task-v2"]);
    expect(parsed.snapshot.documents[0]!.deletedAt).toBe(
      "2030-01-01T00:00:00.000Z",
    );
  });
});
