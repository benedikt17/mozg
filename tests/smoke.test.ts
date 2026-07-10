import { describe, expect, it } from "vitest";
import { locale } from "@/lib/i18n";

describe("project scaffold", () => {
  it("uses the fixed interface locale", () => {
    expect(locale).toBe("ru-RU");
  });
});
