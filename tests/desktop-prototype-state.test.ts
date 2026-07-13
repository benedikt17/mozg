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
    visibleOverviewLanes: [
      ...initialDesktopPrototypeState.visibleOverviewLanes,
    ],
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

function laneIds(
  state: DesktopPrototypeState,
  lane: "now" | "next" | "later" | "done",
): string[] {
  return getTasksForLane(state, lane).map((task) => task.id);
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

  it("moves a task between Overview lanes through the shared append helper", () => {
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
    expect(laneIds(state, "now").at(-1)).toBe("luko-production-plan");
  });

  it("appends from Task Details after hidden target-lane tasks", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "move-task",
      taskId: "luko-first-scene",
      overviewLane: "next",
    });
    const fullNext = state.tasks
      .filter(
        (task) =>
          task.projectId === "lukomorie" && task.overviewLane === "next",
      )
      .sort((first, second) => first.overviewOrder - second.overviewOrder)
      .map((task) => task.id);
    expect(fullNext.at(-1)).toBe("luko-first-scene");
  });

  it("uses manual order as authoritative when a task star changes", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "move-overview-task",
      taskId: "luko-first-scene",
      targetLane: "now",
      targetIndex: 0,
    });
    const before = laneIds(state, "now");
    state = desktopPrototypeReducer(state, {
      type: "toggle-task-star",
      taskId: "luko-first-scene",
    });

    expect(laneIds(state, "now")).toEqual(before);
    expect(laneIds(state, "now")[0]).toBe("luko-first-scene");
  });

  it("sets and clears semantic task signals without affecting order", () => {
    let state = freshState();
    const before = laneIds(state, "now");
    state = desktopPrototypeReducer(state, {
      type: "set-task-signal",
      taskId: "luko-first-scene",
      signal: "red",
    });
    expect(
      state.tasks.find((task) => task.id === "luko-first-scene")?.signal,
    ).toBe("red");
    expect(laneIds(state, "now")).toEqual(before);

    state = desktopPrototypeReducer(state, {
      type: "set-task-signal",
      taskId: "luko-first-scene",
      signal: "none",
    });
    expect(
      state.tasks.find((task) => task.id === "luko-first-scene")?.signal,
    ).toBe("none");
  });

  it("reorders tasks at the beginning, middle and end of a lane", () => {
    let beginning = freshState();
    beginning = desktopPrototypeReducer(beginning, {
      type: "move-overview-task",
      taskId: "luko-first-scene",
      targetLane: "now",
      targetIndex: 0,
    });
    expect(laneIds(beginning, "now")).toEqual([
      "luko-first-scene",
      "luko-characters-map",
    ]);

    let middle = freshState();
    middle = desktopPrototypeReducer(middle, {
      type: "move-overview-task",
      taskId: "luko-production-plan",
      targetLane: "now",
      targetIndex: 1,
    });
    expect(laneIds(middle, "now")).toEqual([
      "luko-characters-map",
      "luko-production-plan",
      "luko-first-scene",
    ]);

    let end = freshState();
    end = desktopPrototypeReducer(end, {
      type: "move-overview-task",
      taskId: "luko-characters-map",
      targetLane: "now",
      targetIndex: 1,
    });
    expect(laneIds(end, "now")).toEqual([
      "luko-first-scene",
      "luko-characters-map",
    ]);
  });

  it("moves tasks across lanes and into an empty lane without duplicates", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "move-overview-task",
      taskId: "luko-production-plan",
      targetLane: "now",
      targetIndex: 1,
    });
    expect(laneIds(state, "later")).toEqual([]);
    state = desktopPrototypeReducer(state, {
      type: "move-overview-task",
      taskId: "luko-first-scene",
      targetLane: "later",
      targetIndex: 0,
    });
    expect(laneIds(state, "later")).toEqual(["luko-first-scene"]);
    expect(
      state.tasks.filter((task) => task.id === "luko-first-scene"),
    ).toHaveLength(1);
  });

  it("normalizes duplicate and sparse lane orders deterministically", () => {
    let state = freshState();
    state = {
      ...state,
      tasks: state.tasks.map((task) =>
        task.id === "luko-characters-map" || task.id === "luko-first-scene"
          ? { ...task, overviewOrder: 40 }
          : task,
      ),
    };
    state = desktopPrototypeReducer(state, {
      type: "move-overview-task",
      taskId: "luko-first-scene",
      targetLane: "now",
      targetIndex: 0,
    });
    expect(
      getTasksForLane(state, "now").map((task) => task.overviewOrder),
    ).toEqual([0, 1]);
    expect(laneIds(state, "now")).toEqual([
      "luko-first-scene",
      "luko-characters-map",
    ]);
  });

  it("preserves hidden task order while moving at a filtered visible position", () => {
    let state = freshState();
    state = {
      ...state,
      tasks: state.tasks.map((task) => {
        if (task.id === "luko-world-rules")
          return { ...task, overviewOrder: 0 };
        if (task.id === "luko-production-plan") {
          return {
            ...task,
            overviewLane: "next" as const,
            overviewOrder: 1,
            milestoneId: "lukomorie-world",
          };
        }
        if (task.id === "luko-shot-list") return { ...task, overviewOrder: 2 };
        return task;
      }),
    };
    state = desktopPrototypeReducer(state, {
      type: "move-overview-task",
      taskId: "luko-first-scene",
      targetLane: "next",
      targetIndex: 0,
    });
    const fullNext = state.tasks
      .filter(
        (task) =>
          task.projectId === "lukomorie" && task.overviewLane === "next",
      )
      .sort((first, second) => first.overviewOrder - second.overviewOrder)
      .map((task) => task.id);
    expect(fullNext).toEqual([
      "luko-world-rules",
      "luko-production-plan",
      "luko-first-scene",
      "luko-shot-list",
    ]);
  });

  it("updates completion timestamps when entering and leaving Done", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "move-overview-task",
      taskId: "luko-production-plan",
      targetLane: "done",
      targetIndex: 1,
    });
    expect(
      state.tasks.find((task) => task.id === "luko-production-plan")
        ?.completedAt,
    ).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    state = desktopPrototypeReducer(state, {
      type: "set-task-filter",
      filter: "completed",
    });
    expect(getVisibleTaskList(state).map((task) => task.id)).toContain(
      "luko-production-plan",
    );

    state = desktopPrototypeReducer(state, {
      type: "move-overview-task",
      taskId: "luko-production-plan",
      targetLane: "next",
      targetIndex: 0,
    });
    expect(
      state.tasks.find((task) => task.id === "luko-production-plan")
        ?.completedAt,
    ).toBeNull();
    expect(getVisibleTaskList(state).map((task) => task.id)).not.toContain(
      "luko-production-plan",
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
      targetLane: "next",
      targetIndex: 0,
    });
    expect(state.selectedTaskId).toBe("luko-characters-map");
    expect(state.contextPanel).toEqual({
      kind: "task",
      taskId: "luko-characters-map",
    });
    state = desktopPrototypeReducer(state, {
      type: "move-overview-task",
      taskId: "luko-characters-map",
      targetLane: "later",
      targetIndex: 0,
    });
    expect(state.selectedTaskId).toBe("luko-characters-map");
    expect(state.contextPanel).toEqual({
      kind: "task",
      taskId: "luko-characters-map",
    });
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

  it("shows, hides and focuses Overview lanes in canonical order", () => {
    let state = freshState();

    state = desktopPrototypeReducer(state, {
      type: "toggle-overview-lane",
      lane: "next",
    });
    expect(state.visibleOverviewLanes).toEqual(["now", "later", "done"]);

    state = desktopPrototypeReducer(state, {
      type: "toggle-overview-lane",
      lane: "next",
    });
    expect(state.visibleOverviewLanes).toEqual([
      "now",
      "next",
      "later",
      "done",
    ]);

    state = desktopPrototypeReducer(state, {
      type: "focus-overview-lane",
      lane: "later",
    });
    expect(state.visibleOverviewLanes).toEqual(["later"]);

    state = desktopPrototypeReducer(state, { type: "show-all-overview-lanes" });
    expect(state.visibleOverviewLanes).toEqual([
      "now",
      "next",
      "later",
      "done",
    ]);
  });

  it("keeps the final Overview lane visible without mutating task lanes", () => {
    let state = freshState();
    const taskLanes = state.tasks.map((task) => [task.id, task.overviewLane]);

    state = desktopPrototypeReducer(state, {
      type: "focus-overview-lane",
      lane: "now",
    });
    state = desktopPrototypeReducer(state, {
      type: "toggle-overview-lane",
      lane: "now",
    });

    expect(state.visibleOverviewLanes).toEqual(["now"]);
    expect(state.tasks.map((task) => [task.id, task.overviewLane])).toEqual(
      taskLanes,
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
      signal: "none",
      completedAt: null,
    });
    expect(laneIds(state, "now").at(-1)).toBe("mock-task-1");
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
