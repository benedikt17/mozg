import { describe, expect, it } from "vitest";
import v1Fixture from "./fixtures/desktop-domain-snapshot-v1.json";
import v2Fixture from "./fixtures/desktop-domain-snapshot-v2.json";
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

describe("desktop domain snapshot v2", () => {
  it("creates a deterministic JSON-serializable snapshot from initial state", () => {
    const first = validSnapshot();
    const second = validSnapshot();

    expect(first.schemaVersion).toBe(DESKTOP_DOMAIN_SCHEMA_VERSION);
    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(
      first.tasks.every((task) =>
        task.subtasks.every(
          (subtask) => typeof subtask.detailsMarkdown === "string",
        ),
      ),
    ).toBe(true);
    expect(parseDesktopDomainSnapshot(first)).toMatchObject({ ok: true });
  });

  it("parses the v2 fixture without migration warnings and preserves details", () => {
    const result = parseDesktopDomainSnapshot(v2Fixture);

    expect(result).toMatchObject({ ok: true, warnings: [] });
    if (!result.ok) return;
    expect(result.snapshot.schemaVersion).toBe(2);
    expect(result.snapshot.tasks[0]?.subtasks).toEqual([
      {
        id: "subtask-v2-empty",
        title: "Empty explanation",
        done: false,
        detailsMarkdown: "",
      },
      {
        id: "subtask-v2-markdown",
        title: "Markdown explanation",
        done: true,
        detailsMarkdown:
          "- First point\n- [literal] text\n\n[Reference](https://example.test/details)",
      },
    ]);
  });

  it("migrates the v1 fixture to runtime v2 without mutating the source", () => {
    const source = structuredClone(v1Fixture);
    const result = parseDesktopDomainSnapshot(source);

    expect(result).toMatchObject({
      ok: true,
      warnings: [
        expect.objectContaining({
          code: "migrated-schema-version",
          path: "schemaVersion",
        }),
      ],
    });
    expect(source).toEqual(v1Fixture);
    if (!result.ok) return;
    expect(result.snapshot.schemaVersion).toBe(2);
    expect(result.snapshot.tasks[0]?.subtasks).toEqual([
      {
        id: "subtask-v1",
        title: "Nested task",
        done: false,
        detailsMarkdown: "",
      },
    ]);
    expect(result.snapshot.tasks[0]?.notes).toBe("Persistent notes");
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

  it("round-trips tasks created and moved into a user list", () => {
    let state = structuredClone(initialDesktopPrototypeState);
    state = desktopPrototypeReducer(state, {
      type: "create-task-group",
      title: "Personal tasks",
    });
    state = desktopPrototypeReducer(state, {
      type: "create-task-list",
      groupId: "mock-task-group-1",
      title: "Private list",
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
      title: "Created in user list",
    });

    const created = parseDesktopDomainSnapshot(
      createDesktopDomainSnapshot(state),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(
      created.snapshot.tasks.find(
        (task) => task.title === "Created in user list",
      ),
    ).toMatchObject({
      listId: "mock-task-list-1",
      overviewDirectionId: "",
      showOnOverview: false,
    });

    const movedState = desktopPrototypeReducer(state, {
      type: "move-task-to-list",
      taskId: "luko-first-scene",
      targetListId: "mock-task-list-1",
      targetTaskId: null,
    });
    const moved = parseDesktopDomainSnapshot(
      createDesktopDomainSnapshot(movedState),
    );
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(
      moved.snapshot.tasks.find((task) => task.id === "luko-first-scene"),
    ).toMatchObject({
      listId: "mock-task-list-1",
      overviewDirectionId: "",
      showOnOverview: false,
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
      { ...validSnapshot(), schemaVersion: 3 },
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

  it("accepts the exact current v2 persistent contract", () => {
    const snapshot = cloneSnapshot();
    delete snapshot.tasks[0]!.area;
    delete snapshot.tasks[0]!.dueDate;
    delete snapshot.tasks[0]!.notes;
    delete snapshot.documents[0]!.order;
    delete snapshot.documents[0]!.folderPath;
    delete snapshot.documents[0]!.isKeyDocument;

    expect(parseDesktopDomainSnapshot(snapshot)).toMatchObject({ ok: true });
  });

  it.each([
    ["unknown field", { futureField: true }, "unknown-field"],
    [
      "missing detailsMarkdown",
      { detailsMarkdown: undefined },
      "invalid-string",
    ],
    [
      "non-string detailsMarkdown",
      { detailsMarkdown: false },
      "invalid-string",
    ],
  ])("rejects v2 subtask with %s", (_name, change, code) => {
    const value = cloneSnapshot();
    const subtask = value.tasks[0]!.subtasks[0] as unknown as Record<
      string,
      unknown
    >;
    if ("detailsMarkdown" in change && change.detailsMarkdown === undefined) {
      delete subtask.detailsMarkdown;
    } else {
      Object.assign(subtask, change);
    }
    expectInvalid(value, code);
  });

  it("rejects v1 subtasks with unknown fields instead of silently treating them as v2", () => {
    const value = structuredClone(v1Fixture) as Record<string, unknown>;
    const tasks = value.tasks as Array<Record<string, unknown>>;
    const subtasks = tasks[0]!.subtasks as Array<Record<string, unknown>>;
    subtasks[0]!.detailsMarkdown = "not allowed in v1";

    expectInvalid(value, "unknown-field");
  });

  it("round-trips non-empty v2 details through hydration", () => {
    const state = structuredClone(initialDesktopPrototypeState);
    const task = state.tasks[0];
    if (!task?.subtasks[0]) throw new Error("Expected a fixture subtask.");
    task.subtasks[0].detailsMarkdown = "# Details\n\n- Keep this Markdown";

    const parsed = parseDesktopDomainSnapshot(
      createDesktopDomainSnapshot(state),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.snapshot.tasks[0]?.subtasks[0]?.detailsMarkdown).toBe(
      "# Details\n\n- Keep this Markdown",
    );
  });

  it("allows duplicate subtask titles because identity is the subtask ID", () => {
    const snapshot = cloneSnapshot();
    const subtasks = snapshot.tasks[0]!.subtasks;
    subtasks[1]!.title = subtasks[0]!.title;

    const result = parseDesktopDomainSnapshot(snapshot);

    expect(result).toMatchObject({ ok: true });
    expect(subtasks.map((subtask) => subtask.id)).toEqual([
      "luko-characters-map-1",
      "luko-characters-map-2",
      "luko-characters-map-3",
    ]);
  });

  it("rejects unknown persistent fields without normalizing them away", () => {
    const topLevel = { ...cloneSnapshot(), futureField: true };
    const topLevelResult = expectInvalid(topLevel, "unknown-field");
    if (!topLevelResult.ok) {
      expect(topLevelResult.errors).toContainEqual(
        expect.objectContaining({ path: "futureField" }),
      );
    }

    const task = cloneSnapshot();
    (task.tasks[0] as unknown as Record<string, unknown>).futureField = true;
    const taskResult = expectInvalid(task, "unknown-field");
    if (!taskResult.ok) {
      expect(taskResult.errors).toContainEqual(
        expect.objectContaining({ path: "tasks[0].futureField" }),
      );
    }

    const nested = cloneSnapshot();
    nested.tasks[0]!.links.push({
      id: "future-link",
      title: "Future link",
      url: "https://example.test/future",
    });
    (
      nested.tasks[0]!.subtasks[0] as unknown as Record<string, unknown>
    ).future = true;
    (nested.tasks[0]!.links[0] as unknown as Record<string, unknown>).future =
      true;
    expectInvalid(nested, "unknown-field");

    const document = cloneSnapshot();
    (document.documents[0] as unknown as Record<string, unknown>).future = true;
    expectInvalid(document, "unknown-field");
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

    const emptySystemDirection = cloneSnapshot();
    emptySystemDirection.tasks[0]!.overviewDirectionId = "";
    expectInvalid(emptySystemDirection, "invalid-overview-link");

    const userListTask = cloneSnapshot();
    userListTask.taskGroups.push({
      id: "user-group",
      projectId: "lukomorie",
      title: "User group",
      order: 1,
      kind: "user",
    });
    userListTask.taskLists.push({
      id: "user-list",
      projectId: "lukomorie",
      groupId: "user-group",
      title: "User list",
      order: 1,
      kind: "user",
    });
    userListTask.tasks[0] = {
      ...userListTask.tasks[0]!,
      listId: "user-list",
      overviewDirectionId: "",
      showOnOverview: false,
    };
    expect(parseDesktopDomainSnapshot(userListTask).ok).toBe(true);

    userListTask.tasks[0]!.showOnOverview = true;
    expectInvalid(userListTask, "invalid-overview-link");
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
