import { describe, expect, it } from "vitest";
import {
  extractWikiLinks,
  parseMarkdown,
  serializeMarkdown,
} from "@/lib/markdown";

function roundTripTwice(markdown: string): string {
  const markdownOne = serializeMarkdown(parseMarkdown(markdown));
  const markdownTwo = serializeMarkdown(parseMarkdown(markdownOne));
  expect(markdownTwo).toBe(markdownOne);
  return markdownOne;
}

describe("structural wiki-link round-trip", () => {
  it("keeps an escaped literal before an identical semantic link", () => {
    const output = roundTripTwice("\\[[Same title]] and [[Same title]]\n");

    expect(output).toBe("\\[\\[Same title]] and [[Same title]]\n");
    expect(extractWikiLinks(output).map(({ title }) => title)).toEqual([
      "Same title",
    ]);
  });

  it("keeps a semantic link before an identical escaped literal", () => {
    const output = roundTripTwice("[[Same title]] and \\[[Same title]]\n");

    expect(output).toBe("[[Same title]] and \\[\\[Same title]]\n");
    expect(extractWikiLinks(output)).toHaveLength(1);
  });

  it("keeps repeated semantic links with the same title", () => {
    const output = roundTripTwice("[[Same title]] and [[Same title]]\n");

    expect(output).toBe("[[Same title]] and [[Same title]]\n");
    expect(extractWikiLinks(output)).toHaveLength(2);
  });

  it("distinguishes two semantic links from an identical escaped literal", () => {
    const output = roundTripTwice(
      "[[Same title]], \\[[Same title]]; and [[Same title]].\n",
    );

    expect(output).toBe(
      "[[Same title]], \\[\\[Same title]]; and [[Same title]].\n",
    );
    expect(extractWikiLinks(output)).toHaveLength(2);
  });

  it("preserves links adjacent to varied punctuation", () => {
    const input =
      "([[One]]), [[Two]]. [[Three]]; [[Four]]—[[Five]] - [[Six]].\n";
    const output = roundTripTwice(input);

    expect(output).toBe(input);
    expect(extractWikiLinks(output)).toHaveLength(6);
  });

  it("does not materialize identical wiki syntax inside code", () => {
    const input =
      "[[Same title]] and `[[Same title]]`\n\n```md\n[[Same title]]\n```\n";
    const output = roundTripTwice(input);

    expect(output).toBe(input);
    expect(extractWikiLinks(output)).toHaveLength(1);
  });

  it("ignores stale discovery metadata after the tree content is replaced", () => {
    const document = parseMarkdown("[[Old title]]\n");
    document.children = [
      {
        type: "paragraph",
        children: [{ type: "text", value: "Different text" }],
      },
    ];

    expect(document.data.wikiLinks).toHaveLength(1);
    expect(serializeMarkdown(document)).toBe("Different text\n");
  });
});
