import { describe, expect, it } from "vitest";
import { parseMarkdown, serializeMarkdown } from "@/lib/markdown";
import { goldenFixtures } from "./fixtures/golden";

describe("Markdown golden round-trip", () => {
  it.each(goldenFixtures)(
    "canonicalizes $name without data loss",
    ({ input, expected }) => {
      const documentOne = parseMarkdown(input);
      const markdownOne = serializeMarkdown(documentOne);
      const documentTwo = parseMarkdown(markdownOne);
      const markdownTwo = serializeMarkdown(documentTwo);

      expect(documentOne.type).toBe("root");
      expect(markdownOne).toBe(expected);
      expect(markdownTwo).toBe(markdownOne);
    },
  );

  it("makes loss of a task ID or wiki-link fail loudly", () => {
    const taskId = "^task-550e8400-e29b-41d4-a716-446655440000";
    const wikiLink = "[[Критическая заметка]]";
    const output = serializeMarkdown(
      parseMarkdown(`- [ ] Critical ${taskId}\n\nOpen ${wikiLink}.\n`),
    );

    expect(output).toContain(taskId);
    expect(output).toContain(wikiLink);
  });
});
