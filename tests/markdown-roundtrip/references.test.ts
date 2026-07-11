import { describe, expect, it } from "vitest";
import { extractTaskReferences, extractWikiLinks } from "@/lib/markdown";

const FIRST_ID = "550e8400-e29b-41d4-a716-446655440000";
const SECOND_ID = "a8098c1a-f86e-11da-bd1a-00112444be1e";

describe("extractTaskReferences", () => {
  it("extracts checked state, title, UUID, and one-based line", () => {
    const references = extractTaskReferences(
      `intro\n- [ ] Купить молоко ^task-${FIRST_ID}\n- [x] Ship release ^task-${SECOND_ID}\n`,
    );

    expect(references).toEqual([
      {
        id: FIRST_ID,
        title: "Купить молоко",
        checkedMarker: false,
        lineOrPosition: 2,
        occurrence: 1,
        isDuplicate: false,
      },
      {
        id: SECOND_ID,
        title: "Ship release",
        checkedMarker: true,
        lineOrPosition: 3,
        occurrence: 1,
        isDuplicate: false,
      },
    ]);
  });

  it("does not invent IDs for ordinary or malformed checkboxes", () => {
    const references = extractTaskReferences(
      "- [ ] ordinary\n- [x] malformed ^task-nope\n- [ ] empty ^task-\n",
    );

    expect(references).toEqual([]);
  });

  it("rejects a line containing more than one task marker", () => {
    const references = extractTaskReferences(
      `- [ ] ambiguous ^task-${FIRST_ID} ^task-${SECOND_ID}\n`,
    );

    expect(references).toEqual([]);
  });

  it("returns every duplicate occurrence and marks all as duplicates", () => {
    const references = extractTaskReferences(
      `- [ ] first ^task-${FIRST_ID}\n- [x] second ^task-${FIRST_ID}\n`,
    );

    expect(
      references.map(({ occurrence, isDuplicate }) => ({
        occurrence,
        isDuplicate,
      })),
    ).toEqual([
      { occurrence: 1, isDuplicate: true },
      { occurrence: 2, isDuplicate: true },
    ]);
  });

  it("ignores task syntax inside fenced code", () => {
    expect(
      extractTaskReferences(
        `\`\`\`md\n- [ ] hidden ^task-${FIRST_ID}\n\`\`\`\n`,
      ),
    ).toEqual([]);
  });
});

describe("extractWikiLinks", () => {
  it("extracts Russian, English, and special-character titles", () => {
    const references = extractWikiLinks(
      "[[Русская заметка]] and [[English Note]] / [[API & интеграции — 2026!]]\n",
    );

    expect(references.map(({ title }) => title)).toEqual([
      "Русская заметка",
      "English Note",
      "API & интеграции — 2026!",
    ]);
    expect(references.map(({ lineOrPosition }) => lineOrPosition)).toEqual([
      1, 1, 1,
    ]);
  });

  it("preserves raw source while trimming the lookup title", () => {
    expect(extractWikiLinks("Open [[  Padded title  ]].\n")[0]).toMatchObject({
      title: "Padded title",
      raw: "[[  Padded title  ]]",
      start: 5,
      end: 25,
    });
  });

  it("ignores escaped, empty, malformed, inline-code, and fenced-code links", () => {
    const markdown =
      "\\[[escaped]] [[]] [[broken]target]] `[[inline code]]`\n" +
      "```md\n[[fenced code]]\n```\n";

    expect(extractWikiLinks(markdown)).toEqual([]);
  });
});
