import { describe, expect, it } from "vitest";
import {
  KnowledgeContentHistory,
  KNOWLEDGE_CONTENT_HISTORY_LIMIT,
} from "@/prototype/knowledge/knowledge-content-history";

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
});
