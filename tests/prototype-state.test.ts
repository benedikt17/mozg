import { describe, expect, it } from "vitest";
import { initialNotes } from "@/prototype/mock-data";
import {
  initialPrototypeState,
  prototypeReducer,
} from "@/prototype/prototype-state";

describe("clickable prototype state", () => {
  it("switches projects, areas, and mobile views", () => {
    let state = initialPrototypeState(initialNotes);
    state = prototypeReducer(state, { type: "project", projectId: "product" });
    expect(state).toMatchObject({
      projectId: "product",
      noteId: "launch",
      mobileView: "list",
    });

    state = prototypeReducer(state, { type: "area", area: "tasks" });
    expect(state.area).toBe("tasks");
  });

  it("creates and edits a temporary note without persistence", () => {
    let state = prototypeReducer(initialPrototypeState(initialNotes), {
      type: "create-note",
    });
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
    let state = prototypeReducer(initialPrototypeState(initialNotes), {
      type: "archive-note",
      noteId: "roadmap",
    });
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
});
