import type { CommandResult } from "@/prototype/desktop-state";

const KNOWLEDGE_SEARCH_HIGHLIGHT_NAME = "knowledge-search-match";
const KNOWLEDGE_SEARCH_HIGHLIGHT_STYLE_ID = "knowledge-search-highlight-style";
const KNOWLEDGE_SEARCH_HIGHLIGHT_WAIT_MS = 3_000;

type SearchMatchSpan = {
  start: number;
  end: number;
};

type TextSegment = {
  node: Text;
  start: number;
  end: number;
};

type HighlightLike = {
  values?: () => IterableIterator<Range>;
};

type HighlightConstructor = new (...ranges: Range[]) => HighlightLike;

type HighlightRegistry = {
  delete: (name: string) => boolean;
  set: (name: string, highlight: HighlightLike) => void;
};

let requestSequence = 0;
let waitObserver: MutationObserver | null = null;
let activeObserver: MutationObserver | null = null;
let waitTimeout: number | null = null;
let activePage: HTMLElement | null = null;

export function getKnowledgeSearchMatchSpans(
  text: string,
  query: string,
): SearchMatchSpan[] {
  const normalizedText = normalizeSearchText(text);
  const normalizedQuery = normalizeSearchText(query.trim());
  if (!normalizedQuery) return [];

  const phraseMatches = findAllMatches(normalizedText, normalizedQuery);
  if (phraseMatches.length > 0) return phraseMatches;

  const terms = Array.from(
    new Set(normalizedQuery.split(/\s+/).filter(Boolean)),
  );
  return mergeSearchMatchSpans(
    terms
      .flatMap((term) => findAllMatches(normalizedText, term))
      .sort(
        (first, second) => first.start - second.start || first.end - second.end,
      ),
  );
}

export function clearKnowledgeSearchHighlight(): void {
  requestSequence += 1;
  stopWaitingForDocument();
  activeObserver?.disconnect();
  activeObserver = null;
  activePage = null;
  getHighlightRegistry()?.delete(KNOWLEDGE_SEARCH_HIGHLIGHT_NAME);
}

export function queueKnowledgeSearchHighlight(
  result: CommandResult,
  query: string,
): void {
  clearKnowledgeSearchHighlight();
  const trimmedQuery = query.trim();
  if (result.kind !== "document" || !trimmedQuery) return;

  const requestId = requestSequence;
  ensureHighlightStyle();

  const tryApply = (): void => {
    if (requestId !== requestSequence) return;
    const page = getActiveKnowledgeDocumentPage(result.id);
    if (!page) return;
    const contentRoot =
      page.querySelector<HTMLElement>(".document-page-inner") ?? page;
    const ranges = getSearchRanges(contentRoot, trimmedQuery);
    if (ranges.length === 0) return;

    stopWaitingForDocument();
    applyHighlight(ranges);
    activePage = page;
    ranges[0]?.startContainer.parentElement?.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
    observeActiveDocument();
  };

  waitObserver = new MutationObserver(tryApply);
  waitObserver.observe(window.document.body, {
    attributes: true,
    attributeFilter: ["class", "data-document-id"],
    childList: true,
    subtree: true,
  });
  waitTimeout = window.setTimeout(
    stopWaitingForDocument,
    KNOWLEDGE_SEARCH_HIGHLIGHT_WAIT_MS,
  );
  window.requestAnimationFrame(tryApply);
}

function normalizeSearchText(value: string): string {
  return value.toLocaleLowerCase("ru");
}

function findAllMatches(text: string, needle: string): SearchMatchSpan[] {
  if (!needle) return [];
  const matches: SearchMatchSpan[] = [];
  let cursor = 0;
  while (cursor <= text.length - needle.length) {
    const start = text.indexOf(needle, cursor);
    if (start < 0) break;
    matches.push({ start, end: start + needle.length });
    cursor = start + Math.max(needle.length, 1);
  }
  return matches;
}

function mergeSearchMatchSpans(spans: SearchMatchSpan[]): SearchMatchSpan[] {
  const merged: SearchMatchSpan[] = [];
  for (const span of spans) {
    const previous = merged.at(-1);
    if (previous && span.start <= previous.end) {
      previous.end = Math.max(previous.end, span.end);
      continue;
    }
    merged.push({ ...span });
  }
  return merged;
}

function getSearchRanges(root: HTMLElement, query: string): Range[] {
  const { text, segments } = collectTextSegments(root);
  return getKnowledgeSearchMatchSpans(text, query)
    .map((span) => createRange(span, segments))
    .filter((range): range is Range => range !== null);
}

function collectTextSegments(root: HTMLElement): {
  text: string;
  segments: TextSegment[];
} {
  const walker = window.document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!(node instanceof Text) || node.data.length === 0) {
        return NodeFilter.FILTER_REJECT;
      }
      const parent = node.parentElement;
      if (
        !parent ||
        parent.closest('script, style, [aria-hidden="true"]') !== null
      ) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const segments: TextSegment[] = [];
  let text = "";
  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    const start = text.length;
    text += textNode.data;
    segments.push({ node: textNode, start, end: text.length });
    node = walker.nextNode();
  }
  return { text, segments };
}

function createRange(
  span: SearchMatchSpan,
  segments: TextSegment[],
): Range | null {
  const startSegment = segments.find(
    (segment) => span.start >= segment.start && span.start < segment.end,
  );
  const endSegment = segments.find(
    (segment) => span.end > segment.start && span.end <= segment.end,
  );
  if (!startSegment || !endSegment) return null;

  const range = window.document.createRange();
  range.setStart(startSegment.node, span.start - startSegment.start);
  range.setEnd(endSegment.node, span.end - endSegment.start);
  return range;
}

function getActiveKnowledgeDocumentPage(
  documentId: string,
): HTMLElement | null {
  return (
    Array.from(
      window.document.querySelectorAll<HTMLElement>(
        ".document-page.is-active-pane",
      ),
    ).find((page) => page.dataset.documentId === documentId) ?? null
  );
}

function applyHighlight(ranges: Range[]): void {
  const registry = getHighlightRegistry();
  const Highlight = getHighlightConstructor();
  if (!registry || !Highlight) return;
  registry.set(KNOWLEDGE_SEARCH_HIGHLIGHT_NAME, new Highlight(...ranges));
}

function getHighlightRegistry(): HighlightRegistry | null {
  const css = window.CSS as typeof CSS & { highlights?: HighlightRegistry };
  return css.highlights ?? null;
}

function getHighlightConstructor(): HighlightConstructor | null {
  const browserWindow = window as Window & { Highlight?: HighlightConstructor };
  return browserWindow.Highlight ?? null;
}

function ensureHighlightStyle(): void {
  if (window.document.getElementById(KNOWLEDGE_SEARCH_HIGHLIGHT_STYLE_ID)) {
    return;
  }
  const style = window.document.createElement("style");
  style.id = KNOWLEDGE_SEARCH_HIGHLIGHT_STYLE_ID;
  style.textContent = `::highlight(${KNOWLEDGE_SEARCH_HIGHLIGHT_NAME}) { background: #ffe38a; color: inherit; }`;
  window.document.head.append(style);
}

function observeActiveDocument(): void {
  activeObserver?.disconnect();
  activeObserver = new MutationObserver(() => {
    if (
      !activePage?.isConnected ||
      !activePage.classList.contains("is-active-pane")
    ) {
      clearKnowledgeSearchHighlight();
    }
  });
  activeObserver.observe(window.document.body, {
    attributes: true,
    attributeFilter: ["class", "data-document-id"],
    childList: true,
    subtree: true,
  });
}

function stopWaitingForDocument(): void {
  waitObserver?.disconnect();
  waitObserver = null;
  if (waitTimeout !== null) {
    window.clearTimeout(waitTimeout);
    waitTimeout = null;
  }
}
