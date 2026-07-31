import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

  it("keeps passive status feedback out of the pointer path while preserving retry access", () => {
    const styles = readFileSync(
      resolve(process.cwd(), "src/prototype/desktop-shell.css"),
      "utf8",
    );

    expect(styles).toMatch(
      /\.desktop-persistence-status\s*\{[\s\S]*?pointer-events:\s*none;/,
    );
    expect(styles).toContain(".desktop-persistence-status.has-right-panel");
    expect(styles).toMatch(
      /\.desktop-persistence-status\s*>\s*\.ui-button\s*\{[\s\S]*?pointer-events:\s*auto;/,
    );
  });
});
