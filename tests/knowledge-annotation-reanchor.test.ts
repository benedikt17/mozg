import { describe, expect, it } from "vitest";
import { reanchorKnowledgeAnnotation } from "@/prototype/knowledge/knowledge-annotation-reanchor";
import type {
  KnowledgeAnnotation,
  KnowledgeAnnotationSelection,
} from "@/prototype/knowledge/knowledge-annotations";

const annotation: KnowledgeAnnotation = {
  schemaVersion: 1,
  id: "annotation-1",
  workspaceId: "workspace-1",
  documentId: "doc-1",
  createdBy: "user-1",
  selectedText: "Старый фрагмент",
  startOffset: 10,
  endOffset: 25,
  prefix: "старый prefix",
  suffix: "старый suffix",
  comment: "Комментарий остаётся тем же.",
  createdAt: "2026-08-16T12:00:00.000Z",
  updatedAt: "2026-08-16T12:00:00.000Z",
  resolvedAt: null,
};

const selection: KnowledgeAnnotationSelection = {
  selectedText: "Новый фрагмент",
  startOffset: 42,
  endOffset: 56,
  prefix: "новый prefix",
  suffix: "новый suffix",
};

describe("Knowledge annotation reanchor", () => {
  it("replaces only the anchor and update timestamp", () => {
    const updated = reanchorKnowledgeAnnotation(
      annotation,
      selection,
      "2026-08-16T13:00:00.000Z",
    );

    expect(updated).toEqual({
      ...annotation,
      ...selection,
      updatedAt: "2026-08-16T13:00:00.000Z",
    });
    expect(updated.id).toBe(annotation.id);
    expect(updated.comment).toBe(annotation.comment);
    expect(updated.createdAt).toBe(annotation.createdAt);
    expect(updated.resolvedAt).toBeNull();
  });
});
