import type { PrototypeDocument } from "@/prototype/desktop-mock-data";
import type {
  DesktopPrototypeState,
  KnowledgeContextMode,
  KnowledgePaneState,
  KnowledgePane,
  KnowledgeTreeNode,
} from "@/prototype/state/types";

const documentFolderPathOverrides: Record<string, string[]> = {
  "doc-l-nastenka": [
    "\u041f\u0435\u0440\u0441\u043e\u043d\u0430\u0436\u0438",
    "\u0413\u043b\u0430\u0432\u043d\u044b\u0435 \u0433\u0435\u0440\u043e\u0438",
  ],
  "doc-l-baba-yaga": [
    "\u041f\u0435\u0440\u0441\u043e\u043d\u0430\u0436\u0438",
    "\u0412\u043e\u043b\u0448\u0435\u0431\u043d\u044b\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0430",
  ],
  "doc-l-koschei": [
    "\u041f\u0435\u0440\u0441\u043e\u043d\u0430\u0436\u0438",
    "\u0412\u043e\u043b\u0448\u0435\u0431\u043d\u044b\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0430",
  ],
  "doc-l-geography": [
    "\u041c\u0438\u0440",
    "\u0413\u0435\u043e\u0433\u0440\u0430\u0444\u0438\u044f",
  ],
  "doc-l-magic": ["\u041c\u0438\u0440"],
  "doc-l-first-chapter": [
    "\u0421\u0446\u0435\u043d\u0430\u0440\u0438\u0438",
    "\u041f\u0435\u0440\u0432\u044b\u0439 \u0441\u0435\u0437\u043e\u043d",
  ],
  "doc-l-scenes": [
    "\u0421\u0446\u0435\u043d\u0430\u0440\u0438\u0438",
    "\u041f\u0435\u0440\u0432\u044b\u0439 \u0441\u0435\u0437\u043e\u043d",
  ],
  "doc-l-production": [
    "\u041f\u0440\u043e\u0438\u0437\u0432\u043e\u0434\u0441\u0442\u0432\u043e",
  ],
};
export function getDocumentById(
  state: DesktopPrototypeState,
  documentId: string | null,
): PrototypeDocument | undefined {
  if (!documentId) return undefined;
  return state.documents.find((document) => document.id === documentId);
}

export function getProjectDocuments(
  state: DesktopPrototypeState,
  projectId = state.activeProjectId,
): PrototypeDocument[] {
  return state.documents.filter((document) => document.projectId === projectId);
}

export function getKeyDocuments(
  state: DesktopPrototypeState,
): PrototypeDocument[] {
  return getProjectDocuments(state).filter(
    (document) => document.isKeyDocument === true,
  );
}

export function knowledgeFolderId(projectId: string, path: string[]): string {
  return `${projectId}:${path.join("/")}`;
}

export function getDocumentFolderPath(document: PrototypeDocument): string[] {
  if (document.folderPath !== undefined) {
    return document.folderPath;
  }
  const overridePath = documentFolderPathOverrides[document.id];
  if (overridePath) return overridePath;
  return document.folder ? [document.folder] : [];
}

export function getDocumentBreadcrumb(document: PrototypeDocument): string {
  return [...getDocumentFolderPath(document), document.title].join(" / ");
}

export function getDocumentAncestorFolderIds(
  document: PrototypeDocument,
): string[] {
  const path = getDocumentFolderPath(document);
  return path.map((_, index) =>
    knowledgeFolderId(document.projectId, path.slice(0, index + 1)),
  );
}

export function getOpenDocuments(
  state: DesktopPrototypeState,
): PrototypeDocument[] {
  const openDocuments = state.openDocumentIds
    .map((documentId) => getDocumentById(state, documentId))
    .filter((document): document is PrototypeDocument => Boolean(document));
  const selectedDocument = getDocumentById(state, state.selectedDocumentId);
  if (
    selectedDocument &&
    !openDocuments.some((document) => document.id === selectedDocument.id)
  ) {
    return [...openDocuments, selectedDocument];
  }
  return openDocuments;
}

export function getKnowledgePaneState(
  state: DesktopPrototypeState,
): KnowledgePaneState {
  const projectDocuments = getProjectDocuments(state);
  const selectedDocument = getDocumentById(state, state.selectedDocumentId);
  const primaryDocument =
    selectedDocument?.projectId === state.activeProjectId
      ? selectedDocument
      : projectDocuments[0];
  const requestedSecondaryDocument = getDocumentById(
    state,
    state.splitViewDocumentId,
  );
  const secondaryDocument =
    requestedSecondaryDocument?.projectId === state.activeProjectId &&
    requestedSecondaryDocument.id !== primaryDocument?.id
      ? requestedSecondaryDocument
      : undefined;
  const activePane =
    state.activeKnowledgePane === "secondary" && secondaryDocument
      ? "secondary"
      : "primary";

  return {
    primaryDocument,
    secondaryDocument,
    activePane,
    activeDocument:
      activePane === "secondary" ? secondaryDocument : primaryDocument,
  };
}

export function getKnowledgeTree(
  state: DesktopPrototypeState,
  projectId = state.activeProjectId,
): KnowledgeTreeNode[] {
  const documents = getProjectDocuments(state, projectId);
  const documentOrder = new Map(
    documents.map((document, index) => [document.id, document.order ?? index]),
  );
  const query = state.knowledgeSearchQuery.trim().toLocaleLowerCase("ru");
  const rootFolders = new Map<string, KnowledgeTreeNode>();
  const rootDocuments: KnowledgeTreeNode[] = [];
  const childFolderMaps = new Map<string, Map<string, KnowledgeTreeNode>>();
  const matches = (document: PrototypeDocument): boolean => {
    if (!query) return true;
    const searchable = [
      document.title,
      document.excerpt,
      getDocumentBreadcrumb(document),
    ]
      .join(" ")
      .toLocaleLowerCase("ru");
    return searchable.includes(query);
  };

  const getFolderChildrenMap = (
    folder: Extract<KnowledgeTreeNode, { kind: "folder" }>,
  ): Map<string, KnowledgeTreeNode> => {
    const existing = childFolderMaps.get(folder.id);
    if (existing) return existing;
    const next = new Map<string, KnowledgeTreeNode>();
    childFolderMaps.set(folder.id, next);
    return next;
  };

  const ensureFolder = (path: string[]): KnowledgeTreeNode => {
    const id = knowledgeFolderId(projectId, path);
    const title = path[path.length - 1] ?? "Р”РѕРєСѓРјРµРЅС‚С‹";
    if (path.length === 1) {
      const existingRoot = rootFolders.get(id);
      if (existingRoot) return existingRoot;
      const folder: KnowledgeTreeNode = {
        kind: "folder",
        id,
        title,
        path,
        children: [],
      };
      rootFolders.set(id, folder);
      return folder;
    }
    const parent = ensureFolder(path.slice(0, -1));
    if (parent.kind !== "folder") return parent;
    const siblings = getFolderChildrenMap(parent);
    const existing = siblings.get(id);
    if (existing) return existing;
    const folder: KnowledgeTreeNode = {
      kind: "folder",
      id,
      title,
      path,
      children: [],
    };
    siblings.set(id, folder);
    parent.children.push(folder);
    return folder;
  };

  if (!query) {
    for (const folder of state.knowledgeFolders) {
      if (folder.projectId === projectId) ensureFolder(folder.path);
    }
  }

  for (const document of documents) {
    if (!matches(document)) continue;
    const folderPath = getDocumentFolderPath(document);
    if (folderPath.length === 0) {
      rootDocuments.push({
        kind: "document",
        id: document.id,
        title: document.title,
        path: [document.title],
        document,
      });
      continue;
    }
    const folder = ensureFolder(folderPath);
    if (folder.kind !== "folder") continue;
    folder.children.push({
      kind: "document",
      id: document.id,
      title: document.title,
      path: [...folderPath, document.title],
      document,
    });
  }

  return sortKnowledgeNodes(
    [...Array.from(rootFolders.values()), ...rootDocuments],
    documentOrder,
  );
}

export function getProjectDocumentFolders(
  state: DesktopPrototypeState,
  projectId = state.activeProjectId,
): string[] {
  return Array.from(
    new Set(
      getProjectDocuments(state, projectId).map((document) => document.folder),
    ),
  );
}

export function sortKnowledgeNodes(
  nodes: KnowledgeTreeNode[],
  documentOrder: ReadonlyMap<string, number>,
): KnowledgeTreeNode[] {
  return [...nodes]
    .map((node) =>
      node.kind === "folder"
        ? {
            ...node,
            children: sortKnowledgeNodes(node.children, documentOrder),
          }
        : node,
    )
    .sort((first, second) => {
      if (first.kind !== second.kind) return first.kind === "folder" ? -1 : 1;
      if (first.kind === "document" && second.kind === "document") {
        return (
          (documentOrder.get(first.id) ?? 0) -
          (documentOrder.get(second.id) ?? 0)
        );
      }
      return first.title.localeCompare(second.title, "ru");
    });
}

export function knowledgePathsEqual(
  first: string[],
  second: string[],
): boolean {
  return (
    first.length === second.length &&
    first.every((segment, index) => segment === second[index])
  );
}

export function knowledgePathStartsWith(
  path: string[],
  prefix: string[],
): boolean {
  return (
    path.length >= prefix.length &&
    prefix.every((segment, index) => segment === path[index])
  );
}

export function toggleKeyDocument(
  state: DesktopPrototypeState,
  documentId: string,
): DesktopPrototypeState {
  const document = getDocumentById(state, documentId);
  if (!document || document.projectId !== state.activeProjectId) return state;
  return {
    ...state,
    documents: state.documents.map((item) =>
      item.id === document.id
        ? { ...item, isKeyDocument: !item.isKeyDocument }
        : item,
    ),
  };
}

export function toggleKnowledgeFolder(
  state: DesktopPrototypeState,
  folderId: string,
  path: string[],
): DesktopPrototypeState {
  const expanded = state.expandedFolderIds.includes(folderId);
  return {
    ...state,
    selectedKnowledgeFolderPath: path,
    expandedFolderIds: expanded
      ? state.expandedFolderIds.filter((id) => id !== folderId)
      : [...state.expandedFolderIds, folderId],
    knowledgeExpandedBeforeCollapse: null,
  };
}

export function toggleAllKnowledgeFolders(
  state: DesktopPrototypeState,
): DesktopPrototypeState {
  if (state.knowledgeExpandedBeforeCollapse !== null) {
    return {
      ...state,
      expandedFolderIds: state.knowledgeExpandedBeforeCollapse,
      knowledgeExpandedBeforeCollapse: null,
    };
  }
  return {
    ...state,
    expandedFolderIds: [],
    knowledgeExpandedBeforeCollapse: state.expandedFolderIds,
  };
}

export function revealCurrentKnowledgeDocument(
  state: DesktopPrototypeState,
): DesktopPrototypeState {
  const selectedDocument = getDocumentById(state, state.selectedDocumentId);
  if (!selectedDocument) return state;
  return {
    ...state,
    selectedKnowledgeFolderPath: getDocumentFolderPath(selectedDocument),
    expandedFolderIds: Array.from(
      new Set([
        ...state.expandedFolderIds,
        ...getDocumentAncestorFolderIds(selectedDocument),
      ]),
    ),
    knowledgeExpandedBeforeCollapse: null,
  };
}

export function setKnowledgeSearch(
  state: DesktopPrototypeState,
  query: string,
): DesktopPrototypeState {
  return {
    ...state,
    knowledgeSearchQuery: query,
    expandedFolderIds: query.trim()
      ? Array.from(
          new Set(
            getProjectDocuments(state).flatMap((document) =>
              getDocumentAncestorFolderIds(document),
            ),
          ),
        )
      : state.expandedFolderIds,
  };
}

export function createKnowledgeDocument(
  state: DesktopPrototypeState,
): DesktopPrototypeState {
  const folderPath = state.selectedKnowledgeFolderPath ?? [];
  const siblingDocuments = getProjectDocuments(state).filter((document) =>
    knowledgePathsEqual(getDocumentFolderPath(document), folderPath),
  );
  const document: PrototypeDocument = {
    id: `mock-document-${state.nextDocumentNumber}`,
    projectId: state.activeProjectId,
    order: siblingDocuments.length,
    folder: folderPath.at(-1) ?? "",
    folderPath,
    title: "Без названия",
    excerpt: "",
    content: [],
    linkedTaskIds: [],
    backlinks: [],
  };
  const nextState = {
    ...state,
    documents: [...state.documents, document],
    nextDocumentNumber: state.nextDocumentNumber + 1,
  };
  const previousDocumentId = nextState.selectedDocumentId;
  return {
    ...nextState,
    activeSection: "knowledge",
    selectedDocumentId: document.id,
    selectedDocumentFolder: document.folder,
    selectedKnowledgeFolderPath: getDocumentFolderPath(document),
    expandedFolderIds: Array.from(
      new Set([
        ...nextState.expandedFolderIds,
        ...getDocumentAncestorFolderIds(document),
      ]),
    ),
    openDocumentIds: nextState.openDocumentIds.includes(document.id)
      ? nextState.openDocumentIds
      : [...nextState.openDocumentIds, document.id],
    documentHistoryBack:
      previousDocumentId !== null
        ? [...nextState.documentHistoryBack, previousDocumentId]
        : nextState.documentHistoryBack,
    documentHistoryForward: [],
    activeKnowledgePane: "primary",
    editingKnowledgeDocumentId: null,
    contextPanelBeforeAi: null,
    commandPaletteOpen: false,
  };
}

export function updateKnowledgeDocumentMarkdown(
  state: DesktopPrototypeState,
  documentId: string,
  markdown: string,
): DesktopPrototypeState {
  const document = getDocumentById(state, documentId);
  if (!document || document.projectId !== state.activeProjectId) return state;
  const normalizedMarkdown = markdown.replace(/\r\n?/g, "\n");
  return {
    ...state,
    documents: state.documents.map((item) =>
      item.id === document.id
        ? {
            ...item,
            content:
              normalizedMarkdown.length > 0
                ? normalizedMarkdown.split("\n")
                : [],
          }
        : item,
    ),
  };
}

export function createKnowledgeFolder(
  state: DesktopPrototypeState,
): DesktopPrototypeState {
  const parentPath = state.selectedKnowledgeFolderPath ?? [];
  const path = [...parentPath, "Новая папка"];
  const folderId = knowledgeFolderId(state.activeProjectId, path);
  const folder = {
    id: `mock-knowledge-folder-${state.nextKnowledgeFolderNumber}`,
    projectId: state.activeProjectId,
    path,
  };
  return {
    ...state,
    knowledgeFolders: [...state.knowledgeFolders, folder],
    selectedKnowledgeFolderPath: path,
    expandedFolderIds: Array.from(
      new Set([
        ...state.expandedFolderIds,
        ...path.map((_, index) =>
          knowledgeFolderId(state.activeProjectId, path.slice(0, index + 1)),
        ),
      ]),
    ),
    knowledgeExpandedBeforeCollapse: null,
    editingKnowledgeFolderId: folderId,
    nextKnowledgeFolderNumber: state.nextKnowledgeFolderNumber + 1,
  };
}

export function renameKnowledgeFolder(
  state: DesktopPrototypeState,
  folderId: string,
  title: string,
): DesktopPrototypeState {
  const folder = state.knowledgeFolders.find(
    (item) =>
      item.projectId === state.activeProjectId &&
      knowledgeFolderId(item.projectId, item.path) === folderId,
  );
  const trimmedTitle = title.trim();
  if (!folder || trimmedTitle.length === 0) {
    return { ...state, editingKnowledgeFolderId: null };
  }
  const oldPath = folder.path;
  const nextPath = [...oldPath.slice(0, -1), trimmedTitle];
  const replacePrefix = (path: string[]): string[] =>
    knowledgePathStartsWith(path, oldPath)
      ? [...nextPath, ...path.slice(oldPath.length)]
      : path;
  return {
    ...state,
    knowledgeFolders: state.knowledgeFolders.map((item) =>
      item.projectId === folder.projectId
        ? { ...item, path: replacePrefix(item.path) }
        : item,
    ),
    documents: state.documents.map((document) => {
      if (document.projectId !== folder.projectId) return document;
      const currentPath = getDocumentFolderPath(document);
      if (!knowledgePathStartsWith(currentPath, oldPath)) return document;
      const documentPath = replacePrefix(currentPath);
      return {
        ...document,
        folder: documentPath.at(-1) ?? "",
        folderPath: documentPath,
      };
    }),
    selectedKnowledgeFolderPath: state.selectedKnowledgeFolderPath
      ? replacePrefix(state.selectedKnowledgeFolderPath)
      : null,
    expandedFolderIds: Array.from(
      new Set([
        ...state.expandedFolderIds.filter(
          (id) => id !== knowledgeFolderId(folder.projectId, oldPath),
        ),
        knowledgeFolderId(folder.projectId, nextPath),
      ]),
    ),
    editingKnowledgeFolderId: null,
  };
}

export function finishEditingKnowledgeFolder(
  state: DesktopPrototypeState,
): DesktopPrototypeState {
  return { ...state, editingKnowledgeFolderId: null };
}

export function moveKnowledgeDocument(
  state: DesktopPrototypeState,
  documentId: string,
  targetFolderPath: string[],
  targetDocumentId: string | undefined,
  position: "before" | "after" | "end",
): DesktopPrototypeState {
  const movingDocument = getDocumentById(state, documentId);
  if (
    !movingDocument ||
    movingDocument.projectId !== state.activeProjectId ||
    targetDocumentId === movingDocument.id
  ) {
    return state;
  }
  const sourcePath = getDocumentFolderPath(movingDocument);
  const documentIndex = new Map(
    state.documents.map((document, index) => [document.id, index]),
  );
  const byManualOrder = (
    first: PrototypeDocument,
    second: PrototypeDocument,
  ): number =>
    (first.order ?? documentIndex.get(first.id) ?? 0) -
    (second.order ?? documentIndex.get(second.id) ?? 0);
  const targetDocuments = getProjectDocuments(state)
    .filter(
      (document) =>
        document.id !== movingDocument.id &&
        knowledgePathsEqual(getDocumentFolderPath(document), targetFolderPath),
    )
    .sort(byManualOrder);
  const targetIndex = targetDocumentId
    ? targetDocuments.findIndex((document) => document.id === targetDocumentId)
    : -1;
  const insertionIndex =
    position === "end" || targetIndex < 0
      ? targetDocuments.length
      : targetIndex + (position === "after" ? 1 : 0);
  targetDocuments.splice(insertionIndex, 0, movingDocument);
  const targetOrders = new Map(
    targetDocuments.map((document, index) => [document.id, index]),
  );
  const sourceOrders = new Map(
    getProjectDocuments(state)
      .filter(
        (document) =>
          document.id !== movingDocument.id &&
          knowledgePathsEqual(getDocumentFolderPath(document), sourcePath),
      )
      .sort(byManualOrder)
      .map((document, index) => [document.id, index]),
  );
  return {
    ...state,
    documents: state.documents.map((document) => {
      if (document.id === movingDocument.id) {
        return {
          ...document,
          folder: targetFolderPath.at(-1) ?? "",
          folderPath: targetFolderPath,
          order: targetOrders.get(document.id) ?? 0,
        };
      }
      const targetOrder = targetOrders.get(document.id);
      if (targetOrder !== undefined) return { ...document, order: targetOrder };
      const sourceOrder = sourceOrders.get(document.id);
      return sourceOrder === undefined
        ? document
        : { ...document, order: sourceOrder };
    }),
    selectedDocumentFolder:
      state.selectedDocumentId === movingDocument.id
        ? (targetFolderPath.at(-1) ?? "")
        : state.selectedDocumentFolder,
    selectedKnowledgeFolderPath:
      state.selectedDocumentId === movingDocument.id
        ? targetFolderPath
        : state.selectedKnowledgeFolderPath,
    expandedFolderIds: Array.from(
      new Set([
        ...state.expandedFolderIds,
        ...targetFolderPath.map((_, index) =>
          knowledgeFolderId(
            state.activeProjectId,
            targetFolderPath.slice(0, index + 1),
          ),
        ),
      ]),
    ),
  };
}

export function closeDocumentTab(
  state: DesktopPrototypeState,
  documentId: string,
): DesktopPrototypeState {
  const nextOpenDocumentIds = state.openDocumentIds.filter(
    (openDocumentId) => openDocumentId !== documentId,
  );
  if (state.selectedDocumentId !== documentId) {
    return { ...state, openDocumentIds: nextOpenDocumentIds };
  }
  const nextActiveDocumentId =
    nextOpenDocumentIds[nextOpenDocumentIds.length - 1] ?? null;
  const nextActiveDocument = getDocumentById(state, nextActiveDocumentId);
  return {
    ...state,
    selectedDocumentId: nextActiveDocument?.id ?? null,
    selectedDocumentFolder: nextActiveDocument?.folder ?? null,
    selectedKnowledgeFolderPath: nextActiveDocument
      ? getDocumentFolderPath(nextActiveDocument)
      : null,
    openDocumentIds: nextOpenDocumentIds,
    contextPanel:
      state.contextPanel?.kind === "document-context" &&
      state.contextPanel.documentId === documentId
        ? null
        : state.contextPanel,
    activeKnowledgePane: "primary",
    editingKnowledgeDocumentId: null,
  };
}

export function setKnowledgeContextMode(
  state: DesktopPrototypeState,
  mode: KnowledgeContextMode,
): DesktopPrototypeState {
  return { ...state, knowledgeContextMode: mode };
}

export function toggleKnowledgeSplitView(
  state: DesktopPrototypeState,
): DesktopPrototypeState {
  if (state.splitViewDocumentId) {
    return {
      ...state,
      splitViewDocumentId: null,
      activeKnowledgePane: "primary",
      editingKnowledgeDocumentId: null,
    };
  }
  const fallbackDocument = getProjectDocuments(state).find(
    (document) => document.id !== state.selectedDocumentId,
  );
  return {
    ...state,
    splitViewDocumentId: fallbackDocument?.id ?? null,
    activeKnowledgePane: "primary",
    editingKnowledgeDocumentId: null,
  };
}

export function activateKnowledgePane(
  state: DesktopPrototypeState,
  pane: KnowledgePane,
): DesktopPrototypeState {
  const paneState = getKnowledgePaneState(state);
  const activeKnowledgePane =
    pane === "secondary" && paneState.secondaryDocument
      ? "secondary"
      : "primary";
  return {
    ...state,
    activeKnowledgePane,
    editingKnowledgeDocumentId:
      activeKnowledgePane === paneState.activePane
        ? state.editingKnowledgeDocumentId
        : null,
  };
}

export function toggleKnowledgeDocumentEdit(
  state: DesktopPrototypeState,
  documentId: string,
): DesktopPrototypeState {
  const paneState = getKnowledgePaneState(state);
  if (paneState.activeDocument?.id !== documentId) return state;
  return {
    ...state,
    editingKnowledgeDocumentId:
      state.editingKnowledgeDocumentId === documentId ? null : documentId,
  };
}
