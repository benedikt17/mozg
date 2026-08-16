import { handleKnowledgeBackupCron } from "@/lib/knowledge-backup/knowledge-backup-cron-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export function GET(request: Request): Promise<Response> {
  return handleKnowledgeBackupCron(request, "daily");
}
