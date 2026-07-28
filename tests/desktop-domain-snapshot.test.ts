import { describe, expect, it } from "vitest";
import {
  desktopPrototypeReducer,
  initialDesktopPrototypeState,
} from "@/prototype/desktop-state";
import {
  DESKTOP_DOMAIN_SCHEMA_VERSION,
  createDesktopDomainSnapshot,
  deriveNextPrototypeCounters,
  parseDesktopDomainSnapshot,
  snapshotToDomainCollections,
  type DesktopDomainSnapshot,
} from "@/prototype/persistence/domain-snapshot";

function validSnapshot(): DesktopDomainSnapshot {
  return createDesktopDomainSnapshot(initialDesktopPrototypeState);
}

function cloneSnapshot(): DesktopDomainSnapshot {
  return structuredClone(validSnapshot());
}

function expectInvalid(
  value: unknown,
  code?: string,
): ReturnType<typeof parseDesktopDomainSnapshot> {
  const result = parseDesktopDomainSnapshot(value);
  expect(result.ok).toBe(false);
  if (!result.ok && code) {
    expect(result.errors.map((error) => error.code)).toContain(code);
  }
  return result;
}

describe("desktop domain snapshot v1", () => {
  it("creates a deterministic JSON-serializable snapshot from initial state", () => {
    const first = validSnapshot();
    const second = validSnapshot();

    expect(first.schemaVersion).toBe(DESKTOP_DOMAIN_SCHEMA_VERSION);
    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(parseDesktopDomainSnapshot(first)).toMatchObject({ ok: true });
  });

  it("includes only active MVP domain collections", () => {
    const snapshot = validSnapshot();
    const keys = Object.keys(snapshot).sort();

    expect(keys).toEqual(
      [
        "schemaVersion",
        "projects",
        "overviewDirections",
        "taskGroups",
        "taskLists",
        "tasks",
        "knowledgeFolders",
        "documents",
      ].sort(),
    );
    expect(snapshot).not.toHaveProperty("activeProjectId");
    expect(snapshot).not.toHaveProperty("selectedDocumentId");
    expect(snapshot).not.toHaveProperty("contextPanel");
    expect(snapshot).not.toHaveProperty("nextTaskNumber");
    expect(snapshot).not.toHaveProperty("canvases");
    expect(snapshot).not.toHaveProperty("canvasGroups");
    expect(snapshot).not.toHaveProperty("inboxItems");
  });

  it("does not share nested mutable references with source state", () => {
    const state = structuredClone(initialDesktopPrototypeState);
    const snapshot = createDesktopDomainSnapshot(state);
    const taskTitle = snapshot.tasks[0]?.subtasks[0]?.title;
    const linkTitle = snapshot.tasks[0]?.links[0]?.title;
    const contentLine = snapshot.documents[0]?.content[0];
    const linkedTaskId = snapshot.documents[0]?.linkedTaskIds[0];

    if (state.tasks[0]?.subtasks[0]) {
      state.tasks[0].subtasks[0].title = "Changed after snapshot";
    }
    if (state.tasks[0]?.links[0]) {
      state.tasks[0].links[0].title = "Changed link";
    }
    if (state.documents[0]) {
      state.documents[0].content[0] = "Changed content";
      state.documents[0].linkedTaskIds[0] = "changed-task";
    }

    expect(snapshot.tasks[0]?.subtasks[0]?.title).toBe(taskTitle);
    expect(snapshot.tasks[0]?.links[0]?.title).toBe(linkTitle);
    expect(snapshot.documents[0]?.content[0]).toBe(contentLine);
    expect(snapshot.documents[0]?.linkedTaskIds[0]).toBe(linkedTaskId);
  });

  it("round-trips a newly created task in its explicit list", () => {
    let state = structuredClone(initialDesktopPrototypeState);
    state = desktopPrototypeReducer(state, {
      type: "switch-section",
      section: "tasks",
    });
    state = desktopPrototypeReducer(state, {
      type: "select-task-list",
      listId: "lukomorie-list-characters",
    });
    state = desktopPrototypeReducer(state, {
      type: "create-task",
      title: "Persisted list task",
      destinationListId: "lukomorie-list-characters",
    });

    const parsed = parseDesktopDomainSnapshot(
      createDesktopDomainSnapshot(state),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(
      parsed.snapshot.tasks.find(
        (task) => task.title === "Persisted list task",
      ),
    ).toMatchObject({
      listId: "lukomorie-list-characters",
      overviewDirectionId: "lukomorie-characters",
      showOnOverview: true,
      myDay: false,
      starred: false,
    });
  });

  it("round-trips domain IDs, relations, content and independent date metadata", () => {
    const snapshot = cloneSnapshot();
    snapshot.knowledgeFolders.push({
      id: "mock-knowledge-folder-1",
      projectId: "lukomorie",
      path: ["Пустая папка"],
    });
    const parsed = parseDesktopDomainSnapshot(snapshot);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const domain = snapshotToDomainCollections(parsed.snapshot);
    expect(domain.projects.map(({ id }) => id)).toEqual(
      snapshot.projects.map(({ id }) => id),
    );
    expect(domain.taskGroups).toEqual(snapshot.taskGroups);
    expect(domain.taskLists).toEqual(snapshot.taskLists);
    expect(domain.tasks).toEqual(snapshot.tasks);
    expect(domain.documents).toEqual(snapshot.documents);
    expect(domain.knowledgeFolders).toEqual(snapshot.knowledgeFolders);
    expect(
      domain.tasks.find((task) => task.id === "luko-first-scene"),
    ).toMatchObject({
      myDay: true,
      dueDate: "19 июл",
      listId: "lukomorie-list-scenario",
      overviewDirectionId: "lukomorie-scenario",
      linkedDocumentIds: ["doc-l-first-chapter"],
    });
  });

  it("persists only materialized folders while document paths remain intact", () => {
    const snapshot = validSnapshot();

    expect(snapshot.knowledgeFolders).toEqual([]);
    expect(
      snapshot.documents.find((document) => document.id === "doc-l-kolenka")
        ?.folderPath,
    ).toEqual(["Персонажи", "Главные герои"]);
  });

  it.each([
    ["null", null, "invalid-snapshot"],
    ["array", [], "invalid-snapshot"],
    [
      "missing version",
      { ...validSnapshot(), schemaVersion: undefined },
      "unsupported-schema-version",
    ],
    [
      "unsupported version",
      { ...validSnapshot(), schemaVersion: 2 },
      "unsupported-schema-version",
    ],
    [
      "missing collection",
      (() => {
        const value = { ...validSnapshot() } as Partial<DesktopDomainSnapshot>;
        delete value.tasks;
        return value;
      })(),
      "invalid-collection",
    ],
    [
      "invalid collection",
      { ...validSnapshot(), tasks: {} },
      "invalid-collection",
    ],
  ])("rejects structurally invalid %s snapshots", (_name, value, code) => {
    expectInvalid(value, code);
  });

  it("rejects invalid booleans, enums, arrays, paths and orders", () => {
    const invalidBoolean = cloneSnapshot();
    (invalidBoolean.tasks[0] as unknown as { myDay: unknown }).myDay = "yes";
    expectInvalid(invalidBoolean, "invalid-boolean");

    const invalidEnum = cloneSnapshot();
    (invalidEnum.taskGroups[0] as unknown as { kind: unknown }).kind = "other";
    expectInvalid(invalidEnum, "invalid-enum");

    const invalidNestedArray = cloneSnapshot();
    (invalidNestedArray.tasks[0] as unknown as { subtasks: unknown }).subtasks =
      {};
    expectInvalid(invalidNestedArray, "invalid-array");

    const invalidFolderPath = cloneSnapshot();
    (
      invalidFolderPath.documents[0] as unknown as { folderPath: unknown }
    ).folderPath = [""];
    expectInvalid(invalidFolderPath, "invalid-string");

    const invalidOrder = cloneSnapshot();
    invalidOrder.tasks[0]!.overviewOrder = Number.POSITIVE_INFINITY;
    expectInvalid(invalidOrder, "invalid-order");

    const invalidCompletion = cloneSnapshot();
    (
      invalidCompletion.tasks[0] as unknown as { completedAt: unknown }
    ).completedAt = false;
    expectInvalid(invalidCompletion, "invalid-completion");
  });

  it("rejects duplicate primary and nested IDs", () => {
    const duplicateProject = cloneSnapshot();
    duplicateProject.projects.push({ ...duplicateProject.projects[0]! });
    expectInvalid(duplicateProject, "duplicate-id");

    const duplicateTask = cloneSnapshot();
    duplicateTask.tasks.push({ ...duplicateTask.tasks[0]! });
    expectInvalid(duplicateTask, "duplicate-id");

    const duplicateSubtask = cloneSnapshot();
    duplicateSubtask.tasks[0]!.subtasks.push({
      ...duplicateSubtask.tasks[0]!.subtasks[0]!,
    });
    expectInvalid(duplicateSubtask, "duplicate-id");
  });

  it("rejects missing and cross-project task/list/group relations", () => {
    const missingList = cloneSnapshot();
    missingList.tasks[0]!.listId = "missing-list";
    expectInvalid(missingList, "missing-list");

    const missingGroup = cloneSnapshot();
    missingGroup.taskLists[0]!.groupId = "missing-group";
    expectInvalid(missingGroup, "missing-group");

    const crossProjectTask = cloneSnapshot();
    crossProjectTask.tasks[0]!.listId = "ammonit-list-scenario";
    expectInvalid(crossProjectTask, "cross-project-relation");

    const crossProjectList = cloneSnapshot();
    crossProjectList.taskLists[0]!.groupId = "ammonit-baza";
    expectInvalid(crossProjectList, "invalid-list-group");
  });

  it("rejects invalid Overview linkage", () => {
    const missingDirection = cloneSnapshot();
    missingDirection.tasks[0]!.overviewDirectionId = "missing-direction";
    expectInvalid(missingDirection, "invalid-overview-link");

    const invalidVisibility = cloneSnapshot();
    invalidVisibility.tasks[0]!.listId = "lukomorie-list-scenario";
    invalidVisibility.tasks[0]!.overviewDirectionId = "lukomorie-characters";
    invalidVisibility.tasks[0]!.showOnOverview = true;
    expectInvalid(invalidVisibility, "invalid-overview-link");
  });

  it("rejects invalid Knowledge ownership and duplicate materialized paths", () => {
    const duplicateFolderPath = cloneSnapshot();
    duplicateFolderPath.knowledgeFolders.push(
      {
        id: "mock-knowledge-folder-1",
        projectId: "lukomorie",
        path: ["Пустая"],
      },
      {
        id: "mock-knowledge-folder-2",
        projectId: "lukomorie",
        path: ["Пустая"],
      },
    );
    expectInvalid(duplicateFolderPath, "duplicate-folder-path");

    const missingProject = cloneSnapshot();
    missingProject.documents[0]!.projectId = "missing-project";
    expectInvalid(missingProject, "missing-project");

    const crossProjectTaskDocument = cloneSnapshot();
    crossProjectTaskDocument.tasks[0]!.linkedDocumentIds = ["doc-a-index"];
    expectInvalid(crossProjectTaskDocument, "cross-project-relation");

    const crossProjectDocumentTask = cloneSnapshot();
    crossProjectDocumentTask.documents[0]!.linkedTaskIds = ["ammonit-index"];
    expectInvalid(crossProjectDocumentTask, "cross-project-relation");
  });

  it("derives collision-safe prototype counters by prefix", () => {
    const snapshot = cloneSnapshot();
    snapshot.projects.push({
      id: "mock-project-7",
      name: "Seven",
      shortName: "Seven",
      description: "",
    });
    snapshot.tasks.push({
      ...snapshot.tasks[0]!,
      id: "ai-task-9",
    });
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
      linkedTaskIds: [],
    });
    snapshot.knowledgeFolders.push({
      id: "mock-knowledge-folder-3",
      projectId: "lukomorie",
      path: ["Empty"],
    });

    expect(deriveNextPrototypeCounters(snapshot)).toEqual({
      nextProjectNumber: 8,
      nextTaskNumber: 10,
      nextTaskGroupNumber: 5,
      nextTaskListNumber: 7,
      nextDocumentNumber: 9,
      nextKnowledgeFolderNumber: 4,
    });
    expect(
      deriveNextPrototypeCounters({
        ...snapshot,
        projects: snapshot.projects.filter(
          (item) => !item.id.startsWith("mock-project-"),
        ),
        tasks: snapshot.tasks.filter(
          (item) =>
            !item.id.startsWith("mock-task-") &&
            !item.id.startsWith("ai-task-"),
        ),
        taskGroups: [],
        taskLists: [],
        documents: [],
        knowledgeFolders: [],
      }),
    ).toEqual({
      nextProjectNumber: 1,
      nextTaskNumber: 1,
      nextTaskGroupNumber: 1,
      nextTaskListNumber: 1,
      nextDocumentNumber: 1,
      nextKnowledgeFolderNumber: 1,
    });
  });
});
