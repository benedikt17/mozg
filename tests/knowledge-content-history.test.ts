import { describe, expect, it } from "vitest";
import {
  getKnowledgeHistoryShortcutAction,
  KnowledgeContentHistory,
  KNOWLEDGE_CONTENT_HISTORY_LIMIT,
} from "@/prototype/knowledge/knowledge-content-history";
import { applyMarkdownToolbarFormat } from "@/prototype/knowledge/markdown-source-selection";

function commit(
  history: KnowledgeContentHistory,
  markdown: string,
  options:
    | Parameters<KnowledgeContentHistory["commit"]>[0]["origin"]
    | {
        origin: Parameters<KnowledgeContentHistory["commit"]>[0]["origin"];
        selectionStart?: number;
        selectionEnd?: number;
        timestamp?: number;
        coalesce?: boolean;
      },
): void {
  const normalized =
    typeof options === "string" ? { origin: options } : options;
  history.commit({
    documentId: "doc-a",
    markdown,
    ...normalized,
  });
}

describe("KnowledgeContentHistory", () => {
  it("keeps a baseline and supports undo, redo, selection restore, and redo clearing", () => {
    const history = new KnowledgeContentHistory();
    history.ensureDocument("doc-a", "base");

    commit(history, "first", {
      origin: "toolbar",
      selectionEnd: 5,
      selectionStart: 5,
    });
    expect(history.canUndo("doc-a")).toBe(true);
    expect(history.undo("doc-a")).toMatchObject({
      markdown: "base",
      selectionStart: null,
    });
    expect(history.canRedo("doc-a")).toBe(true);
    expect(history.redo("doc-a")).toMatchObject({
      markdown: "first",
      selectionEnd: 5,
      selectionStart: 5,
    });

    history.undo("doc-a");
    commit(history, "replacement", "replace");
    expect(history.canRedo("doc-a")).toBe(false);
  });

  it("coalesces sequential typing within 800ms and breaks on pause or nonlocal selection", () => {
    const history = new KnowledgeContentHistory();
    history.ensureDocument("doc-a", "");

    commit(history, "a", {
      origin: "typing",
      selectionEnd: 1,
      selectionStart: 1,
      timestamp: 0,
    });
    commit(history, "ab", {
      origin: "typing",
      selectionEnd: 2,
      selectionStart: 2,
      timestamp: 800,
    });
    expect(history.getEntries("doc-a")).toHaveLength(2);

    commit(history, "abc", {
      origin: "typing",
      selectionEnd: 3,
      selectionStart: 3,
      timestamp: 1_601,
    });
    commit(history, "abcd", {
      origin: "typing",
      selectionEnd: 1,
      selectionStart: 1,
      timestamp: 1_700,
    });
    expect(history.getEntries("doc-a")).toHaveLength(4);
  });

  it("keeps paste, cut, toolbar, load, and checklist changes distinct", () => {
    const history = new KnowledgeContentHistory();
    history.ensureDocument("doc-a", "");
    const origins = ["paste", "cut", "toolbar", "load", "checklist"] as const;
    origins.forEach((origin, index) =>
      commit(history, String(index), { origin, timestamp: index }),
    );
    expect(history.getEntries("doc-a")).toHaveLength(origins.length + 1);
    expect(history.getEntries("doc-a").map((entry) => entry.origin)).toEqual([
      "baseline",
      ...origins,
    ]);
  });

  it("isolates documents and caps each history at 100 entries", () => {
    const history = new KnowledgeContentHistory();
    history.ensureDocument("doc-a", "a0");
    history.ensureDocument("doc-b", "b0");
    for (let index = 1; index <= 120; index += 1) {
      history.commit({
        documentId: "doc-a",
        markdown: `a${index}`,
        origin: "toolbar",
        timestamp: index,
      });
    }
    history.commit({
      documentId: "doc-b",
      markdown: "b1",
      origin: "checklist",
    });

    expect(history.getEntries("doc-a")).toHaveLength(
      KNOWLEDGE_CONTENT_HISTORY_LIMIT,
    );
    expect(history.getCurrentEntry("doc-a")?.markdown).toBe("a120");
    expect(history.getCurrentEntry("doc-b")?.markdown).toBe("b1");
    expect(history.undo("doc-b")?.markdown).toBe("b0");
    expect(history.getCurrentEntry("doc-a")?.markdown).toBe("a120");
  });

  it("does not create entries for undo or redo", () => {
    const history = new KnowledgeContentHistory();
    history.ensureDocument("doc-a", "");
    commit(history, "one", "toolbar");
    commit(history, "two", "toolbar");
    const length = history.getEntries("doc-a").length;

    history.undo("doc-a");
    history.redo("doc-a");
    expect(history.getEntries("doc-a")).toHaveLength(length);
    expect(history.getCurrentEntry("doc-a")?.markdown).toBe("two");
  });

  it("normalizes undo and redo shortcuts across keyboard layouts", () => {
    const baseEvent = {
      altKey: false,
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
    };

    expect(
      getKnowledgeHistoryShortcutAction({
        ...baseEvent,
        code: "KeyZ",
        key: "я",
      }),
    ).toBe("undo");
    expect(
      getKnowledgeHistoryShortcutAction({
        ...baseEvent,
        code: "KeyZ",
        key: "я",
        shiftKey: true,
      }),
    ).toBe("redo");
    expect(
      getKnowledgeHistoryShortcutAction({
        ...baseEvent,
        code: "KeyY",
        key: "н",
      }),
    ).toBe("redo");
    expect(
      getKnowledgeHistoryShortcutAction({
        ...baseEvent,
        code: "",
        key: "z",
      }),
    ).toBe("undo");
    expect(
      getKnowledgeHistoryShortcutAction({
        ...baseEvent,
        code: "KeyZ",
        key: "я",
        ctrlKey: false,
        metaKey: false,
      }),
    ).toBeNull();
  });

  it("routes title and body history through the same shortcut actions", () => {
    const history = new KnowledgeContentHistory();
    history.ensureDocument("title-doc", "# Old title\n\nBody");
    history.commit({
      documentId: "title-doc",
      markdown: "# New title\n\nBody",
      origin: "toolbar",
    });

    expect(
      getKnowledgeHistoryShortcutAction({
        altKey: false,
        code: "KeyZ",
        ctrlKey: true,
        key: "я",
        metaKey: false,
        shiftKey: false,
      }),
    ).toBe("undo");
    expect(history.undo("title-doc")?.markdown).toBe("# Old title\n\nBody");

    expect(
      getKnowledgeHistoryShortcutAction({
        altKey: false,
        code: "KeyY",
        ctrlKey: true,
        key: "н",
        metaKey: false,
        shiftKey: false,
      }),
    ).toBe("redo");
    expect(history.redo("title-doc")?.markdown).toBe("# New title\n\nBody");

    history.ensureDocument("body-doc", "# Title\n\nOld body");
    history.commit({
      documentId: "body-doc",
      markdown: "# Title\n\nNew body",
      origin: "typing",
    });
    history.undo("body-doc");
    expect(history.redo("body-doc")?.markdown).toBe("# Title\n\nNew body");
  });
});

describe("Markdown toolbar selection transforms", () => {
  it("formats the live first, middle, last, and multiple-line selections", () => {
    const markdown = "one\ntwo\nthree\nfour";

    expect(applyMarkdownToolbarFormat(markdown, 0, 3, "h1").markdown).toBe(
      "# one\ntwo\nthree\nfour",
    );
    expect(applyMarkdownToolbarFormat(markdown, 4, 7, "h2").markdown).toBe(
      "one\n## two\nthree\nfour",
    );
    expect(applyMarkdownToolbarFormat(markdown, 8, 13, "h3").markdown).toBe(
      "one\ntwo\n### three\nfour",
    );
    expect(applyMarkdownToolbarFormat(markdown, 8, 13, "bullet").markdown).toBe(
      "one\ntwo\n- three\nfour",
    );
    expect(
      applyMarkdownToolbarFormat(markdown, 0, 7, "numbered").markdown,
    ).toBe("1. one\n2. two\nthree\nfour");
  });

  it("uses the live selection after an earlier history entry moved elsewhere", () => {
    const markdown = "alpha beta\ngamma delta\nepsilon zeta";
    const staleHistorySelection = { start: 23, end: 30 };
    const liveSelection = { start: 6, end: 10 };

    expect(staleHistorySelection).not.toEqual(liveSelection);
    expect(
      applyMarkdownToolbarFormat(
        markdown,
        liveSelection.start,
        liveSelection.end,
        "bold",
      ),
    ).toMatchObject({
      markdown: "alpha **beta**\ngamma delta\nepsilon zeta",
      selection: { start: 8, end: 12 },
    });
  });

  it("keeps inline and cursor-only formatting selection behavior", () => {
    expect(
      applyMarkdownToolbarFormat("alpha beta gamma", 6, 10, "italic"),
    ).toMatchObject({
      markdown: "alpha *beta* gamma",
      selection: { start: 7, end: 11 },
    });
    expect(
      applyMarkdownToolbarFormat("alpha beta", 5, 5, "bold"),
    ).toMatchObject({
      markdown: "alpha**текст** beta",
      selection: { start: 7, end: 12 },
    });
  });
});
