import { describe, expect, it } from "vitest";
import {
  createKnowledgeAnnotationSelection,
  resolveAppliedKnowledgeAnnotationOffset,
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

describe("Applied neurocomment navigation", () => {
  it("locates the replacement after earlier edits shift its position", () => {
    const original =
      "В первой главе Настенька принимает решение и запускает путешествие.";
    const quote = "Настенька принимает решение";
    const offset = original.indexOf(quote);
    const selection = createKnowledgeAnnotationSelection(
      original,
      quote,
      offset,
      offset + quote.length,
    );
    const replacement = "Настенька решает уйти";
    const changed = `Предисловие. ${original.replace(quote, replacement)}`;

    expect(
      resolveAppliedKnowledgeAnnotationOffset(
        changed,
        annotation({
          ...selection!,
          suggestedText: replacement,
          appliedAt: "2026-09-28T12:00:00.000Z",
        }),
      ),
    ).toEqual({
      startOffset: changed.indexOf(replacement),
      endOffset: changed.indexOf(replacement) + replacement.length,
    });
  });

  it("selects surrounding context when the applied change deleted the quote", () => {
    const original =
      "В первой главе Настенька принимает решение и запускает путешествие.";
    const quote = "Настенька принимает решение";
    const offset = original.indexOf(quote);
    const selection = createKnowledgeAnnotationSelection(
      original,
      quote,
      offset,
      offset + quote.length,
    );
    const changed = original.replace(quote, "");
    const resolved = resolveAppliedKnowledgeAnnotationOffset(
      changed,
      annotation({
        ...selection!,
        suggestedText: "",
        appliedAt: "2026-09-28T12:00:00.000Z",
      }),
    );
    expect(resolved).not.toBeNull();
    expect(changed.slice(resolved!.startOffset, resolved!.endOffset)).toContain(
      "и запускает путешествие",
    );
  });

  it("does not claim a match if the replacement no longer appears", () => {
    expect(
      resolveAppliedKnowledgeAnnotationOffset(
        "Полностью новая версия статьи.",
        annotation({
          suggestedText: "Настенька решает уйти",
          appliedAt: "2026-09-28T12:00:00.000Z",
        }),
      ),
    ).toBeNull();
  });
});
