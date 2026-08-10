import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { analyzeMarkdownStructure } from "@/lib/markdown";

function roundMs(value: number): number {
  return Math.round(value * 1000) / 1000;
}

describe("Stage 5 post-cache Markdown profile", () => {
  it(
    "measures first parse versus identical cache hits",
    () => {
      const markdown = [
        "# Large post-cache profile document",
        ...Array.from({ length: 1200 }, (_, index) =>
          index % 100 === 0
            ? `\n## Section ${index / 100}\n\n| Field | Value |\n| --- | --- |\n| Item ${index} | Значение |`
            : `Paragraph ${index} with **bold**, *italic*, [link](https://example.com), and [[doc:profile-doc-0]].`,
        ),
      ].join("\n\n");

      const firstStartedAt = performance.now();
      const first = analyzeMarkdownStructure(markdown);
      const firstParseMs = performance.now() - firstStartedAt;

      const cacheHitIterations = 20;
      const cacheStartedAt = performance.now();
      let last = first;
      for (let index = 0; index < cacheHitIterations; index += 1) {
        last = analyzeMarkdownStructure(markdown);
      }
      const cacheHitAverageMs =
        (performance.now() - cacheStartedAt) / cacheHitIterations;

      expect(markdown.split("\n")).toHaveLength(2461);
      expect(first.headings.length).toBeGreaterThan(1);
      expect(first.tables.length).toBeGreaterThan(1);
      expect(last).toBe(first);

      console.info(
        "STAGE5_POSTCACHE_PROFILE",
        JSON.stringify({
          markdownProfileLines: markdown.split("\n").length,
          firstParseMs: roundMs(firstParseMs),
          cacheHitAverageMs: roundMs(cacheHitAverageMs),
          estimatedOutlinePlusRendererMs: roundMs(
            firstParseMs + cacheHitAverageMs,
          ),
        }),
      );
    },
    15_000,
  );
});
