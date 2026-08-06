import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Knowledge content history integration contract", () => {
  it("keeps history above the editor and exposes the required toolbar controls", () => {
    const shell = source("src/prototype/desktop-shell.tsx");
    const workspace = source("src/prototype/knowledge/knowledge-workspace.tsx");
    const editor = source("src/prototype/knowledge/markdown-source-editor.tsx");

    expect(shell).toContain("KnowledgeContentHistoryProvider");
    expect(workspace).toContain('label="Отменить"');
    expect(workspace).toContain('label="Повторить"');
    expect(workspace).toContain("contentHistory.canUndo");
    expect(workspace).toContain("contentHistory.canRedo");
    expect(editor).not.toContain("historyRef");
    expect(editor).toContain('event.key.toLowerCase() === "z"');
    expect(editor).toContain('event.key.toLowerCase() === "y"');
    expect(editor).toContain("event.preventDefault()");
  });

  it("routes Knowledge and Overview checklist mutations through the history boundary", () => {
    const workspace = source("src/prototype/knowledge/knowledge-workspace.tsx");
    const reader = source(
      "src/prototype/overview/overview-contextual-reader.tsx",
    );
    const runtime = source(
      "src/prototype/knowledge/knowledge-content-history-runtime.tsx",
    );

    expect(workspace).toContain('origin: "checklist"');
    expect(workspace).toContain('origin: "load"');
    expect(reader).toContain("contentHistory.commitMarkdown");
    expect(reader).toContain('origin: "checklist"');
    expect(runtime).toContain('type: "update-knowledge-document-markdown"');
  });
});
