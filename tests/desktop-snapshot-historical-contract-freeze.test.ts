import { describe, expect, it } from "vitest";

import v1Fixture from "./fixtures/desktop-domain-snapshot-v1.json";
import v2Fixture from "./fixtures/desktop-domain-snapshot-v2.json";
import { parseDesktopDomainSnapshot } from "@/prototype/persistence/domain-snapshot";

type MutableV2Fixture = {
  projects: Array<Record<string, unknown>>;
  overviewDirections: Array<Record<string, unknown>>;
  taskGroups: Array<Record<string, unknown>>;
  taskLists: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  knowledgeFolders: Array<Record<string, unknown>>;
  documents: Array<Record<string, unknown>>;
};

function mutableV2Fixture(): MutableV2Fixture {
  return structuredClone(v2Fixture) as unknown as MutableV2Fixture;
}

const historicalUnknownFieldCases: Array<{
  name: string;
  path: string;
  mutate: (snapshot: MutableV2Fixture) => void;
}> = [
  {
    name: "project",
    path: "projects[0].futureField",
    mutate: (snapshot) => {
      snapshot.projects[0]!.futureField = true;
    },
  },
  {
    name: "Overview direction",
    path: "overviewDirections[0].futureField",
    mutate: (snapshot) => {
      snapshot.overviewDirections[0]!.futureField = true;
    },
  },
  {
    name: "task group",
    path: "taskGroups[0].futureField",
    mutate: (snapshot) => {
      snapshot.taskGroups[0]!.futureField = true;
    },
  },
  {
    name: "task list",
    path: "taskLists[0].futureField",
    mutate: (snapshot) => {
      snapshot.taskLists[0]!.futureField = true;
    },
  },
  {
    name: "task",
    path: "tasks[0].futureField",
    mutate: (snapshot) => {
      snapshot.tasks[0]!.futureField = true;
    },
  },
  {
    name: "task link",
    path: "tasks[0].links[0].futureField",
    mutate: (snapshot) => {
      const links = snapshot.tasks[0]!.links as Array<Record<string, unknown>>;
      links[0]!.futureField = true;
    },
  },
  {
    name: "V2 subtask",
    path: "tasks[0].subtasks[0].futureField",
    mutate: (snapshot) => {
      const subtasks = snapshot.tasks[0]!.subtasks as Array<
        Record<string, unknown>
      >;
      subtasks[0]!.futureField = true;
    },
  },
  {
    name: "Knowledge folder",
    path: "knowledgeFolders[0].futureField",
    mutate: (snapshot) => {
      snapshot.knowledgeFolders[0]!.futureField = true;
    },
  },
  {
    name: "Knowledge document",
    path: "documents[0].futureField",
    mutate: (snapshot) => {
      snapshot.documents[0]!.futureField = true;
    },
  },
];

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

  it.each(historicalUnknownFieldCases)(
    "keeps the historical $name field set closed",
    ({ mutate, path }) => {
      const snapshot = mutableV2Fixture();
      mutate(snapshot);

      const parsed = parseDesktopDomainSnapshot(snapshot);

      expect(parsed.ok).toBe(false);
      if (!parsed.ok) {
        expect(parsed.errors).toContainEqual(
          expect.objectContaining({ code: "unknown-field", path }),
        );
      }
    },
  );

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

  it("does not widen the historical parser to unknown schema versions", () => {
    const snapshot = { ...structuredClone(v2Fixture), schemaVersion: 4 };

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
