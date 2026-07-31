import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createDesktopDomainSnapshot,
  parseDesktopDomainSnapshot,
} from "@/prototype/persistence/domain-snapshot";
import {
  desktopPrototypeReducer,
  getOverviewTaskDetailMaterial,
  getOverviewTaskDetailSplitDocument,
  initialDesktopPrototypeState,
} from "@/prototype/desktop-state";
import { getMarkdownTaskListPresentation } from "@/prototype/knowledge/markdown-document-preview";
import {
  getSubtaskMoveTarget,
  getTaskSubtasksDocumentLayout,
} from "@/prototype/overview/task-subtasks-document";
import type { DesktopPrototypeState } from "@/prototype/state/types";

function freshState(): DesktopPrototypeState {
  return structuredClone(initialDesktopPrototypeState);
}

function subtaskIds(state: DesktopPrototypeState, taskId = "luko-world-rules") {
  return state.tasks
    .find((task) => task.id === taskId)
    ?.subtasks.map((item) => item.id);
}

describe("Overview task material selection", () => {
  it("opens the first valid attached article by default", () => {
    const next = desktopPrototypeReducer(freshState(), {
      type: "open-overview-task-focus",
      taskId: "luko-world-rules",
    });

    expect(next.overviewTaskDetailMaterial).toEqual({
      kind: "knowledge",
      documentId: "doc-l-geography",
    });
    expect(getOverviewTaskDetailMaterial(next, "luko-world-rules")).toEqual({
      kind: "knowledge",
      documentId: "doc-l-geography",
    });
  });

  it("opens Subtasks by default when a task has no attached article", () => {
    const state = freshState();
    state.tasks = state.tasks.map((task) =>
      task.id === "luko-production-plan"
        ? { ...task, linkedDocumentIds: [] }
        : task,
    );

    const next = desktopPrototypeReducer(state, {
      type: "open-overview-task-focus",
      taskId: "luko-production-plan",
    });

    expect(next.overviewTaskDetailMaterial).toEqual({ kind: "subtasks" });
  });

  it("explicitly opens Subtasks without changing task identity", () => {
    const next = desktopPrototypeReducer(freshState(), {
      type: "open-overview-task-subtasks",
      taskId: "luko-world-rules",
    });

    expect(next.overviewArticleSourceTaskId).toBe("luko-world-rules");
    expect(next.overviewArticlePreviewDocumentId).toBeNull();
    expect(next.overviewTaskDetailMaterial).toEqual({ kind: "subtasks" });
  });

  it("explicitly opens a valid attached article", () => {
    const next = desktopPrototypeReducer(freshState(), {
      type: "open-overview-task-article",
      taskId: "luko-world-rules",
      documentId: "doc-l-magic",
    });

    expect(next.overviewTaskDetailMaterial).toEqual({
      kind: "knowledge",
      documentId: "doc-l-magic",
    });
  });

  it("rejects an unattached document without changing state", () => {
    const state = freshState();

    expect(
      desktopPrototypeReducer(state, {
        type: "open-overview-task-article",
        taskId: "luko-world-rules",
        documentId: "doc-a-index",
      }),
    ).toBe(state);
  });

  it("restores the transient Overview workspace after section navigation", () => {
    const opened = desktopPrototypeReducer(freshState(), {
      type: "open-overview-task-article",
      taskId: "luko-world-rules",
      documentId: "doc-l-magic",
    });
    const switched = desktopPrototypeReducer(opened, {
      type: "switch-section",
      section: "tasks",
    });
    const hydrated = desktopPrototypeReducer(opened, {
      type: "hydrate-domain",
      snapshot: createDesktopDomainSnapshot(opened),
    });

    expect(switched.overviewExpandedTaskId).toBe("luko-world-rules");
    expect(switched.overviewArticleSourceTaskId).toBe("luko-world-rules");
    expect(switched.overviewTaskDetailMaterial).toEqual({
      kind: "knowledge",
      documentId: "doc-l-magic",
    });
    expect(
      desktopPrototypeReducer(switched, {
        type: "switch-section",
        section: "overview",
      }).overviewTaskDetailMaterial,
    ).toEqual({ kind: "knowledge", documentId: "doc-l-magic" });
    expect(hydrated.overviewTaskDetailMaterial).toBeNull();
  });

  it("keeps an expanded task card through Knowledge navigation", () => {
    let state = desktopPrototypeReducer(freshState(), {
      type: "toggle-overview-task-expanded",
      taskId: "luko-world-rules",
    });
    state = desktopPrototypeReducer(state, {
      type: "switch-section",
      section: "knowledge",
    });
    state = desktopPrototypeReducer(state, {
      type: "switch-section",
      section: "overview",
    });

    expect(state.overviewExpandedTaskId).toBe("luko-world-rules");
    expect(state.overviewArticleSourceTaskId).toBeNull();
  });

  it("restores the same task details, material, and context through repeated navigation", () => {
    let state = desktopPrototypeReducer(freshState(), {
      type: "open-overview-task-article",
      taskId: "luko-world-rules",
      documentId: "doc-l-magic",
    });
    state = desktopPrototypeReducer(state, {
      type: "switch-section",
      section: "knowledge",
    });
    state = desktopPrototypeReducer(state, {
      type: "switch-section",
      section: "tasks",
    });
    state = desktopPrototypeReducer(state, {
      type: "switch-section",
      section: "overview",
    });

    expect(state.overviewExpandedTaskId).toBe("luko-world-rules");
    expect(state.overviewArticleSourceTaskId).toBe("luko-world-rules");
    expect(state.overviewTaskDetailMaterial).toEqual({
      kind: "knowledge",
      documentId: "doc-l-magic",
    });
    expect(state.overviewTaskDetailContextPanel).toEqual({
      kind: "task",
      taskId: "luko-world-rules",
    });
    expect(state.contextPanel).toEqual({
      kind: "task",
      taskId: "luko-world-rules",
    });
  });

  it("restores Subtasks and the Split article after top-level navigation", () => {
    let state = desktopPrototypeReducer(freshState(), {
      type: "open-overview-task-subtasks",
      taskId: "luko-world-rules",
    });
    state = desktopPrototypeReducer(state, {
      type: "open-overview-task-split",
      taskId: "luko-world-rules",
      documentId: "doc-l-magic",
    });
    state = desktopPrototypeReducer(state, {
      type: "switch-section",
      section: "knowledge",
    });
    state = desktopPrototypeReducer(state, {
      type: "switch-section",
      section: "tasks",
    });
    state = desktopPrototypeReducer(state, {
      type: "switch-section",
      section: "overview",
    });

    expect(state.overviewArticleSourceTaskId).toBe("luko-world-rules");
    expect(state.overviewTaskDetailMaterial).toEqual({ kind: "subtasks" });
    expect(state.overviewTaskDetailSplit).toEqual({
      enabled: true,
      documentId: "doc-l-magic",
    });
    expect(
      getOverviewTaskDetailSplitDocument(state, "luko-world-rules")?.id,
    ).toBe("doc-l-magic");
  });

  it("falls back to a collapsed Overview when the remembered task is deleted", () => {
    let state = desktopPrototypeReducer(freshState(), {
      type: "open-overview-task-article",
      taskId: "luko-world-rules",
      documentId: "doc-l-magic",
    });
    state = desktopPrototypeReducer(state, {
      type: "switch-section",
      section: "knowledge",
    });
    state = desktopPrototypeReducer(state, {
      type: "delete-task",
      taskId: "luko-world-rules",
    });
    state = desktopPrototypeReducer(state, {
      type: "switch-section",
      section: "overview",
    });

    expect(state.overviewExpandedTaskId).toBeNull();
    expect(state.overviewArticleSourceTaskId).toBeNull();
    expect(state.overviewTaskDetailContextPanel).toBeNull();
    expect(state.contextPanel).toBeNull();
  });

  it("restores duplicate-titled articles by ID, not by title", () => {
    const state = freshState();
    const duplicateTitle = state.documents.find(
      (document) => document.id === "doc-l-geography",
    )?.title;
    state.documents = state.documents.map((document) =>
      document.id === "doc-l-magic"
        ? { ...document, title: duplicateTitle ?? document.title }
        : document,
    );

    let next = desktopPrototypeReducer(state, {
      type: "open-overview-task-article",
      taskId: "luko-world-rules",
      documentId: "doc-l-magic",
    });
    next = desktopPrototypeReducer(next, {
      type: "switch-section",
      section: "tasks",
    });
    next = desktopPrototypeReducer(next, {
      type: "switch-section",
      section: "overview",
    });

    expect(next.overviewTaskDetailMaterial).toEqual({
      kind: "knowledge",
      documentId: "doc-l-magic",
    });
  });

  it("does not include material or Split view state in schema v2 snapshots", () => {
    let state = desktopPrototypeReducer(freshState(), {
      type: "open-overview-task-subtasks",
      taskId: "luko-world-rules",
    });
    state = desktopPrototypeReducer(state, {
      type: "open-overview-task-split",
      taskId: "luko-world-rules",
    });
    const snapshot = createDesktopDomainSnapshot(state);

    expect(snapshot.schemaVersion).toBe(2);
    expect("overviewTaskDetailMaterial" in snapshot).toBe(false);
    expect("overviewTaskDetailSplit" in snapshot).toBe(false);
    expect("overviewTaskDetailContextPanel" in snapshot).toBe(false);
    expect(parseDesktopDomainSnapshot(snapshot)).toMatchObject({ ok: true });
  });

  it("falls back safely to Subtasks for a stale selected document", () => {
    const state = {
      ...freshState(),
      overviewArticleSourceTaskId: "luko-world-rules",
      overviewTaskDetailMaterial: {
        kind: "knowledge" as const,
        documentId: "missing-document",
      },
    };

    expect(getOverviewTaskDetailMaterial(state, "luko-world-rules")).toEqual({
      kind: "subtasks",
    });
  });

  it("falls back to Subtasks when the remembered article is detached", () => {
    let state = desktopPrototypeReducer(freshState(), {
      type: "open-overview-task-article",
      taskId: "luko-world-rules",
      documentId: "doc-l-magic",
    });
    state = desktopPrototypeReducer(state, {
      type: "detach-task-document",
      taskId: "luko-world-rules",
      documentId: "doc-l-magic",
    });
    state = desktopPrototypeReducer(state, {
      type: "switch-section",
      section: "tasks",
    });
    state = desktopPrototypeReducer(state, {
      type: "switch-section",
      section: "overview",
    });

    expect(state.overviewArticleSourceTaskId).toBe("luko-world-rules");
    expect(getOverviewTaskDetailMaterial(state, "luko-world-rules")).toEqual({
      kind: "subtasks",
    });
  });

  it("keeps the ephemeral Split secondary article on the attached-document boundary", () => {
    let state = desktopPrototypeReducer(freshState(), {
      type: "open-overview-task-subtasks",
      taskId: "luko-world-rules",
    });
    state = desktopPrototypeReducer(state, {
      type: "open-overview-task-split",
      taskId: "luko-world-rules",
    });

    expect(state.overviewTaskDetailSplit).toEqual({
      enabled: true,
      documentId: "doc-l-geography",
    });
    expect(
      getOverviewTaskDetailSplitDocument(state, "luko-world-rules")?.id,
    ).toBe("doc-l-geography");

    const replaced = desktopPrototypeReducer(state, {
      type: "select-overview-task-split-article",
      taskId: "luko-world-rules",
      documentId: "doc-l-magic",
    });
    expect(replaced.overviewTaskDetailSplit).toEqual({
      enabled: true,
      documentId: "doc-l-magic",
    });

    expect(
      desktopPrototypeReducer(state, {
        type: "select-overview-task-split-article",
        taskId: "luko-world-rules",
        documentId: "doc-a-index",
      }),
    ).toBe(state);
  });

  it("opens Split from an article with Subtasks primary and the same article secondary", () => {
    let state = desktopPrototypeReducer(freshState(), {
      type: "open-overview-task-article",
      taskId: "luko-world-rules",
      documentId: "doc-l-magic",
    });
    state = desktopPrototypeReducer(state, {
      type: "open-overview-task-split",
      taskId: "luko-world-rules",
    });

    expect(state.overviewTaskDetailMaterial).toEqual({ kind: "subtasks" });
    expect(state.overviewTaskDetailSplit).toEqual({
      enabled: true,
      documentId: "doc-l-magic",
    });
    expect(
      getOverviewTaskDetailSplitDocument(state, "luko-world-rules")?.id,
    ).toBe("doc-l-magic");
  });

  it("falls back safely when remembered task or article IDs are stale", () => {
    const staleArticle = {
      ...freshState(),
      activeSection: "tasks" as const,
      overviewArticleSourceTaskId: "luko-world-rules",
      overviewTaskDetailMaterial: {
        kind: "knowledge" as const,
        documentId: "deleted-document",
      },
      overviewTaskDetailSplit: {
        enabled: true as const,
        documentId: "deleted-document",
      },
    };
    const returned = desktopPrototypeReducer(staleArticle, {
      type: "switch-section",
      section: "overview",
    });

    expect(getOverviewTaskDetailMaterial(returned, "luko-world-rules")).toEqual(
      { kind: "subtasks" },
    );
    expect(
      getOverviewTaskDetailSplitDocument(returned, "luko-world-rules"),
    ).toBeUndefined();
    expect(getOverviewTaskDetailMaterial(returned, "deleted-task")).toBeNull();
  });

  it("closes Split when its active article is detached or the reader is closed", () => {
    let state = desktopPrototypeReducer(freshState(), {
      type: "open-overview-task-subtasks",
      taskId: "luko-world-rules",
    });
    state = desktopPrototypeReducer(state, {
      type: "open-overview-task-split",
      taskId: "luko-world-rules",
      documentId: "doc-l-magic",
    });
    const detached = desktopPrototypeReducer(state, {
      type: "detach-task-document",
      taskId: "luko-world-rules",
      documentId: "doc-l-magic",
    });

    expect(detached.overviewTaskDetailSplit).toEqual({ enabled: false });
    expect(
      desktopPrototypeReducer(state, {
        type: "close-overview-task-split",
      }).overviewTaskDetailSplit,
    ).toEqual({ enabled: false });
  });
});

describe("central Subtasks view helpers", () => {
  it("keeps the central document free of redundant heading and sequence chrome", () => {
    expect(getTaskSubtasksDocumentLayout()).toEqual({
      showRedundantHeading: false,
      showSequenceNumbers: false,
    });
  });

  it("maps move-up to the previous target", () => {
    const state = freshState();
    const subtasks = state.tasks.find(
      (task) => task.id === "luko-characters-map",
    )!.subtasks;

    expect(getSubtaskMoveTarget(subtasks, "luko-characters-map-2", "up")).toBe(
      "luko-characters-map-1",
    );
  });

  it("maps move-down to the item after the next or the end", () => {
    const state = freshState();
    const subtasks = state.tasks.find(
      (task) => task.id === "luko-characters-map",
    )!.subtasks;

    expect(
      getSubtaskMoveTarget(subtasks, "luko-characters-map-1", "down"),
    ).toBe("luko-characters-map-3");
    expect(
      getSubtaskMoveTarget(subtasks, "luko-characters-map-2", "down"),
    ).toBeNull();
  });

  it("keeps central reorder mapped to the domain order", () => {
    const state = freshState();
    const subtasks = state.tasks.find(
      (task) => task.id === "luko-characters-map",
    )!.subtasks;
    const next = desktopPrototypeReducer(state, {
      type: "move-subtask",
      taskId: "luko-characters-map",
      subtaskId: "luko-characters-map-1",
      targetSubtaskId: getSubtaskMoveTarget(
        subtasks,
        "luko-characters-map-1",
        "down",
      ),
    });

    expect(subtaskIds(next, "luko-characters-map")).toEqual([
      "luko-characters-map-2",
      "luko-characters-map-1",
      "luko-characters-map-3",
    ]);
  });

  it("treats checklist Markdown as literal in static previews", () => {
    expect(
      getMarkdownTaskListPresentation("- [ ] literal checklist", "static"),
    ).toBe("literal");
    expect(
      getMarkdownTaskListPresentation("- [x] completed checklist", "static"),
    ).toBe("literal");
    expect(
      getMarkdownTaskListPresentation(
        "- [ ] Knowledge checklist",
        "interactive",
      ),
    ).toBe("interactive");
  });

  it("keeps central materials free of visible path rows and uses orange structured checkboxes", () => {
    const subtasksSource = readFileSync(
      resolve(
        process.cwd(),
        "src/prototype/overview/task-subtasks-document.tsx",
      ),
      "utf8",
    );
    const readerSource = readFileSync(
      resolve(
        process.cwd(),
        "src/prototype/overview/overview-contextual-reader.tsx",
      ),
      "utf8",
    );
    const workspaceStyles = readFileSync(
      resolve(process.cwd(), "src/prototype/desktop-workspaces.css"),
      "utf8",
    );

    expect(subtasksSource).not.toContain(
      'className="overview-reader-breadcrumb"',
    );
    expect(readerSource).not.toContain("overview-reader-breadcrumb");
    expect(readerSource.match(/overview-reader-pane-content/g)).toHaveLength(2);
    expect(workspaceStyles).toContain(".task-subtask-document-checkbox");
    expect(workspaceStyles).toContain("accent-color: #ff5200");
    expect(workspaceStyles).toContain(
      "padding: 32px var(--overview-reader-pane-inline-padding) 48px",
    );
    expect(workspaceStyles).toMatch(
      /\.task-subtasks-sections\s*\{[\s\S]*?margin-top:\s*0;/,
    );
  });

  it("does not classify ordinary lists as task checkboxes", () => {
    expect(
      getMarkdownTaskListPresentation("- ordinary bullet", "static"),
    ).toBeNull();
    expect(
      getMarkdownTaskListPresentation("1. ordered item", "static"),
    ).toBeNull();
  });
});

describe("central Subtasks reducer integration", () => {
  it("toggles the same structured subtask used by the task card", () => {
    const state = desktopPrototypeReducer(freshState(), {
      type: "open-overview-task-subtasks",
      taskId: "luko-world-rules",
    });
    const next = desktopPrototypeReducer(state, {
      type: "toggle-subtask",
      taskId: "luko-world-rules",
      subtaskId: "luko-world-rules-1",
    });

    expect(
      next.tasks.find((task) => task.id === "luko-world-rules")?.subtasks[0]
        ?.done,
    ).toBe(true);
  });

  it("preserves exact Markdown through central updates and reload hydration", () => {
    const markdown =
      "# Heading\n\n**bold**\n\n- bullet\n\n[link](https://example.test)\n\n```\n- [ ] literal\n```";
    let state = desktopPrototypeReducer(freshState(), {
      type: "open-overview-task-subtasks",
      taskId: "luko-world-rules",
    });
    state = desktopPrototypeReducer(state, {
      type: "update-subtask-details-markdown",
      taskId: "luko-world-rules",
      subtaskId: "luko-world-rules-1",
      markdown,
    });
    const hydrated = desktopPrototypeReducer(freshState(), {
      type: "hydrate-domain",
      snapshot: createDesktopDomainSnapshot(state),
    });

    expect(
      hydrated.tasks.find((task) => task.id === "luko-world-rules")?.subtasks[0]
        ?.detailsMarkdown,
    ).toBe(markdown);
  });

  it("creates duplicate titles without changing identity semantics", () => {
    let state = freshState();
    state = desktopPrototypeReducer(state, {
      type: "add-subtask",
      taskId: "luko-world-rules",
      title: "Shared title",
    });
    state = desktopPrototypeReducer(state, {
      type: "add-subtask",
      taskId: "luko-world-rules",
      title: "Shared title",
    });
    const task = state.tasks.find((item) => item.id === "luko-world-rules");

    expect(task?.subtasks.at(-1)?.title).toBe("Shared title");
    expect(new Set(task?.subtasks.map((item) => item.id)).size).toBe(
      task?.subtasks.length,
    );
  });

  it("requires no separate persistence record for details", () => {
    const state = desktopPrototypeReducer(freshState(), {
      type: "update-subtask-details-markdown",
      taskId: "luko-world-rules",
      subtaskId: "luko-world-rules-1",
      markdown: "Embedded details",
    });
    const snapshot = createDesktopDomainSnapshot(state);
    const task = snapshot.tasks.find((item) => item.id === "luko-world-rules");

    expect(task?.subtasks[0]?.detailsMarkdown).toBe("Embedded details");
    expect("documents" in snapshot).toBe(true);
  });
});
