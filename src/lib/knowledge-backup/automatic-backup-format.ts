export type KnowledgeBackupKind = "daily" | "weekly";

export type KnowledgeBackupCaptionInput = {
  activeDocumentCount: number;
  deletedDocumentCount: number;
  documentCount: number;
  generatedAt: Date;
  kind: KnowledgeBackupKind;
  revision: number;
  workspaceName: string;
};

export function automaticKnowledgeBackupFileName(
  kind: KnowledgeBackupKind,
  generatedAt: Date,
): string {
  const date = formatUtcDate(generatedAt);
  const label = kind === "daily" ? "Daily" : "Weekly";
  return `MOZG-Knowledge-${label}-${date}.zip`;
}

export function createKnowledgeBackupCaption({
  activeDocumentCount,
  deletedDocumentCount,
  documentCount,
  generatedAt,
  kind,
  revision,
  workspaceName,
}: KnowledgeBackupCaptionInput): string {
  const label =
    kind === "daily"
      ? "Ежедневная резервная копия"
      : "Контрольная недельная копия";
  return [
    `MOZG · Знания · ${label}`,
    `Дата: ${formatUtcDate(generatedAt)} UTC`,
    `Workspace: ${workspaceName}`,
    `Документов: ${documentCount} · активных ${activeDocumentCount} · в Корзине ${deletedDocumentCount}`,
    `Revision: ${revision}`,
  ].join("\n");
}

function formatUtcDate(value: Date): string {
  return [
    value.getUTCFullYear().toString().padStart(4, "0"),
    (value.getUTCMonth() + 1).toString().padStart(2, "0"),
    value.getUTCDate().toString().padStart(2, "0"),
  ].join("-");
}
