import { describe, expect, it } from "vitest";
import { initialNotes, initialProjects } from "@/prototype/mock-data";
import {
  initialPrototypeState,
  prototypeReducer,
  visibleSearchResults,
} from "@/prototype/prototype-state";

describe("clickable prototype state", () => {
  it("switches projects, areas, and mobile views", () => {
    let state = initialPrototypeState(initialNotes, initialProjects);
    state = prototypeReducer(state, { type: "project", projectId: "product" });
    expect(state).toMatchObject({
      projectId: "product",
      noteId: "launch",
      mobileView: "list",
    });

    state = prototypeReducer(state, { type: "area", area: "tasks" });
    expect(state).toMatchObject({ area: "tasks", mobileView: "editor" });

    state = prototypeReducer(state, { type: "mobile-view", view: "list" });
    state = prototypeReducer(state, { type: "area", area: "canvas" });
    expect(state).toMatchObject({ area: "canvas", mobileView: "editor" });

    state = prototypeReducer(state, { type: "mobile-view", view: "list" });
    expect(state.mobileView).toBe("list");
  });

  it("creates and edits a temporary note without persistence", () => {
    let state = prototypeReducer(
      initialPrototypeState(initialNotes, initialProjects),
      {
        type: "create-note",
      },
    );
    expect(state.notes[0]).toMatchObject({
      title: "Без названия",
      projectId: "lukomorye",
    });
    expect(state.mobileView).toBe("editor");

    state = prototypeReducer(state, {
      type: "edit-note",
      field: "title",
      value: "Новая идея",
    });
    expect(state.notes.find((note) => note.id === state.noteId)?.title).toBe(
      "Новая идея",
    );
  });

  it("archives and restores a mock note", () => {
    let state = prototypeReducer(
      initialPrototypeState(initialNotes, initialProjects),
      {
        type: "archive-note",
        noteId: "roadmap",
      },
    );
    expect(state.notes.find((note) => note.id === "roadmap")?.archived).toBe(
      true,
    );

    state = prototypeReducer(state, {
      type: "restore-note",
      noteId: "roadmap",
    });
    expect(state.notes.find((note) => note.id === "roadmap")?.archived).toBe(
      false,
    );
  });

  it("opens a cross-project note with its real project and editor context", () => {
    let state = initialPrototypeState(initialNotes, initialProjects);
    state = prototypeReducer(state, { type: "search", open: true });
    state = prototypeReducer(state, { type: "open-note", noteId: "launch" });

    expect(state).toMatchObject({
      projectId: "product",
      noteId: "launch",
      section: "projects",
      area: "notes",
      searchOpen: false,
      mobileView: "editor",
    });
  });

  it("opens a project result and closes the command palette", () => {
    let state = prototypeReducer(
      initialPrototypeState(initialNotes, initialProjects),
      { type: "search", open: true },
    );
    state = prototypeReducer(state, { type: "project", projectId: "product" });
    expect(state).toMatchObject({ projectId: "product", searchOpen: false });
  });

  it("limits keyboard-selectable search results to visible rows", () => {
    expect(
      visibleSearchResults(Array.from({ length: 12 }, (_, id) => id)),
    ).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(visibleSearchResults([])).toEqual([]);
  });

  it("restores an archived mock project", () => {
    let state = initialPrototypeState(initialNotes, initialProjects);
    expect(
      state.projects.find((project) => project.id === "old-site")?.archived,
    ).toBe(true);
    state = prototypeReducer(state, {
      type: "restore-project",
      projectId: "old-site",
    });
    expect(
      state.projects.find((project) => project.id === "old-site")?.archived,
    ).toBe(false);
  });

  it("opens a note from the project list in the mobile editor", () => {
    const state = prototypeReducer(
      initialPrototypeState(initialNotes, initialProjects),
      { type: "open-note", noteId: "meeting" },
    );
    expect(state).toMatchObject({ noteId: "meeting", mobileView: "editor" });
  });
});
