import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { analyzeMarkdownStructure } from "@/lib/markdown";
import {
  getCommandResults,
  getKnowledgeTree,
  initialDesktopPrototypeState,
} from "@/prototype/desktop-state";
import { createDesktopDomainSnapshot } from "@/prototype/persistence/domain-snapshot";

function averageMs(iterations: number, run: () => unknown): number {
  let sink: unknown;
  const startedAt = performance.now();
  for (let index = 0; index < iterations; index += 1) sink = run();
  void sink;
  return (performance.now() - startedAt) / iterations;
}

function roundMs(value: number): number {
  return Math.round(value * 1000) / 1000;
}

describe("Stage 5 runtime profile characterization", () => {
  it("profiles a roughly 10x-current Desktop workload without timing gates", () => {
    const base = structuredClone(initialDesktopPrototypeState);
    const documentTemplate = base.documents.find(
      (document) =>
        document.projectId === base.activeProjectId &&
        document.deletedAt === undefined,
    )!;
    const taskTemplate = base.tasks.find(
      (task) => task.projectId === base.activeProjectId,
    )!;
    const bodyLines = Array.from(
      { length: 200 },
      (_, index) =>
        `Paragraph ${index}: realistic Markdown body with **formatting**, [[doc:profile-doc-0]], and Unicode — Лукоморье.`,
    );

    const profileState = {
      ...base,
      documents: Array.from({ length: 530 }, (_, index) => ({
        ...structuredClone(documentTemplate),
        id: `profile-doc-${index}`,
        projectId: base.activeProjectId,
        title: `Profile Document ${index}`,
        excerpt: `Profile excerpt ${index}`,
        folder: "Profile",
        folderPath: ["Profile", `Bucket ${index % 20}`],
        order: index,
        content: [`# Profile Document ${index}`, ...bodyLines],
        backlinks: [],
      })),
      tasks: Array.from({ length: 180 }, (_, index) => ({
        ...structuredClone(taskTemplate),
        id: `profile-task-${index}`,
        projectId: base.activeProjectId,
        title: `Profile Task ${index}`,
        linkedDocumentIds: [],
      })),
    };

    const treeStartedAt = performance.now();
    const firstTree = getKnowledgeTree(profileState);
    const knowledgeTreeBuildMs = performance.now() - treeStartedAt;

    const contentOnlyState = {
      ...profileState,
      documents: profileState.documents.map((document, index) =>
        index === 0
          ? { ...document, content: [...document.content, "content-only edit"] }
          : document,
      ),
    };
    const reusedTree = getKnowledgeTree(contentOnlyState);
    const knowledgeTreeReuseAverageMs = averageMs(100, () =>
      getKnowledgeTree(contentOnlyState),
    );

    const persistedState = {
      projects: profileState.projects,
      overviewDirections: profileState.overviewDirections,
      taskGroups: profileState.taskGroups,
      taskLists: profileState.taskLists,
      tasks: profileState.tasks,
      knowledgeFolders: profileState.knowledgeFolders,
      documents: profileState.documents,
    };
    const snapshotAverageMs = averageMs(10, () =>
      createDesktopDomainSnapshot(persistedState),
    );

    const commandSearchAverageMs = averageMs(50, () =>
      getCommandResults(
        {
          projects: profileState.projects,
          tasks: profileState.tasks,
          documents: profileState.documents,
          inboxItems: profileState.inboxItems,
        },
        "profile",
      ),
    );

    const longMarkdown = [
      "# Large profile document",
      ...Array.from({ length: 1200 }, (_, index) =>
        index % 100 === 0
          ? `\n## Section ${index / 100}\n\n| Field | Value |\n| --- | --- |\n| Item ${index} | Значение |`
          : `Paragraph ${index} with **bold**, *italic*, [link](https://example.com), and [[doc:profile-doc-0]].`,
      ),
    ].join("\n\n");
    const markdownAnalysisAverageMs = averageMs(5, () =>
      analyzeMarkdownStructure(longMarkdown),
    );

    const commandResults = getCommandResults(
      {
        projects: profileState.projects,
        tasks: profileState.tasks,
        documents: profileState.documents,
        inboxItems: profileState.inboxItems,
      },
      "profile",
    );
    const markdownStructure = analyzeMarkdownStructure(longMarkdown);

    expect(profileState.documents).toHaveLength(530);
    expect(profileState.tasks).toHaveLength(180);
    expect(firstTree.length).toBeGreaterThan(0);
    expect(reusedTree).toBe(firstTree);
    expect(commandResults).toHaveLength(10);
    expect(markdownStructure.headings.length).toBeGreaterThan(1);
    expect(markdownStructure.tables.length).toBeGreaterThan(1);

    console.info(
      "STAGE5_PROFILE",
      JSON.stringify({
        documents: profileState.documents.length,
        tasks: profileState.tasks.length,
        linesPerDocument: profileState.documents[0]?.content.length ?? 0,
        knowledgeTreeBuildMs: roundMs(knowledgeTreeBuildMs),
        knowledgeTreeReuseAverageMs: roundMs(knowledgeTreeReuseAverageMs),
        snapshotAverageMs: roundMs(snapshotAverageMs),
        commandSearchAverageMs: roundMs(commandSearchAverageMs),
        markdownProfileLines: longMarkdown.split("\n").length,
        markdownAnalysisAverageMs: roundMs(markdownAnalysisAverageMs),
      }),
    );
  });
});
