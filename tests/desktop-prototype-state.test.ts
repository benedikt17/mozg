import { describe, expect, it } from "vitest";
import type { DesktopPrototypeState } from "@/prototype/desktop-state";
import {
  ALL_AREAS,
  desktopPrototypeReducer,
  getCommandResults,
  getDocumentAncestorFolderIds,
  getDocumentById,
  getKeyDocuments,
  getKnowledgeTree,
  getTasksForLane,
  getVisibleOverviewTasks,
  getVisibleTaskList,
  initialDesktopPrototypeState,
} from "@/prototype/desktop-state";

function freshState(): DesktopPrototypeState {
  return {
    ...initialDesktopPrototypeState,
    projects: initialDesktopPrototypeState.projects.map((project) => ({
      ...project,
    })),
    milestones: initialDesktopPrototypeState.milestones.map((milestone) => ({
      ...milestone,
    })),
    tasks: initialDesktopPrototypeState.tasks.map((task) => ({
      ...task,
      linkedDocumentIds: [...task.linkedDocumentIds],
      subtasks: task.subtasks.map((subtask) => ({ ...subtask })),
    })),
    documents: initialDesktopPrototypeState.documents.map((document) => ({
      ...document,
      content: [...document.content],
      linkedTaskIds: [...document.linkedTaskIds],
      backlinks: [...document.backlinks],
    })),
    canvases: initialDesktopPrototypeState.canvases.map((canvas) => ({
      ...canvas,
      objects: canvas.objects.map((object) => ({ ...object })),
    })),
    inboxItems: initialDesktopPrototypeState.inboxItems.map((item) => ({
      ...item,
    })),
    filters: { ...initialDesktopPrototypeState.filters },
    expandedFolderIds: [...initialDesktopPrototypeState.expandedFolderIds],
    openDocumentIds: [...initialDesktopPrototypeState.openDocumentIds],
    documentHistoryBack: [...initialDesktopPrototypeState.documentHistoryBack],
    documentHistoryForward: [
      ...initialDesktopPrototypeState.documentHistoryForward,
    ],
    selectedAiProposalIds: [
      ...initialDesktopPrototypeState.selectedAiProposalIds,
    ],
    aiActivityLog: [...initialDesktopPrototypeState.aiActivityLog],
  };
}

describe("desktop structural prototype state", () => {
  it("collapses the project rail without changing project navigation state", () => {
    const state = desktopPrototypeReducer(freshState(), {
      type: "toggle-project-rail",
    });

    expect(state.projectRailCollapsed).toBe(true);
    expect(state.activeProjectId).toBe("lukomorie");
    expect(state.activeSection).toBe("overview");
  });

  it("switches projects from the rail and resets project-specific selections", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "select-task",
      taskId: "luko-characters-map",
      section: "overview",
    });
    state = desktopPrototypeReducer(state, {
      type: "switch-section",
      section: "knowledge",
    });

    state = desktopPrototypeReducer(state, {
      type: "switch-project",
      projectId: "ammonit",
    });

    expect(state.activeProjectId).toBe("ammonit");
    expect(state.activeSection).toBe("knowledge");
    expect(state.selectedTaskId).toBeNull();
    expect(state.selectedDocumentId).toBe("doc-a-index");
    expect(state.selectedDocumentFolder).toBe("Исследование");
    expect(state.contextPanel).toBeNull();
    expect(state.filters.milestoneId).toBe("ammonit-research");
  });

  it("switches sections and closes the shared context slot", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "select-task",
      taskId: "luko-first-scene",
      section: "overview",
    });

    state = desktopPrototypeReducer(state, {
      type: "switch-section",
      section: "canvases",
    });

    expect(state.activeSection).toBe("canvases");
    expect(state.contextPanel).toBeNull();
  });

  it("opens AI without forcing the active section back to Overview", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "switch-section",
      section: "knowledge",
    });
    state = desktopPrototypeReducer(state, {
      type: "select-document",
      documentId: "doc-l-baba-yaga",
    });
    state = desktopPrototypeReducer(state, { type: "open-ai-panel" });

    expect(state.activeSection).toBe("knowledge");
    expect(state.selectedDocumentId).toBe("doc-l-baba-yaga");
    expect(state.contextPanel).toEqual({ kind: "ai" });
  });

  it("keeps only one context panel active at a time", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "select-task",
      taskId: "luko-first-scene",
      section: "tasks",
    });
    expect(state.contextPanel).toEqual({
      kind: "task",
      taskId: "luko-first-scene",
    });

    state = desktopPrototypeReducer(state, { type: "open-ai-panel" });
    expect(state.contextPanel).toEqual({ kind: "ai" });

    state = desktopPrototypeReducer(state, {
      type: "select-canvas-object",
      canvasId: "canvas-l-characters",
      objectId: "obj-nastenka",
    });
    expect(state.contextPanel).toEqual({
      kind: "canvas-inspector",
      canvasId: "canvas-l-characters",
      objectId: "obj-nastenka",
    });
  });

  it("restores the previous contextual panel after AI is closed", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "select-task",
      taskId: "luko-first-scene",
      section: "tasks",
    });
    state = desktopPrototypeReducer(state, { type: "open-ai-panel" });

    expect(state.contextPanel).toEqual({ kind: "ai" });
    expect(state.contextPanelBeforeAi).toEqual({
      kind: "task",
      taskId: "luko-first-scene",
    });

    state = desktopPrototypeReducer(state, { type: "close-ai-panel" });

    expect(state.contextPanel).toEqual({
      kind: "task",
      taskId: "luko-first-scene",
    });
    expect(state.contextPanelBeforeAi).toBeNull();
  });

  it("closes AI to an empty context slot when no previous panel existed", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, { type: "open-ai-panel" });
    state = desktopPrototypeReducer(state, { type: "close-ai-panel" });

    expect(state.contextPanel).toBeNull();
    expect(state.contextPanelBeforeAi).toBeNull();
  });

  it("selects a document and opens document context", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "select-document",
      documentId: "doc-l-magic",
    });
    state = desktopPrototypeReducer(state, {
      type: "open-document-context",
    });

    expect(state.activeSection).toBe("knowledge");
    expect(state.selectedDocumentId).toBe("doc-l-magic");
    expect(state.selectedDocumentFolder).toBe("Мир");
    expect(state.contextPanel).toEqual({
      kind: "document-context",
      documentId: "doc-l-magic",
    });
  });

  it("selects a task from Tasks and reuses the existing task details model", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "switch-section",
      section: "tasks",
    });
    state = desktopPrototypeReducer(state, {
      type: "select-task",
      taskId: "luko-world-rules",
      section: "tasks",
    });

    expect(state.activeSection).toBe("tasks");
    expect(state.selectedTaskId).toBe("luko-world-rules");
    expect(state.contextPanel).toEqual({
      kind: "task",
      taskId: "luko-world-rules",
    });
  });

  it("shares starred task state between Overview and Tasks", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "toggle-task-star",
      taskId: "luko-first-scene",
    });

    expect(
      getVisibleOverviewTasks(state).find(
        (task) => task.id === "luko-first-scene",
      )?.starred,
    ).toBe(true);

    state = desktopPrototypeReducer(state, {
      type: "switch-section",
      section: "tasks",
    });
    state = desktopPrototypeReducer(state, {
      type: "set-task-filter",
      filter: "important",
    });

    expect(
      getVisibleTaskList(state).some((task) => task.id === "luko-first-scene"),
    ).toBe(true);
  });

  it("selects a canvas and opens a mock object inspector", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "select-canvas",
      canvasId: "canvas-l-plot",
    });
    state = desktopPrototypeReducer(state, {
      type: "select-canvas-object",
      canvasId: "canvas-l-plot",
      objectId: "obj-choice",
    });

    expect(state.activeSection).toBe("canvases");
    expect(state.selectedCanvasId).toBe("canvas-l-plot");
    expect(state.selectedCanvasObjectId).toBe("obj-choice");
    expect(state.contextPanel).toEqual({
      kind: "canvas-inspector",
      canvasId: "canvas-l-plot",
      objectId: "obj-choice",
    });
  });

  it("selects an Inbox item and opens item details", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "set-inbox-filter",
      filter: "audio",
    });
    state = desktopPrototypeReducer(state, {
      type: "select-inbox-item",
      itemId: "inbox-l-audio",
    });

    expect(state.activeSection).toBe("inbox");
    expect(state.inboxFilter).toBe("audio");
    expect(state.selectedInboxItemId).toBe("inbox-l-audio");
    expect(state.contextPanel).toEqual({
      kind: "inbox-item",
      itemId: "inbox-l-audio",
    });
  });

  it("opens a cross-project task from the command palette and synchronizes project filters", () => {
    let state = freshState();
    const result = getCommandResults(state, "Разложить находки").find(
      (item) => item.kind === "task",
    );

    expect(result).toBeDefined();
    if (!result) return;

    state = desktopPrototypeReducer(state, {
      type: "activate-command-result",
      result,
    });

    expect(state.activeProjectId).toBe("ammonit");
    expect(state.activeSection).toBe("tasks");
    expect(state.selectedTaskId).toBe("ammonit-index");
    expect(state.filters).toMatchObject({
      area: ALL_AREAS,
      milestoneId: "ammonit-research",
      starredOnly: false,
    });
    expect(state.contextPanel).toEqual({
      kind: "task",
      taskId: "ammonit-index",
    });
  });

  it("opens an Inbox item from command palette search", () => {
    let state = freshState();
    const result = getCommandResults(state, "Голосовая мысль").find(
      (item) => item.kind === "inbox",
    );

    expect(result).toBeDefined();
    if (!result) return;

    state = desktopPrototypeReducer(state, {
      type: "activate-command-result",
      result,
    });

    expect(state.activeSection).toBe("inbox");
    expect(state.selectedInboxItemId).toBe("inbox-l-audio");
    expect(state.contextPanel).toEqual({
      kind: "inbox-item",
      itemId: "inbox-l-audio",
    });
  });

  it("moves a task between Overview lanes without changing a production status", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "move-task",
      taskId: "luko-production-plan",
      overviewLane: "now",
    });

    expect(
      state.tasks.find((task) => task.id === "luko-production-plan")
        ?.overviewLane,
    ).toBe("now");
  });

  it("sorts starred tasks above normal tasks inside a lane", () => {
    const state = freshState();
    const nowTasks = getTasksForLane(state, "now");

    expect(nowTasks.length).toBeGreaterThan(1);
    expect(nowTasks[0]?.starred).toBe(true);
  });

  it("filters Overview by area, milestone and starred-only toggle", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "set-area-filter",
      area: "Персонажи",
    });
    expect(
      getVisibleOverviewTasks(state).every((task) => task.area === "Персонажи"),
    ).toBe(true);

    state = desktopPrototypeReducer(state, {
      type: "set-area-filter",
      area: ALL_AREAS,
    });
    state = desktopPrototypeReducer(state, {
      type: "set-milestone-filter",
      milestoneId: "lukomorie-world",
    });
    expect(
      getVisibleOverviewTasks(state).every(
        (task) => task.milestoneId === "lukomorie-world",
      ),
    ).toBe(true);

    state = desktopPrototypeReducer(state, { type: "toggle-starred-filter" });
    expect(getVisibleOverviewTasks(state).every((task) => task.starred)).toBe(
      true,
    );
  });

  it("confirms selected AI proposals and applies visible mock updates", () => {
    let state = freshState();
    const initialTaskCount = state.tasks.length;
    state = desktopPrototypeReducer(state, { type: "open-ai-panel" });
    state = desktopPrototypeReducer(state, {
      type: "toggle-ai-proposal",
      proposalId: "create-next-step",
    });
    state = desktopPrototypeReducer(state, {
      type: "toggle-ai-proposal",
      proposalId: "add-question",
    });
    state = desktopPrototypeReducer(state, { type: "confirm-ai-proposals" });

    expect(state.tasks).toHaveLength(initialTaskCount + 1);
    expect(state.tasks[0]).toMatchObject({
      projectId: "lukomorie",
      overviewLane: "next",
    });
    expect(state.aiActivityLog.length).toBeGreaterThan(0);
    expect(state.selectedAiProposalIds).toEqual([]);
  });

  it("opens and closes the command palette and context panel state", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, { type: "open-command-palette" });
    expect(state.commandPaletteOpen).toBe(true);

    state = desktopPrototypeReducer(state, { type: "close-command-palette" });
    expect(state.commandPaletteOpen).toBe(false);

    state = desktopPrototypeReducer(state, {
      type: "select-task",
      taskId: "luko-first-scene",
      section: "overview",
    });
    state = desktopPrototypeReducer(state, { type: "close-context-panel" });
    expect(state.contextPanel).toBeNull();
    expect(state.selectedTaskId).toBe("luko-first-scene");
  });

  it("quickly creates a task in the active project and opens details", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, { type: "create-task" });

    expect(state.tasks[0]).toMatchObject({
      projectId: "lukomorie",
      title: "Новая задача",
      overviewLane: "now",
    });
    expect(state.selectedTaskId).toBe("mock-task-1");
    expect(state.contextPanel).toEqual({
      kind: "task",
      taskId: "mock-task-1",
    });
  });

  it("expands, collapses and collapses all Knowledge folders while preserving the active document path", () => {
    let state = freshState();
    const folderId = "lukomorie:Персонажи/Отношения";

    expect(state.expandedFolderIds).not.toContain(folderId);

    state = desktopPrototypeReducer(state, {
      type: "toggle-knowledge-folder",
      folderId,
    });
    expect(state.expandedFolderIds).toContain(folderId);

    state = desktopPrototypeReducer(state, {
      type: "toggle-knowledge-folder",
      folderId,
    });
    expect(state.expandedFolderIds).not.toContain(folderId);

    state = desktopPrototypeReducer(state, {
      type: "collapse-all-knowledge-folders",
    });

    const selectedDocument = getDocumentById(state, state.selectedDocumentId);
    expect(selectedDocument).toBeDefined();
    expect(state.expandedFolderIds).toEqual(
      selectedDocument ? getDocumentAncestorFolderIds(selectedDocument) : [],
    );
  });

  it("filters the Knowledge tree by nested document context", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "set-knowledge-search",
      query: "тварь из бездны",
    });

    const tree = getKnowledgeTree(state);
    const firstBranch = tree[0];

    expect(state.knowledgeSearchQuery).toBe("тварь из бездны");
    expect(JSON.stringify(tree)).toContain("doc-l-abyss-relationship");
    expect(firstBranch?.kind).toBe("folder");
  });

  it("selects a nested Knowledge document, expands ancestors and opens a tab", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "select-document",
      documentId: "doc-l-routes",
    });

    expect(state.activeSection).toBe("knowledge");
    expect(state.selectedDocumentId).toBe("doc-l-routes");
    expect(state.openDocumentIds).toContain("doc-l-routes");
    expect(state.expandedFolderIds).toContain("lukomorie:Мир");
    expect(state.expandedFolderIds).toContain("lukomorie:Мир/География");
  });

  it("maintains a manual mock-only group of key Knowledge documents", () => {
    let state = freshState();
    expect(getKeyDocuments(state).map((document) => document.id)).toEqual([
      "doc-l-nastenka",
      "doc-l-magic",
      "doc-l-routes",
    ]);

    state = desktopPrototypeReducer(state, {
      type: "toggle-key-document",
      documentId: "doc-l-magic",
    });

    expect(getKeyDocuments(state).map((document) => document.id)).toEqual([
      "doc-l-nastenka",
      "doc-l-routes",
    ]);
  });

  it("closes document tabs and switches the active tab to the remaining document", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "select-document",
      documentId: "doc-l-routes",
    });
    state = desktopPrototypeReducer(state, {
      type: "close-document-tab",
      documentId: "doc-l-routes",
    });

    expect(state.openDocumentIds).not.toContain("doc-l-routes");
    expect(state.selectedDocumentId).toBe(state.openDocumentIds.at(-1));

    const nextTab = state.openDocumentIds[0];
    expect(nextTab).toBeDefined();
    if (!nextTab) return;

    state = desktopPrototypeReducer(state, {
      type: "activate-document-tab",
      documentId: nextTab,
    });
    expect(state.selectedDocumentId).toBe(nextTab);
  });

  it("navigates Knowledge document history backward and forward", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "select-document",
      documentId: "doc-l-routes",
    });
    state = desktopPrototypeReducer(state, {
      type: "select-document",
      documentId: "doc-l-scene-list",
    });

    expect(state.selectedDocumentId).toBe("doc-l-scene-list");
    expect(state.documentHistoryBack).toContain("doc-l-routes");

    state = desktopPrototypeReducer(state, { type: "go-document-back" });
    expect(state.selectedDocumentId).toBe("doc-l-routes");
    expect(state.documentHistoryForward[0]).toBe("doc-l-scene-list");

    state = desktopPrototypeReducer(state, { type: "go-document-forward" });
    expect(state.selectedDocumentId).toBe("doc-l-scene-list");
  });

  it("opens a nested Knowledge document from command palette search", () => {
    let state = freshState();
    const result = getCommandResults(state, "Пути между островами").find(
      (item) => item.kind === "document",
    );

    expect(result).toBeDefined();
    if (!result) return;

    state = desktopPrototypeReducer(state, {
      type: "activate-command-result",
      result,
    });

    expect(state.activeProjectId).toBe("lukomorie");
    expect(state.activeSection).toBe("knowledge");
    expect(state.selectedDocumentId).toBe("doc-l-routes");
    expect(state.openDocumentIds).toContain("doc-l-routes");
    expect(state.expandedFolderIds).toContain("lukomorie:Мир/География");
    expect(state.contextPanel).toEqual({
      kind: "document-context",
      documentId: "doc-l-routes",
    });
  });

  it("opens document context, switches context modes and restores it after AI closes", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "select-document",
      documentId: "doc-l-routes",
    });
    state = desktopPrototypeReducer(state, {
      type: "open-document-context",
    });
    state = desktopPrototypeReducer(state, {
      type: "set-knowledge-context-mode",
      mode: "backlinks",
    });

    expect(state.knowledgeContextMode).toBe("backlinks");
    expect(state.contextPanel).toEqual({
      kind: "document-context",
      documentId: "doc-l-routes",
    });

    state = desktopPrototypeReducer(state, { type: "open-ai-panel" });
    expect(state.contextPanel).toEqual({ kind: "ai" });

    state = desktopPrototypeReducer(state, { type: "close-ai-panel" });
    expect(state.contextPanel).toEqual({
      kind: "document-context",
      documentId: "doc-l-routes",
    });
  });

  it("toggles the Knowledge split-view mock without changing persistence data", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "toggle-knowledge-split-view",
    });

    expect(state.splitViewDocumentId).toBeTruthy();
    expect(state.splitViewDocumentId).not.toBe(state.selectedDocumentId);

    state = desktopPrototypeReducer(state, {
      type: "toggle-knowledge-split-view",
    });
    expect(state.splitViewDocumentId).toBeNull();
  });
});
