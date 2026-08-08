import { describe, expect, it } from "vitest";
import {
  desktopPrototypeReducer,
  initialDesktopPrototypeState,
} from "@/prototype/desktop-state";
import {
  DESKTOP_DOMAIN_SCHEMA_VERSION,
  createDesktopDomainSnapshot,
  parseDesktopDomainSnapshot,
  type DesktopDomainSnapshot,
} from "@/prototype/persistence/domain-snapshot";
import type { DesktopPrototypeState } from "@/prototype/state/types";

function freshState(): DesktopPrototypeState {
  return structuredClone(initialDesktopPrototypeState);
}

function validSnapshot(): DesktopDomainSnapshot {
  return createDesktopDomainSnapshot(freshState());
}

function hydrate(
  state: DesktopPrototypeState,
  snapshot: DesktopDomainSnapshot,
): DesktopPrototypeState {
  return desktopPrototypeReducer(state, { type: "hydrate-domain", snapshot });
}

describe("desktop domain hydration", () => {
  it("replaces only persisted domain collections and preserves frozen state", () => {
    const state = freshState();
    state.projects[0]!.name = "Old project name";
    state.selectedCanvasId = "canvas-l-characters";
    state.selectedCanvasObjectId = "character-nastenka";
    state.selectedInboxItemId = "inbox-l-text";
    state.selectedAiProposalIds = ["proposal-1"];
    state.aiActivityLog = ["Existing AI activity"];
    const frozen = {
      canvases: state.canvases,
      canvasGroups: state.canvasGroups,
      inboxItems: state.inboxItems,
      selectedAiProposalIds: state.selectedAiProposalIds,
      aiActivityLog: state.aiActivityLog,
    };
    const snapshot = validSnapshot();
    snapshot.projects[0]!.name = "Hydrated project name";

    const next = hydrate(state, snapshot);

    expect(next).not.toBe(state);
    expect(next.projects[0]?.name).toBe("Hydrated project name");
    expect(next.overviewDirections).toEqual(snapshot.overviewDirections);
    expect(next.taskGroups).toEqual(snapshot.taskGroups);
    expect(next.taskLists).toEqual(snapshot.taskLists);
    expect(next.tasks).toEqual(snapshot.tasks);
    expect(next.knowledgeFolders).toEqual(snapshot.knowledgeFolders);
    expect(next.documents).toEqual(snapshot.documents);
    expect(next.canvases).toBe(frozen.canvases);
    expect(next.canvasGroups).toBe(frozen.canvasGroups);
    expect(next.inboxItems).toBe(frozen.inboxItems);
    expect(next.selectedCanvasId).toBe("canvas-l-characters");
    expect(next.selectedCanvasObjectId).toBe("character-nastenka");
    expect(next.selectedInboxItemId).toBe("inbox-l-text");
    expect(next.selectedAiProposalIds).toBe(frozen.selectedAiProposalIds);
    expect(next.aiActivityLog).toBe(frozen.aiActivityLog);
  });

  it("preserves safe preferences and clears entity-bound session state", () => {
    const state: DesktopPrototypeState = {
      ...freshState(),
      activeSection: "knowledge",
      projectRailCollapsed: true,
      overviewExpandedTaskId: "luko-first-scene",
      overviewHiddenDirectionIds: [
        "lukomorie-scenario",
        "ammonit-scenario",
        "missing-direction",
      ],
      overviewScrollLeft: 320,
      overviewArticleSourceTaskId: "luko-first-scene",
      overviewArticlePreviewDocumentId: "doc-l-first-chapter",
      editingTaskTitleId: "luko-first-scene",
      selectedTaskId: "luko-first-scene",
      taskDetailViewTaskId: "luko-first-scene",
      selectedDocumentId: "doc-l-magic",
      selectedDocumentFolder: "Мир",
      selectedKnowledgeFolderPath: ["Мир"],
      expandedFolderIds: ["lukomorie:Мир"],
      knowledgeExpandedBeforeCollapse: ["lukomorie:Мир"],
      editingKnowledgeFolderId: "lukomorie:Мир",
      knowledgeSearchQuery: "магия",
      openDocumentIds: ["doc-l-magic"],
      documentHistoryBack: ["doc-l-nastenka"],
      documentHistoryForward: ["doc-l-scenes"],
      knowledgeContextMode: "backlinks",
      knowledgeSplitEnabled: true,
      splitViewDocumentId: "doc-l-scenes",
      activeKnowledgePane: "secondary",
      editingKnowledgeDocumentId: "doc-l-magic",
      taskSearchQuery: "сцена",
      expandedTaskGroupIds: ["lukomorie-baza"],
      contextPanel: { kind: "document-context", documentId: "doc-l-magic" },
      contextPanelBeforeAi: {
        kind: "task",
        taskId: "luko-first-scene",
      },
      commandPaletteOpen: true,
    };

    const next = hydrate(state, validSnapshot());

    expect(next.activeSection).toBe("knowledge");
    expect(next.projectRailCollapsed).toBe(true);
    expect(next.knowledgeContextMode).toBe("backlinks");
    expect(next.overviewHiddenDirectionIds).toEqual(["lukomorie-scenario"]);
    expect(next).toMatchObject({
      overviewExpandedTaskId: null,
      overviewScrollLeft: 0,
      overviewArticleSourceTaskId: null,
      overviewArticlePreviewDocumentId: null,
      editingTaskTitleId: null,
      selectedTaskId: null,
      taskDetailViewTaskId: null,
      selectedDocumentId: null,
      selectedDocumentFolder: null,
      selectedKnowledgeFolderPath: null,
      expandedFolderIds: [],
      knowledgeExpandedBeforeCollapse: null,
      editingKnowledgeFolderId: null,
      knowledgeSearchQuery: "",
      openDocumentIds: [],
      documentHistoryBack: [],
      documentHistoryForward: [],
      knowledgeSplitEnabled: false,
      splitViewDocumentId: null,
      activeKnowledgePane: "primary",
      editingKnowledgeDocumentId: null,
      taskSearchQuery: "",
      expandedTaskGroupIds: [],
      contextPanel: null,
      contextPanelBeforeAi: null,
      commandPaletteOpen: false,
    });
  });

  it("keeps a valid active project and falls back to snapshot array order", () => {
    const snapshot = validSnapshot();
    snapshot.projects = [
      snapshot.projects.find((project) => project.id === "ammonit")!,
      ...snapshot.projects.filter((project) => project.id !== "ammonit"),
    ];

    const kept = hydrate(freshState(), snapshot);
    expect(kept.activeProjectId).toBe("lukomorie");

    const staleState = { ...freshState(), activeProjectId: "missing-project" };
    const fallback = hydrate(staleState, snapshot);
    expect(fallback.activeProjectId).toBe("ammonit");
  });

  it("preserves Canvas as a public section alongside the existing sections", () => {
    const canvasSection = hydrate(
      { ...freshState(), activeSection: "canvases" },
      validSnapshot(),
    );
    const publicSection = hydrate(
      { ...freshState(), activeSection: "tasks" },
      validSnapshot(),
    );

    expect(canvasSection.activeSection).toBe("canvases");
    expect(publicSection.activeSection).toBe("tasks");
  });

  it("returns the original state for an unsupported empty workspace", () => {
    const state = freshState();
    const emptySnapshot: DesktopDomainSnapshot = {
      schemaVersion: DESKTOP_DOMAIN_SCHEMA_VERSION,
      projects: [],
      overviewDirections: [],
      taskGroups: [],
      taskLists: [],
      tasks: [],
      knowledgeFolders: [],
      documents: [],
    };

    expect(parseDesktopDomainSnapshot(emptySnapshot)).toMatchObject({
      ok: true,
    });
    expect(hydrate(state, emptySnapshot)).toBe(state);
  });

  it("preserves valid task views and falls invalid list selections back to All", () => {
    const snapshot = validSnapshot();
    const systemSelection = hydrate(
      {
        ...freshState(),
        taskSelection: { kind: "system", view: "important" },
      },
      snapshot,
    );
    const listSelection = hydrate(
      {
        ...freshState(),
        taskSelection: {
          kind: "list",
          listId: "lukomorie-list-scenario",
        },
      },
      snapshot,
    );
    const invalidSelection = hydrate(
      {
        ...freshState(),
        taskSelection: { kind: "list", listId: "ammonit-list-scenario" },
      },
      snapshot,
    );

    expect(systemSelection.taskSelection).toEqual({
      kind: "system",
      view: "important",
    });
    expect(listSelection.taskSelection).toEqual({
      kind: "list",
      listId: "lukomorie-list-scenario",
    });
    expect(invalidSelection.taskSelection).toEqual({
      kind: "system",
      view: "all",
    });
  });

  it("restores persisted counters without changing frozen counters", () => {
    const state = {
      ...freshState(),
      nextCanvasGroupNumber: 41,
      nextCanvasNumber: 42,
      nextInboxItemNumber: 43,
    };
    const snapshot = validSnapshot();
    snapshot.projects.push({
      id: "mock-project-7",
      name: "Seven",
      shortName: "Seven",
      description: "",
    });
    snapshot.tasks.push({ ...snapshot.tasks[0]!, id: "mock-task-9" });
    snapshot.taskGroups.push({
      ...snapshot.taskGroups[0]!,
      id: "mock-task-group-4",
    });
    snapshot.taskLists.push({
      ...snapshot.taskLists[0]!,
      id: "mock-task-list-6",
    });
    snapshot.documents.push({
      ...snapshot.documents[0]!,
      id: "mock-document-8",
    });
    snapshot.knowledgeFolders.push({
      id: "mock-knowledge-folder-3",
      projectId: "lukomorie",
      path: ["Empty"],
    });

    const hydrated = hydrate(state, snapshot);
    expect(hydrated).toMatchObject({
      nextProjectNumber: 8,
      nextTaskNumber: 10,
      nextTaskGroupNumber: 5,
      nextTaskListNumber: 7,
      nextDocumentNumber: 9,
      nextKnowledgeFolderNumber: 4,
      nextCanvasGroupNumber: 41,
      nextCanvasNumber: 42,
      nextInboxItemNumber: 43,
    });

    const created = desktopPrototypeReducer(hydrated, {
      type: "create-project",
    });
    expect(created.projects.at(-1)?.id).toBe("mock-project-8");
    expect(
      created.projects.filter((project) => project.id === "mock-project-7"),
    ).toHaveLength(1);
  });

  it("isolates hydrated state and the source snapshot in both directions", () => {
    const state = freshState();
    const snapshot = validSnapshot();
    snapshot.tasks[0]!.links = [
      {
        id: "snapshot-link",
        title: "Original link",
        url: "https://example.com",
      },
    ];
    snapshot.knowledgeFolders.push({
      id: "mock-knowledge-folder-1",
      projectId: "lukomorie",
      path: ["Original folder"],
    });
    const next = hydrate(state, snapshot);
    const hydratedTitle = next.tasks[0]!.title;
    const hydratedSubtaskTitle = next.tasks[0]!.subtasks[0]!.title;
    const hydratedContent = next.documents[0]!.content[0];

    snapshot.tasks[0]!.title = "Mutated snapshot";
    snapshot.tasks[0]!.subtasks[0]!.title = "Mutated subtask";
    snapshot.tasks[0]!.links[0]!.title = "Mutated link";
    snapshot.knowledgeFolders[0]!.path[0] = "Mutated folder";
    snapshot.documents[0]!.content[0] = "Mutated content";

    expect(next.tasks[0]!.title).toBe(hydratedTitle);
    expect(next.tasks[0]!.subtasks[0]!.title).toBe(hydratedSubtaskTitle);
    expect(next.tasks[0]!.links[0]!.title).toBe("Original link");
    expect(next.knowledgeFolders[0]!.path).toEqual(["Original folder"]);
    expect(next.documents[0]!.content[0]).toBe(hydratedContent);

    const updated = desktopPrototypeReducer(next, {
      type: "set-task-notes",
      taskId: next.tasks[0]!.id,
      notes: "Hydrated state mutation",
    });
    expect(updated.tasks[0]!.notes).toBe("Hydrated state mutation");
    expect(snapshot.tasks[0]!.notes).not.toBe("Hydrated state mutation");
  });

  it("is deterministic for the same state and snapshot", () => {
    const state = freshState();
    const snapshot = validSnapshot();

    expect(hydrate(state, snapshot)).toEqual(hydrate(state, snapshot));
  });
});
