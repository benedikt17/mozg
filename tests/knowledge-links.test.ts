import { describe, expect, it } from "vitest";
import {
  parseExternalLinkToken,
  parseInternalLinkToken,
  parseTaskListToken,
  toggleTaskListMarker,
} from "@/prototype/knowledge/markdown-document-preview";
import {
  adjustListIndent,
  continueListLine,
} from "@/prototype/knowledge/markdown-source-editor";

describe("Knowledge external link tokens", () => {
  it.each(["https://example.com", "http://example.com"])(
    "recognizes %s",
    (value) =>
      expect(parseExternalLinkToken(value)).toMatchObject({
        href: value,
        label: value,
      }),
  );

  it("keeps Markdown label and strips sentence punctuation", () => {
    expect(
      parseExternalLinkToken("[Open source](https://example.com/page)"),
    ).toEqual({
      label: "Open source",
      href: "https://example.com/page",
      trailing: "",
    });
    expect(parseExternalLinkToken("https://example.com/page.")).toEqual({
      label: "https://example.com/page",
      href: "https://example.com/page",
      trailing: ".",
    });
  });

  it.each(["javascript:alert(1)", "data:text/html,evil", "file:///tmp/a"])(
    "does not activate %s",
    (value) => expect(parseExternalLinkToken(value)).toBeNull(),
  );

  it("does not reinterpret internal Knowledge links", () => {
    expect(parseExternalLinkToken("[[Настенька]]")).toBeNull();
  });

  it("parses stable document ids separately from external links", () => {
    expect(parseInternalLinkToken("[[doc:doc-l-baba-yaga|Баба Яга]]")).toEqual({
      documentId: "doc-l-baba-yaga",
      label: "Баба Яга",
    });
    expect(parseInternalLinkToken("[[doc:foreign]]")).toBeNull();
  });
});

describe("Knowledge task-list preview tokens", () => {
  it.each(["- [ ] Open", "- [x] Done", "- [X] Done"])('parses "%s"', (line) => {
    expect(parseTaskListToken(line)).toMatchObject({
      checked: line.includes("x") || line.includes("X"),
    });
  });

  it("toggles only the requested marker and preserves neighboring Markdown", () => {
    const markdown = "before\n- [ ] First  \n- [x] Second\nafter";
    expect(toggleTaskListMarker(markdown, 1, true)).toBe(
      "before\n- [x] First  \n- [x] Second\nafter",
    );
    expect(toggleTaskListMarker(markdown, 2, false)).toBe(
      "before\n- [ ] First  \n- [ ] Second\nafter",
    );
  });

  it("toggles nested items independently while preserving indentation", () => {
    const markdown = "- [ ] Parent\n    - [ ] Same\n        - [x] Same\nend";
    expect(toggleTaskListMarker(markdown, 1, true)).toBe(
      "- [ ] Parent\n    - [x] Same\n        - [x] Same\nend",
    );
    expect(toggleTaskListMarker(markdown, 2, false)).toBe(
      "- [ ] Parent\n    - [ ] Same\n        - [ ] Same\nend",
    );
  });

  it("parses nested mixed list types through depth two", async () => {
    const {
      buildNestedListTree,
      hasNestedChildren,
      isNestedLineHidden,
      parseNestedListItem,
    } = await import("@/prototype/knowledge/markdown-document-preview");
    expect(parseNestedListItem("        - [x] Child")).toMatchObject({
      depth: 2,
      kind: "task",
      checked: true,
    });
    expect(parseNestedListItem("    1. Ordered")).toMatchObject({
      depth: 1,
      kind: "ordered",
    });
    expect(parseNestedListItem("    - Bullet")).toMatchObject({
      depth: 1,
      kind: "bullet",
    });
    expect(hasNestedChildren(["- Parent", "    - Child"], 0, 0)).toBe(true);
    expect(hasNestedChildren(["- Parent", "- Sibling"], 0, 0)).toBe(false);
    expect(
      isNestedLineHidden(
        ["- Parent", "    - One", "    - Two"],
        1,
        new Set([0]),
      ),
    ).toBe(true);
    expect(
      isNestedLineHidden(
        ["- Parent", "    - One", "    - Two"],
        2,
        new Set([0]),
      ),
    ).toBe(true);
    const tree = buildNestedListTree(
      ["- Parent", "    - Child", "        - Grandchild", "- Next"],
      0,
    );
    expect(tree.roots.map((node) => node.lineIndex)).toEqual([0, 3]);
    expect(tree.roots[0]?.children[0]?.children[0]?.lineIndex).toBe(2);
    expect(tree.roots[0]?.children[0]?.kind).toBe("bullet");
  });

  it("adjusts list depth and continues the same list type", () => {
    expect(adjustListIndent("- [ ] Task", 1)).toBe("    - [ ] Task");
    expect(adjustListIndent("        - [ ] Task", 1)).toBe(
      "        - [ ] Task",
    );
    expect(adjustListIndent("    - [ ] Task", -1)).toBe("- [ ] Task");
    expect(adjustListIndent("plain text", 1)).toBe("plain text");
    expect(continueListLine("    - [x] Task")).toBe("    - [ ] ");
    expect(continueListLine("    3. Step")).toBe("    4. ");
    expect(continueListLine("    - ")).toBe("    ");
  });
});
