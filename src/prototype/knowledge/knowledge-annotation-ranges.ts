import {
  resolveAppliedKnowledgeAnnotationOffset,
  resolveKnowledgeAnnotationOffset,
  type KnowledgeAnnotation,
} from "./knowledge-annotations";

export const REVEAL_MARKDOWN_RANGE = "mozg:reveal-markdown-range";

/** Reading text is a projection of Markdown, not the source-offset coordinate system. */
export function sourceRangeInRenderedText(
  source: string,
  rendered: string,
  start: number,
  end: number,
): { startOffset: number; endOffset: number } {
  const literalAt = source.indexOf(rendered);
  if (literalAt >= 0) {
    return {
      startOffset: Math.max(0, Math.min(rendered.length, start - literalAt)),
      endOffset: Math.max(0, Math.min(rendered.length, end - literalAt)),
    };
  }
  // Escapes/entities can change the length of an mdast text leaf. Select that
  // leaf rather than guessing a location elsewhere in the article.
  return { startOffset: 0, endOffset: rendered.length };
}

export function resolveAgentSourceRange(
  markdown: string,
  annotation: KnowledgeAnnotation,
  applied = false,
): { startOffset: number; endOffset: number } | null {
  return applied
    ? resolveAppliedKnowledgeAnnotationOffset(markdown, annotation)
    : resolveKnowledgeAnnotationOffset(markdown, annotation);
}

export function agentRangeInReadingRoot(
  root: HTMLElement,
  markdown: string,
  annotation: KnowledgeAnnotation,
  applied = false,
): Range | null {
  const sourceRange = resolveAgentSourceRange(markdown, annotation, applied);
  if (!sourceRange) return null;
  const leaves = Array.from(
    root.querySelectorAll<HTMLElement>(
      "[data-markdown-start][data-markdown-end]",
    ),
  ).filter((element) => {
    const start = Number(element.dataset.markdownStart);
    const end = Number(element.dataset.markdownEnd);
    return start < sourceRange.endOffset && end > sourceRange.startOffset;
  });
  const first = leaves[0];
  const last = leaves.at(-1);
  if (!first || !last) return null;

  const boundary = (
    element: HTMLElement,
    end: boolean,
  ): [Text, number] | null => {
    const walker = root.ownerDocument.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
    );
    const start = Number(element.dataset.markdownStart);
    const finish = Number(element.dataset.markdownEnd);
    const offsets = sourceRangeInRenderedText(
      markdown.slice(start, finish),
      element.textContent ?? "",
      sourceRange.startOffset - start,
      sourceRange.endOffset - start,
    );
    const target = end ? offsets.endOffset : offsets.startOffset;
    let consumed = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (target <= consumed + node.data.length)
        return [node, target - consumed];
      consumed += node.data.length;
    }
    return null;
  };
  const start = boundary(first, false);
  const end = boundary(last, true);
  if (!start || !end) return null;
  const range = root.ownerDocument.createRange();
  range.setStart(...start);
  range.setEnd(...end);
  return range.collapsed ? null : range;
}
