import { describe, expect, it } from "vitest";
import {
  automaticKnowledgeBackupFileName,
  createKnowledgeBackupCaption,
} from "@/lib/knowledge-backup/automatic-backup-format";

describe("automatic Knowledge backup format", () => {
  const generatedAt = new Date("2026-08-16T06:30:00.000Z");

  it("uses stable daily and weekly filenames", () => {
    expect(automaticKnowledgeBackupFileName("daily", generatedAt)).toBe(
      "MOZG-Knowledge-Daily-2026-08-16.zip",
    );
    expect(automaticKnowledgeBackupFileName("weekly", generatedAt)).toBe(
      "MOZG-Knowledge-Weekly-2026-08-16.zip",
    );
  });

  it("builds a compact caption with recovery-relevant metadata", () => {
    expect(
      createKnowledgeBackupCaption({
        activeDocumentCount: 85,
        deletedDocumentCount: 17,
        documentCount: 102,
        generatedAt,
        kind: "weekly",
        revision: 3620,
        workspaceName: "Личное пространство",
      }),
    ).toBe(
      [
        "MOZG · Знания · Контрольная недельная копия",
        "Дата: 2026-08-16 UTC",
        "Workspace: Личное пространство",
        "Документов: 102 · активных 85 · в Корзине 17",
        "Revision: 3620",
      ].join("\n"),
    );
  });
});
