import { describe, expect, it } from "vitest";
import {
  KnowledgeStructuralHistory,
  KNOWLEDGE_STRUCTURAL_HISTORY_LIMIT,
  type CreateFolderEntry,
} from "@/prototype/knowledge/knowledge-structural-history";
import {
  createKnowledgeStructuralHistoryEntry,
  getActiveDocumentById,
  getActiveProjectDocuments,
  getDocumentById,
  getDocumentFolderPath,
} from "@/prototype/state/knowledge-state";
import { evaluateKnowledgeStructuralTransition } from "@/prototype/knowledge/knowledge-content-history-runtime";
import {
  desktopPrototypeReducer,
  initialDesktopPrototypeState,
} from "@/prototype/desktop-state";
import { expectPersistentStateValid } from "./helpers/persistent-state-invariant";
import type {
  DesktopPrototypeAction,
  DesktopPrototypeState,
} from "@/prototype/state/types";

function freshState(): DesktopPrototypeState {
  return structuredClone(initialDesktopPrototypeState);
}

function perform(
  state: DesktopPrototypeState,
  history: KnowledgeStructuralHistory,
  action: DesktopPrototypeAction,
): DesktopPrototypeState {
  const next = desktopPrototypeReducer(state, action);
  if (action.type === "permanently-delete-knowledge-document") {
    if (next !== state) history.commitDocumentBarrier(action.documentId);
  } else {
    const entry = createKnowledgeStructuralHistoryEntry(state, next, action);
    if (entry) history.commit(entry);
  }
  return next;
}

function undo(
  state: DesktopPrototypeState,
  history: KnowledgeStructuralHistory,
): DesktopPrototypeState {
  const entry = history.undo();
  if (!entry) return state;
  return desktopPrototypeReducer(state, {
    direction: "undo",
    entry,
    type: "apply-knowledge-structural-history",
  });
}

function redo(
  state: DesktopPrototypeState,
  history: KnowledgeStructuralHistory,
): DesktopPrototypeState {
  const entry = history.redo();
  if (!entry) return state;
  return desktopPrototypeReducer(state, {
    direction: "redo",
    entry,
    type: "apply-knowledge-structural-history",
  });
}

describe("Knowledge structural history", () => {
  it("evaluates one structural transition once before committing it", () => {
    const initial = freshState();
    let evaluations = 0;
    const action: Extract<
      DesktopPrototypeAction,
      { type: "create-knowledge-folder" }
    > = { type: "create-knowledge-folder" };
    const transition = evaluateKnowledgeStructuralTransition(
      initial,
      action,
      (state, nextAction) => {
        evaluations += 1;
        return desktopPrototypeReducer(state, nextAction);
      },
    );

    expect(evaluations).toBe(1);
    expect(transition.entry?.kind).toBe("create-folder");
    expect(
      desktopPrototypeReducer(initial, {
        nextState: transition.nextState,
        type: "commit-knowledge-structural-transition",
      }),
    ).toBe(transition.nextState);
  });

  it("creates a document, removes it without Trash on undo, and restores its stable id on redo", () => {
    const history = new KnowledgeStructuralHistory();
    const initial = freshState();
    const created = perform(initial, history, {
      type: "create-knowledge-document",
    });
    const documentId = created.selectedDocumentId;
    expect(documentId).toBeTruthy();

    const undone = undo(created, history);
    expect(getDocumentById(undone, documentId)).toBeUndefined();
    expect(undone.openDocumentIds).not.toContain(documentId);

    const redone = redo(undone, history);
    expect(getDocumentById(redone, documentId)?.id).toBe(documentId);
    expect(getDocumentById(redone, documentId)?.content).toEqual([]);
  });

  it("creates and renames a folder while preserving nested document Markdown", () => {
    const history = new KnowledgeStructuralHistory();
    const initial = {
      ...freshState(),
      selectedKnowledgeFolderPath: ["Мир"],
    };
    const created = perform(initial, history, {
      type: "create-knowledge-folder",
    });
    const path = created.selectedKnowledgeFolderPath ?? [];
    const folderId = `${created.activeProjectId}:${path.join("/")}`;
    const renamed = perform(created, history, {
      folderId,
      title: "Черновики",
      type: "rename-knowledge-folder",
    });
    const movedPath = renamed.selectedKnowledgeFolderPath;
    expect(movedPath?.at(-1)).toBe("Черновики");

    const undoRename = undo(renamed, history);
    expect(undoRename.selectedKnowledgeFolderPath).toEqual(path);
    const redoRename = redo(undoRename, history);
    expect(redoRename.selectedKnowledgeFolderPath).toEqual(movedPath);
  });

  it("moves a document back to its exact parent and order without changing Markdown", () => {
    const history = new KnowledgeStructuralHistory();
    const initial = freshState();
    const original = getDocumentById(initial, "doc-l-nastenka");
    if (!original) throw new Error("Expected source document");
    const moved = perform(initial, history, {
      documentId: original.id,
      position: "after",
      targetDocumentId: "doc-l-magic",
      targetFolderPath: ["Мир"],
      type: "move-knowledge-document",
    });
    const undone = undo(moved, history);
    expect(
      getDocumentFolderPath(getDocumentById(undone, original.id)!),
    ).toEqual(getDocumentFolderPath(original));
    expect(getDocumentById(undone, original.id)?.order).toBe(original.order);
    expect(getDocumentById(undone, original.id)?.content).toEqual(
      original.content,
    );
    const redone = redo(undone, history);
    expect(
      getDocumentFolderPath(getDocumentById(redone, original.id)!),
    ).toEqual(["Мир"]);
  });

  it("restores a deleted folder subtree and a soft-deleted document", () => {
    const history = new KnowledgeStructuralHistory();
    const initial = freshState();
    const originalMarkdown = getDocumentById(initial, "doc-l-magic")?.content;
    const folderPath = ["Мир"];
    const deletedFolder = perform(initial, history, {
      folderId: `${initial.activeProjectId}:${folderPath.join("/")}`,
      type: "delete-knowledge-folder",
    });
    const restoredFolder = undo(deletedFolder, history);
    expect(
      restoredFolder.documents.some(
        (document) =>
          document.id === "doc-l-magic" &&
          getDocumentFolderPath(document).join("/") === "Мир",
      ),
    ).toBe(true);
    expect(getDocumentById(restoredFolder, "doc-l-magic")?.content).toEqual(
      originalMarkdown,
    );
    expect(
      redo(restoredFolder, history).documents.find(
        (document) => document.id === "doc-l-magic",
      )?.folderPath,
    ).toEqual([]);

    const deletedDocument = perform(restoredFolder, history, {
      documentId: "doc-l-routes",
      type: "soft-delete-knowledge-document",
      deletedAt: "2026-08-08T00:00:00.000Z",
    });
    expect(
      getDocumentById(deletedDocument, "doc-l-routes")?.deletedAt,
    ).toBeTypeOf("string");
    const restoredDocument = undo(deletedDocument, history);
    expect(
      getDocumentById(restoredDocument, "doc-l-routes")?.deletedAt,
    ).toBeUndefined();
    expect(
      redo(restoredDocument, history).documents.find(
        (document) => document.id === "doc-l-routes",
      )?.deletedAt,
    ).toBeTypeOf("string");
  });

  it("undoes and redoes Restore from Trash and clears structural redo after a new action", () => {
    const history = new KnowledgeStructuralHistory();
    const initial = freshState();
    const trashed = perform(initial, history, {
      documentId: "doc-l-routes",
      type: "soft-delete-knowledge-document",
      deletedAt: "2026-08-08T00:00:00.000Z",
    });
    const restored = perform(trashed, history, {
      documentId: "doc-l-routes",
      type: "restore-knowledge-document",
    });
    const undoRestore = undo(restored, history);
    expect(getDocumentById(undoRestore, "doc-l-routes")?.deletedAt).toBeTypeOf(
      "string",
    );
    const redoRestore = redo(undoRestore, history);
    expect(
      getDocumentById(redoRestore, "doc-l-routes")?.deletedAt,
    ).toBeUndefined();

    const undoAgain = undo(redoRestore, history);
    perform(undoAgain, history, { type: "create-knowledge-folder" });
    expect(history.canRedo()).toBe(false);
  });

  it("keeps permanent delete as a barrier without resurrecting its document", () => {
    const history = new KnowledgeStructuralHistory();
    const initial = freshState();
    const withSafeHistory = perform(initial, history, {
      type: "create-knowledge-folder",
    });
    const trashed = perform(withSafeHistory, history, {
      deletedAt: "2026-08-08T00:00:00.000Z",
      documentId: "doc-l-nastenka",
      type: "soft-delete-knowledge-document",
    });
    const permanentlyDeleted = perform(trashed, history, {
      documentId: "doc-l-nastenka",
      type: "permanently-delete-knowledge-document",
    });

    expect(
      getDocumentById(permanentlyDeleted, "doc-l-nastenka"),
    ).toBeUndefined();
    expect(
      history
        .getEntries()
        .some(
          (entry) =>
            (entry.kind === "create-document" &&
              entry.document.id === "doc-l-nastenka") ||
            (entry.kind === "move-document" &&
              entry.documentId === "doc-l-nastenka") ||
            ((entry.kind === "soft-delete-document" ||
              entry.kind === "restore-document") &&
              entry.documentId === "doc-l-nastenka") ||
            (entry.kind === "delete-folder" &&
              entry.documents.some(
                (document) => document.id === "doc-l-nastenka",
              )),
        ),
    ).toBe(false);

    const undone = undo(permanentlyDeleted, history);
    expect(getDocumentById(undone, "doc-l-nastenka")).toBeUndefined();
    expectPersistentStateValid(undone);
  });

  it("does not add a structural history entry for an effective no-op rename", () => {
    const history = new KnowledgeStructuralHistory();
    const initial = {
      ...freshState(),
      selectedKnowledgeFolderPath: ["Персонажи"],
    };
    const created = perform(initial, history, {
      type: "create-knowledge-folder",
    });
    const folderId = created.activeProjectId + ":Персонажи/Новая папка";
    const entryCount = history.getEntries().length;
    const canUndo = history.canUndo();
    const renamed = perform(created, history, {
      folderId,
      title: "Новая папка",
      type: "rename-knowledge-folder",
    });

    expect(renamed.editingKnowledgeFolderId).toBeNull();
    expect(history.getEntries()).toHaveLength(entryCount);
    expect(history.canUndo()).toBe(canUndo);
  });

  it("keeps trashed linked documents persisted but excludes them from active projections", () => {
    const initial = freshState();
    const trashed = desktopPrototypeReducer(initial, {
      deletedAt: "2026-08-08T00:00:00.000Z",
      documentId: "doc-l-nastenka",
      type: "soft-delete-knowledge-document",
    });

    expect(getDocumentById(trashed, "doc-l-nastenka")).toBeDefined();
    expect(getActiveDocumentById(trashed, "doc-l-nastenka")).toBeUndefined();
    expect(
      getActiveProjectDocuments(trashed).some(
        (document) => document.id === "doc-l-nastenka",
      ),
    ).toBe(false);
    expectPersistentStateValid(trashed);

    const restored = desktopPrototypeReducer(trashed, {
      documentId: "doc-l-nastenka",
      type: "restore-knowledge-document",
    });
    expect(getActiveDocumentById(restored, "doc-l-nastenka")).toBeDefined();
    expectPersistentStateValid(restored);
  });

  it("caps entries at 100 and undo/redo do not create entries", () => {
    const history = new KnowledgeStructuralHistory();
    const entry = (index: number): CreateFolderEntry => ({
      folder: {
        id: `folder-${index}`,
        path: [`Folder ${index}`],
        projectId: "p",
      },
      id: `entry-${index}`,
      kind: "create-folder",
      label: "Создание папки",
    });
    for (let index = 0; index < 120; index += 1) history.commit(entry(index));
    expect(history.getEntries()).toHaveLength(
      KNOWLEDGE_STRUCTURAL_HISTORY_LIMIT,
    );
    const length = history.getEntries().length;
    history.undo();
    history.redo();
    expect(history.getEntries()).toHaveLength(length);
    history.reset();
    expect(history.canUndo()).toBe(false);
  });
});
