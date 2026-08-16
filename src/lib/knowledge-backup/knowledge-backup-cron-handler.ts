import "server-only";

import {
  runAutomaticKnowledgeBackup,
  type AutomaticKnowledgeBackupResult,
} from "./automatic-knowledge-backup";
import type { KnowledgeBackupKind } from "./automatic-backup-format";

export function isKnowledgeBackupCronAuthorized(
  request: Request,
  cronSecret = process.env.CRON_SECRET,
): boolean {
  return (
    typeof cronSecret === "string" &&
    cronSecret.length >= 16 &&
    request.headers.get("authorization") === `Bearer ${cronSecret}`
  );
}

export async function handleKnowledgeBackupCron(
  request: Request,
  kind: KnowledgeBackupKind,
): Promise<Response> {
  if (!isKnowledgeBackupCronAuthorized(request)) {
    return Response.json({ ok: false }, { status: 401 });
  }

  try {
    const result = await runAutomaticKnowledgeBackup(kind);
    return Response.json(toPublicResult(result));
  } catch (error) {
    console.error(
      "Knowledge backup cron failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return Response.json({ ok: false }, { status: 500 });
  }
}

function toPublicResult(result: AutomaticKnowledgeBackupResult) {
  return {
    ok: true,
    documentCount: result.documentCount,
    fileName: result.fileName,
    kind: result.kind,
    revision: result.revision,
  } as const;
}
