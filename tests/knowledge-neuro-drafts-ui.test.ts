import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { selectDraftDocumentForPublication } from "@/prototype/knowledge/knowledge-neuro-drafts";

describe("publishing one neuro-MD document", () => {
  it("selects only the opened document and leaves the other drafts intact", () => {
    const documents = [
      { title: "Первый", markdown: "# Первый", selected: true },
      { title: "Второй", markdown: "# Второй", selected: true },
      { title: "Третий", markdown: "# Третий", selected: false },
    ];
    expect(selectDraftDocumentForPublication(documents, 1)).toEqual([
      { ...documents[0], selected: false },
      { ...documents[1], selected: true },
      { ...documents[2], selected: false },
    ]);
    expect(documents.map((document) => document.selected)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it("uses the normal document page and Markdown editor for drafts", () => {
    const draft = readFileSync(
      resolve(
        process.cwd(),
        "src/prototype/knowledge/knowledge-neuro-drafts.tsx",
      ),
      "utf8",
    );
    const workspace = readFileSync(
      resolve(process.cwd(), "src/prototype/knowledge/knowledge-workspace.tsx"),
      "utf8",
    );
    expect(draft).toContain('className="document-page-inner"');
    expect(draft).toContain("<MarkdownSourceEditor");
    expect(draft).toContain('className="knowledge-edit-action"');
    expect(draft).toContain("styles.settingsPanel");
    expect(draft).not.toContain("styles.draftTab");
    expect(draft).not.toContain("styles.metadata");
    expect(workspace).not.toContain("knowledge-neuro-md-jump");
  });
});
