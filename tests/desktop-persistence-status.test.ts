import { describe, expect, it } from "vitest";
import { getDesktopPersistenceStatusMessage } from "@/prototype/desktop-shell";

describe("desktop persistence status", () => {
  it("uses a user-facing conflict message without exposing transport details", () => {
    expect(getDesktopPersistenceStatusMessage("conflict")).toBe(
      "Конфликт изменений",
    );
  });

  it("keeps non-conflict failures generic", () => {
    expect(getDesktopPersistenceStatusMessage("unavailable")).toBe(
      "Не удалось сохранить изменения",
    );
  });
});
