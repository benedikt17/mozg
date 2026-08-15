import { NextResponse } from "next/server";
import { z } from "zod";

import {
  chunkProjectFileSearchText,
  extractProjectFileSearchText,
  isProjectFileSearchableMimeType,
  PROJECT_FILE_SEARCH_EXTRACTOR_VERSION,
} from "@/lib/files/project-file-search-content.server";
import {
  isProjectFileMimeType,
  PROJECT_FILES_BUCKET,
} from "@/lib/files/project-file-repository";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const requestSchema = z.object({
  workspaceId: z.string().uuid(),
  projectId: z.string().trim().min(1).max(128),
  fileId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(24).optional(),
});

type IndexCandidate = {
  id: string;
  workspace_id: string;
  project_id: string;
  storage_key: string;
  mime_type: string;
};

type IndexFailure = {
  fileId: string;
  reason: string;
};

export async function POST(request: Request): Promise<Response> {
  const parsed = requestSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const input = parsed.data;
  const { data: mayIndex, error: roleError } = await supabase.rpc(
    "has_workspace_role",
    {
      target_workspace_id: input.workspaceId,
      roles: ["owner", "editor"],
    },
  );
  if (roleError) {
    return NextResponse.json({ error: "authorization-failed" }, { status: 403 });
  }
  if (!mayIndex) {
    return NextResponse.json({ indexed: 0, failures: [], readOnly: true });
  }

  const candidatesResult = input.fileId
    ? await supabase
        .from("project_files")
        .select("id,workspace_id,project_id,storage_key,mime_type")
        .eq("workspace_id", input.workspaceId)
        .eq("project_id", input.projectId)
        .eq("id", input.fileId)
        .not("ready_at", "is", null)
        .is("deleted_at", null)
        .maybeSingle()
    : await supabase.rpc("list_project_files_needing_search_content", {
        target_workspace_id: input.workspaceId,
        target_project_id: input.projectId,
        target_extractor_version: PROJECT_FILE_SEARCH_EXTRACTOR_VERSION,
        target_limit: input.limit ?? 8,
      });

  if (candidatesResult.error) {
    return NextResponse.json({ error: "candidate-query-failed" }, { status: 500 });
  }

  const rawCandidates = input.fileId
    ? candidatesResult.data
      ? [candidatesResult.data]
      : []
    : (candidatesResult.data ?? []);
  const candidates: IndexCandidate[] = rawCandidates.map((row) => ({
    id: row.id,
    workspace_id: row.workspace_id,
    project_id: row.project_id,
    storage_key: row.storage_key,
    mime_type: row.mime_type,
  }));

  const failures: IndexFailure[] = [];
  let indexed = 0;
  for (const candidate of candidates) {
    if (
      candidate.workspace_id !== input.workspaceId ||
      candidate.project_id !== input.projectId ||
      !isProjectFileMimeType(candidate.mime_type) ||
      !isProjectFileSearchableMimeType(candidate.mime_type)
    ) {
      continue;
    }

    try {
      const { data: original, error: downloadError } = await supabase.storage
        .from(PROJECT_FILES_BUCKET)
        .download(candidate.storage_key);
      if (downloadError || !(original instanceof Blob)) {
        throw downloadError ?? new Error("Project file download returned no Blob.");
      }

      const extractedText = await extractProjectFileSearchText(
        original,
        candidate.mime_type,
      );
      const chunks = chunkProjectFileSearchText(extractedText);
      const { error: indexError } = await supabase.rpc(
        "upsert_project_file_search_content",
        {
          target_workspace_id: input.workspaceId,
          target_project_id: input.projectId,
          target_file_id: candidate.id,
          target_chunks: chunks,
          target_extractor_version: PROJECT_FILE_SEARCH_EXTRACTOR_VERSION,
        },
      );
      if (indexError) throw indexError;
      indexed += 1;
    } catch (cause) {
      failures.push({
        fileId: candidate.id,
        reason: cause instanceof Error ? cause.message : "indexing-failed",
      });
    }
  }

  return NextResponse.json({ indexed, failures, readOnly: false });
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
