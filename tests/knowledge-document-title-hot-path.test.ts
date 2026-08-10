import { describe, expect, it } from "vitest";
import type { PrototypeDocument } from "@/prototype/desktop-mock-data";
import { getDocumentTitle } from "@/prototype/desktop-state";

describe("Knowledge document title hot path", () => {
  it("uses the stored semantic title instead of reparsing Markdown on reads", () => {
    const document: PrototypeDocument = {
      id: "doc-performance-contract",
      projectId: "project-performance-contract",
      folder: "",
      title: "Stored semantic title",
      excerpt: "",
      content: [
        "# Different **source** heading",
        "",
        "A long article body must not be parsed just to read its already-synchronized title.",
      ],
      backlinks: [],
    };

    expect(getDocumentTitle(document)).toBe("Stored semantic title");
  });
});
