"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useDesktopTaskRuntime } from "@/prototype/tasks/desktop-task-runtime";
import { desktopPrototypeReducer } from "@/prototype/desktop-state";
import type { DesktopPrototypeAction } from "@/prototype/state/types";
import { createKnowledgeStructuralHistoryEntry } from "@/prototype/state/knowledge-state";
import {
  KnowledgeContentHistory,
  type KnowledgeContentHistoryOrigin,
} from "./knowledge-content-history";
import {
  KnowledgeStructuralHistory,
  type KnowledgeStructuralHistoryEntry,
} from "./knowledge-structural-history";

type CommitOptions = {
  selectionStart?: number | null;
  selectionEnd?: number | null;
  origin: Exclude<KnowledgeContentHistoryOrigin, "baseline">;
  timestamp?: number;
  coalesce?: boolean;
};

type KnowledgeContentHistoryContextValue = {
  version: number;
  commitMarkdown: (
    documentId: string,
    markdown: string,
    options: CommitOptions,
  ) => void;
  undo: (documentId: string) => void;
  redo: (documentId: string) => void;
  canUndo: (documentId: string) => boolean;
  canRedo: (documentId: string) => boolean;
  getSelection: (
    documentId: string,
  ) => { start: number | null; end: number | null } | null;
  dispatchKnowledgeAction: React.Dispatch<DesktopPrototypeAction>;
  activateContentScope: (documentId: string) => void;
  activateStructuralScope: () => void;
  canUndoActive: (documentId: string | undefined) => boolean;
  canRedoActive: (documentId: string | undefined) => boolean;
  undoActive: (documentId: string | undefined) => void;
  redoActive: (documentId: string | undefined) => void;
  getUndoTitle: (documentId: string | undefined) => string;
  getRedoTitle: (documentId: string | undefined) => string;
};

export type KnowledgeUndoScope =
  { kind: "content"; documentId: string } | { kind: "structure" };

export function activateKnowledgeContentScope(
  currentScope: KnowledgeUndoScope | null,
  documentId: string,
): KnowledgeUndoScope {
  if (
    currentScope?.kind === "content" &&
    currentScope.documentId === documentId
  ) {
    return currentScope;
  }
  return { documentId, kind: "content" };
}

function isStructuralAction(action: DesktopPrototypeAction): boolean {
  return [
    "create-knowledge-document",
    "create-knowledge-folder",
    "rename-knowledge-folder",
    "delete-knowledge-folder",
    "soft-delete-knowledge-document",
    "restore-knowledge-document",
    "move-knowledge-document",
  ].includes(action.type);
}

const KnowledgeContentHistoryContext = createContext<
  KnowledgeContentHistoryContextValue | undefined
>(undefined);

export function KnowledgeContentHistoryProvider({
  children,
}: {
  children?: ReactNode;
}): React.JSX.Element {
  const { dispatch, persistence, state } = useDesktopTaskRuntime();
  const [history] = useState(() => new KnowledgeContentHistory());
  const [structuralHistory] = useState(() => new KnowledgeStructuralHistory());
  const [version, setVersion] = useState(() => history.getVersion());
  const [scope, setScope] = useState<KnowledgeUndoScope | null>(null);
  const hydratedRef = useRef(false);
  const structuralWorkspaceRef = useRef<string | null>(null);

  useEffect(
    () => history.subscribe(() => setVersion(history.getVersion())),
    [history],
  );
  useEffect(
    () =>
      structuralHistory.subscribe(() => setVersion((current) => current + 1)),
    [structuralHistory],
  );

  useEffect(() => {
    if (persistence.lifecycle.status === "load-error") {
      hydratedRef.current = false;
      return;
    }
    if (persistence.lifecycle.status !== "ready" || hydratedRef.current) {
      return;
    }
    history.resetAll(
      state.documents.map((document) => ({
        documentId: document.id,
        markdown: document.content.join("\n"),
      })),
    );
    hydratedRef.current = true;
  }, [history, persistence.lifecycle.status, state.documents]);

  useEffect(() => {
    if (structuralWorkspaceRef.current === state.activeProjectId) return;
    structuralWorkspaceRef.current = state.activeProjectId;
    structuralHistory.reset();
    setScope(null);
  }, [state.activeProjectId, structuralHistory]);

  const commitMarkdown = useCallback(
    (documentId: string, markdown: string, options: CommitOptions): void => {
      const document = state.documents.find((item) => item.id === documentId);
      if (!document) return;
      setScope({ documentId, kind: "content" });
      history.ensureDocument(documentId, document.content.join("\n"));
      const entry = history.commit({
        documentId,
        markdown,
        ...options,
      });
      if (!entry) return;
      dispatch({
        type: "update-knowledge-document-markdown",
        documentId,
        markdown,
      });
    },
    [dispatch, history, state.documents],
  );

  const applyHistoryEntry = useCallback(
    (documentId: string, markdown: string): void => {
      dispatch({
        type: "update-knowledge-document-markdown",
        documentId,
        markdown,
      });
    },
    [dispatch],
  );

  const undo = useCallback(
    (documentId: string): void => {
      setScope({ documentId, kind: "content" });
      const entry = history.undo(documentId);
      if (entry) applyHistoryEntry(documentId, entry.markdown);
    },
    [applyHistoryEntry, history],
  );

  const redo = useCallback(
    (documentId: string): void => {
      setScope({ documentId, kind: "content" });
      const entry = history.redo(documentId);
      if (entry) applyHistoryEntry(documentId, entry.markdown);
    },
    [applyHistoryEntry, history],
  );

  const getSelection = useCallback(
    (
      documentId: string,
    ): { start: number | null; end: number | null } | null => {
      const entry = history.getCurrentEntry(documentId);
      if (!entry) return null;
      return { end: entry.selectionEnd, start: entry.selectionStart };
    },
    [history],
  );

  const activateContentScope = useCallback((documentId: string): void => {
    setScope((currentScope) =>
      activateKnowledgeContentScope(currentScope, documentId),
    );
  }, []);

  const activateStructuralScope = useCallback((): void => {
    setScope({ kind: "structure" });
  }, []);

  const dispatchKnowledgeAction = useCallback<
    React.Dispatch<DesktopPrototypeAction>
  >(
    (action): void => {
      if (!isStructuralAction(action)) {
        dispatch(action);
        return;
      }
      const nextState = desktopPrototypeReducer(state, action);
      const entry = createKnowledgeStructuralHistoryEntry(
        state,
        nextState,
        action,
      );
      if (entry) {
        structuralHistory.commit(entry);
        setScope({ kind: "structure" });
      }
      dispatch(action);
    },
    [dispatch, state, structuralHistory],
  );

  const activeScope = useCallback(
    (documentId: string | undefined): KnowledgeUndoScope | null => {
      if (scope?.kind === "structure") return scope;
      if (documentId) return { documentId, kind: "content" };
      return scope;
    },
    [scope],
  );

  const canUndoActive = useCallback(
    (documentId: string | undefined): boolean => {
      const currentScope = activeScope(documentId);
      return currentScope?.kind === "structure"
        ? structuralHistory.canUndo()
        : currentScope?.kind === "content"
          ? history.canUndo(currentScope.documentId)
          : false;
    },
    [activeScope, history, structuralHistory],
  );

  const canRedoActive = useCallback(
    (documentId: string | undefined): boolean => {
      const currentScope = activeScope(documentId);
      return currentScope?.kind === "structure"
        ? structuralHistory.canRedo()
        : currentScope?.kind === "content"
          ? history.canRedo(currentScope.documentId)
          : false;
    },
    [activeScope, history, structuralHistory],
  );

  const applyStructuralEntry = useCallback(
    (entry: KnowledgeStructuralHistoryEntry, direction: "undo" | "redo") => {
      dispatch({
        type: "apply-knowledge-structural-history",
        entry,
        direction,
      });
      setScope({ kind: "structure" });
    },
    [dispatch],
  );

  const undoActive = useCallback(
    (documentId: string | undefined): void => {
      const currentScope = activeScope(documentId);
      if (currentScope?.kind === "content") {
        undo(currentScope.documentId);
        return;
      }
      const pendingEntry = structuralHistory.getUndoEntry();
      if (
        pendingEntry?.kind === "create-document" &&
        history.canUndo(pendingEntry.document.id)
      ) {
        undo(pendingEntry.document.id);
        return;
      }
      const entry = structuralHistory.undo();
      if (entry) applyStructuralEntry(entry, "undo");
    },
    [activeScope, applyStructuralEntry, history, structuralHistory, undo],
  );

  const redoActive = useCallback(
    (documentId: string | undefined): void => {
      const currentScope = activeScope(documentId);
      if (currentScope?.kind === "content") {
        redo(currentScope.documentId);
        return;
      }
      const entry = structuralHistory.redo();
      if (entry) applyStructuralEntry(entry, "redo");
    },
    [activeScope, applyStructuralEntry, redo, structuralHistory],
  );

  const getUndoTitle = useCallback(
    (documentId: string | undefined): string => {
      const currentScope = activeScope(documentId);
      const entry =
        currentScope?.kind === "structure"
          ? structuralHistory.getUndoEntry()
          : null;
      return entry ? `Отменить: ${entry.label} (Ctrl+Z)` : "Отменить";
    },
    [activeScope, structuralHistory],
  );

  const getRedoTitle = useCallback(
    (documentId: string | undefined): string => {
      const currentScope = activeScope(documentId);
      const entry =
        currentScope?.kind === "structure"
          ? structuralHistory.getRedoEntry()
          : null;
      return entry
        ? `Повторить: ${entry.label} (Ctrl+Shift+Z / Ctrl+Y)`
        : "Повторить";
    },
    [activeScope, structuralHistory],
  );

  const value = useMemo<KnowledgeContentHistoryContextValue>(
    () => ({
      canRedo: (documentId) => history.canRedo(documentId),
      canUndo: (documentId) => history.canUndo(documentId),
      commitMarkdown,
      activateContentScope,
      activateStructuralScope,
      canRedoActive,
      canUndoActive,
      dispatchKnowledgeAction,
      getSelection,
      getRedoTitle,
      getUndoTitle,
      redo,
      redoActive,
      undo,
      undoActive,
      version,
    }),
    [
      activateContentScope,
      activateStructuralScope,
      canRedoActive,
      canUndoActive,
      commitMarkdown,
      dispatchKnowledgeAction,
      getRedoTitle,
      getSelection,
      getUndoTitle,
      history,
      redo,
      redoActive,
      undo,
      undoActive,
      version,
    ],
  );

  return (
    <KnowledgeContentHistoryContext.Provider value={value}>
      {children}
    </KnowledgeContentHistoryContext.Provider>
  );
}

export function useKnowledgeContentHistory(): KnowledgeContentHistoryContextValue {
  const value = useContext(KnowledgeContentHistoryContext);
  if (!value) {
    throw new Error(
      "useKnowledgeContentHistory must be used within KnowledgeContentHistoryProvider.",
    );
  }
  return value;
}
