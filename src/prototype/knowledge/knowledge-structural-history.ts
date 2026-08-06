import type { PrototypeDocument } from "@/prototype/desktop-mock-data";
import type { PrototypeKnowledgeFolder } from "@/prototype/state/types";

export const KNOWLEDGE_STRUCTURAL_HISTORY_LIMIT = 100;

export type KnowledgeDocumentPlacement = {
  id: string;
  folder: string;
  folderPath: string[] | undefined;
  order: number | undefined;
  deletedAt: string | undefined;
};

type KnowledgeStructuralHistoryBase = {
  id: string;
  label: string;
};

export type CreateDocumentEntry = KnowledgeStructuralHistoryBase & {
  kind: "create-document";
  document: PrototypeDocument;
  previousSelectedDocumentId: string | null;
  wasOpened: boolean;
};

export type CreateFolderEntry = KnowledgeStructuralHistoryBase & {
  kind: "create-folder";
  folder: PrototypeKnowledgeFolder;
};

export type RenameFolderEntry = KnowledgeStructuralHistoryBase & {
  kind: "rename-folder";
  projectId: string;
  oldPath: string[];
  newPath: string[];
};

export type MoveDocumentEntry = KnowledgeStructuralHistoryBase & {
  kind: "move-document";
  documentId: string;
  before: KnowledgeDocumentPlacement[];
  after: KnowledgeDocumentPlacement[];
};

export type DeleteFolderEntry = KnowledgeStructuralHistoryBase & {
  kind: "delete-folder";
  projectId: string;
  folderPath: string[];
  folders: PrototypeKnowledgeFolder[];
  documents: KnowledgeDocumentPlacement[];
};

export type DocumentVisibilityEntry = KnowledgeStructuralHistoryBase & {
  kind: "soft-delete-document" | "restore-document";
  documentId: string;
  before: KnowledgeDocumentPlacement;
  after: KnowledgeDocumentPlacement;
  beforeSelected: boolean;
  beforeOpened: boolean;
  afterSelected: boolean;
  afterOpened: boolean;
};

export type KnowledgeStructuralHistoryEntry =
  | CreateDocumentEntry
  | CreateFolderEntry
  | RenameFolderEntry
  | MoveDocumentEntry
  | DeleteFolderEntry
  | DocumentVisibilityEntry;

export class KnowledgeStructuralHistory {
  private entries: KnowledgeStructuralHistoryEntry[] = [];

  private index = -1;

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

  reset(): void {
    this.entries = [];
    this.index = -1;
    this.notify();
  }

  commit(entry: KnowledgeStructuralHistoryEntry): void {
    this.entries = [...this.entries.slice(0, this.index + 1), entry];
    if (this.entries.length > KNOWLEDGE_STRUCTURAL_HISTORY_LIMIT) {
      this.entries.shift();
    }
    this.index = this.entries.length - 1;
    this.notify();
  }

  canUndo(): boolean {
    return this.index >= 0;
  }

  canRedo(): boolean {
    return this.index < this.entries.length - 1;
  }

  getUndoEntry(): KnowledgeStructuralHistoryEntry | null {
    return this.entries[this.index] ?? null;
  }

  getRedoEntry(): KnowledgeStructuralHistoryEntry | null {
    return this.entries[this.index + 1] ?? null;
  }

  undo(): KnowledgeStructuralHistoryEntry | null {
    const entry = this.getUndoEntry();
    if (!entry) return null;
    this.index -= 1;
    this.notify();
    return entry;
  }

  redo(): KnowledgeStructuralHistoryEntry | null {
    const entry = this.getRedoEntry();
    if (!entry) return null;
    this.index += 1;
    this.notify();
    return entry;
  }

  getEntries(): KnowledgeStructuralHistoryEntry[] {
    return [...this.entries];
  }
}
