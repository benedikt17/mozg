import type {
  ProjectArea,
  PrototypeNote,
  Section,
} from "@/prototype/mock-data";

export type MobileView = "navigation" | "list" | "editor";

export type PrototypeState = {
  section: Section;
  projectId: string;
  noteId: string;
  area: ProjectArea;
  notes: PrototypeNote[];
  sidebarCollapsed: boolean;
  searchOpen: boolean;
  mobileView: MobileView;
};

export type PrototypeAction =
  | { type: "section"; section: Section }
  | { type: "project"; projectId: string }
  | { type: "area"; area: ProjectArea }
  | { type: "note"; noteId: string }
  | { type: "create-note" }
  | { type: "edit-note"; field: "title" | "body"; value: string }
  | { type: "archive-note"; noteId: string }
  | { type: "restore-note"; noteId: string }
  | { type: "toggle-sidebar" }
  | { type: "search"; open: boolean }
  | { type: "mobile-view"; view: MobileView };

export const initialPrototypeState = (
  notes: PrototypeNote[],
): PrototypeState => ({
  section: "projects",
  projectId: "lukomorye",
  noteId: "roadmap",
  area: "notes",
  notes,
  sidebarCollapsed: false,
  searchOpen: false,
  mobileView: "navigation",
});

export function prototypeReducer(
  state: PrototypeState,
  action: PrototypeAction,
): PrototypeState {
  switch (action.type) {
    case "section":
      return { ...state, section: action.section, mobileView: "list" };
    case "project": {
      const first = state.notes.find(
        (note) => note.projectId === action.projectId && !note.archived,
      );
      return {
        ...state,
        section: "projects",
        projectId: action.projectId,
        noteId: first?.id ?? "",
        area: "notes",
        mobileView: "list",
      };
    }
    case "area":
      return { ...state, area: action.area };
    case "note":
      return {
        ...state,
        noteId: action.noteId,
        section: "projects",
        area: "notes",
        searchOpen: false,
        mobileView: "editor",
      };
    case "create-note": {
      const id = `mock-${state.notes.length + 1}`;
      const note: PrototypeNote = {
        id,
        projectId: state.projectId,
        title: "Без названия",
        body: "Начните писать…",
        edited: "только что",
        archived: false,
      };
      return {
        ...state,
        notes: [note, ...state.notes],
        noteId: id,
        area: "notes",
        mobileView: "editor",
      };
    }
    case "edit-note":
      return {
        ...state,
        notes: state.notes.map((note) =>
          note.id === state.noteId
            ? { ...note, [action.field]: action.value, edited: "только что" }
            : note,
        ),
      };
    case "archive-note":
      return {
        ...state,
        notes: state.notes.map((note) =>
          note.id === action.noteId ? { ...note, archived: true } : note,
        ),
        noteId: "",
        mobileView: "list",
      };
    case "restore-note":
      return {
        ...state,
        notes: state.notes.map((note) =>
          note.id === action.noteId ? { ...note, archived: false } : note,
        ),
      };
    case "toggle-sidebar":
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };
    case "search":
      return { ...state, searchOpen: action.open };
    case "mobile-view":
      return { ...state, mobileView: action.view };
  }
}
