import { describe, expect, it } from "vitest";

import { initialDesktopPrototypeState } from "@/prototype/desktop-state";
import {
  createDesktopDomainSnapshot,
  parseDesktopDomainSnapshotV3,
} from "@/prototype/persistence/domain-snapshot";

describe("desktop snapshot V3 application/SQL parity corpus", () => {
  const invalidWhitespaceCases = [
    {
      name: "tab-only required identifier",
      mutate: (snapshot: ReturnType<typeof createDesktopDomainSnapshot>) => {
        snapshot.projects[0]!.id = "\t";
      },
    },
    {
      name: "newline-only relation identifier",
      mutate: (snapshot: ReturnType<typeof createDesktopDomainSnapshot>) => {
        snapshot.tasks[0]!.linkedDocumentIds = ["\n"];
      },
    },
    {
      name: "whitespace-only folder path segment",
      mutate: (snapshot: ReturnType<typeof createDesktopDomainSnapshot>) => {
        snapshot.knowledgeFolders.push({
          id: "mock-knowledge-folder-whitespace",
          projectId: snapshot.projects[0]!.id,
          path: ["\r\t"],
        });
      },
    },
  ];

  it.each(invalidWhitespaceCases)("rejects $name", ({ mutate }) => {
    const snapshot = createDesktopDomainSnapshot(
      structuredClone(initialDesktopPrototypeState),
    );
    mutate(snapshot);

    const parsed = parseDesktopDomainSnapshotV3(snapshot);

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors.map((issue) => issue.code)).toContain(
        "invalid-string",
      );
    }
  });
});
