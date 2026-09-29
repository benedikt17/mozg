import { describe, expect, it } from "vitest";
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
});
