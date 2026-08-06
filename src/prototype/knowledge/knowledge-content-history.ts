export const KNOWLEDGE_CONTENT_HISTORY_LIMIT = 100;
export const KNOWLEDGE_CONTENT_HISTORY_COALESCE_MS = 800;

export type KnowledgeContentHistoryOrigin =
  | "baseline"
  | "typing"
  | "backspace"
  | "delete"
  | "paste"
  | "cut"
  | "replace"
  | "toolbar"
  | "programmatic"
  | "load"
  | "checklist";

export type KnowledgeContentHistoryEntry = {
  markdown: string;
  selectionStart: number | null;
  selectionEnd: number | null;
  origin: KnowledgeContentHistoryOrigin;
};

export type CommitKnowledgeContentChangeOptions = {
  documentId: string;
  markdown: string;
  selectionStart?: number | null;
  selectionEnd?: number | null;
  origin: Exclude<KnowledgeContentHistoryOrigin, "baseline">;
  timestamp?: number;
  coalesce?: boolean;
};

type DocumentHistory = {
  entries: KnowledgeContentHistoryEntry[];
  index: number;
  lastCommitTimestamp: number | null;
};

const COALESCIBLE_ORIGINS = new Set<KnowledgeContentHistoryOrigin>([
  "typing",
  "backspace",
  "delete",
]);

function selectionValue(value: number | null | undefined): number | null {
  return value ?? null;
}

function canCoalesce(
  previous: KnowledgeContentHistoryEntry,
  next: KnowledgeContentHistoryEntry,
  previousMarkdown: string,
  nextMarkdown: string,
): boolean {
  if (
    previous.selectionStart === null ||
    previous.selectionEnd === null ||
    next.selectionStart === null ||
    next.selectionEnd === null
  ) {
    return (
      previous.selectionStart === null &&
      previous.selectionEnd === null &&
      next.selectionStart === null &&
      next.selectionEnd === null
    );
  }
  if (
    previous.selectionStart !== previous.selectionEnd ||
    next.selectionStart !== next.selectionEnd
  ) {
    return false;
  }

  const delta = nextMarkdown.length - previousMarkdown.length;
  if (previous.origin === "typing") {
    return delta > 0 && next.selectionStart === previous.selectionStart + delta;
  }
  if (previous.origin === "backspace") {
    return delta < 0 && next.selectionStart === previous.selectionStart + delta;
  }
  return delta <= 0 && next.selectionStart === previous.selectionStart;
}

export class KnowledgeContentHistory {
  private readonly documents = new Map<string, DocumentHistory>();

  private readonly listeners = new Set<() => void>();

  private version = 0;

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getVersion(): number {
    return this.version;
  }

  private notify(): void {
    this.version += 1;
    for (const listener of this.listeners) listener();
  }

  private ensureRecord(documentId: string, markdown: string): DocumentHistory {
    const existing = this.documents.get(documentId);
    if (existing) return existing;
    const record: DocumentHistory = {
      entries: [
        {
          markdown,
          selectionStart: null,
          selectionEnd: null,
          origin: "baseline",
        },
      ],
      index: 0,
      lastCommitTimestamp: null,
    };
    this.documents.set(documentId, record);
    return record;
  }

  ensureDocument(documentId: string, markdown: string): void {
    this.ensureRecord(documentId, markdown);
  }

  resetDocument(documentId: string, markdown: string): void {
    this.documents.set(documentId, {
      entries: [
        {
          markdown,
          selectionStart: null,
          selectionEnd: null,
          origin: "baseline",
        },
      ],
      index: 0,
      lastCommitTimestamp: null,
    });
  }

  resetAll(
    documents: Iterable<{ documentId: string; markdown: string }>,
  ): void {
    this.documents.clear();
    for (const document of documents) {
      this.resetDocument(document.documentId, document.markdown);
    }
    this.notify();
  }

  commit(
    options: CommitKnowledgeContentChangeOptions,
  ): KnowledgeContentHistoryEntry | null {
    const record = this.ensureRecord(options.documentId, options.markdown);
    const current = record.entries[record.index];
    if (!current || current.markdown === options.markdown) return null;

    const next: KnowledgeContentHistoryEntry = {
      markdown: options.markdown,
      selectionStart: selectionValue(options.selectionStart),
      selectionEnd: selectionValue(options.selectionEnd),
      origin: options.origin,
    };
    const timestamp = options.timestamp ?? Date.now();
    const canJoinPrevious =
      options.coalesce !== false &&
      record.lastCommitTimestamp !== null &&
      timestamp >= record.lastCommitTimestamp &&
      timestamp - record.lastCommitTimestamp <=
        KNOWLEDGE_CONTENT_HISTORY_COALESCE_MS &&
      current.origin === options.origin &&
      COALESCIBLE_ORIGINS.has(options.origin) &&
      canCoalesce(current, next, current.markdown, options.markdown);

    if (canJoinPrevious) {
      record.entries[record.index] = next;
    } else {
      record.entries = record.entries.slice(0, record.index + 1);
      record.entries.push(next);
      if (record.entries.length > KNOWLEDGE_CONTENT_HISTORY_LIMIT) {
        record.entries.shift();
      }
      record.index = record.entries.length - 1;
    }
    record.lastCommitTimestamp = timestamp;
    this.notify();
    return next;
  }

  canUndo(documentId: string): boolean {
    const record = this.documents.get(documentId);
    return record !== undefined && record.index > 0;
  }

  canRedo(documentId: string): boolean {
    const record = this.documents.get(documentId);
    return record !== undefined && record.index < record.entries.length - 1;
  }

  undo(documentId: string): KnowledgeContentHistoryEntry | null {
    const record = this.documents.get(documentId);
    if (!record || record.index === 0) return null;
    record.index -= 1;
    record.lastCommitTimestamp = null;
    this.notify();
    return record.entries[record.index] ?? null;
  }

  redo(documentId: string): KnowledgeContentHistoryEntry | null {
    const record = this.documents.get(documentId);
    if (!record || record.index >= record.entries.length - 1) return null;
    record.index += 1;
    record.lastCommitTimestamp = null;
    this.notify();
    return record.entries[record.index] ?? null;
  }

  getCurrentEntry(documentId: string): KnowledgeContentHistoryEntry | null {
    const record = this.documents.get(documentId);
    return record?.entries[record.index] ?? null;
  }

  getEntries(documentId: string): KnowledgeContentHistoryEntry[] {
    return [...(this.documents.get(documentId)?.entries ?? [])];
  }
}
