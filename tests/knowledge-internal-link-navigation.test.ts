import { describe, expect, it } from "vitest";
import {
  desktopPrototypeReducer,
  initialDesktopPrototypeState,
  type DesktopPrototypeState,
} from "@/prototype/desktop-state";
import { getKnowledgeInternalLinkNavigationActions } from "@/prototype/knowledge/knowledge-internal-link-navigation";

function freshState(): DesktopPrototypeState {
  return {
    ...initialDesktopPrototypeState,
    documents: initialDesktopPrototypeState.documents.map((document) => ({
      ...document,
      backlinks: [...document.backlinks],
      content: [...document.content],
    })),
    openDocumentIds: [...initialDesktopPrototypeState.openDocumentIds],
    documentHistoryBack: [...initialDesktopPrototypeState.documentHistoryBack],
    documentHistoryForward: [
      ...initialDesktopPrototypeState.documentHistoryForward,
    ],
  };
}

function applyInternalLink(
  state: DesktopPrototypeState,
  sourcePane: "primary" | "secondary",
  targetDocumentId: string,
): DesktopPrototypeState {
  return getKnowledgeInternalLinkNavigationActions({
    sourcePane,
    splitEnabled: state.knowledgeSplitEnabled,
    targetDocumentId,
  }).reduce(desktopPrototypeReducer, state);
}

function projectDocuments(state: DesktopPrototypeState) {
  return state.documents.filter(
    (document) =>
      document.projectId === state.activeProjectId &&
      document.deletedAt === undefined,
  );
}

describe("Knowledge internal link beside navigation", () => {
  it("opens a link from a single article in a new secondary pane", () => {
    const initial = freshState();
    const sourceId = initial.selectedDocumentId;
    const target = projectDocuments(initial).find(
      (document) => document.id !== sourceId,
    );
    if (!sourceId || !target) throw new Error("Expected source and target");

    const next = applyInternalLink(initial, "primary", target.id);

    expect(next.knowledgeSplitEnabled).toBe(true);
    expect(next.selectedDocumentId).toBe(sourceId);
    expect(next.splitViewDocumentId).toBe(target.id);
    expect(next.activeKnowledgePane).toBe("secondary");
  });

  it("keeps the primary source and replaces only the opposite pane", () => {
    const initial = freshState();
    const sourceId = initial.selectedDocumentId;
    const candidates = projectDocuments(initial).filter(
      (document) => document.id !== sourceId,
    );
    const firstTarget = candidates[0];
    const secondTarget = candidates[1];
    if (!sourceId || !firstTarget || !secondTarget) {
      throw new Error("Expected three project documents");
    }

    let split = desktopPrototypeReducer(initial, {
      type: "toggle-knowledge-split-view",
    });
    split = desktopPrototypeReducer(split, {
      type: "open-knowledge-document-in-active-pane",
      documentId: firstTarget.id,
    });
    split = desktopPrototypeReducer(split, {
      type: "activate-knowledge-pane",
      pane: "primary",
    });

    const next = applyInternalLink(split, "primary", secondTarget.id);

    expect(next.selectedDocumentId).toBe(sourceId);
    expect(next.splitViewDocumentId).toBe(secondTarget.id);
    expect(next.activeKnowledgePane).toBe("secondary");
  });

  it("keeps a secondary source and opens its link in the primary pane", () => {
    const initial = freshState();
    const originalPrimaryId = initial.selectedDocumentId;
    const candidates = projectDocuments(initial).filter(
      (document) => document.id !== originalPrimaryId,
    );
    const secondarySource = candidates[0];
    const target = candidates[1];
    if (!originalPrimaryId || !secondarySource || !target) {
      throw new Error("Expected three project documents");
    }

    let split = desktopPrototypeReducer(initial, {
      type: "toggle-knowledge-split-view",
    });
    split = desktopPrototypeReducer(split, {
      type: "open-knowledge-document-in-active-pane",
      documentId: secondarySource.id,
    });

    const next = applyInternalLink(split, "secondary", target.id);

    expect(next.knowledgeSplitEnabled).toBe(true);
    expect(next.selectedDocumentId).toBe(target.id);
    expect(next.splitViewDocumentId).toBe(secondarySource.id);
    expect(next.activeKnowledgePane).toBe("primary");
  });
});
