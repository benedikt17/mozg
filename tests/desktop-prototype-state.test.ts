import { describe, expect, it } from "vitest";
import type { DesktopPrototypeState } from "@/prototype/desktop-state";
import {
  desktopPrototypeReducer,
  getActiveProject,
  getCommandResults,
  getDocumentById,
  getKeyDocuments,
  getKnowledgePaneState,
  getKnowledgeTree,
  getProjectDocuments,
  getProjectOverviewDirections,
  getProjectTaskGroups,
  getProjectTaskLists,
  getCompletedTasksForList,
  getTaskListActiveCount,
  getTaskSystemViewCount,
  getTasksForDirection,
  getVisibleOverviewTasks,
  getVisibleTaskList,
  getVisibleInboxItems,
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
    taskLists: initialDesktopPrototypeState.taskLists.map((list) => ({
      ...list,
    })),
    taskGroups: initialDesktopPrototypeState.taskGroups.map((group) => ({
      ...group,
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
    expandedTaskGroupIds: [
      ...initialDesktopPrototypeState.expandedTaskGroupIds,
    ],
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
  it("keeps every project task structure rooted in one BAZA group", () => {
    const state = freshState();
    const expectedTitles = [
      "Сценарий",
      "Персонажи",
      "Визуальная разработка",
      "Производство",
    ];

    for (const project of state.projects) {
      const groups = getProjectTaskGroups(state, project.id);
      const systemGroups = groups.filter((group) => group.kind === "system");
      expect(systemGroups).toHaveLength(1);
      expect(systemGroups[0]).toMatchObject({
        projectId: project.id,
        title: "BAZA",
        kind: "system",
      });

      const lists = getProjectTaskLists(state, project.id);
      const bazaLists = lists.filter(
        (list) => list.groupId === systemGroups[0]?.id,
      );
      expect(bazaLists).toHaveLength(4);
      expect(bazaLists.map((list) => list.title)).toEqual(expectedTitles);
      expect(bazaLists.every((list) => list.kind === "system")).toBe(true);
      if (project.id === state.activeProjectId) {
        for (const list of bazaLists) {
          expect(getTaskListActiveCount(state, list.id)).toBe(
            state.tasks.filter(
              (task) =>
                task.projectId === project.id &&
                task.listId === list.id &&
                task.completedAt === null,
            ).length,
          );
        }
      }
      expect(
        bazaLists.every((list) =>
          groups.some(
            (group) =>
              group.id === list.groupId && group.projectId === project.id,
          ),
        ),
      ).toBe(true);
      const directions = getProjectOverviewDirections(state, project.id);
      expect(directions).toHaveLength(4);
      expect(
        bazaLists.every(
          (list) =>
            list.overviewDirectionId !== undefined &&
            directions.some(
              (direction) => direction.id === list.overviewDirectionId,
            ),
        ),
      ).toBe(true);
      expect(
        lists
          .filter((list) => list.kind === "user")
          .every((list) => list.overviewDirectionId === undefined),
      ).toBe(true);
    }

    expect(
      state.tasks.every((task) =>
        state.taskLists.some(
          (list) =>
            list.id === task.listId && list.projectId === task.projectId,
        ),
      ),
    ).toBe(true);
  });

  it("keeps BAZA permanent and rejects lists outside user groups", () => {
    const initial = freshState();
    const baza = getProjectTaskGroups(initial).find(
      (group) => group.kind === "system",
    );
    const collapsed = desktopPrototypeReducer(initial, {
      type: "toggle-task-group",
      groupId: baza?.id ?? "",
    });
    expect(collapsed).toBe(initial);

    const unchanged = desktopPrototypeReducer(initial, {
      type: "create-task-list",
      groupId: baza?.id ?? "",
      title: "Нельзя сюда",
    });
    expect(unchanged).toBe(initial);
  });

  it("creates only non-empty user lists inside the active project", () => {
    let state = desktopPrototypeReducer(freshState(), {
      type: "create-task-group",
      title: "Рабочая группа",
    });
    const before = state.taskLists.length;
    state = desktopPrototypeReducer(state, {
      type: "create-task-list",
      groupId: "mock-task-group-1",
      title: "   ",
    });
    expect(state.taskLists).toHaveLength(before);
    state = desktopPrototypeReducer(state, {
      type: "create-task-list",
      groupId: "mock-task-group-1",
      title: "Новый список",
    });
    expect(state.taskLists).toHaveLength(before + 1);
    expect(state.taskLists.at(-1)).toMatchObject({
      groupId: "mock-task-group-1",
      kind: "user",
      projectId: "lukomorie",
    });
  });

  it("creates task groups for the active project and ignores empty titles", () => {
    const initial = freshState();
    const unchanged = desktopPrototypeReducer(initial, {
      type: "create-task-group",
      title: "   ",
    });
    expect(unchanged).toBe(initial);

    const state = desktopPrototypeReducer(initial, {
      type: "create-task-group",
      title: "  Сюжет  ",
    });
    expect(getProjectTaskGroups(state)).toEqual(
      expect.arrayContaining([
        {
          id: "mock-task-group-1",
          projectId: "lukomorie",
          title: "Сюжет",
          order: 0,
          kind: "user",
        },
      ]),
    );
    expect(state.taskGroups).toHaveLength(5);
  });

  it("keeps task groups isolated by project", () => {
    let state = desktopPrototypeReducer(freshState(), {
      type: "create-task-group",
      title: "Лукоморье группа",
    });
    state = desktopPrototypeReducer(state, {
      type: "switch-project",
      projectId: "ammonit",
    });
    expect(getProjectTaskGroups(state).map((group) => group.id)).toEqual([
      "ammonit-baza",
    ]);

    state = desktopPrototypeReducer(state, {
      type: "create-task-group",
      title: "Аммонит группа",
    });
    expect(
      state.taskGroups
        .filter((group) => group.kind === "user")
        .map((group) => group.projectId),
    ).toEqual(["lukomorie", "ammonit"]);
  });

  it("toggles task group disclosure without changing selection", () => {
    const created = desktopPrototypeReducer(freshState(), {
      type: "create-task-group",
      title: "РЎСЋР¶РµС‚",
    });
    expect(created.expandedTaskGroupIds).toEqual(["mock-task-group-1"]);

    const collapsed = desktopPrototypeReducer(created, {
      type: "toggle-task-group",
      groupId: "mock-task-group-1",
    });
    expect(collapsed.expandedTaskGroupIds).toEqual([]);
    expect(collapsed.taskSelection).toEqual({ kind: "system", view: "all" });

    const expanded = desktopPrototypeReducer(collapsed, {
      type: "toggle-task-group",
      groupId: "mock-task-group-1",
    });
    expect(expanded.expandedTaskGroupIds).toEqual(["mock-task-group-1"]);
  });

  it("resolves the active project title and updates it after switching", () => {
    const initial = freshState();
    expect(getActiveProject(initial)?.name).toBe("Лукоморье");

    const switched = desktopPrototypeReducer(initial, {
      type: "switch-project",
      projectId: "ammonit",
    });
    expect(getActiveProject(switched)?.name).toBe("Аммонит");
  });

  it("creates a custom list inside the active project group", () => {
    let state = desktopPrototypeReducer(freshState(), {
      type: "create-task-group",
      title: "РЎРїРёСЃРѕРє",
    });
    state = desktopPrototypeReducer(state, {
      type: "create-task-list",
      groupId: "mock-task-group-1",
      title: "РЎРѕР·РґР°С‚СЊ СЃРїРёСЃРѕРє",
    });

    expect(state.taskLists).toContainEqual(
      expect.objectContaining({
        groupId: "mock-task-group-1",
        projectId: "lukomorie",
        title: "РЎРѕР·РґР°С‚СЊ СЃРїРёСЃРѕРє",
        kind: "user",
      }),
    );
  });

  it("renames only user lists with trimmed non-empty titles", () => {
    let state = desktopPrototypeReducer(freshState(), {
      type: "create-task-group",
      title: "Рабочая группа",
    });
    state = desktopPrototypeReducer(state, {
      type: "create-task-list",
      groupId: "mock-task-group-1",
      title: "Старое имя",
    });
    state = desktopPrototypeReducer(state, {
      type: "select-task-list",
      listId: "mock-task-list-1",
    });
    const before = state.taskLists.find(
      (list) => list.id === "mock-task-list-1",
    );
    const renamed = desktopPrototypeReducer(state, {
      type: "rename-task-list",
      listId: "mock-task-list-1",
      title: "  Новое имя  ",
    });
    const updated = renamed.taskLists.find(
      (list) => list.id === "mock-task-list-1",
    );

    expect(updated).toMatchObject({
      ...before,
      title: "Новое имя",
    });
    expect(renamed.taskSelection).toEqual({
      kind: "list",
      listId: "mock-task-list-1",
    });
    expect(renamed.tasks).toEqual(state.tasks);

    const empty = desktopPrototypeReducer(renamed, {
      type: "rename-task-list",
      listId: "mock-task-list-1",
      title: "   ",
    });
    expect(empty).toBe(renamed);

    const baza = desktopPrototypeReducer(renamed, {
      type: "rename-task-list",
      listId: "lukomorie-list-scenario",
      title: "Нельзя переименовать",
    });
    expect(baza).toBe(renamed);

    const missing = desktopPrototypeReducer(renamed, {
      type: "rename-task-list",
      listId: "missing-list",
      title: "Не найден",
    });
    expect(missing).toBe(renamed);

    const switched = desktopPrototypeReducer(renamed, {
      type: "switch-project",
      projectId: "ammonit",
    });
    const crossProject = desktopPrototypeReducer(switched, {
      type: "rename-task-list",
      listId: "mock-task-list-1",
      title: "Чужой список",
    });
    expect(crossProject).toBe(switched);
  });

  it("renames only user task groups with trimmed non-empty titles", () => {
    const state = desktopPrototypeReducer(freshState(), {
      type: "create-task-group",
      title: "Рабочая группа",
    });

    const renamed = desktopPrototypeReducer(state, {
      type: "rename-task-group",
      groupId: "mock-task-group-1",
      title: "  Новое имя  ",
    });
    expect(
      renamed.taskGroups.find((group) => group.id === "mock-task-group-1"),
    ).toMatchObject({ title: "Новое имя" });

    const empty = desktopPrototypeReducer(renamed, {
      type: "rename-task-group",
      groupId: "mock-task-group-1",
      title: "   ",
    });
    expect(empty).toBe(renamed);

    const baza = desktopPrototypeReducer(renamed, {
      type: "rename-task-group",
      groupId: "lukomorie-task-group-baza",
      title: "Нельзя переименовать",
    });
    expect(baza).toBe(renamed);
  });

  it("deletes a user task group and moves its lists to BAZA", () => {
    let state = desktopPrototypeReducer(freshState(), {
      type: "create-task-group",
      title: "Temporary group",
    });
    state = desktopPrototypeReducer(state, {
      type: "create-task-list",
      groupId: "mock-task-group-1",
      title: "Temporary list",
    });

    const deleted = desktopPrototypeReducer(state, {
      type: "delete-task-group",
      groupId: "mock-task-group-1",
    });

    expect(
      deleted.taskGroups.some((group) => group.id === "mock-task-group-1"),
    ).toBe(false);
    expect(
      deleted.taskLists.find((list) => list.id === "mock-task-list-1"),
    ).toMatchObject({ groupId: "lukomorie-baza" });
    expect(deleted.expandedTaskGroupIds).not.toContain("mock-task-group-1");
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

  it("creates a mock project with four canonical Overview directions", () => {
    const state = desktopPrototypeReducer(freshState(), {
      type: "create-project",
    });

    expect(state.activeProjectId).toBe("mock-project-1");
    expect(getProjectOverviewDirections(state)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "mock-project-1-scenario",
          projectId: "mock-project-1",
          title: "Сценарий",
          order: 0,
        }),
        expect.objectContaining({ id: "mock-project-1-production", order: 3 }),
      ]),
    );
    expect(getProjectOverviewDirections(state)).toHaveLength(4);
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
      type: "select-task-system-view",
      view: "important",
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

  it("creates standalone and grouped canvases", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "create-canvas-group",
      title: "Новые карты",
    });
    const group = state.canvasGroups[0];
    if (!group) return;
    expect(group?.title).toBe("Новые карты");
    expect(state.expandedCanvasGroupIds).toContain(group?.id);

    state = desktopPrototypeReducer(state, {
      type: "create-canvas",
      title: "Свободный холст",
      groupId: null,
    });
    expect(state.canvases.at(-1)).toMatchObject({
      title: "Свободный холст",
      groupId: null,
    });

    state = desktopPrototypeReducer(state, {
      type: "create-canvas",
      title: "Холст группы",
      groupId: group.id,
    });
    expect(state.canvases.at(-1)).toMatchObject({
      title: "Холст группы",
      groupId: group.id,
    });
    expect(state.selectedCanvasId).toBe(state.canvases.at(-1)?.id);
  });

  it("moves a canvas into a project group", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "create-canvas-group",
      title: "Рабочая группа",
    });
    const group = state.canvasGroups[0];
    if (!group) return;

    state = desktopPrototypeReducer(state, {
      type: "move-canvas-to-group",
      canvasId: "canvas-l-plot",
      groupId: group.id,
    });

    const movedCanvas = state.canvases.find(
      (canvas) => canvas.id === "canvas-l-plot",
    );
    expect(movedCanvas?.groupId).toBe(group.id);
  });

  it("renames and deletes canvas groups without deleting their canvases", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "create-canvas-group",
      title: "Рабочая группа",
    });
    const group = state.canvasGroups[0];
    if (!group) return;
    state = desktopPrototypeReducer(state, {
      type: "move-canvas-to-group",
      canvasId: "canvas-l-plot",
      groupId: group.id,
    });
    state = desktopPrototypeReducer(state, {
      type: "rename-canvas-group",
      groupId: group.id,
      title: "Переименованная группа",
    });
    expect(state.canvasGroups[0]?.title).toBe("Переименованная группа");
    state = desktopPrototypeReducer(state, {
      type: "delete-canvas-group",
      groupId: group.id,
    });
    expect(state.canvasGroups).toHaveLength(0);
    expect(
      state.canvases.find((canvas) => canvas.id === "canvas-l-plot")?.groupId,
    ).toBeNull();
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

  it("filters Inbox cards from the sidebar search query", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "set-inbox-search-query",
      query: "голосовая",
    });

    expect(getVisibleInboxItems(state).map((item) => item.id)).toEqual([
      "inbox-l-audio",
    ]);
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
      targetDirectionId: "ammonit-scenario",
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

  it("reorders an active task within one concrete list without duplicating it", () => {
    const initial = freshState();
    const movingBefore = initial.tasks.find(
      (task) => task.id === "luko-first-scene",
    );
    const next = desktopPrototypeReducer(initial, {
      type: "move-task-to-list",
      taskId: "luko-first-scene",
      targetListId: "lukomorie-list-scenario",
      targetTaskId: "luko-world-rules",
    });
    const movingAfter = next.tasks.find(
      (task) => task.id === "luko-first-scene",
    );

    expect(
      next.tasks.filter((task) => task.id === "luko-first-scene"),
    ).toHaveLength(1);
    expect(movingAfter).toMatchObject({
      id: movingBefore?.id,
      listId: movingBefore?.listId,
      title: movingBefore?.title,
      links: movingBefore?.links,
      subtasks: movingBefore?.subtasks,
      taskListOrder: expect.any(Number),
    });
    expect(
      getVisibleTaskList(next)
        .filter((task) => task.listId === "lukomorie-list-scenario")
        .map((task) => task.id)
        .slice(0, 2),
    ).toEqual(["luko-first-scene", "luko-world-rules"]);
  });

  it("moves an active task between BAZA lists and updates Overview mapping", () => {
    const initial = freshState();
    const movingBefore = initial.tasks.find(
      (task) => task.id === "luko-first-scene",
    );
    const sourceCount = getTaskListActiveCount(
      initial,
      "lukomorie-list-scenario",
    );
    const destinationCount = getTaskListActiveCount(
      initial,
      "lukomorie-list-production",
    );
    const next = desktopPrototypeReducer(initial, {
      type: "move-task-to-list",
      taskId: "luko-first-scene",
      targetListId: "lukomorie-list-production",
      targetTaskId: null,
    });
    const movingAfter = next.tasks.find(
      (task) => task.id === "luko-first-scene",
    );

    expect(movingAfter).toMatchObject({
      listId: "lukomorie-list-production",
      overviewDirectionId: "lukomorie-production",
      showOnOverview: true,
      title: movingBefore?.title,
      notes: movingBefore?.notes,
      links: movingBefore?.links,
      subtasks: movingBefore?.subtasks,
      linkedDocumentIds: movingBefore?.linkedDocumentIds,
    });
    expect(getTaskListActiveCount(next, "lukomorie-list-scenario")).toBe(
      sourceCount - 1,
    );
    expect(getTaskListActiveCount(next, "lukomorie-list-production")).toBe(
      destinationCount + 1,
    );
    expect(directionTaskIds(next, "lukomorie-production")).toContain(
      "luko-first-scene",
    );
  });

  it("moves tasks between BAZA and user lists while preserving task details", () => {
    let state = desktopPrototypeReducer(freshState(), {
      type: "create-task-group",
      title: "Рабочая группа",
    });
    state = desktopPrototypeReducer(state, {
      type: "create-task-list",
      groupId: "mock-task-group-1",
      title: "Черновики",
    });
    const before = state.tasks.find((task) => task.id === "luko-first-scene");

    const inUserList = desktopPrototypeReducer(state, {
      type: "move-task-to-list",
      taskId: "luko-first-scene",
      targetListId: "mock-task-list-1",
      targetTaskId: null,
    });
    expect(
      inUserList.tasks.find((task) => task.id === "luko-first-scene"),
    ).toMatchObject({
      listId: "mock-task-list-1",
      overviewDirectionId: "",
      showOnOverview: false,
      title: before?.title,
      notes: before?.notes,
      links: before?.links,
      subtasks: before?.subtasks,
    });
    expect(directionTaskIds(inUserList, "lukomorie-scenario")).not.toContain(
      "luko-first-scene",
    );

    const backInBaza = desktopPrototypeReducer(inUserList, {
      type: "move-task-to-list",
      taskId: "luko-first-scene",
      targetListId: "lukomorie-list-scenario",
      targetTaskId: null,
    });
    expect(
      backInBaza.tasks.find((task) => task.id === "luko-first-scene"),
    ).toMatchObject({
      listId: "lukomorie-list-scenario",
      overviewDirectionId: "lukomorie-scenario",
      showOnOverview: true,
    });
    expect(directionTaskIds(backInBaza, "lukomorie-scenario")).toContain(
      "luko-first-scene",
    );
  });

  it("removes a task from a virtual system view when it is moved to a list", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "select-task-system-view",
      view: "important",
    });
    state = desktopPrototypeReducer(state, {
      type: "move-task-to-list",
      taskId: "luko-characters-map",
      targetListId: "lukomorie-list-scenario",
      targetTaskId: null,
      sourceSystemView: "important",
    });
    expect(
      state.tasks.find((task) => task.id === "luko-characters-map"),
    ).toMatchObject({
      listId: "lukomorie-list-scenario",
      starred: false,
    });
    expect(getVisibleTaskList(state)).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "luko-characters-map" }),
      ]),
    );

    state = desktopPrototypeReducer(state, {
      type: "select-task-system-view",
      view: "day",
    });
    state = desktopPrototypeReducer(state, {
      type: "move-task-to-list",
      taskId: "luko-first-scene",
      targetListId: "lukomorie-list-visual",
      targetTaskId: null,
      sourceSystemView: "day",
    });
    expect(
      state.tasks.find((task) => task.id === "luko-first-scene"),
    ).toMatchObject({
      listId: "lukomorie-list-visual",
    });
    expect(
      state.tasks.find((task) => task.id === "luko-first-scene"),
    ).not.toHaveProperty("dueDate");
    expect(getVisibleTaskList(state)).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "luko-first-scene" }),
      ]),
    );
  });

  it("rejects cross-project and invalid concrete-list moves unchanged", () => {
    const initial = freshState();
    const crossProject = desktopPrototypeReducer(initial, {
      type: "move-task-to-list",
      taskId: "luko-first-scene",
      targetListId: "ammonit-list-scenario",
      targetTaskId: null,
    });
    const inactiveTask = desktopPrototypeReducer(initial, {
      type: "move-task-to-list",
      taskId: "ammonit-index",
      targetListId: "lukomorie-list-scenario",
      targetTaskId: null,
    });
    const mismatchedTarget = desktopPrototypeReducer(initial, {
      type: "move-task-to-list",
      taskId: "luko-first-scene",
      targetListId: "lukomorie-list-production",
      targetTaskId: "luko-world-rules",
    });

    expect(crossProject).toBe(initial);
    expect(inactiveTask).toBe(initial);
    expect(mismatchedTarget).toBe(initial);
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

  it("opens task details from the contextual reader without closing its article", () => {
    const openedArticle = desktopPrototypeReducer(freshState(), {
      type: "open-overview-task-article",
      taskId: "luko-production-plan",
      documentId: "doc-l-production",
    });
    const openedDetails = desktopPrototypeReducer(openedArticle, {
      type: "select-task",
      taskId: "luko-production-plan",
      section: "overview",
    });

    expect(openedDetails.contextPanel).toEqual({
      kind: "task",
      taskId: "luko-production-plan",
    });
    expect(openedDetails.overviewArticleSourceTaskId).toBe(
      "luko-production-plan",
    );
    expect(openedDetails.overviewArticlePreviewDocumentId).toBe(
      "doc-l-production",
    );

    const closedDetails = desktopPrototypeReducer(openedDetails, {
      type: "close-context-panel",
    });
    expect(closedDetails.contextPanel).toBeNull();
    expect(closedDetails.overviewArticleSourceTaskId).toBe(
      "luko-production-plan",
    );
    expect(closedDetails.overviewArticlePreviewDocumentId).toBe(
      "doc-l-production",
    );
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

  it("keeps Tasks view membership stable when Overview order changes", () => {
    let state = freshState();
    const views = ["all", "important", "day"] as const;
    const membershipBefore = Object.fromEntries(
      views.map((view) => {
        const filteredState = desktopPrototypeReducer(state, {
          type: "select-task-system-view",
          view,
        });
        return [view, getVisibleTaskList(filteredState).map((task) => task.id)];
      }),
    );

    state = desktopPrototypeReducer(state, {
      type: "move-overview-task",
      taskId: "luko-first-scene",
      targetDirectionId: "lukomorie-scenario",
      targetIndex: 0,
    });

    for (const view of views) {
      const filteredState = desktopPrototypeReducer(state, {
        type: "select-task-system-view",
        view,
      });
      expect(getVisibleTaskList(filteredState).map((task) => task.id)).toEqual(
        membershipBefore[view],
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
    const productionCount = getTaskListActiveCount(
      state,
      "lukomorie-list-production",
    );
    const scenarioCount = getTaskListActiveCount(
      state,
      "lukomorie-list-scenario",
    );
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
    expect(state.tasks.find((task) => task.id === "luko-brief-done")).toEqual(
      expect.objectContaining({
        listId: "lukomorie-list-scenario",
        overviewDirectionId: "lukomorie-scenario",
      }),
    );
    expect(getTaskListActiveCount(state, "lukomorie-list-production")).toBe(
      productionCount,
    );
    expect(getTaskListActiveCount(state, "lukomorie-list-scenario")).toBe(
      scenarioCount,
    );
    expect(getVisibleOverviewTasks(state).map((task) => task.id)).not.toContain(
      "luko-brief-done",
    );
    expect(
      getCompletedTasksForList(state, "lukomorie-list-scenario").map(
        (task) => task.id,
      ),
    ).toContain("luko-brief-done");
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
    expect(
      getProjectTaskLists(state).find(
        (list) => list.overviewDirectionId === "lukomorie-scenario",
      )?.title,
    ).toBe("Драматургия");

    state = desktopPrototypeReducer(state, {
      type: "rename-overview-direction",
      directionId: "lukomorie-scenario",
      title: "   ",
    });
    expect(getProjectOverviewDirections(state)[0]?.title).toBe("Драматургия");
  });

  it("provides four canonical ordered directions per mock project", () => {
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
      const directions = getProjectOverviewDirections(state, project.id);
      expect(directions).toHaveLength(4);
      expect(directions.map((direction) => direction.id)).toEqual([
        `${project.id}-scenario`,
        `${project.id}-characters`,
        `${project.id}-visual`,
        `${project.id}-production`,
      ]);
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

  it("requires a concrete list before creating a task in Tasks", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "switch-section",
      section: "tasks",
    });
    const unchanged = desktopPrototypeReducer(state, { type: "create-task" });
    expect(unchanged).toBe(state);

    state = desktopPrototypeReducer(state, {
      type: "select-task-list",
      listId: "lukomorie-list-characters",
    });
    state = desktopPrototypeReducer(state, {
      type: "create-task",
      title: "Новая задача в списке",
    });
    expect(state.tasks[0]).toMatchObject({
      listId: "lukomorie-list-characters",
      overviewDirectionId: "lukomorie-characters",
      showOnOverview: true,
    });
  });

  it("derives system-view counts from unfinished tasks in the active project", () => {
    const state = freshState();

    expect(getTaskSystemViewCount(state, "day")).toBe(3);
    expect(getTaskSystemViewCount(state, "important")).toBe(2);
    expect(getTaskSystemViewCount(state, "all")).toBe(5);

    const completed = desktopPrototypeReducer(state, {
      type: "toggle-task-completed",
      taskId: "luko-world-rules",
    });
    expect(getTaskSystemViewCount(completed, "day")).toBe(2);
    expect(getTaskSystemViewCount(completed, "important")).toBe(1);
    expect(getTaskSystemViewCount(completed, "all")).toBe(4);

    const restored = desktopPrototypeReducer(completed, {
      type: "toggle-task-completed",
      taskId: "luko-world-rules",
    });
    const starred = desktopPrototypeReducer(restored, {
      type: "toggle-task-star",
      taskId: "luko-shot-list",
    });
    const due = desktopPrototypeReducer(starred, {
      type: "set-task-due-date",
      taskId: "luko-shot-list",
      dueDate: "Сегодня",
    });
    expect(getTaskSystemViewCount(due, "important")).toBe(3);
    expect(getTaskSystemViewCount(due, "day")).toBe(4);
    expect(getTaskSystemViewCount(due, "all")).toBe(5);
  });

  it("creates system-view tasks only with valid concrete destinations", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "switch-section",
      section: "tasks",
    });
    const unchanged = desktopPrototypeReducer(state, {
      type: "create-task",
      title: "Без списка",
      sourceSystemView: "all",
    });
    expect(unchanged).toBe(state);

    state = desktopPrototypeReducer(state, {
      type: "create-task",
      title: "Новая задача в BAZA",
      destinationListId: "lukomorie-list-production",
      sourceSystemView: "day",
    });
    expect(state.tasks[0]).toMatchObject({
      title: "Новая задача в BAZA",
      listId: "lukomorie-list-production",
      overviewDirectionId: "lukomorie-production",
      showOnOverview: true,
      dueDate: "Сегодня",
    });
    expect(state.taskSelection).toEqual({ kind: "system", view: "all" });

    state = desktopPrototypeReducer(state, {
      type: "create-task-group",
      title: "Личная группа",
    });
    state = desktopPrototypeReducer(state, {
      type: "create-task-list",
      groupId: "mock-task-group-1",
      title: "Личный список",
    });
    const userCreated = desktopPrototypeReducer(state, {
      type: "create-task",
      title: "Важная личная задача",
      destinationListId: "mock-task-list-1",
      sourceSystemView: "important",
    });
    expect(userCreated.tasks[0]).toMatchObject({
      title: "Важная личная задача",
      listId: "mock-task-list-1",
      overviewDirectionId: "",
      showOnOverview: false,
      starred: true,
    });
    expect(userCreated.taskSelection).toEqual({ kind: "system", view: "all" });

    const invalidDestination = desktopPrototypeReducer(userCreated, {
      type: "create-task",
      title: "Чужая задача",
      destinationListId: "ammonit-list-scenario",
      sourceSystemView: "all",
    });
    expect(invalidDestination).toBe(userCreated);
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

  it("keeps BAZA completion synchronized between Tasks and Overview", () => {
    let state = freshState();
    const before = getTaskListActiveCount(state, "lukomorie-list-scenario");
    state = desktopPrototypeReducer(state, {
      type: "toggle-task-completed",
      taskId: "luko-first-scene",
    });
    const completed = state.tasks.find(
      (task) => task.id === "luko-first-scene",
    );
    expect(completed).toMatchObject({
      listId: "lukomorie-list-scenario",
      overviewDirectionId: "lukomorie-scenario",
    });
    expect(getTaskListActiveCount(state, "lukomorie-list-scenario")).toBe(
      before - 1,
    );
    expect(directionTaskIds(state, "lukomorie-scenario")).not.toContain(
      "luko-first-scene",
    );

    state = desktopPrototypeReducer(state, {
      type: "toggle-task-completed",
      taskId: "luko-first-scene",
    });
    expect(getTaskListActiveCount(state, "lukomorie-list-scenario")).toBe(
      before,
    );
    expect(directionTaskIds(state, "lukomorie-scenario")).toContain(
      "luko-first-scene",
    );
  });

  it("normalizes stale BAZA integration fields when restoring tasks", () => {
    const mappings = [
      ["scenario", "lukomorie-list-scenario", "lukomorie-scenario"],
      ["characters", "lukomorie-list-characters", "lukomorie-characters"],
      ["visual", "lukomorie-list-visual", "lukomorie-visual"],
      ["production", "lukomorie-list-production", "lukomorie-production"],
    ] as const;

    for (const [key, listId, directionId] of mappings) {
      const initial = freshState();
      const source = initial.tasks.find(
        (task) => task.id === "luko-characters-map",
      )!;
      const staleTask = {
        ...source,
        id: `restore-${key}`,
        listId,
        completedAt: "2026-07-10T12:00:00.000Z",
        overviewDirectionId: "legacy-direction",
        showOnOverview: false,
      };
      const state = {
        ...initial,
        tasks: [staleTask, ...initial.tasks],
      };
      const before = getTaskListActiveCount(state, listId);
      const restored = desktopPrototypeReducer(state, {
        type: "toggle-task-completed",
        taskId: staleTask.id,
      });
      const task = restored.tasks.find((item) => item.id === staleTask.id);

      expect(task).toMatchObject({
        id: staleTask.id,
        title: staleTask.title,
        notes: staleTask.notes,
        subtasks: staleTask.subtasks,
        links: staleTask.links,
        linkedDocumentIds: staleTask.linkedDocumentIds,
        starred: staleTask.starred,
        dueDate: staleTask.dueDate,
        listId,
        completedAt: null,
        overviewDirectionId: directionId,
        showOnOverview: true,
      });
      expect(getTaskListActiveCount(restored, listId)).toBe(before + 1);
      expect(directionTaskIds(restored, directionId)).toContain(staleTask.id);
      expect(getCompletedTasksForList(restored, listId)).not.toContainEqual(
        expect.objectContaining({ id: staleTask.id }),
      );
    }
  });

  it("keeps restored user-list tasks Tasks-only", () => {
    let state = desktopPrototypeReducer(freshState(), {
      type: "create-task-group",
      title: "Рабочая группа",
    });
    state = desktopPrototypeReducer(state, {
      type: "create-task-list",
      groupId: "mock-task-group-1",
      title: "Личный список",
    });
    const source = state.tasks.find((task) => task.id === "luko-first-scene")!;
    const staleTask = {
      ...source,
      id: "restore-user-list-task",
      listId: "mock-task-list-1",
      completedAt: "2026-07-10T12:00:00.000Z",
      overviewDirectionId: "lukomorie-scenario",
      showOnOverview: true,
    };
    state = { ...state, tasks: [staleTask, ...state.tasks] };
    const before = getTaskListActiveCount(state, "mock-task-list-1");

    state = desktopPrototypeReducer(state, {
      type: "toggle-task-completed",
      taskId: staleTask.id,
    });
    const restored = state.tasks.find((task) => task.id === staleTask.id);
    expect(restored).toMatchObject({
      listId: "mock-task-list-1",
      completedAt: null,
      overviewDirectionId: "",
      showOnOverview: false,
    });
    expect(getTaskListActiveCount(state, "mock-task-list-1")).toBe(before + 1);
    expect(getVisibleOverviewTasks(state).map((task) => task.id)).not.toContain(
      staleTask.id,
    );
  });

  it("rejects completion changes for tasks outside the active project", () => {
    const initial = freshState();
    const foreignTask = {
      ...initial.tasks[0],
      id: "foreign-restore-task",
      projectId: "ammonit",
      listId: "ammonit-list-scenario",
      completedAt: "2026-07-10T12:00:00.000Z",
    };
    const state = {
      ...initial,
      tasks: [foreignTask, ...initial.tasks],
    };
    expect(
      desktopPrototypeReducer(state, {
        type: "toggle-task-completed",
        taskId: foreignTask.id,
      }),
    ).toBe(state);
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

  it("creates a task at the end of the selected task list", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "switch-section",
      section: "tasks",
    });
    state = desktopPrototypeReducer(state, {
      type: "select-task-list",
      listId: "lukomorie-list-visual",
    });
    state = desktopPrototypeReducer(state, { type: "create-task" });

    expect(state.tasks[0]).toMatchObject({
      id: "mock-task-1",
      listId: "lukomorie-list-visual",
      overviewDirectionId: "lukomorie-visual",
      showOnOverview: true,
      starred: false,
      completedAt: null,
    });
    expect(getVisibleTaskList(state).at(-1)?.id).toBe("mock-task-1");
    expect(state.contextPanel).toBeNull();
  });

  it("filters Tasks by list and search while day view stays UI-only", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "select-task-list",
      listId: "lukomorie-list-scenario",
    });
    expect(
      getVisibleTaskList(state).every(
        (task) => task.listId === "lukomorie-list-scenario",
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
    state = desktopPrototypeReducer(state, {
      type: "select-task-system-view",
      view: "day",
    });
    expect(state.taskSelection).toEqual({ kind: "system", view: "day" });
    expect(getVisibleTaskList(state)).toHaveLength(
      state.tasks.filter(
        (task) =>
          task.projectId === state.activeProjectId &&
          task.dueDate !== undefined &&
          task.completedAt === null,
      ).length,
    );
  });

  it("creates a titled task at the end of the selected list", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "switch-section",
      section: "tasks",
    });
    state = desktopPrototypeReducer(state, {
      type: "select-task-list",
      listId: "lukomorie-list-visual",
    });
    state = desktopPrototypeReducer(state, {
      type: "create-task",
      title: "  Новый образ  ",
    });

    expect(state.tasks[0]).toMatchObject({
      id: "mock-task-1",
      title: "Новый образ",
      overviewDirectionId: "lukomorie-visual",
      listId: "lukomorie-list-visual",
    });
    expect(getVisibleTaskList(state).at(-1)?.id).toBe("mock-task-1");
    expect(state.contextPanel).toBeNull();
  });

  it("maps every BAZA list creation to its matching Overview direction", () => {
    let state = desktopPrototypeReducer(freshState(), {
      type: "switch-section",
      section: "tasks",
    });
    const mappings = [
      ["lukomorie-list-scenario", "lukomorie-scenario"],
      ["lukomorie-list-characters", "lukomorie-characters"],
      ["lukomorie-list-visual", "lukomorie-visual"],
      ["lukomorie-list-production", "lukomorie-production"],
    ] as const;

    for (const [listId, directionId] of mappings) {
      const title = `BAZA task ${listId}`;
      state = desktopPrototypeReducer(state, {
        type: "select-task-list",
        listId,
      });
      state = desktopPrototypeReducer(state, { type: "create-task", title });
      const task = state.tasks.find((item) => item.title === title);
      expect(task).toMatchObject({
        id: expect.any(String),
        listId,
        overviewDirectionId: directionId,
        showOnOverview: true,
      });
      expect(getVisibleTaskList(state).map((item) => item.id)).toContain(
        task?.id,
      );
      expect(directionTaskIds(state, directionId)).toContain(task?.id);
    }
  });

  it("keeps user-list tasks out of Overview", () => {
    let state = desktopPrototypeReducer(freshState(), {
      type: "create-task-group",
      title: "Рабочая группа",
    });
    state = desktopPrototypeReducer(state, {
      type: "create-task-list",
      groupId: "mock-task-group-1",
      title: "Личный список",
    });
    state = desktopPrototypeReducer(state, {
      type: "switch-section",
      section: "tasks",
    });
    state = desktopPrototypeReducer(state, {
      type: "select-task-list",
      listId: "mock-task-list-1",
    });
    state = desktopPrototypeReducer(state, {
      type: "create-task",
      title: "Только в личном списке",
    });

    const task = state.tasks.find(
      (item) => item.title === "Только в личном списке",
    );
    expect(task).toMatchObject({
      listId: "mock-task-list-1",
      overviewDirectionId: "",
      showOnOverview: false,
    });
    expect(getVisibleTaskList(state).map((item) => item.id)).toContain(
      task?.id,
    );
    expect(getVisibleOverviewTasks(state).map((item) => item.id)).not.toContain(
      task?.id,
    );
    const unchanged = desktopPrototypeReducer(state, {
      type: "move-overview-task",
      taskId: task?.id ?? "",
      targetDirectionId: "lukomorie-scenario",
      targetIndex: 0,
    });
    expect(unchanged).toBe(state);
  });

  it("moves a canonical Overview task to the matching BAZA list", () => {
    const initial = freshState();
    const moving = initial.tasks.find(
      (task) => task.id === "luko-production-plan",
    );
    const sourceCount = getTaskListActiveCount(
      initial,
      "lukomorie-list-production",
    );
    const targetCount = getTaskListActiveCount(
      initial,
      "lukomorie-list-scenario",
    );
    const state = desktopPrototypeReducer(initial, {
      type: "move-overview-task",
      taskId: "luko-production-plan",
      targetDirectionId: "lukomorie-scenario",
      targetIndex: 0,
    });
    const moved = state.tasks.find(
      (task) => task.id === "luko-production-plan",
    );

    expect(moved).toEqual(
      expect.objectContaining({
        id: moving?.id,
        title: moving?.title,
        listId: "lukomorie-list-scenario",
        overviewDirectionId: "lukomorie-scenario",
        subtasks: moving?.subtasks,
        linkedDocumentIds: moving?.linkedDocumentIds,
      }),
    );
    expect(getTaskListActiveCount(state, "lukomorie-list-production")).toBe(
      sourceCount - 1,
    );
    expect(getTaskListActiveCount(state, "lukomorie-list-scenario")).toBe(
      targetCount + 1,
    );
    expect(
      getVisibleTaskList({
        ...state,
        taskSelection: { kind: "list", listId: "lukomorie-list-production" },
      }).map((task) => task.id),
    ).not.toContain("luko-production-plan");
    expect(
      getVisibleTaskList({
        ...state,
        taskSelection: { kind: "list", listId: "lukomorie-list-scenario" },
      }).map((task) => task.id),
    ).toContain("luko-production-plan");
  });

  it("rejects Overview moves for tasks outside the active project", () => {
    const initial = freshState();
    const activeState = { ...initial, activeProjectId: "ammonit" };
    const state = desktopPrototypeReducer(activeState, {
      type: "move-overview-task",
      taskId: "luko-production-plan",
      targetDirectionId: "ammonit-scenario",
      targetIndex: 0,
    });
    expect(state).toBe(activeState);
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

  it("uses the first Markdown heading as the Knowledge document title", () => {
    const state = freshState();
    const next = desktopPrototypeReducer(state, {
      type: "update-knowledge-document-markdown",
      documentId: "doc-l-nastenka",
      markdown: "# Обновлённый заголовок\n\nТекст статьи",
    });

    expect(getDocumentById(next, "doc-l-nastenka")?.title).toBe(
      "Обновлённый заголовок",
    );
    expect(getDocumentById(next, "doc-l-nastenka")?.content).toEqual([
      "# Обновлённый заголовок",
      "",
      "Текст статьи",
    ]);
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

  it("starts renaming folders that are represented by document paths", () => {
    const state = freshState();
    const folderId = getKnowledgeTree(state).find(
      (node) => node.kind === "folder",
    )?.id;
    expect(folderId).toBeDefined();
    if (!folderId) return;
    const next = desktopPrototypeReducer(state, {
      type: "start-editing-knowledge-folder",
      folderId,
    });

    expect(next.editingKnowledgeFolderId).toBe(folderId);
  });

  it("deletes a Knowledge folder and keeps its documents in the parent folder", () => {
    const state = {
      ...freshState(),
      selectedKnowledgeFolderPath: ["Персонажи"],
    };
    const created = desktopPrototypeReducer(state, {
      type: "create-knowledge-folder",
    });
    const folderId = "lukomorie:Персонажи/Новая папка";
    expect(
      created.knowledgeFolders.some(
        (folder) => folder.path.at(-1) === "Новая папка",
      ),
    ).toBe(true);

    const deleted = desktopPrototypeReducer(created, {
      type: "delete-knowledge-folder",
      folderId,
    });
    expect(
      deleted.knowledgeFolders.some((folder) => folder.id === folderId),
    ).toBe(false);
    expect(deleted.selectedKnowledgeFolderPath).toEqual(["Персонажи"]);
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

  it("enables an empty secondary Knowledge pane without changing primary data", () => {
    let state = freshState();
    const primaryDocumentId = state.selectedDocumentId;
    const openDocumentIds = [...state.openDocumentIds];
    const historyBack = [...state.documentHistoryBack];
    const historyForward = [...state.documentHistoryForward];
    state = desktopPrototypeReducer(state, {
      type: "toggle-knowledge-split-view",
    });

    expect(state.knowledgeSplitEnabled).toBe(true);
    expect(state.splitViewDocumentId).toBeNull();
    expect(state.activeKnowledgePane).toBe("secondary");
    expect(state.selectedDocumentId).toBe(primaryDocumentId);
    expect(state.openDocumentIds).toEqual(openDocumentIds);
    expect(state.documentHistoryBack).toEqual(historyBack);
    expect(state.documentHistoryForward).toEqual(historyForward);
    expect(getKnowledgePaneState(state)).toMatchObject({
      splitEnabled: true,
      activePane: "secondary",
      secondaryDocument: undefined,
      activeDocument: undefined,
    });

    state = desktopPrototypeReducer(state, {
      type: "toggle-knowledge-split-view",
    });
    expect(state.knowledgeSplitEnabled).toBe(false);
    expect(state.splitViewDocumentId).toBeNull();
    expect(state.activeKnowledgePane).toBe("primary");
  });

  it("targets Knowledge tree selection to the active pane", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "toggle-knowledge-split-view",
    });
    const primaryDocumentId = state.selectedDocumentId;
    const secondaryDocument = state.documents.find(
      (document) =>
        document.projectId === state.activeProjectId &&
        document.id !== primaryDocumentId,
    );
    if (!secondaryDocument) throw new Error("Expected a secondary document");

    state = desktopPrototypeReducer(state, {
      type: "open-knowledge-document-in-active-pane",
      documentId: secondaryDocument.id,
    });

    expect(getKnowledgePaneState(state)).toMatchObject({
      activePane: "secondary",
      activeDocument: { id: secondaryDocument.id },
    });
    expect(state.selectedDocumentId).toBe(primaryDocumentId);
    expect(state.splitViewDocumentId).toBe(secondaryDocument.id);

    state = desktopPrototypeReducer(state, {
      type: "activate-knowledge-pane",
      pane: "primary",
    });
    const primaryReplacement = state.documents.find(
      (document) =>
        document.projectId === state.activeProjectId &&
        document.id !== primaryDocumentId &&
        document.id !== secondaryDocument.id,
    );
    if (!primaryReplacement) throw new Error("Expected a primary document");
    state = desktopPrototypeReducer(state, {
      type: "open-knowledge-document-in-active-pane",
      documentId: primaryReplacement.id,
    });
    expect(getKnowledgePaneState(state)).toMatchObject({
      activePane: "primary",
      activeDocument: { id: primaryReplacement.id },
    });
    expect(state.selectedDocumentId).toBe(primaryReplacement.id);
    expect(state.splitViewDocumentId).toBe(secondaryDocument.id);
  });

  it("activates the opposite pane instead of duplicating its document", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "toggle-knowledge-split-view",
    });
    const primaryDocumentId = state.selectedDocumentId;
    const secondaryDocument = state.documents.find(
      (document) =>
        document.projectId === state.activeProjectId &&
        document.id !== primaryDocumentId,
    );
    if (!secondaryDocument) throw new Error("Expected a secondary document");
    state = desktopPrototypeReducer(state, {
      type: "open-knowledge-document-in-active-pane",
      documentId: secondaryDocument.id,
    });
    state = desktopPrototypeReducer(state, {
      type: "activate-knowledge-pane",
      pane: "primary",
    });
    state = desktopPrototypeReducer(state, {
      type: "open-knowledge-document-in-active-pane",
      documentId: secondaryDocument.id,
    });
    expect(state.activeKnowledgePane).toBe("secondary");
    expect(state.selectedDocumentId).toBe(primaryDocumentId);
    expect(state.splitViewDocumentId).toBe(secondaryDocument.id);
  });

  it("clears Split when leaving Knowledge or switching projects", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "toggle-knowledge-split-view",
    });
    state = desktopPrototypeReducer(state, {
      type: "switch-section",
      section: "overview",
    });
    expect(state.knowledgeSplitEnabled).toBe(false);
    expect(state.splitViewDocumentId).toBeNull();

    state = desktopPrototypeReducer(state, {
      type: "switch-section",
      section: "knowledge",
    });
    state = desktopPrototypeReducer(state, {
      type: "toggle-knowledge-split-view",
    });
    const otherProject = state.projects.find(
      (project) => project.id !== state.activeProjectId,
    );
    if (!otherProject) throw new Error("Expected another project");
    state = desktopPrototypeReducer(state, {
      type: "switch-project",
      projectId: otherProject.id,
    });
    expect(state.knowledgeSplitEnabled).toBe(false);
    expect(state.splitViewDocumentId).toBeNull();
  });

  it("falls back within the active project for invalid pane documents", () => {
    const state = freshState();
    const foreignDocument = state.documents.find(
      (document) => document.projectId !== state.activeProjectId,
    );
    if (!foreignDocument) throw new Error("Expected a foreign mock document");

    const crossProjectPane = getKnowledgePaneState({
      ...state,
      knowledgeSplitEnabled: true,
      activeKnowledgePane: "secondary",
      splitViewDocumentId: foreignDocument.id,
    });
    expect(crossProjectPane.secondaryDocument).toBeUndefined();
    expect(crossProjectPane.activePane).toBe("secondary");
    expect(crossProjectPane.activeDocument).toBeUndefined();

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
