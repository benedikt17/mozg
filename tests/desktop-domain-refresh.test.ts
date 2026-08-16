import { describe, expect, it } from "vitest";
import { initialDesktopPrototypeState } from "@/prototype/desktop-state";
import { createDesktopDomainSnapshot } from "@/prototype/persistence/domain-snapshot";
import { desktopRuntimeReducer } from "@/prototype/state/desktop-runtime-reducer";
import type { DesktopPrototypeState } from "@/prototype/state/types";

function freshState(): DesktopPrototypeState {
  return structuredClone(initialDesktopPrototypeState);
}

function knowledgeSessionState(): DesktopPrototypeState {
  return {
    ...freshState(),
    activeSection: "knowledge",
    selectedDocumentId: "doc-l-magic",
    selectedDocumentFolder: "Мир",
    selectedKnowledgeFolderPath: ["Мир"],
    selectedKnowledgePath: {
      kind: "document",
      path: ["Мир"],
      documentId: "doc-l-magic",
    },
    expandedFolderIds: ["lukomorie:Мир"],
    knowledgeSearchQuery: "магия",
    openDocumentIds: ["doc-l-magic", "doc-l-scenes"],
    documentHistoryBack: ["doc-l-nastenka"],
    documentHistoryForward: ["doc-l-production"],
    knowledgeContextMode: "outgoing",
    knowledgeSplitEnabled: true,
    splitViewDocumentId: "doc-l-scenes",
    activeKnowledgePane: "secondary",
    editingKnowledgeDocumentId: null,
  };
}

describe("desktop live domain refresh", () => {
  it("adopts fresh persisted data while preserving valid Knowledge navigation", () => {
    const state = knowledgeSessionState();
    const snapshot = createDesktopDomainSnapshot(state);
    const magic = snapshot.documents.find((document) => document.id === "doc-l-magic");
    const task = snapshot.tasks[0];
    expect(magic).toBeDefined();
    expect(task).toBeDefined();
    magic!.content = ["# Магия", "Свежий текст с другого устройства"];
    task!.title = "Свежая задача с другого устройства";

    const next = desktopRuntimeReducer(state, {
      type: "refresh-domain",
      snapshot,
    });

    expect(
      next.documents.find((document) => document.id === "doc-l-magic")?.content,
    ).toEqual(["# Магия", "Свежий текст с другого устройства"]);
    expect(next.tasks[0]?.title).toBe("Свежая задача с другого устройства");
    expect(next).toMatchObject({
      activeSection: "knowledge",
      selectedDocumentId: "doc-l-magic",
      selectedKnowledgeFolderPath: ["Мир"],
      knowledgeSearchQuery: "магия",
      openDocumentIds: ["doc-l-magic", "doc-l-scenes"],
      knowledgeContextMode: "outgoing",
      knowledgeSplitEnabled: true,
      splitViewDocumentId: "doc-l-scenes",
      activeKnowledgePane: "secondary",
      editingKnowledgeDocumentId: null,
    });
    expect(next.documentHistoryBack).toEqual(["doc-l-nastenka"]);
    expect(next.documentHistoryForward).toEqual(["doc-l-production"]);
  });

  it("drops stale Knowledge session references when the active document disappeared", () => {
    const state = knowledgeSessionState();
    const snapshot = createDesktopDomainSnapshot(state);
    snapshot.documents = snapshot.documents.filter(
      (document) => document.id !== "doc-l-magic",
    );

    const next = desktopRuntimeReducer(state, {
      type: "refresh-domain",
      snapshot,
    });

    expect(next.selectedDocumentId).toBeNull();
    expect(next.openDocumentIds).toEqual([]);
    expect(next.knowledgeSplitEnabled).toBe(false);
    expect(next.splitViewDocumentId).toBeNull();
    expect(next.editingKnowledgeDocumentId).toBeNull();
  });

  it("closes split view if only the secondary document disappeared", () => {
    const state = knowledgeSessionState();
    const snapshot = createDesktopDomainSnapshot(state);
    snapshot.documents = snapshot.documents.filter(
      (document) => document.id !== "doc-l-scenes",
    );

    const next = desktopRuntimeReducer(state, {
      type: "refresh-domain",
      snapshot,
    });

    expect(next.selectedDocumentId).toBe("doc-l-magic");
    expect(next.knowledgeSplitEnabled).toBe(false);
    expect(next.splitViewDocumentId).toBeNull();
    expect(next.activeKnowledgePane).toBe("primary");
    expect(next.openDocumentIds).toEqual(["doc-l-magic"]);
  });
});
