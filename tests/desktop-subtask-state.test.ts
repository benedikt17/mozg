import { describe, expect, it } from "vitest";
import v1Fixture from "./fixtures/desktop-domain-snapshot-v1.json";
import {
  createDesktopDomainSnapshot,
  parseDesktopDomainSnapshot,
} from "@/prototype/persistence/domain-snapshot";
import { parseDesktopCloudSnapshotRow } from "@/prototype/persistence/cloud-snapshot-bridge";
import {
  desktopPrototypeReducer,
  initialDesktopPrototypeState,
} from "@/prototype/desktop-state";
import type { DesktopPrototypeState } from "@/prototype/state/types";

function freshState(): DesktopPrototypeState {
  return structuredClone(initialDesktopPrototypeState);
}

function subtaskIds(
  state: DesktopPrototypeState,
  taskId = "luko-characters-map",
) {
  return state.tasks
    .find((task) => task.id === taskId)
    ?.subtasks.map((subtask) => subtask.id);
}

function subtask(
  state: DesktopPrototypeState,
  taskId: string,
  subtaskId: string,
) {
  return state.tasks
    .find((task) => task.id === taskId)
    ?.subtasks.find((item) => item.id === subtaskId);
}

describe("task subtask domain actions", () => {
  it("updates only detailsMarkdown", () => {
    const state = freshState();
    const before = state.tasks.find(
      (task) => task.id === "luko-characters-map",
    );
    const next = desktopPrototypeReducer(state, {
      type: "update-subtask-details-markdown",
      taskId: "luko-characters-map",
      subtaskId: "luko-characters-map-2",
      markdown: "Explanation",
    });

    expect(
      subtask(next, "luko-characters-map", "luko-characters-map-2"),
    ).toEqual({
      id: "luko-characters-map-2",
      title: "Проверить конфликт наставника",
      done: false,
      detailsMarkdown: "Explanation",
    });
    expect(
      next.tasks.find((task) => task.id === "luko-characters-map")?.title,
    ).toBe(before?.title);
    expect(next.tasks.find((task) => task.id === "luko-world-rules")).toBe(
      state.tasks.find((task) => task.id === "luko-world-rules"),
    );
  });

  it("preserves multiline Markdown, links, lists and blank lines exactly", () => {
    const state = freshState();
    const markdown =
      "# Details\n\n- First point\n- [literal] text\n\n[Link](https://example.test)";

    const next = desktopPrototypeReducer(state, {
      type: "update-subtask-details-markdown",
      taskId: "luko-characters-map",
      subtaskId: "luko-characters-map-1",
      markdown,
    });

    expect(
      subtask(next, "luko-characters-map", "luko-characters-map-1")
        ?.detailsMarkdown,
    ).toBe(markdown);
  });

  it("allows an empty Markdown value to clear details", () => {
    const state = freshState();
    const withDetails = desktopPrototypeReducer(state, {
      type: "update-subtask-details-markdown",
      taskId: "luko-characters-map",
      subtaskId: "luko-characters-map-1",
      markdown: "Existing details",
    });

    const cleared = desktopPrototypeReducer(withDetails, {
      type: "update-subtask-details-markdown",
      taskId: "luko-characters-map",
      subtaskId: "luko-characters-map-1",
      markdown: "",
    });

    expect(
      subtask(cleared, "luko-characters-map", "luko-characters-map-1")
        ?.detailsMarkdown,
    ).toBe("");
  });

  it("returns the original state and task array for unchanged Markdown", () => {
    const state = freshState();
    const tasks = state.tasks;

    const next = desktopPrototypeReducer(state, {
      type: "update-subtask-details-markdown",
      taskId: "luko-characters-map",
      subtaskId: "luko-characters-map-1",
      markdown: "",
    });

    expect(next).toBe(state);
    expect(next.tasks).toBe(tasks);
  });

  it("rejects a valid subtask on an inactive project", () => {
    const state = freshState();

    expect(
      desktopPrototypeReducer(state, {
        type: "update-subtask-details-markdown",
        taskId: "ammonit-index",
        subtaskId: "ammonit-index-1",
        markdown: "Inactive project must not update",
      }),
    ).toBe(state);
  });

  it.each([
    ["missing task", "missing-task", "luko-characters-map-1"],
    ["missing subtask", "luko-characters-map", "missing-subtask"],
    ["subtask from another task", "luko-characters-map", "luko-world-rules-1"],
  ])("returns the original state for %s", (_name, taskId, subtaskId) => {
    const state = freshState();

    expect(
      desktopPrototypeReducer(state, {
        type: "update-subtask-details-markdown",
        taskId,
        subtaskId,
        markdown: "Must not update",
      }),
    ).toBe(state);
  });

  it("adds a new subtask with empty details", () => {
    const state = freshState();
    const next = desktopPrototypeReducer(state, {
      type: "add-subtask",
      taskId: "luko-characters-map",
      title: "New compact subtask",
    });

    expect(
      next.tasks
        .find((task) => task.id === "luko-characters-map")
        ?.subtasks.at(-1),
    ).toEqual({
      id: "luko-characters-map-subtask-4",
      title: "New compact subtask",
      done: false,
      detailsMarkdown: "",
    });
  });

  it("preserves details through rename", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "update-subtask-details-markdown",
      taskId: "luko-characters-map",
      subtaskId: "luko-characters-map-1",
      markdown: "Keep this explanation",
    });
    const next = desktopPrototypeReducer(state, {
      type: "rename-subtask",
      taskId: "luko-characters-map",
      subtaskId: "luko-characters-map-1",
      title: "Renamed subtask",
    });

    expect(
      subtask(next, "luko-characters-map", "luko-characters-map-1"),
    ).toMatchObject({
      id: "luko-characters-map-1",
      title: "Renamed subtask",
      detailsMarkdown: "Keep this explanation",
    });
  });

  it("preserves details through toggle", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "update-subtask-details-markdown",
      taskId: "luko-characters-map",
      subtaskId: "luko-characters-map-1",
      markdown: "Keep this explanation",
    });
    const next = desktopPrototypeReducer(state, {
      type: "toggle-subtask",
      taskId: "luko-characters-map",
      subtaskId: "luko-characters-map-1",
    });

    expect(
      subtask(next, "luko-characters-map", "luko-characters-map-1"),
    ).toMatchObject({
      id: "luko-characters-map-1",
      done: false,
      detailsMarkdown: "Keep this explanation",
    });
  });

  it("deletes the embedded subtask object and its details", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "update-subtask-details-markdown",
      taskId: "luko-characters-map",
      subtaskId: "luko-characters-map-2",
      markdown: "Delete with the subtask",
    });
    const next = desktopPrototypeReducer(state, {
      type: "delete-subtask",
      taskId: "luko-characters-map",
      subtaskId: "luko-characters-map-2",
    });

    expect(
      subtask(next, "luko-characters-map", "luko-characters-map-2"),
    ).toBeUndefined();
    expect(subtaskIds(next)).toEqual([
      "luko-characters-map-1",
      "luko-characters-map-3",
    ]);
  });

  it("updates duplicate titles by ID", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "rename-subtask",
      taskId: "luko-characters-map",
      subtaskId: "luko-characters-map-2",
      title: "Shared title",
    });
    state = desktopPrototypeReducer(state, {
      type: "rename-subtask",
      taskId: "luko-characters-map",
      subtaskId: "luko-characters-map-1",
      title: "Shared title",
    });
    const next = desktopPrototypeReducer(state, {
      type: "update-subtask-details-markdown",
      taskId: "luko-characters-map",
      subtaskId: "luko-characters-map-2",
      markdown: "Only second subtask",
    });

    expect(
      subtask(next, "luko-characters-map", "luko-characters-map-1")
        ?.detailsMarkdown,
    ).toBe("");
    expect(
      subtask(next, "luko-characters-map", "luko-characters-map-2")
        ?.detailsMarkdown,
    ).toBe("Only second subtask");
  });

  it("moves a subtask to the beginning", () => {
    const next = desktopPrototypeReducer(freshState(), {
      type: "move-subtask",
      taskId: "luko-characters-map",
      subtaskId: "luko-characters-map-3",
      targetSubtaskId: "luko-characters-map-1",
    });

    expect(subtaskIds(next)).toEqual([
      "luko-characters-map-3",
      "luko-characters-map-1",
      "luko-characters-map-2",
    ]);
  });

  it("moves a subtask between two subtasks", () => {
    const next = desktopPrototypeReducer(freshState(), {
      type: "move-subtask",
      taskId: "luko-characters-map",
      subtaskId: "luko-characters-map-1",
      targetSubtaskId: "luko-characters-map-3",
    });

    expect(subtaskIds(next)).toEqual([
      "luko-characters-map-2",
      "luko-characters-map-1",
      "luko-characters-map-3",
    ]);
  });

  it("moves a subtask to the end", () => {
    const next = desktopPrototypeReducer(freshState(), {
      type: "move-subtask",
      taskId: "luko-characters-map",
      subtaskId: "luko-characters-map-1",
      targetSubtaskId: null,
    });

    expect(subtaskIds(next)).toEqual([
      "luko-characters-map-2",
      "luko-characters-map-3",
      "luko-characters-map-1",
    ]);
  });

  it("moves details with identity and preserves unaffected order", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "update-subtask-details-markdown",
      taskId: "luko-characters-map",
      subtaskId: "luko-characters-map-1",
      markdown: "Identity-bound details",
    });
    const originalSubtasks = state.tasks.find(
      (task) => task.id === "luko-characters-map",
    )!.subtasks;
    const next = desktopPrototypeReducer(state, {
      type: "move-subtask",
      taskId: "luko-characters-map",
      subtaskId: "luko-characters-map-1",
      targetSubtaskId: null,
    });

    expect(
      subtask(next, "luko-characters-map", "luko-characters-map-1")
        ?.detailsMarkdown,
    ).toBe("Identity-bound details");
    expect(subtaskIds(next)).toEqual([
      "luko-characters-map-2",
      "luko-characters-map-3",
      "luko-characters-map-1",
    ]);
    expect(
      next.tasks.find((task) => task.id === "luko-characters-map")?.subtasks[2],
    ).toBe(originalSubtasks[0]);
    expect(
      next.tasks.find((task) => task.id === "luko-characters-map")?.subtasks[0],
    ).toBe(originalSubtasks[1]);
  });

  it.each([
    ["invalid source", "missing-subtask", "luko-characters-map-1"],
    ["invalid target", "luko-characters-map-1", "missing-subtask"],
    ["cross-task target", "luko-characters-map-1", "luko-world-rules-1"],
  ])("rejects %s reorders", (_name, source, target) => {
    const state = freshState();

    expect(
      desktopPrototypeReducer(state, {
        type: "move-subtask",
        taskId: "luko-characters-map",
        subtaskId: source,
        targetSubtaskId: target,
      }),
    ).toBe(state);
  });

  it("rejects an already-effective reorder", () => {
    const state = freshState();

    expect(
      desktopPrototypeReducer(state, {
        type: "move-subtask",
        taskId: "luko-characters-map",
        subtaskId: "luko-characters-map-1",
        targetSubtaskId: "luko-characters-map-2",
      }),
    ).toBe(state);
  });

  it("returns the original state when the last subtask is moved to the end", () => {
    const state = freshState();

    expect(
      desktopPrototypeReducer(state, {
        type: "move-subtask",
        taskId: "luko-characters-map",
        subtaskId: "luko-characters-map-3",
        targetSubtaskId: null,
      }),
    ).toBe(state);
  });

  it("round-trips details through v2 serialization and hydration", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "update-subtask-details-markdown",
      taskId: "luko-characters-map",
      subtaskId: "luko-characters-map-1",
      markdown: "# Persisted\n\n- Exact Markdown",
    });
    const parsed = parseDesktopDomainSnapshot(
      createDesktopDomainSnapshot(state),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const hydrated = desktopPrototypeReducer(freshState(), {
      type: "hydrate-domain",
      snapshot: parsed.snapshot,
    });
    expect(
      subtask(hydrated, "luko-characters-map", "luko-characters-map-1")
        ?.detailsMarkdown,
    ).toBe("# Persisted\n\n- Exact Markdown");
  });

  it("round-trips reordered subtasks and details through v2", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "update-subtask-details-markdown",
      taskId: "luko-characters-map",
      subtaskId: "luko-characters-map-3",
      markdown: "Moves with ID",
    });
    state = desktopPrototypeReducer(state, {
      type: "move-subtask",
      taskId: "luko-characters-map",
      subtaskId: "luko-characters-map-3",
      targetSubtaskId: "luko-characters-map-1",
    });
    const parsed = parseDesktopDomainSnapshot(
      createDesktopDomainSnapshot(state),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const hydrated = desktopPrototypeReducer(freshState(), {
      type: "hydrate-domain",
      snapshot: parsed.snapshot,
    });
    expect(subtaskIds(hydrated)).toEqual([
      "luko-characters-map-3",
      "luko-characters-map-1",
      "luko-characters-map-2",
    ]);
    expect(
      subtask(hydrated, "luko-characters-map", "luko-characters-map-3")
        ?.detailsMarkdown,
    ).toBe("Moves with ID");
  });

  it("preserves one coherent subtask through rename, toggle and details update", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "rename-subtask",
      taskId: "luko-characters-map",
      subtaskId: "luko-characters-map-1",
      title: "Coherent subtask",
    });
    state = desktopPrototypeReducer(state, {
      type: "toggle-subtask",
      taskId: "luko-characters-map",
      subtaskId: "luko-characters-map-1",
    });
    state = desktopPrototypeReducer(state, {
      type: "update-subtask-details-markdown",
      taskId: "luko-characters-map",
      subtaskId: "luko-characters-map-1",
      markdown: "Coherent details",
    });

    expect(
      subtask(state, "luko-characters-map", "luko-characters-map-1"),
    ).toEqual({
      id: "luko-characters-map-1",
      title: "Coherent subtask",
      done: false,
      detailsMarkdown: "Coherent details",
    });
  });

  it("updates a migrated v1 subtask and saves it as valid v2", () => {
    const parsedV1 = parseDesktopDomainSnapshot(v1Fixture);
    expect(parsedV1.ok).toBe(true);
    if (!parsedV1.ok) return;
    const migrated = desktopPrototypeReducer(freshState(), {
      type: "hydrate-domain",
      snapshot: parsedV1.snapshot,
    });
    const activeMigrated = { ...migrated, activeProjectId: "project-v1" };
    const updated = desktopPrototypeReducer(activeMigrated, {
      type: "update-subtask-details-markdown",
      taskId: "task-v1",
      subtaskId: "subtask-v1",
      markdown: "Added after v1 migration",
    });
    const saved = createDesktopDomainSnapshot(updated);

    expect(saved.schemaVersion).toBe(2);
    expect(saved.tasks[0]?.subtasks[0]?.detailsMarkdown).toBe(
      "Added after v1 migration",
    );
    expect(parseDesktopDomainSnapshot(saved)).toMatchObject({ ok: true });
  });

  it("keeps local snapshot creation and cloud snapshot loading in parity", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "update-subtask-details-markdown",
      taskId: "luko-characters-map",
      subtaskId: "luko-characters-map-2",
      markdown: "Parity details",
    });
    state = desktopPrototypeReducer(state, {
      type: "move-subtask",
      taskId: "luko-characters-map",
      subtaskId: "luko-characters-map-2",
      targetSubtaskId: null,
    });
    const localSnapshot = createDesktopDomainSnapshot(state);
    const cloud = parseDesktopCloudSnapshotRow(
      {
        workspace_id: "workspace-local",
        schema_version: 2,
        snapshot: localSnapshot,
        revision: 3,
        updated_at: "2030-01-01T00:00:00.000Z",
      },
      "Workspace",
    );

    expect(cloud).toMatchObject({
      kind: "ready",
      bootstrap: { revision: 3, snapshot: localSnapshot },
    });
  });
});
