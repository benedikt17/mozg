import { describe, expect, it } from "vitest";
import { taskFilters } from "@/prototype/desktop-mock-data";
import type { DesktopPrototypeState } from "@/prototype/desktop-state";
import {
  desktopPrototypeReducer,
  getCommandResults,
  getDocumentById,
  getKeyDocuments,
  getKnowledgePaneState,
  getKnowledgeTree,
  getProjectDocuments,
  getProjectOverviewDirections,
  getTasksForDirection,
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
    overviewDirections: initialDesktopPrototypeState.overviewDirections.map(
      (direction) => ({ ...direction }),
    ),
    tasks: initialDesktopPrototypeState.tasks.map((task) => ({
      ...task,
      links: task.links.map((link) => ({ ...link })),
      linkedDocumentIds: [...task.linkedDocumentIds],
      subtasks: task.subtasks.map((subtask) => ({ ...subtask })),
    })),
    taskFolders: initialDesktopPrototypeState.taskFolders.map((folder) => ({
      ...folder,
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

function directionTaskIds(
  state: DesktopPrototypeState,
  directionId: string,
): string[] {
  return getTasksForDirection(state, directionId).map((task) => task.id);
}

describe("desktop structural prototype state", () => {
  it("exposes the compact fixed Tasks lists in product order", () => {
    expect(taskFilters.map((filter) => filter.id)).toEqual([
      "all",
      "overview",
      "important",
      "completed",
    ]);
  });

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

  it("creates a mock project with one editable Overview direction", () => {
    const state = desktopPrototypeReducer(freshState(), {
      type: "create-project",
    });

    expect(state.activeProjectId).toBe("mock-project-1");
    expect(getProjectOverviewDirections(state)).toEqual([
      expect.objectContaining({
        projectId: "mock-project-1",
        title: "Основное направление",
        order: 0,
      }),
    ]);
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

  it("focuses one task in the normal Tasks layout and returns to all tasks", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "open-task-detail-view",
      taskId: "luko-first-scene",
    });

    expect(state.activeSection).toBe("tasks");
    expect(state.selectedTaskId).toBe("luko-first-scene");
    expect(state.taskDetailViewTaskId).toBe("luko-first-scene");
    expect(state.contextPanel).toEqual({
      kind: "task",
      taskId: "luko-first-scene",
    });

    state = desktopPrototypeReducer(state, {
      type: "close-task-detail-view",
    });

    expect(state.activeSection).toBe("tasks");
    expect(state.taskDetailViewTaskId).toBeNull();
    expect(state.contextPanel).toEqual({
      kind: "task",
      taskId: "luko-first-scene",
    });
    expect(state.selectedTaskId).toBe("luko-first-scene");
  });

  it("returns normal task selection to the list-and-panel mode", () => {
    let state = desktopPrototypeReducer(freshState(), {
      type: "open-task-detail-view",
      taskId: "luko-first-scene",
    });
    state = desktopPrototypeReducer(state, {
      type: "select-task",
      taskId: "luko-first-scene",
      section: "tasks",
    });

    expect(state.taskDetailViewTaskId).toBe("luko-first-scene");

    state = desktopPrototypeReducer(state, {
      type: "select-task",
      taskId: "luko-world-rules",
      section: "tasks",
    });

    expect(state.taskDetailViewTaskId).toBeNull();
    expect(state.contextPanel).toEqual({
      kind: "task",
      taskId: "luko-world-rules",
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

  it("opens a cross-project task from the command palette", () => {
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

  it("moves a task between project directions through the shared append helper", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "move-task",
      taskId: "luko-production-plan",
      overviewDirectionId: "lukomorie-scenario",
    });

    expect(
      state.tasks.find((task) => task.id === "luko-production-plan")
        ?.overviewDirectionId,
    ).toBe("lukomorie-scenario");
    expect(directionTaskIds(state, "lukomorie-scenario").at(-1)).toBe(
      "luko-production-plan",
    );
  });

  it("rejects moving a task into a direction owned by another project", () => {
    const state = freshState();
    const next = desktopPrototypeReducer(state, {
      type: "move-overview-task",
      taskId: "luko-first-scene",
      targetDirectionId: "ammonit-research-direction",
      targetIndex: 0,
    });

    expect(next).toBe(state);
  });

  it("uses manual order as authoritative when a task star changes", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "move-overview-task",
      taskId: "luko-first-scene",
      targetDirectionId: "lukomorie-scenario",
      targetIndex: 0,
    });
    const before = directionTaskIds(state, "lukomorie-scenario");
    state = desktopPrototypeReducer(state, {
      type: "toggle-task-star",
      taskId: "luko-first-scene",
    });

    expect(directionTaskIds(state, "lukomorie-scenario")).toEqual(before);
    expect(directionTaskIds(state, "lukomorie-scenario")[0]).toBe(
      "luko-first-scene",
    );
  });

  it("sets and clears semantic task signals without affecting order", () => {
    let state = freshState();
    const before = directionTaskIds(state, "lukomorie-scenario");
    state = desktopPrototypeReducer(state, {
      type: "set-task-signal",
      taskId: "luko-first-scene",
      signal: "red",
    });
    expect(
      state.tasks.find((task) => task.id === "luko-first-scene")?.signal,
    ).toBe("red");
    expect(directionTaskIds(state, "lukomorie-scenario")).toEqual(before);

    state = desktopPrototypeReducer(state, {
      type: "set-task-signal",
      taskId: "luko-first-scene",
      signal: "none",
    });
    expect(
      state.tasks.find((task) => task.id === "luko-first-scene")?.signal,
    ).toBe("none");
  });

  it("appends a trimmed incomplete subtask only to the selected task", () => {
    const state = freshState();
    const targetBefore = state.tasks.find(
      (task) => task.id === "luko-first-scene",
    );
    const otherBefore = state.tasks.find(
      (task) => task.id === "luko-world-rules",
    );
    const unchanged = desktopPrototypeReducer(state, {
      type: "add-subtask",
      taskId: "luko-first-scene",
      title: "   ",
    });

    expect(unchanged).toBe(state);

    const next = desktopPrototypeReducer(state, {
      type: "add-subtask",
      taskId: "luko-first-scene",
      title: "  Проверить переход сцены  ",
    });
    const targetAfter = next.tasks.find(
      (task) => task.id === "luko-first-scene",
    );
    const otherAfter = next.tasks.find(
      (task) => task.id === "luko-world-rules",
    );

    expect(targetAfter?.subtasks.slice(0, -1)).toEqual(targetBefore?.subtasks);
    expect(targetAfter?.subtasks.at(-1)).toMatchObject({
      title: "Проверить переход сцены",
      done: false,
    });
    expect(otherAfter?.subtasks).toEqual(otherBefore?.subtasks);
  });

  it("uses the Overview smart-list flag independently from task folders", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "set-task-overview",
      taskId: "luko-first-scene",
      visible: false,
    });

    expect(
      getVisibleOverviewTasks(state).some(
        (task) => task.id === "luko-first-scene",
      ),
    ).toBe(false);
    expect(getVisibleTaskList(state).map((task) => task.id)).toContain(
      "luko-first-scene",
    );

    state = desktopPrototypeReducer(state, {
      type: "set-task-filter",
      filter: "overview",
    });
    expect(getVisibleTaskList(state).map((task) => task.id)).not.toContain(
      "luko-first-scene",
    );

    state = desktopPrototypeReducer(state, {
      type: "assign-task-folder",
      taskId: "luko-first-scene",
      folderId: "lukomorie-visual-folder",
    });
    expect(
      state.tasks.find((task) => task.id === "luko-first-scene")
        ?.showOnOverview,
    ).toBe(false);
  });

  it("creates, renames, selects and deletes only empty task folders", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "create-task-folder",
      title: "  На проверку  ",
    });
    const folder = state.taskFolders.find(
      (item) => item.id === "mock-task-folder-1",
    );
    expect(folder?.title).toBe("На проверку");

    state = desktopPrototypeReducer(state, {
      type: "rename-task-folder",
      folderId: "mock-task-folder-1",
      title: "  Финальная проверка  ",
    });
    state = desktopPrototypeReducer(state, {
      type: "assign-task-folder",
      taskId: "luko-first-scene",
      folderId: "mock-task-folder-1",
    });
    state = desktopPrototypeReducer(state, {
      type: "select-task-folder",
      folderId: "mock-task-folder-1",
    });

    expect(getVisibleTaskList(state).map((task) => task.id)).toEqual([
      "luko-first-scene",
    ]);
    const withTask = desktopPrototypeReducer(state, {
      type: "delete-task-folder",
      folderId: "mock-task-folder-1",
    });
    expect(withTask).toBe(state);

    state = desktopPrototypeReducer(state, {
      type: "assign-task-folder",
      taskId: "luko-first-scene",
      folderId: null,
    });
    state = desktopPrototypeReducer(state, {
      type: "delete-task-folder",
      folderId: "mock-task-folder-1",
    });
    expect(
      state.taskFolders.some((item) => item.id === "mock-task-folder-1"),
    ).toBe(false);
    expect(state.selectedTaskFolderId).toBeNull();
  });

  it("reorders the Tasks list without changing Overview placement", () => {
    let state = freshState();
    const overviewPlacement = state.tasks
      .filter((task) => task.projectId === "lukomorie")
      .map((task) => [task.id, task.overviewDirectionId, task.overviewOrder]);

    state = desktopPrototypeReducer(state, {
      type: "move-task-list",
      taskId: "luko-production-plan",
      targetTaskId: "luko-characters-map",
    });

    expect(getVisibleTaskList(state).map((task) => task.id)[0]).toBe(
      "luko-production-plan",
    );
    expect(
      state.tasks
        .filter((task) => task.projectId === "lukomorie")
        .map((task) => [task.id, task.overviewDirectionId, task.overviewOrder]),
    ).toEqual(overviewPlacement);
  });

  it("adds, edits and deletes validated task links only on the target task", () => {
    const state = freshState();
    const rejectedEmpty = desktopPrototypeReducer(state, {
      type: "add-task-link",
      taskId: "luko-first-scene",
      title: "   ",
      url: "https://example.com",
    });
    const rejectedProtocol = desktopPrototypeReducer(state, {
      type: "add-task-link",
      taskId: "luko-first-scene",
      title: "Файл",
      url: "ftp://example.com/file",
    });

    expect(rejectedEmpty).toBe(state);
    expect(rejectedProtocol).toBe(state);

    const added = desktopPrototypeReducer(state, {
      type: "add-task-link",
      taskId: "luko-first-scene",
      title: "  Референс сцены  ",
      url: "  https://example.com/scene  ",
    });
    const addedLink = added.tasks.find((task) => task.id === "luko-first-scene")
      ?.links[0];

    expect(addedLink).toEqual({
      id: "luko-first-scene-link-1",
      title: "Референс сцены",
      url: "https://example.com/scene",
    });
    expect(
      added.tasks.find((task) => task.id === "luko-world-rules")?.links,
    ).toEqual([]);

    const edited = desktopPrototypeReducer(added, {
      type: "edit-task-link",
      taskId: "luko-first-scene",
      linkId: addedLink?.id ?? "missing",
      title: "  Новый референс  ",
      url: "https://example.com/new",
    });
    expect(
      edited.tasks.find((task) => task.id === "luko-first-scene")?.links[0],
    ).toMatchObject({
      title: "Новый референс",
      url: "https://example.com/new",
    });

    const deleted = desktopPrototypeReducer(edited, {
      type: "delete-task-link",
      taskId: "luko-first-scene",
      linkId: addedLink?.id ?? "missing",
    });
    expect(
      deleted.tasks.find((task) => task.id === "luko-first-scene")?.links,
    ).toEqual([]);
  });

  it("attaches only same-project articles without duplicates and detaches only the relation", () => {
    const state = freshState();
    const attached = desktopPrototypeReducer(state, {
      type: "attach-task-document",
      taskId: "luko-first-scene",
      documentId: "doc-l-magic",
    });
    const duplicate = desktopPrototypeReducer(attached, {
      type: "attach-task-document",
      taskId: "luko-first-scene",
      documentId: "doc-l-magic",
    });
    const crossProject = desktopPrototypeReducer(attached, {
      type: "attach-task-document",
      taskId: "luko-first-scene",
      documentId: "doc-a-index",
    });

    expect(
      attached.tasks
        .find((task) => task.id === "luko-first-scene")
        ?.linkedDocumentIds.at(-1),
    ).toBe("doc-l-magic");
    expect(duplicate).toBe(attached);
    expect(crossProject).toBe(attached);

    const detached = desktopPrototypeReducer(attached, {
      type: "detach-task-document",
      taskId: "luko-first-scene",
      documentId: "doc-l-magic",
    });
    expect(
      detached.tasks
        .find((task) => task.id === "luko-first-scene")
        ?.linkedDocumentIds.includes("doc-l-magic"),
    ).toBe(false);
    expect(detached.documents).toBe(state.documents);
    expect(getDocumentById(detached, "doc-l-magic")).toEqual(
      getDocumentById(state, "doc-l-magic"),
    );
  });

  it("opens the Knowledge task linker without changing the current article", () => {
    const state = {
      ...freshState(),
      activeSection: "knowledge" as const,
      selectedDocumentId: "doc-l-magic",
    };
    const next = desktopPrototypeReducer(state, {
      type: "open-knowledge-task-linker",
    });

    expect(next.activeSection).toBe("knowledge");
    expect(next.selectedDocumentId).toBe("doc-l-magic");
    expect(next.openDocumentIds).toEqual(state.openDocumentIds);
    expect(next.contextPanel).toEqual({ kind: "knowledge-tasks" });
  });

  it("opens an attached article in an overlay without changing Overview UI state", () => {
    const state = desktopPrototypeReducer(freshState(), {
      type: "select-task",
      taskId: "luko-production-plan",
      section: "overview",
    });
    const expanded = desktopPrototypeReducer(state, {
      type: "toggle-overview-task-expanded",
      taskId: "luko-production-plan",
    });
    const hidden = desktopPrototypeReducer(expanded, {
      type: "set-overview-direction-visible",
      directionId: "lukomorie-characters",
      visible: false,
    });
    const scrolled = desktopPrototypeReducer(hidden, {
      type: "set-overview-scroll-left",
      scrollLeft: 240,
    });
    const opened = desktopPrototypeReducer(scrolled, {
      type: "open-overview-task-article",
      taskId: "luko-production-plan",
      documentId: "doc-l-production",
    });

    expect(opened.activeSection).toBe("overview");
    expect(opened.selectedDocumentId).toBe(state.selectedDocumentId);
    expect(opened.contextPanel).toEqual(state.contextPanel);
    expect(opened.overviewArticleSourceTaskId).toBe("luko-production-plan");
    expect(opened.overviewArticlePreviewDocumentId).toBe("doc-l-production");

    const closed = desktopPrototypeReducer(opened, {
      type: "close-overview-article-preview",
    });
    expect(closed.activeSection).toBe("overview");
    expect(closed.contextPanel).toEqual(state.contextPanel);
    expect(closed.overviewArticleSourceTaskId).toBeNull();
    expect(closed.overviewArticlePreviewDocumentId).toBeNull();
    expect(closed.overviewExpandedTaskId).toBe("luko-production-plan");
    expect(closed.overviewHiddenDirectionIds).toEqual(["lukomorie-characters"]);
    expect(closed.overviewScrollLeft).toBe(240);
    expect(closed.tasks).toEqual(state.tasks);
  });

  it("does not open an article that is not attached to the source task", () => {
    const state = freshState();
    const next = desktopPrototypeReducer(state, {
      type: "open-overview-task-article",
      taskId: "luko-production-plan",
      documentId: "doc-l-magic",
    });

    expect(next).toBe(state);
  });

  it("replaces the open Overview article preview with another attachment", () => {
    const state = freshState();
    const first = desktopPrototypeReducer(state, {
      type: "open-overview-task-article",
      taskId: "luko-world-rules",
      documentId: "doc-l-geography",
    });
    const second = desktopPrototypeReducer(first, {
      type: "open-overview-task-article",
      taskId: "luko-world-rules",
      documentId: "doc-l-magic",
    });

    expect(second.activeSection).toBe("overview");
    expect(second.overviewArticleSourceTaskId).toBe("luko-world-rules");
    expect(second.overviewArticlePreviewDocumentId).toBe("doc-l-magic");
  });

  it("renames and trims only the selected subtask", () => {
    const state = freshState();
    const otherBefore = state.tasks.find(
      (task) => task.id === "luko-world-rules",
    )?.subtasks;
    const next = desktopPrototypeReducer(state, {
      type: "rename-subtask",
      taskId: "luko-first-scene",
      subtaskId: "luko-first-scene-2",
      title: "  Усилить видимую ставку  ",
    });

    expect(
      next.tasks
        .find((task) => task.id === "luko-first-scene")
        ?.subtasks.map((subtask) => subtask.title),
    ).toEqual(["Убрать вступительное объяснение", "Усилить видимую ставку"]);
    expect(
      next.tasks.find((task) => task.id === "luko-world-rules")?.subtasks,
    ).toEqual(otherBefore);
  });

  it("rejects an empty renamed subtask title", () => {
    const state = freshState();
    const next = desktopPrototypeReducer(state, {
      type: "rename-subtask",
      taskId: "luko-first-scene",
      subtaskId: "luko-first-scene-2",
      title: "   ",
    });

    expect(next).toBe(state);
  });

  it("deletes the selected subtask while preserving order and other tasks", () => {
    const state = freshState();
    const otherBefore = state.tasks.find(
      (task) => task.id === "luko-world-rules",
    )?.subtasks;
    const next = desktopPrototypeReducer(state, {
      type: "delete-subtask",
      taskId: "luko-first-scene",
      subtaskId: "luko-first-scene-1",
    });

    expect(
      next.tasks
        .find((task) => task.id === "luko-first-scene")
        ?.subtasks.map((subtask) => subtask.id),
    ).toEqual(["luko-first-scene-2"]);
    expect(
      next.tasks.find((task) => task.id === "luko-world-rules")?.subtasks,
    ).toEqual(otherBefore);
  });

  it("preserves existing subtask completion toggling", () => {
    const state = freshState();
    const next = desktopPrototypeReducer(state, {
      type: "toggle-subtask",
      taskId: "luko-first-scene",
      subtaskId: "luko-first-scene-2",
    });

    expect(
      next.tasks
        .find((task) => task.id === "luko-first-scene")
        ?.subtasks.find((subtask) => subtask.id === "luko-first-scene-2")?.done,
    ).toBe(true);
  });

  it("reorders tasks at the beginning, middle and end of a direction", () => {
    let beginning = freshState();
    beginning = desktopPrototypeReducer(beginning, {
      type: "move-overview-task",
      taskId: "luko-first-scene",
      targetDirectionId: "lukomorie-scenario",
      targetIndex: 0,
    });
    expect(directionTaskIds(beginning, "lukomorie-scenario")).toEqual([
      "luko-first-scene",
      "luko-world-rules",
    ]);

    let middle = freshState();
    middle = desktopPrototypeReducer(middle, {
      type: "move-overview-task",
      taskId: "luko-production-plan",
      targetDirectionId: "lukomorie-scenario",
      targetIndex: 1,
    });
    expect(directionTaskIds(middle, "lukomorie-scenario")).toEqual([
      "luko-world-rules",
      "luko-production-plan",
      "luko-first-scene",
    ]);

    let end = freshState();
    end = desktopPrototypeReducer(end, {
      type: "move-overview-task",
      taskId: "luko-world-rules",
      targetDirectionId: "lukomorie-scenario",
      targetIndex: 1,
    });
    expect(directionTaskIds(end, "lukomorie-scenario")).toEqual([
      "luko-first-scene",
      "luko-world-rules",
    ]);
  });

  it("uses overviewOrder only for manual order inside one direction", () => {
    let state = freshState();
    const tasksListBefore = getVisibleTaskList(state).map((task) => task.id);

    state = desktopPrototypeReducer(state, {
      type: "move-overview-task",
      taskId: "luko-first-scene",
      targetDirectionId: "lukomorie-scenario",
      targetIndex: 0,
    });

    expect(directionTaskIds(state, "lukomorie-scenario").slice(0, 2)).toEqual([
      "luko-first-scene",
      "luko-world-rules",
    ]);
    expect(getVisibleTaskList(state).map((task) => task.id)).toEqual(
      tasksListBefore,
    );
  });

  it("keeps Tasks filter membership stable when Overview order changes", () => {
    let state = freshState();
    const filters = ["all", "overview", "important", "completed"] as const;
    const membershipBefore = Object.fromEntries(
      filters.map((filter) => {
        const filteredState = desktopPrototypeReducer(state, {
          type: "set-task-filter",
          filter,
        });
        return [
          filter,
          getVisibleTaskList(filteredState).map((task) => task.id),
        ];
      }),
    );

    state = desktopPrototypeReducer(state, {
      type: "move-overview-task",
      taskId: "luko-first-scene",
      targetDirectionId: "lukomorie-scenario",
      targetIndex: 0,
    });

    for (const filter of filters) {
      const filteredState = desktopPrototypeReducer(state, {
        type: "set-task-filter",
        filter,
      });
      expect(getVisibleTaskList(filteredState).map((task) => task.id)).toEqual(
        membershipBefore[filter],
      );
    }
  });

  it("moves tasks into an emptied direction without duplicates", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "move-overview-task",
      taskId: "luko-characters-map",
      targetDirectionId: "lukomorie-production",
      targetIndex: 0,
    });
    expect(directionTaskIds(state, "lukomorie-characters")).toEqual([]);

    state = desktopPrototypeReducer(state, {
      type: "move-overview-task",
      taskId: "luko-first-scene",
      targetDirectionId: "lukomorie-characters",
      targetIndex: 0,
    });
    expect(directionTaskIds(state, "lukomorie-characters")).toEqual([
      "luko-first-scene",
    ]);
    expect(
      state.tasks.filter((task) => task.id === "luko-first-scene"),
    ).toHaveLength(1);
  });

  it("normalizes duplicate and sparse direction orders deterministically", () => {
    let state = freshState();
    state = {
      ...state,
      tasks: state.tasks.map((task) =>
        task.id === "luko-world-rules" || task.id === "luko-first-scene"
          ? { ...task, overviewOrder: 40 }
          : task,
      ),
    };
    state = desktopPrototypeReducer(state, {
      type: "move-overview-task",
      taskId: "luko-first-scene",
      targetDirectionId: "lukomorie-scenario",
      targetIndex: 0,
    });
    expect(
      getTasksForDirection(state, "lukomorie-scenario").map(
        (task) => task.overviewOrder,
      ),
    ).toEqual([0, 1]);
  });

  it("preserves completed task data while completed tasks stay off Overview", () => {
    let state = freshState();
    const completedAt = state.tasks.find(
      (task) => task.id === "luko-brief-done",
    )?.completedAt;

    state = desktopPrototypeReducer(state, {
      type: "move-task",
      taskId: "luko-brief-done",
      overviewDirectionId: "lukomorie-scenario",
    });

    expect(
      state.tasks.find((task) => task.id === "luko-brief-done")?.completedAt,
    ).toBe(completedAt);
    expect(getVisibleOverviewTasks(state).map((task) => task.id)).not.toContain(
      "luko-brief-done",
    );
    state = desktopPrototypeReducer(state, {
      type: "set-task-filter",
      filter: "completed",
    });
    expect(getVisibleTaskList(state).map((task) => task.id)).toContain(
      "luko-brief-done",
    );
  });

  it("preserves selected task and context while moving another task", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "select-task",
      taskId: "luko-characters-map",
      section: "overview",
    });
    state = desktopPrototypeReducer(state, {
      type: "move-overview-task",
      taskId: "luko-first-scene",
      targetDirectionId: "lukomorie-visual",
      targetIndex: 0,
    });
    expect(state.selectedTaskId).toBe("luko-characters-map");
    expect(state.contextPanel).toEqual({
      kind: "task",
      taskId: "luko-characters-map",
    });
  });

  it("renames an active project direction with trimmed non-empty text", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "rename-overview-direction",
      directionId: "lukomorie-scenario",
      title: "  Драматургия  ",
    });
    expect(getProjectOverviewDirections(state)[0]?.title).toBe("Драматургия");

    state = desktopPrototypeReducer(state, {
      type: "rename-overview-direction",
      directionId: "lukomorie-scenario",
      title: "   ",
    });
    expect(getProjectOverviewDirections(state)[0]?.title).toBe("Драматургия");
  });

  it("provides between one and four ordered directions per mock project", () => {
    const state = freshState();
    expect(
      getProjectOverviewDirections(state).map((item) => item.title),
    ).toEqual([
      "Сценарий",
      "Персонажи",
      "Визуальная разработка",
      "Производство",
    ]);
    for (const project of state.projects) {
      const count = getProjectOverviewDirections(state, project.id).length;
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(4);
    }
  });

  it("edits an Overview task title with trimmed commit and explicit cancel", () => {
    let state = freshState();
    const taskId = "luko-characters-map";

    state = desktopPrototypeReducer(state, {
      type: "select-task",
      taskId,
      section: "overview",
    });
    expect(state.contextPanel).toEqual({ kind: "task", taskId });

    state = desktopPrototypeReducer(state, {
      type: "begin-task-title-edit",
      taskId,
    });
    expect(state.editingTaskTitleId).toBe(taskId);
    expect(state.contextPanel).toBeNull();

    state = desktopPrototypeReducer(state, {
      type: "commit-task-title-edit",
      taskId,
      title: "  Обновлённая карта персонажей  ",
    });
    expect(state.editingTaskTitleId).toBeNull();
    expect(state.tasks.find((task) => task.id === taskId)?.title).toBe(
      "Обновлённая карта персонажей",
    );

    state = desktopPrototypeReducer(state, {
      type: "begin-task-title-edit",
      taskId,
    });
    state = desktopPrototypeReducer(state, { type: "cancel-task-title-edit" });
    expect(state.editingTaskTitleId).toBeNull();
    expect(state.tasks.find((task) => task.id === taskId)?.title).toBe(
      "Обновлённая карта персонажей",
    );
  });

  it("restores the current title when an inline title commit is blank", () => {
    let state = freshState();
    const taskId = "luko-characters-map";
    const originalTitle = state.tasks.find((task) => task.id === taskId)?.title;

    state = desktopPrototypeReducer(state, {
      type: "begin-task-title-edit",
      taskId,
    });
    state = desktopPrototypeReducer(state, {
      type: "commit-task-title-edit",
      taskId,
      title: "   ",
    });

    expect(state.editingTaskTitleId).toBeNull();
    expect(state.tasks.find((task) => task.id === taskId)?.title).toBe(
      originalTitle,
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
      overviewDirectionId: "lukomorie-scenario",
      overviewOrder: 2,
      completedAt: null,
      signal: "none",
      starred: false,
      links: [],
      linkedDocumentIds: [],
    });
    expect(directionTaskIds(state, "lukomorie-scenario").at(-1)).toBe(
      "ai-task-1",
    );
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

  it("quickly creates a task without selecting it or opening details", () => {
    let state = freshState();
    const selectedTaskIdBefore = state.selectedTaskId;
    const contextPanelBefore = state.contextPanel;
    state = desktopPrototypeReducer(state, { type: "create-task" });

    expect(state.tasks[0]).toMatchObject({
      projectId: "lukomorie",
      title: "Новая задача",
      overviewDirectionId: "lukomorie-scenario",
      overviewOrder: 2,
      signal: "none",
      starred: false,
      completedAt: null,
      links: [],
      linkedDocumentIds: [],
      subtasks: [],
    });
    expect(directionTaskIds(state, "lukomorie-scenario").at(-1)).toBe(
      "mock-task-1",
    );
    expect(state.selectedTaskId).toBe(selectedTaskIdBefore);
    expect(state.contextPanel).toBe(contextPanelBefore);
  });

  it("preserves an open task panel when creating another task", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "select-task",
      taskId: "luko-first-scene",
      section: "overview",
    });
    const contextPanelBefore = state.contextPanel;

    state = desktopPrototypeReducer(state, { type: "create-task" });

    expect(state.tasks[0]?.id).toBe("mock-task-1");
    expect(state.selectedTaskId).toBe("luko-first-scene");
    expect(state.contextPanel).toBe(contextPanelBefore);
  });

  it("toggles task completion without changing the selected task panel", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "select-task",
      taskId: "luko-first-scene",
      section: "tasks",
    });
    const contextPanelBefore = state.contextPanel;

    state = desktopPrototypeReducer(state, {
      type: "toggle-task-completed",
      taskId: "luko-first-scene",
    });
    expect(
      state.tasks.find((task) => task.id === "luko-first-scene")?.completedAt,
    ).not.toBeNull();
    expect(state.contextPanel).toEqual(contextPanelBefore);

    state = desktopPrototypeReducer(state, {
      type: "toggle-task-completed",
      taskId: "luko-first-scene",
    });
    expect(
      state.tasks.find((task) => task.id === "luko-first-scene")?.completedAt,
    ).toBeNull();
  });

  it("deletes only the currently targeted task and closes its panel", () => {
    let state = freshState();
    const taskCountBefore = state.tasks.length;
    state = desktopPrototypeReducer(state, {
      type: "select-task",
      taskId: "luko-first-scene",
      section: "tasks",
    });
    state = desktopPrototypeReducer(state, {
      type: "delete-task",
      taskId: "luko-first-scene",
    });

    expect(state.tasks).toHaveLength(taskCountBefore - 1);
    expect(state.tasks.some((task) => task.id === "luko-first-scene")).toBe(
      false,
    );
    expect(state.selectedTaskId).toBeNull();
    expect(state.contextPanel).toBeNull();
  });

  it("creates a task at the end of the selected task folder", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "switch-section",
      section: "tasks",
    });
    state = desktopPrototypeReducer(state, {
      type: "select-task-folder",
      folderId: "lukomorie-visual-folder",
    });
    state = desktopPrototypeReducer(state, { type: "create-task" });

    expect(state.tasks[0]).toMatchObject({
      id: "mock-task-1",
      taskFolderId: "lukomorie-visual-folder",
      showOnOverview: false,
      starred: false,
      completedAt: null,
    });
    expect(getVisibleTaskList(state).at(-1)?.id).toBe("mock-task-1");
    expect(state.contextPanel).toBeNull();
  });

  it("filters Tasks by direction and search while day view stays UI-only", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "select-task-direction",
      directionId: "lukomorie-scenario",
    });
    expect(
      getVisibleTaskList(state).every(
        (task) => task.overviewDirectionId === "lukomorie-scenario",
      ),
    ).toBe(true);

    state = desktopPrototypeReducer(state, {
      type: "set-task-search-query",
      query: "правила",
    });
    expect(
      getVisibleTaskList(state).every((task) =>
        task.title.toLocaleLowerCase().includes("правила"),
      ),
    ).toBe(true);

    state = desktopPrototypeReducer(state, {
      type: "set-task-search-query",
      query: "",
    });
    state = desktopPrototypeReducer(state, { type: "select-task-day" });
    expect(state.taskDayViewActive).toBe(true);
    expect(state.selectedTaskDirectionId).toBeNull();
    expect(getVisibleTaskList(state)).toHaveLength(
      state.tasks.filter((task) => task.projectId === state.activeProjectId)
        .length,
    );
  });

  it("creates a titled task at the end of the selected direction", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "switch-section",
      section: "tasks",
    });
    state = desktopPrototypeReducer(state, {
      type: "select-task-direction",
      directionId: "lukomorie-visual",
    });
    state = desktopPrototypeReducer(state, {
      type: "create-task",
      title: "  Новый образ  ",
    });

    expect(state.tasks[0]).toMatchObject({
      id: "mock-task-1",
      title: "Новый образ",
      overviewDirectionId: "lukomorie-visual",
    });
    expect(getVisibleTaskList(state).at(-1)?.id).toBe("mock-task-1");
    expect(state.contextPanel).toBeNull();
  });

  it("expands, collapses and collapses all Knowledge folders while preserving the active document path", () => {
    let state = freshState();
    const folderId = "lukomorie:Персонажи/Отношения";

    expect(state.expandedFolderIds).not.toContain(folderId);

    state = desktopPrototypeReducer(state, {
      type: "toggle-knowledge-folder",
      folderId,
      path: ["Персонажи", "Отношения"],
    });
    expect(state.expandedFolderIds).toContain(folderId);

    state = desktopPrototypeReducer(state, {
      type: "toggle-knowledge-folder",
      folderId,
      path: ["Персонажи", "Отношения"],
    });
    expect(state.expandedFolderIds).not.toContain(folderId);

    const expandedBeforeCollapse = state.expandedFolderIds;
    state = desktopPrototypeReducer(state, {
      type: "toggle-all-knowledge-folders",
    });
    expect(state.expandedFolderIds).toEqual([]);

    state = desktopPrototypeReducer(state, {
      type: "toggle-all-knowledge-folders",
    });
    expect(state.expandedFolderIds).toEqual(expandedBeforeCollapse);
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

  it("places a Knowledge document with no folder path at the tree root", () => {
    const state = freshState();
    state.documents = state.documents.map((document) =>
      document.id === "doc-l-nastenka"
        ? { ...document, folder: "", folderPath: [] }
        : document,
    );

    const tree = getKnowledgeTree(state);

    expect(tree).toContainEqual(
      expect.objectContaining({
        kind: "document",
        id: "doc-l-nastenka",
      }),
    );
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

  it("creates an empty Knowledge document in the current folder and opens it", () => {
    const state = {
      ...freshState(),
      selectedDocumentId: "doc-l-kolenka",
      selectedKnowledgeFolderPath: ["Персонажи", "Главные герои"],
    };
    const next = desktopPrototypeReducer(state, {
      type: "create-knowledge-document",
    });
    const document = next.documents.find(
      (item) => item.id === next.selectedDocumentId,
    );

    expect(document).toMatchObject({
      projectId: state.activeProjectId,
      folder: "Главные герои",
      folderPath: ["Персонажи", "Главные герои"],
      title: "Без названия",
      excerpt: "",
      content: [],
    });
    expect(next.openDocumentIds.at(-1)).toBe(document?.id);
    expect(next.expandedFolderIds).toContain(
      "lukomorie:Персонажи/Главные герои",
    );
  });

  it("creates and renames an empty Knowledge folder in the selected folder", () => {
    const state = {
      ...freshState(),
      selectedKnowledgeFolderPath: ["Персонажи"],
    };
    const created = desktopPrototypeReducer(state, {
      type: "create-knowledge-folder",
    });

    expect(created.selectedKnowledgeFolderPath).toEqual([
      "Персонажи",
      "Новая папка",
    ]);
    expect(created.editingKnowledgeFolderId).toBe(
      "lukomorie:Персонажи/Новая папка",
    );

    const renamed = desktopPrototypeReducer(created, {
      type: "rename-knowledge-folder",
      folderId: "lukomorie:Персонажи/Новая папка",
      title: "Черновики",
    });
    expect(renamed.selectedKnowledgeFolderPath).toEqual([
      "Персонажи",
      "Черновики",
    ]);
    expect(JSON.stringify(getKnowledgeTree(renamed))).toContain("Черновики");
  });

  it("moves a selected Knowledge document into another folder at an exact position", () => {
    const state = {
      ...freshState(),
      selectedDocumentId: "doc-l-nastenka",
      openDocumentIds: ["doc-l-nastenka"],
    };
    const next = desktopPrototypeReducer(state, {
      type: "move-knowledge-document",
      documentId: "doc-l-nastenka",
      targetFolderPath: ["Мир"],
      targetDocumentId: "doc-l-magic",
      position: "after",
    });
    const moved = next.documents.find(
      (document) => document.id === "doc-l-nastenka",
    );
    const target = next.documents.find(
      (document) => document.id === "doc-l-magic",
    );

    expect(moved?.folderPath).toEqual(["Мир"]);
    expect(moved?.order).toBe((target?.order ?? -1) + 1);
    expect(next.selectedDocumentId).toBe("doc-l-nastenka");
    expect(next.openDocumentIds).toContain("doc-l-nastenka");
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

  it("keeps each Knowledge pane document while switching the active pane", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "toggle-knowledge-split-view",
    });
    const primaryDocumentId = state.selectedDocumentId;
    const secondaryDocumentId = state.splitViewDocumentId;

    state = desktopPrototypeReducer(state, {
      type: "activate-knowledge-pane",
      pane: "secondary",
    });

    expect(getKnowledgePaneState(state)).toMatchObject({
      activePane: "secondary",
      activeDocument: { id: secondaryDocumentId },
    });
    expect(state.selectedDocumentId).toBe(primaryDocumentId);
    expect(state.splitViewDocumentId).toBe(secondaryDocumentId);

    state = desktopPrototypeReducer(state, {
      type: "activate-knowledge-pane",
      pane: "primary",
    });
    expect(getKnowledgePaneState(state)).toMatchObject({
      activePane: "primary",
      activeDocument: { id: primaryDocumentId },
    });
  });

  it("falls back within the active project for invalid pane documents", () => {
    const state = freshState();
    const foreignDocument = state.documents.find(
      (document) => document.projectId !== state.activeProjectId,
    );
    if (!foreignDocument) throw new Error("Expected a foreign mock document");

    const crossProjectPane = getKnowledgePaneState({
      ...state,
      activeKnowledgePane: "secondary",
      splitViewDocumentId: foreignDocument.id,
    });
    expect(crossProjectPane.secondaryDocument).toBeUndefined();
    expect(crossProjectPane.activePane).toBe("primary");
    expect(crossProjectPane.activeDocument?.projectId).toBe(
      state.activeProjectId,
    );

    const invalidPrimaryPane = getKnowledgePaneState({
      ...state,
      selectedDocumentId: "missing-document",
      splitViewDocumentId: null,
    });
    expect(invalidPrimaryPane.primaryDocument?.id).toBe(
      getProjectDocuments(state)[0]?.id,
    );
  });
});
