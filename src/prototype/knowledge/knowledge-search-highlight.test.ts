import { describe, expect, it } from "vitest";

import { getKnowledgeSearchMatchSpans } from "./knowledge-search-highlight";

function matchedText(text: string, query: string): string[] {
  return getKnowledgeSearchMatchSpans(text, query).map(({ start, end }) =>
    text.slice(start, end),
  );
}

describe("Knowledge Search highlight matching", () => {
  it("highlights the full phrase when the phrase exists", () => {
    const text =
      "Почему герои не могут уйти, и почему герои не могут вернуться.";

    expect(matchedText(text, "почему герои не могут")).toEqual([
      "Почему герои не могут",
      "почему герои не могут",
    ]);
  });

  it("falls back to individual terms when the full phrase is absent", () => {
    const text = "Остров находится на севере. Берег остаётся далеко на юге.";

    expect(matchedText(text, "остров берег")).toEqual(["Остров", "Берег"]);
  });

  it("is case-insensitive and does not duplicate repeated terms", () => {
    const text = "Магия рядом. МАГИЯ внутри.";

    expect(matchedText(text, "магия магия")).toEqual(["Магия", "МАГИЯ"]);
  });

  it("returns no matches for an empty query", () => {
    expect(getKnowledgeSearchMatchSpans("Любой текст", "   ")).toEqual([]);
  });
});
