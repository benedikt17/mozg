import "server-only";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";
import {
  parseDesktopCloudSnapshotRow,
  type DesktopCloudSnapshotRow,
} from "@/prototype/persistence/cloud-snapshot-bridge";
import { createKnowledgeBackup } from "@/prototype/knowledge/knowledge-backup-export";
import { CANVAS_DOCUMENT_V2_SCHEMA_VERSION } from "@/lib/canvas/canvas-document";
import { createAutomaticCanvasBackupBundle } from "./automatic-canvas-backup";
import {
  automaticKnowledgeBackupFileName,
  createKnowledgeBackupCaption,
  type KnowledgeBackupKind,
} from "./automatic-backup-format";

const MAX_TELEGRAM_DOCUMENT_BYTES = 49 * 1024 * 1024;

const telegramChatIdSchema = z
  .string()
  .refine(
    (value) => /^-?\d+$/.test(value) || /^@[A-Za-z0-9_]{5,}$/.test(value),
    "Expected a numeric Telegram chat id or @channel username",
  );

const automaticBackupEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_BACKUP_SECRET_KEY: z.string().startsWith("sb_secret_"),
  MOZG_BACKUP_WORKSPACE_ID: z.string().uuid(),
  TELEGRAM_BACKUP_BOT_TOKEN: z.string().regex(/^\d+:[A-Za-z0-9_-]{20,}$/),
  TELEGRAM_BACKUP_DAILY_CHAT_ID: telegramChatIdSchema,
  TELEGRAM_BACKUP_WEEKLY_CHAT_ID: telegramChatIdSchema,
});

const telegramResponseSchema = z
  .object({
    ok: z.boolean(),
    description: z.string().optional(),
    result: z
      .object({
        message_id: z.number().int(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type AutomaticKnowledgeBackupResult = {
  canvasCount: number;
  documentCount: number;
  fileName: string;
  kind: KnowledgeBackupKind;
  revision: number;
  telegramMessageId: number;
  workspaceId: string;
};

export async function runAutomaticKnowledgeBackup(
  kind: KnowledgeBackupKind,
  generatedAt = new Date(),
): Promise<AutomaticKnowledgeBackupResult> {
  const env = getAutomaticBackupEnv();
  const supabase = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_BACKUP_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("id", env.MOZG_BACKUP_WORKSPACE_ID)
    .maybeSingle();
  if (workspaceError || !workspace) {
    throw new Error("Knowledge backup workspace is unavailable");
  }

  const { data: row, error: snapshotError } = await supabase
    .from("workspace_snapshots")
    .select("workspace_id, schema_version, snapshot, revision, updated_at")
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (snapshotError || !row) {
    throw new Error("Knowledge backup snapshot is unavailable");
  }

  const parsed = parseDesktopCloudSnapshotRow(
    row as DesktopCloudSnapshotRow,
    workspace.name,
  );
  if (parsed.kind !== "ready") {
    throw new Error(`Knowledge backup snapshot rejected: ${parsed.kind}`);
  }

  const snapshot = parsed.bootstrap.snapshot;
  const [{ data: canvasRows, error: canvasError }, { data: groupRows, error: groupError }, { data: fileRows, error: fileError }] =
    await Promise.all([
      supabase
        .from("canvases")
        .select("id, project_id, group_id, title, document, revision")
        .eq("workspace_id", workspace.id)
        .eq("schema_version", CANVAS_DOCUMENT_V2_SCHEMA_VERSION)
        .is("deleted_at", null),
      supabase
        .from("canvas_groups")
        .select("id, project_id, parent_group_id, title")
        .eq("workspace_id", workspace.id)
        .is("deleted_at", null),
      supabase
        .from("project_files")
        .select("id, byte_size, checksum, mime_type, name, original_name")
        .eq("workspace_id", workspace.id)
        .is("deleted_at", null),
    ]);
  if (canvasError || groupError || fileError) {
    throw new Error("Canvas backup snapshot is unavailable");
  }
  const canvasBackup = createAutomaticCanvasBackupBundle(
    {
      canvases: (canvasRows ?? []).map((row) => ({
        document: row.document,
        groupId: row.group_id,
        id: row.id,
        projectId: row.project_id,
        revision: row.revision,
        title: row.title,
      })),
      documents: snapshot.documents,
      files: (fileRows ?? []).map((row) => ({
        byteSize: row.byte_size,
        checksum: row.checksum,
        id: row.id,
        mimeType: row.mime_type,
        name: row.name,
        originalName: row.original_name,
      })),
      groups: (groupRows ?? []).map((row) => ({
        id: row.id,
        parentGroupId: row.parent_group_id,
        projectId: row.project_id,
        title: row.title,
      })),
      projects: snapshot.projects,
    },
    generatedAt,
  );
  const archive = createKnowledgeBackup(
    {
      canvasBackup,
      documents: snapshot.documents,
      knowledgeFolders: snapshot.knowledgeFolders,
      projects: snapshot.projects,
    },
    generatedAt,
  );
  if (archive.bytes.byteLength > MAX_TELEGRAM_DOCUMENT_BYTES) {
    throw new Error("Knowledge backup archive exceeds Telegram safety limit");
  }

  const fileName = automaticKnowledgeBackupFileName(kind, generatedAt);
  const caption = createKnowledgeBackupCaption({
    activeDocumentCount: archive.manifest.activeDocumentCount,
    canvasCount: archive.manifest.canvasCount,
    deletedDocumentCount: archive.manifest.deletedDocumentCount,
    documentCount: archive.manifest.documentCount,
    generatedAt,
    kind,
    revision: parsed.bootstrap.revision,
    workspaceName: parsed.bootstrap.workspaceName,
  });
  const telegramMessageId = await sendTelegramDocument({
    botToken: env.TELEGRAM_BACKUP_BOT_TOKEN,
    bytes: archive.bytes,
    caption,
    chatId:
      kind === "daily"
        ? env.TELEGRAM_BACKUP_DAILY_CHAT_ID
        : env.TELEGRAM_BACKUP_WEEKLY_CHAT_ID,
    fileName,
  });

  return {
    canvasCount: archive.manifest.canvasCount,
    documentCount: archive.manifest.documentCount,
    fileName,
    kind,
    revision: parsed.bootstrap.revision,
    telegramMessageId,
    workspaceId: parsed.bootstrap.workspaceId,
  };
}

function getAutomaticBackupEnv(): z.infer<typeof automaticBackupEnvSchema> {
  return automaticBackupEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_BACKUP_SECRET_KEY: process.env.SUPABASE_BACKUP_SECRET_KEY,
    MOZG_BACKUP_WORKSPACE_ID: process.env.MOZG_BACKUP_WORKSPACE_ID,
    TELEGRAM_BACKUP_BOT_TOKEN: process.env.TELEGRAM_BACKUP_BOT_TOKEN,
    TELEGRAM_BACKUP_DAILY_CHAT_ID: process.env.TELEGRAM_BACKUP_DAILY_CHAT_ID,
    TELEGRAM_BACKUP_WEEKLY_CHAT_ID: process.env.TELEGRAM_BACKUP_WEEKLY_CHAT_ID,
  });
}

async function sendTelegramDocument({
  botToken,
  bytes,
  caption,
  chatId,
  fileName,
}: {
  botToken: string;
  bytes: Uint8Array;
  caption: string;
  chatId: string;
  fileName: string;
}): Promise<number> {
  const form = new FormData();
  form.set("chat_id", chatId);
  form.set("caption", caption);
  form.set(
    "document",
    new Blob([new Uint8Array(bytes)], { type: "application/zip" }),
    fileName,
  );

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendDocument`,
    {
      body: form,
      method: "POST",
      signal: AbortSignal.timeout(30_000),
    },
  );
  const raw: unknown = await response.json().catch(() => null);
  const parsed = telegramResponseSchema.safeParse(raw);
  if (
    !response.ok ||
    !parsed.success ||
    !parsed.data.ok ||
    parsed.data.result === undefined
  ) {
    const description =
      parsed.success && parsed.data.description
        ? `: ${parsed.data.description}`
        : "";
    throw new Error(`Telegram rejected Knowledge backup${description}`);
  }
  return parsed.data.result.message_id;
}
