import { describe, expect, it } from "vitest";

import {
  desktopPrototypeReducer,
  initialDesktopPrototypeState,
} from "@/prototype/desktop-state";
import {
  DESKTOP_DOMAIN_SCHEMA_VERSION,
  createDesktopDomainSnapshot,
  parseDesktopDomainSnapshotV3,
} from "@/prototype/persistence/domain-snapshot";
import { getLinkedTaskIdsForDocument } from "@/prototype/state/selectors";

describe("desktop snapshot v3 contract", () => {
  it("persists the task-owned relation and omits the document reverse field", () => {
    const snapshot = createDesktopDomainSnapshot(initialDesktopPrototypeState);

    expect(snapshot.schemaVersion).toBe(DESKTOP_DOMAIN_SCHEMA_VERSION);
    expect(snapshot.tasks[0]).toHaveProperty("linkedDocumentIds");
    expect(snapshot.documents[0]).not.toHaveProperty("linkedTaskIds");
    expect(parseDesktopDomainSnapshotV3(snapshot)).toMatchObject({
      ok: true,
      warnings: [],
    });
  });

  it("rejects dangling task-owned document references without requiring a reverse field", () => {
    const snapshot = createDesktopDomainSnapshot(initialDesktopPrototypeState);
    snapshot.tasks[0]!.linkedDocumentIds = ["missing-document"];

    const parsed = parseDesktopDomainSnapshotV3(snapshot);

    expect(parsed).toMatchObject({ ok: false });
    if (!parsed.ok) {
      expect(parsed.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "missing-document",
            path: "tasks[0].linkedDocumentIds[0]",
          }),
        ]),
      );
    }
  });

  it("loads V3 into runtime state and derives reverse task IDs from tasks", () => {
    const attached = desktopPrototypeReducer(initialDesktopPrototypeState, {
      type: "attach-task-document",
      taskId: "luko-characters-map",
      documentId: "doc-l-magic",
    });
    const snapshot = createDesktopDomainSnapshot(attached);
    const parsed = parseDesktopDomainSnapshotV3(snapshot);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const hydrated = desktopPrototypeReducer(initialDesktopPrototypeState, {
      type: "hydrate-domain",
      snapshot: parsed.snapshot,
    });
    expect(getLinkedTaskIdsForDocument(hydrated, "doc-l-magic")).toContain(
      "luko-characters-map",
    );
    expect(hydrated.documents[0]).not.toHaveProperty("linkedTaskIds");
  });
});
