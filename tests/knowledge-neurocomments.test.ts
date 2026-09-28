import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { exactQuoteAnchor } from "@/lib/knowledge-mcp/neurocomments";

describe("exact neurocomment anchor", () => {
  it("accepts one literal occurrence and refuses ambiguous quotes", () => {
    const anchor = exactQuoteAnchor(
      "# Герой\nОдин дракон живёт у пруда.",
      "Один дракон",
    );
    expect(anchor).toMatchObject({ start_offset: 8, end_offset: 19 });
    expect(exactQuoteAnchor("дракон и дракон", "дракон")).toBeNull();
    expect(exactQuoteAnchor("нет героя", "дракон")).toBeNull();
  });
});
