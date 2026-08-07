import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  desktopPrototypeReducer,
  getDocumentById,
  initialDesktopPrototypeState,
} from "@/prototype/desktop-state";
import {
  getDocumentTitle,
  updateKnowledgeDocumentMarkdown,
} from "@/prototype/state/knowledge-state";
import {
  KnowledgeContentHistory,
  type KnowledgeContentHistoryOrigin,
} from "@/prototype/knowledge/knowledge-content-history";
import { KnowledgeStructuralHistory } from "@/prototype/knowledge/knowledge-structural-history";
import { activateKnowledgeContentScope } from "@/prototype/knowledge/knowledge-content-history-runtime";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function commitContent(
  history: KnowledgeContentHistory,
  documentId: string,
  markdown: string,
  origin: Exclude<KnowledgeContentHistoryOrigin, "baseline">,
): void {
  history.commit({ documentId, markdown, origin });
}

describe("Knowledge edit mode regression", () => {
  it("keeps textarea mounting independent from scope updates", () => {
    const editor = source("src/prototype/knowledge/markdown-source-editor.tsx");
    const refStart = editor.indexOf("const mountTextarea");
    const refEnd = editor.indexOf("useLayoutEffect", refStart);
    const refCallback = editor.slice(refStart, refEnd);

    expect(refCallback).not.toContain("activateContentScope");
    expect(refCallback).not.toContain("contentHistory");
    expect(refCallback).toContain("resizeTextarea(textarea)");
    expect(editor).toContain(
      "onFocus={() => contentHistory.activateContentScope(document.id)}",
    );
  });

  it("does not let scope-only rerenders restore stale history selection", () => {
    const editor = source("src/prototype/knowledge/markdown-source-editor.tsx");
    const effectStart = editor.indexOf("useLayoutEffect");
    const effectEnd = editor.indexOf("const updateMarkdown", effectStart);
    const effect = editor.slice(effectStart, effectEnd);

    expect(editor).toContain(
      "const { getSelection, version } = contentHistory;",
    );
    expect(effect).toContain("const selection = getSelection(document.id)");
    expect(effect).toContain("getSelection,");
    expect(effect).toContain("version,");
    expect(effect).not.toContain("[contentHistory, document.id, markdown");
  });

  it("makes repeated activation of the same content scope a no-op", () => {
    const firstScope = activateKnowledgeContentScope(null, "doc-a");
    const repeatedScope = activateKnowledgeContentScope(firstScope, "doc-a");

    expect(repeatedScope).toBe(firstScope);
    expect(activateKnowledgeContentScope(firstScope, "doc-b")).toEqual({
      documentId: "doc-b",
      kind: "content",
    });
    expect(
      activateKnowledgeContentScope({ kind: "structure" }, "doc-a"),
    ).toEqual({
      documentId: "doc-a",
      kind: "content",
    });
  });

  it("routes both toolbar button sets through the single history provider", () => {
    const editor = source("src/prototype/knowledge/markdown-source-editor.tsx");
    const workspace = source("src/prototype/knowledge/knowledge-workspace.tsx");

    expect(editor).toContain("contentHistory.undo(document.id)");
    expect(editor).toContain("contentHistory.redo(document.id)");
    expect(workspace).toContain(
      "contentHistory.undoActive(activeDocument?.id)",
    );
    expect(workspace).toContain(
      "contentHistory.redoActive(activeDocument?.id)",
    );
  });

  it("keeps content and structural undo/redo behavior intact", () => {
    const contentHistory = new KnowledgeContentHistory();
    contentHistory.ensureDocument("doc-a", "# Old\n\nBody");
    commitContent(contentHistory, "doc-a", "# New\n\nBody", "toolbar");
    expect(contentHistory.undo("doc-a")?.markdown).toBe("# Old\n\nBody");
    expect(contentHistory.redo("doc-a")?.markdown).toBe("# New\n\nBody");

    const structuralHistory = new KnowledgeStructuralHistory();
    structuralHistory.commit({
      document: initialDesktopPrototypeState.documents[0]!,
      id: "create-doc-a",
      kind: "create-document",
      label: "Создать документ",
      previousSelectedDocumentId: null,
      wasOpened: true,
    });
    expect(structuralHistory.canUndo()).toBe(true);
    expect(structuralHistory.undo()?.kind).toBe("create-document");
    expect(structuralHistory.canRedo()).toBe(true);
    expect(structuralHistory.redo()?.kind).toBe("create-document");
  });

  it("keeps H1 title derivation aligned with content undo/redo", () => {
    const originalState = initialDesktopPrototypeState;
    const documentId = originalState.documents[0]!.id;
    const originalDocument = getDocumentById(originalState, documentId)!;
    const originalMarkdown = originalDocument.content.join("\n");
    const updatedMarkdown = `# Rewritten title\n\n${originalMarkdown}`;
    const history = new KnowledgeContentHistory();

    history.ensureDocument(documentId, originalMarkdown);
    commitContent(history, documentId, updatedMarkdown, "toolbar");

    const changedState = desktopPrototypeReducer(originalState, {
      type: "update-knowledge-document-markdown",
      documentId,
      markdown: updatedMarkdown,
    });
    expect(getDocumentTitle(getDocumentById(changedState, documentId)!)).toBe(
      "Rewritten title",
    );

    const undoneMarkdown = history.undo(documentId)!.markdown;
    const undoneState = updateKnowledgeDocumentMarkdown(
      changedState,
      documentId,
      undoneMarkdown,
    );
    expect(getDocumentTitle(getDocumentById(undoneState, documentId)!)).toBe(
      getDocumentTitle(originalDocument),
    );

    const redoneMarkdown = history.redo(documentId)!.markdown;
    const redoneState = updateKnowledgeDocumentMarkdown(
      undoneState,
      documentId,
      redoneMarkdown,
    );
    expect(getDocumentTitle(getDocumentById(redoneState, documentId)!)).toBe(
      "Rewritten title",
    );
  });
});
