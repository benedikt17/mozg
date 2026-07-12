import { describe, expect, it } from "vitest";
import type { DesktopPrototypeState } from "@/prototype/desktop-state";
import {
  ALL_AREAS,
  desktopPrototypeReducer,
  getTasksForLane,
  getVisibleOverviewTasks,
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
    filters: { ...initialDesktopPrototypeState.filters },
    selectedAiProposalIds: [
      ...initialDesktopPrototypeState.selectedAiProposalIds,
    ],
    aiActivityLog: [...initialDesktopPrototypeState.aiActivityLog],
  };
}

describe("desktop prototype state", () => {
  it("switches projects, preserves the active section, and clears foreign task selection", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "switch-section",
      section: "tasks",
    });
    state = desktopPrototypeReducer(state, {
      type: "select-task",
      taskId: "luko-characters-map",
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
    expect(state.rightPanel).toBeNull();
    expect(state.filters.milestoneId).toBe("ammonit-research");
  });

  it("switches sections without opening production tools", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "switch-section",
      section: "canvases",
    });

    expect(state.activeSection).toBe("canvases");
    expect(state.rightPanel).toBeNull();
  });

  it("selects a task, opens the details panel, and closes it", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "select-task",
      taskId: "luko-first-scene",
    });

    expect(state.selectedTaskId).toBe("luko-first-scene");
    expect(state.activeSection).toBe("overview");
    expect(state.rightPanel).toBe("task");

    state = desktopPrototypeReducer(state, { type: "close-right-panel" });
    expect(state.rightPanel).toBeNull();
    expect(state.selectedTaskId).toBe("luko-first-scene");
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

  it("filters by area, milestone and starred-only toggle", () => {
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

  it("opens and closes the AI panel while preserving selected task context", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "select-task",
      taskId: "luko-world-rules",
    });
    state = desktopPrototypeReducer(state, { type: "open-ai-panel" });

    expect(state.selectedTaskId).toBe("luko-world-rules");
    expect(state.rightPanel).toBe("ai");

    state = desktopPrototypeReducer(state, { type: "close-ai-panel" });
    expect(state.rightPanel).toBeNull();
  });

  it("keeps AI and task details mutually exclusive", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, { type: "open-ai-panel" });
    expect(state.rightPanel).toBe("ai");

    state = desktopPrototypeReducer(state, {
      type: "select-task",
      taskId: "luko-characters-map",
    });
    expect(state.rightPanel).toBe("task");
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

  it("opens and closes the command palette state", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, { type: "open-command-palette" });
    expect(state.commandPaletteOpen).toBe(true);

    state = desktopPrototypeReducer(state, { type: "close-command-palette" });
    expect(state.commandPaletteOpen).toBe(false);
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
    expect(state.rightPanel).toBe("task");
  });
});
