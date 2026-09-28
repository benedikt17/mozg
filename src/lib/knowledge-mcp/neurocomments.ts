import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Knowledge comments unavailable");
  return createClient<Database>(getPublicEnv().NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function exactQuoteAnchor(markdown: string, quote: string) {
  const start = markdown.indexOf(quote);
  if (start < 0 || markdown.indexOf(quote, start + quote.length) >= 0)
    return null;
  return {
    start_offset: start,
    end_offset: start + quote.length,
    prefix: markdown.slice(Math.max(0, start - 96), start),
    suffix: markdown.slice(start + quote.length, start + quote.length + 96),
  };
}

export async function listOwnKnowledgeComments(
  userId: string,
  workspaceId: string,
  documentId: string,
  offset: number,
  limit: number,
) {
  const { data, error, count } = await admin()
    .from("knowledge_annotations")
    .select("id, selected_text, comment, resolved_at, created_at", {
      count: "exact",
    })
    .eq("workspace_id", workspaceId)
    .eq("document_id", documentId)
    .eq("created_by", userId)
    .eq("kind", "human")
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw new Error("Cannot read Knowledge comments");
  if (count === null) throw new Error("Cannot count Knowledge comments");
  return {
    items: data ?? [],
    total: count,
    nextOffset: offset + limit < count ? offset + limit : null,
  };
}

export async function createNeurocomment(input: {
  userId: string;
  workspaceId: string;
  documentId: string;
  revision: number;
  markdown: string;
  quote: string;
  comment: string;
  suggestedText?: string;
  operation?: "replace" | "delete" | "insert_before" | "insert_after";
}) {
  const quote = input.quote;
  const anchor = exactQuoteAnchor(input.markdown, quote);
  if (!anchor) return { kind: "quote-not-unique" as const };
  const db = admin();
  const { data: membership, error: roleError } = await db
    .from("workspace_members")
    .select("role")
    .eq("user_id", input.userId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();
  if (roleError || membership?.role !== "owner")
    return { kind: "forbidden" as const };
  const { data: latest, error: snapshotError } = await db
    .from("workspace_snapshots")
    .select("revision")
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();
  if (snapshotError || latest?.revision !== input.revision)
    return { kind: "conflict" as const };
  const { data, error } = await db
    .from("knowledge_annotations")
    .insert({
      workspace_id: input.workspaceId,
      document_id: input.documentId,
      created_by: input.userId,
      kind: "agent",
      selected_text: quote,
      ...anchor,
      comment: input.comment,
      suggested_text: input.suggestedText ?? null,
      proposal_action: input.operation ?? "replace",
      source_revision: input.revision,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("Cannot create neurocomment");
  return { kind: "created" as const, id: data.id };
}

export async function createNeuroDraft(input: {
  userId: string;
  workspaceId: string;
  projectId: string;
  folderPath: string[];
  documents: { title: string; markdown: string }[];
  revision: number;
}) {
  const db = admin();
  const { data: membership, error: memberError } = await db
    .from("workspace_members")
    .select("role")
    .eq("user_id", input.userId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();
  if (memberError || membership?.role !== "owner")
    return { kind: "forbidden" as const };
  const { data: latest, error: snapshotError } = await db
    .from("workspace_snapshots")
    .select("revision")
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();
  if (snapshotError || latest?.revision !== input.revision)
    return { kind: "conflict" as const };
  const { data, error } = await db
    .from("knowledge_neuro_drafts")
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      project_id: input.projectId,
      folder_path: input.folderPath,
      documents: input.documents.map((document) => ({
        ...document,
        selected: true,
      })),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("Cannot create Knowledge draft");
  return { kind: "created" as const, id: data.id };
}
