"use client";

import { createClient } from "@/lib/supabase/browser";

const ANNOTATION_SCHEMA_VERSION = 1 as const;
const ANCHOR_CONTEXT_LENGTH = 96;

export type KnowledgeAnnotationPersistenceMode = "cloud" | "preview-local";

export type KnowledgeAnnotation = {
  schemaVersion: typeof ANNOTATION_SCHEMA_VERSION;
  id: string;
  workspaceId: string;
  documentId: string;
  createdBy: string;
  selectedText: string;
  startOffset: number;
  endOffset: number;
  prefix: string;
  suffix: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export type KnowledgeAnnotationSelection = Pick<
  KnowledgeAnnotation,
  "selectedText" | "startOffset" | "endOffset" | "prefix" | "suffix"
>;

export type KnowledgeAnnotationLoadResult = {
  annotations: KnowledgeAnnotation[];
  userId: string;
  persistenceMode: KnowledgeAnnotationPersistenceMode;
};

type KnowledgeAnnotationRow = {
  comment: string;
  created_at: string;
  created_by: string;
  document_id: string;
  end_offset: number;
  id: string;
  prefix: string;
  resolved_at: string | null;
  schema_version: number;
  selected_text: string;
  start_offset: number;
  suffix: string;
  updated_at: string;
  workspace_id: string;
};

function encodePathSegment(value: string): string {
  return encodeURIComponent(value).replace(/%2F/giu, "%252F");
}

export function getKnowledgeAnnotationPrefix(
  workspaceId: string,
  userId: string,
  documentId: string,
): string {
  return `${workspaceId}/${userId}/${encodePathSegment(documentId)}`;
}

function getLocalStorageKey(
  workspaceId: string,
  userId: string,
  documentId: string,
): string {
  return `mozg:knowledge-annotations:${getKnowledgeAnnotationPrefix(
    workspaceId,
    userId,
    documentId,
  )}`;
}

function isFiniteNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function parseKnowledgeAnnotation(
  value: unknown,
): KnowledgeAnnotation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.schemaVersion !== ANNOTATION_SCHEMA_VERSION ||
    typeof candidate.id !== "string" ||
    candidate.id.length === 0 ||
    typeof candidate.workspaceId !== "string" ||
    candidate.workspaceId.length === 0 ||
    typeof candidate.documentId !== "string" ||
    candidate.documentId.length === 0 ||
    typeof candidate.createdBy !== "string" ||
    candidate.createdBy.length === 0 ||
    typeof candidate.selectedText !== "string" ||
    candidate.selectedText.trim().length === 0 ||
    candidate.selectedText.length > 20_000 ||
    !isFiniteNonNegativeInteger(candidate.startOffset) ||
    !isFiniteNonNegativeInteger(candidate.endOffset) ||
    candidate.endOffset < candidate.startOffset ||
    typeof candidate.prefix !== "string" ||
    candidate.prefix.length > ANCHOR_CONTEXT_LENGTH ||
    typeof candidate.suffix !== "string" ||
    candidate.suffix.length > ANCHOR_CONTEXT_LENGTH ||
    typeof candidate.comment !== "string" ||
    candidate.comment.trim().length === 0 ||
    candidate.comment.length > 10_000 ||
    typeof candidate.createdAt !== "string" ||
    !Number.isFinite(Date.parse(candidate.createdAt)) ||
    typeof candidate.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(candidate.updatedAt)) ||
    !(
      candidate.resolvedAt === null ||
      (typeof candidate.resolvedAt === "string" &&
        Number.isFinite(Date.parse(candidate.resolvedAt)))
    )
  ) {
    return null;
  }
  return candidate as KnowledgeAnnotation;
}

export function createKnowledgeAnnotationSelection(
  rootText: string,
  selectedText: string,
  startOffset: number,
  endOffset: number,
): KnowledgeAnnotationSelection | null {
  if (
    selectedText.trim().length === 0 ||
    selectedText.length > 20_000 ||
    !Number.isSafeInteger(startOffset) ||
    !Number.isSafeInteger(endOffset) ||
    startOffset < 0 ||
    endOffset < startOffset ||
    endOffset > rootText.length
  ) {
    return null;
  }
  return {
    selectedText,
    startOffset,
    endOffset,
    prefix: rootText.slice(
      Math.max(0, startOffset - ANCHOR_CONTEXT_LENGTH),
      startOffset,
    ),
    suffix: rootText.slice(
      endOffset,
      Math.min(rootText.length, endOffset + ANCHOR_CONTEXT_LENGTH),
    ),
  };
}

function matchingSuffixLength(left: string, right: string): number {
  const maximum = Math.min(left.length, right.length);
  let length = 0;
  while (
    length < maximum &&
    left[left.length - 1 - length] === right[right.length - 1 - length]
  ) {
    length += 1;
  }
  return length;
}

function matchingPrefixLength(left: string, right: string): number {
  const maximum = Math.min(left.length, right.length);
  let length = 0;
  while (length < maximum && left[length] === right[length]) length += 1;
  return length;
}

export function resolveKnowledgeAnnotationOffset(
  text: string,
  annotation: Pick<
    KnowledgeAnnotation,
    "selectedText" | "startOffset" | "endOffset" | "prefix" | "suffix"
  >,
): { startOffset: number; endOffset: number } | null {
  const quote = annotation.selectedText;
  if (quote.length === 0) return null;
  if (
    annotation.startOffset >= 0 &&
    annotation.endOffset <= text.length &&
    text.slice(annotation.startOffset, annotation.endOffset) === quote
  ) {
    return {
      startOffset: annotation.startOffset,
      endOffset: annotation.endOffset,
    };
  }

  const candidates: Array<{
    startOffset: number;
    score: number;
    distance: number;
  }> = [];
  let searchFrom = 0;
  while (searchFrom <= text.length - quote.length) {
    const startOffset = text.indexOf(quote, searchFrom);
    if (startOffset < 0) break;
    const endOffset = startOffset + quote.length;
    const before = text.slice(
      Math.max(0, startOffset - annotation.prefix.length),
      startOffset,
    );
    const after = text.slice(endOffset, endOffset + annotation.suffix.length);
    const score =
      matchingSuffixLength(before, annotation.prefix) +
      matchingPrefixLength(after, annotation.suffix);
    candidates.push({
      startOffset,
      score,
      distance: Math.abs(startOffset - annotation.startOffset),
    });
    searchFrom = startOffset + Math.max(1, quote.length);
  }
  if (candidates.length === 0) return null;
  candidates.sort((left, right) =>
    right.score !== left.score
      ? right.score - left.score
      : left.distance - right.distance,
  );
  const winner = candidates[0]!;
  return {
    startOffset: winner.startOffset,
    endOffset: winner.startOffset + quote.length,
  };
}

function sortAnnotations(
  annotations: KnowledgeAnnotation[],
): KnowledgeAnnotation[] {
  return [...annotations].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
}

function loadLocalAnnotations(
  workspaceId: string,
  userId: string,
  documentId: string,
): KnowledgeAnnotation[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(
    getLocalStorageKey(workspaceId, userId, documentId),
  );
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return sortAnnotations(
      parsed
        .map(parseKnowledgeAnnotation)
        .filter((item): item is KnowledgeAnnotation => item !== null)
        .filter(
          (item) =>
            item.workspaceId === workspaceId &&
            item.documentId === documentId &&
            item.createdBy === userId,
        ),
    );
  } catch {
    return [];
  }
}

function writeLocalAnnotations(
  workspaceId: string,
  userId: string,
  documentId: string,
  annotations: KnowledgeAnnotation[],
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    getLocalStorageKey(workspaceId, userId, documentId),
    JSON.stringify(sortAnnotations(annotations)),
  );
}

function clearLocalAnnotations(
  workspaceId: string,
  userId: string,
  documentId: string,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(
    getLocalStorageKey(workspaceId, userId, documentId),
  );
}

function rowToAnnotation(row: KnowledgeAnnotationRow): KnowledgeAnnotation | null {
  return parseKnowledgeAnnotation({
    schemaVersion: row.schema_version,
    id: row.id,
    workspaceId: row.workspace_id,
    documentId: row.document_id,
    createdBy: row.created_by,
    selectedText: row.selected_text,
    startOffset: row.start_offset,
    endOffset: row.end_offset,
    prefix: row.prefix,
    suffix: row.suffix,
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
  });
}

function annotationToRow(annotation: KnowledgeAnnotation): KnowledgeAnnotationRow {
  return {
    id: annotation.id,
    workspace_id: annotation.workspaceId,
    document_id: annotation.documentId,
    created_by: annotation.createdBy,
    schema_version: annotation.schemaVersion,
    selected_text: annotation.selectedText,
    start_offset: annotation.startOffset,
    end_offset: annotation.endOffset,
    prefix: annotation.prefix,
    suffix: annotation.suffix,
    comment: annotation.comment,
    created_at: annotation.createdAt,
    updated_at: annotation.updatedAt,
    resolved_at: annotation.resolvedAt,
  };
}

async function getAuthenticatedUserId(): Promise<string> {
  const client = createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw error ?? new Error("Unauthenticated");
  return data.user.id;
}

async function migrateLocalAnnotations(
  workspaceId: string,
  userId: string,
  documentId: string,
): Promise<void> {
  const localAnnotations = loadLocalAnnotations(
    workspaceId,
    userId,
    documentId,
  );
  if (localAnnotations.length === 0) return;

  const client = createClient();
  const { error } = await client
    .from("knowledge_annotations")
    .upsert(localAnnotations.map(annotationToRow), { onConflict: "id" });
  if (error) throw error;
  clearLocalAnnotations(workspaceId, userId, documentId);
}

export async function loadKnowledgeAnnotations(
  workspaceId: string,
  documentId: string,
): Promise<KnowledgeAnnotationLoadResult> {
  const userId = await getAuthenticatedUserId();
  await migrateLocalAnnotations(workspaceId, userId, documentId);

  const client = createClient();
  const { data, error } = await client
    .from("knowledge_annotations")
    .select(
      "id, workspace_id, document_id, created_by, schema_version, selected_text, start_offset, end_offset, prefix, suffix, comment, resolved_at, created_at, updated_at",
    )
    .eq("workspace_id", workspaceId)
    .eq("document_id", documentId)
    .eq("created_by", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  return {
    annotations: sortAnnotations(
      (data ?? [])
        .map((row) => rowToAnnotation(row as KnowledgeAnnotationRow))
        .filter((item): item is KnowledgeAnnotation => item !== null),
    ),
    userId,
    persistenceMode: "cloud",
  };
}

export async function createKnowledgeAnnotation(
  annotation: KnowledgeAnnotation,
  persistenceMode: KnowledgeAnnotationPersistenceMode,
): Promise<void> {
  if (persistenceMode === "preview-local") {
    const current = loadLocalAnnotations(
      annotation.workspaceId,
      annotation.createdBy,
      annotation.documentId,
    );
    writeLocalAnnotations(
      annotation.workspaceId,
      annotation.createdBy,
      annotation.documentId,
      [...current.filter((item) => item.id !== annotation.id), annotation],
    );
    return;
  }

  const client = createClient();
  const { error } = await client
    .from("knowledge_annotations")
    .insert(annotationToRow(annotation));
  if (error) throw error;
}

export async function updateKnowledgeAnnotation(
  annotation: KnowledgeAnnotation,
  persistenceMode: KnowledgeAnnotationPersistenceMode,
): Promise<void> {
  if (persistenceMode === "preview-local") {
    const current = loadLocalAnnotations(
      annotation.workspaceId,
      annotation.createdBy,
      annotation.documentId,
    );
    writeLocalAnnotations(
      annotation.workspaceId,
      annotation.createdBy,
      annotation.documentId,
      [...current.filter((item) => item.id !== annotation.id), annotation],
    );
    return;
  }

  const client = createClient();
  const { error } = await client
    .from("knowledge_annotations")
    .update({
      selected_text: annotation.selectedText,
      start_offset: annotation.startOffset,
      end_offset: annotation.endOffset,
      prefix: annotation.prefix,
      suffix: annotation.suffix,
      comment: annotation.comment,
      resolved_at: annotation.resolvedAt,
    })
    .eq("id", annotation.id)
    .eq("workspace_id", annotation.workspaceId)
    .eq("created_by", annotation.createdBy);
  if (error) throw error;
}
