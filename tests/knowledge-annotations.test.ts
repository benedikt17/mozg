import { describe, expect, it } from "vitest";
import {
  createKnowledgeAnnotationSelection,
  resolveKnowledgeAnnotationOffset,
  type KnowledgeAnnotation,
} from "@/prototype/knowledge/knowledge-annotations";

function annotation(
  overrides: Partial<KnowledgeAnnotation> = {},
): KnowledgeAnnotation {
  return {
    schemaVersion: 1,
    id: "annotation-1",
    workspaceId: "workspace-1",
    documentId: "doc-1",
    createdBy: "user-1",
    selectedText: "Настенька принимает решение",
    startOffset: 16,
    endOffset: 44,
    prefix: "В первой главе ",
    suffix: " и запускает путешествие.",
    comment: "Здесь решение пока не мотивировано.",
    createdAt: "2026-08-13T12:00:00.000Z",
    updatedAt: "2026-08-13T12:00:00.000Z",
    resolvedAt: null,
    ...overrides,
  };
}

describe("Knowledge annotation anchors", () => {
  it("reattaches after text is inserted before the quoted fragment", () => {
    const original =
      "В первой главе Настенька принимает решение и запускает путешествие.";
    const quote = "Настенька принимает решение";
    const startOffset = original.indexOf(quote);
    const selection = createKnowledgeAnnotationSelection(
      original,
      quote,
      startOffset,
      startOffset + quote.length,
    );
    expect(selection).not.toBeNull();

    const changed = `После разговора. ${original}`;
    expect(
      resolveKnowledgeAnnotationOffset(changed, {
        ...annotation(),
        ...selection!,
      }),
    ).toEqual({
      startOffset: changed.indexOf(quote),
      endOffset: changed.indexOf(quote) + quote.length,
    });
  });

  it("returns null instead of guessing when the quote was removed", () => {
    expect(
      resolveKnowledgeAnnotationOffset(
        "Фрагмент полностью переписан.",
        annotation(),
      ),
    ).toBeNull();
  });
});
