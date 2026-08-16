import type { DesktopDomainSnapshot } from "@/prototype/persistence/domain-snapshot";
import { desktopPrototypeReducer } from "@/prototype/state/desktop-state";
import {
  getActiveDocumentById,
  getDocumentFolderPath,
} from "@/prototype/state/knowledge-state";
import type { DesktopPrototypeState } from "@/prototype/state/types";

function uniqueDocumentIds(ids: Array<string | null>): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

/**
 * Applies a fresh persisted domain snapshot without reusing startup hydration's
 * intentionally destructive Knowledge session reset. Persistent collections
 * always come from the server; only still-valid local reading/navigation state
 * is restored.
 */
export function refreshDesktopDomain(
  state: DesktopPrototypeState,
  snapshot: DesktopDomainSnapshot,
): DesktopPrototypeState {
  const hydrated = desktopPrototypeReducer(state, {
    type: "hydrate-domain",
    snapshot,
  });
  if (hydrated === state) return state;

  const activeProjectPreserved =
    hydrated.activeProjectId === state.activeProjectId;
  if (!activeProjectPreserved) return hydrated;

  const selectedDocument = getActiveDocumentById(
    hydrated,
    state.selectedDocumentId,
    hydrated.activeProjectId,
  );
  if (!selectedDocument) return hydrated;

  const selectedPath = getDocumentFolderPath(selectedDocument);
  const splitDocument = state.knowledgeSplitEnabled
    ? getActiveDocumentById(
        hydrated,
        state.splitViewDocumentId,
        hydrated.activeProjectId,
      )
    : undefined;
  const splitEnabled = Boolean(
    splitDocument && splitDocument.id !== selectedDocument.id,
  );
  const activePane =
    splitEnabled && state.activeKnowledgePane === "secondary"
      ? "secondary"
      : "primary";
  const validDocumentIds = new Set(
    hydrated.documents
      .filter(
        (document) =>
          document.projectId === hydrated.activeProjectId &&
          document.deletedAt === undefined,
      )
      .map((document) => document.id),
  );
  const openDocumentIds = uniqueDocumentIds([
    ...state.openDocumentIds.filter((id) => validDocumentIds.has(id)),
    selectedDocument.id,
    splitEnabled ? splitDocument?.id ?? null : null,
  ]);

  return {
    ...hydrated,
    selectedDocumentId: selectedDocument.id,
    selectedDocumentFolder: selectedDocument.folder ?? null,
    selectedKnowledgeFolderPath: selectedPath,
    selectedKnowledgePath: {
      kind: "document",
      path: selectedPath,
      documentId: selectedDocument.id,
    },
    knowledgeBreadcrumbHighlightVisible:
      state.knowledgeBreadcrumbHighlightVisible,
    expandedFolderIds: state.expandedFolderIds,
    knowledgeExpandedBeforeCollapse: state.knowledgeExpandedBeforeCollapse,
    knowledgeSearchQuery: state.knowledgeSearchQuery,
    knowledgeWorkspaceView: state.knowledgeWorkspaceView,
    openDocumentIds,
    documentHistoryBack: state.documentHistoryBack.filter((id) =>
      validDocumentIds.has(id),
    ),
    documentHistoryForward: state.documentHistoryForward.filter((id) =>
      validDocumentIds.has(id),
    ),
    knowledgeContextMode: state.knowledgeContextMode,
    knowledgeSplitEnabled: splitEnabled,
    splitViewDocumentId: splitEnabled ? splitDocument?.id ?? null : null,
    activeKnowledgePane: activePane,
    editingKnowledgeDocumentId: null,
  };
}
