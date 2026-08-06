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
import {
  KnowledgeContentHistory,
  type KnowledgeContentHistoryOrigin,
} from "./knowledge-content-history";

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
};

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
  const [version, setVersion] = useState(() => history.getVersion());
  const hydratedRef = useRef(false);

  useEffect(
    () => history.subscribe(() => setVersion(history.getVersion())),
    [history],
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

  const commitMarkdown = useCallback(
    (documentId: string, markdown: string, options: CommitOptions): void => {
      const document = state.documents.find((item) => item.id === documentId);
      if (!document) return;
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
      const entry = history.undo(documentId);
      if (entry) applyHistoryEntry(documentId, entry.markdown);
    },
    [applyHistoryEntry, history],
  );

  const redo = useCallback(
    (documentId: string): void => {
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

  const value = useMemo<KnowledgeContentHistoryContextValue>(
    () => ({
      canRedo: (documentId) => history.canRedo(documentId),
      canUndo: (documentId) => history.canUndo(documentId),
      commitMarkdown,
      getSelection,
      redo,
      undo,
      version,
    }),
    [commitMarkdown, getSelection, history, redo, undo, version],
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
