import type { PrototypeDocument } from "@/prototype/desktop-mock-data";
import type {
  DesktopPrototypeAction,
  DesktopPrototypeState,
  KnowledgeContextMode,
  KnowledgePaneState,
  KnowledgePane,
  KnowledgePathSelection,
  KnowledgeTreeNode,
} from "@/prototype/state/types";
import type {
  KnowledgeDocumentPlacement,
  KnowledgeStructuralHistoryEntry,
} from "@/prototype/knowledge/knowledge-structural-history";

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

export function getActiveProjectDocuments(
  state: DesktopPrototypeState,
  projectId = state.activeProjectId,
): PrototypeDocument[] {
  return getProjectDocuments(state, projectId).filter(
    (document) => document.deletedAt === undefined,
  );
}

export function getActiveDocumentById(
  state: DesktopPrototypeState,
  documentId: string | null,
  projectId?: string,
): PrototypeDocument | undefined {
  const document = getDocumentById(state, documentId);
  return document &&
    document.deletedAt === undefined &&
    (projectId === undefined || document.projectId === projectId)
    ? document
    : undefined;
}

export function getKnowledgeTrashDocuments(
  state: DesktopPrototypeState,
  projectId = state.activeProjectId,
): PrototypeDocument[] {
  const documentPosition = new Map(
    state.documents.map((document, index) => [document.id, index]),
  );
  const documentOrder = new Map(
    state.documents.map((document, index) => [
      document.id,
      document.order ?? index,
    ]),
  );
  return getProjectDocuments(state, projectId)
    .filter((document) => document.deletedAt !== undefined)
    .sort((first, second) => {
      const firstDeletedAt = Date.parse(first.deletedAt ?? "");
      const secondDeletedAt = Date.parse(second.deletedAt ?? "");
      const firstTime = Number.isNaN(firstDeletedAt) ? 0 : firstDeletedAt;
      const secondTime = Number.isNaN(secondDeletedAt) ? 0 : secondDeletedAt;
      if (firstTime !== secondTime) return secondTime - firstTime;
      const orderDifference =
        (documentOrder.get(first.id) ?? 0) -
        (documentOrder.get(second.id) ?? 0);
      if (orderDifference !== 0) return orderDifference;
      return (
        (documentPosition.get(first.id) ?? 0) -
        (documentPosition.get(second.id) ?? 0)
      );
    });
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
  return [...getDocumentFolderPath(document), getDocumentTitle(document)].join(
    " / ",
  );
}

function getFirstMarkdownHeading(markdown: string): string | undefined {
  for (const line of markdown.split("\n")) {
    const match = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

export function getDocumentTitle(document: PrototypeDocument): string {
  return getFirstMarkdownHeading(document.content.join("\n")) ?? document.title;
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
    .filter(
      (document): document is PrototypeDocument =>
        document !== undefined && document.deletedAt === undefined,
    );
  const selectedDocument = getDocumentById(state, state.selectedDocumentId);
  if (
    selectedDocument &&
    selectedDocument.deletedAt === undefined &&
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
    selectedDocument?.projectId === state.activeProjectId &&
    selectedDocument.deletedAt === undefined
      ? selectedDocument
      : projectDocuments.find((document) => document.deletedAt === undefined);
  const requestedSecondaryDocument = state.knowledgeSplitEnabled
    ? getDocumentById(state, state.splitViewDocumentId)
    : undefined;
  const secondaryDocument =
    requestedSecondaryDocument !== undefined &&
    requestedSecondaryDocument.projectId === state.activeProjectId &&
    requestedSecondaryDocument.deletedAt === undefined &&
    requestedSecondaryDocument.id !== primaryDocument?.id
      ? requestedSecondaryDocument
      : undefined;
  const activePane =
    state.knowledgeSplitEnabled && state.activeKnowledgePane === "secondary"
      ? "secondary"
      : "primary";

  return {
    primaryDocument,
    secondaryDocument,
    splitEnabled: state.knowledgeSplitEnabled,
    activePane,
    activeDocument:
      activePane === "secondary" ? secondaryDocument : primaryDocument,
  };
}

export function getKnowledgeTree(
  state: DesktopPrototypeState,
  projectId = state.activeProjectId,
): KnowledgeTreeNode[] {
  const documents = getProjectDocuments(state, projectId).filter(
    (document) => document.deletedAt === undefined,
  );
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
      getDocumentTitle(document),
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
        title: getDocumentTitle(document),
        path: [getDocumentTitle(document)],
        document,
      });
      continue;
    }
    const folder = ensureFolder(folderPath);
    if (folder.kind !== "folder") continue;
    folder.children.push({
      kind: "document",
      id: document.id,
      title: getDocumentTitle(document),
      path: [...folderPath, getDocumentTitle(document)],
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
    selectedKnowledgePath: { kind: "folder", path },
    expandedFolderIds: expanded
      ? state.expandedFolderIds.filter((id) => id !== folderId)
      : [...state.expandedFolderIds, folderId],
    knowledgeExpandedBeforeCollapse: null,
  };
}

export function selectKnowledgeFolder(
  state: DesktopPrototypeState,
  path: string[],
): DesktopPrototypeState {
  if (path.length === 0) return state;
  const expandedFolderIds = path.map((_, index) =>
    knowledgeFolderId(state.activeProjectId, path.slice(0, index + 1)),
  );
  return {
    ...state,
    selectedKnowledgeFolderPath: path,
    selectedKnowledgePath: { kind: "folder", path },
    expandedFolderIds: Array.from(
      new Set([...state.expandedFolderIds, ...expandedFolderIds]),
    ),
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
    selectedKnowledgePath: {
      kind: "document",
      path: getDocumentFolderPath(selectedDocument),
      documentId: selectedDocument.id,
    },
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
    knowledgeWorkspaceView: "documents",
    selectedDocumentId: document.id,
    selectedDocumentFolder: document.folder,
    selectedKnowledgeFolderPath: getDocumentFolderPath(document),
    selectedKnowledgePath: {
      kind: "document",
      path: getDocumentFolderPath(document),
      documentId: document.id,
    },
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
  const nextTitle =
    getFirstMarkdownHeading(normalizedMarkdown) ?? "Без названия";
  return {
    ...state,
    documents: state.documents.map((item) =>
      item.id === document.id
        ? {
            ...item,
            title: nextTitle,
            content:
              normalizedMarkdown.length > 0
                ? normalizedMarkdown.split("\n")
                : [],
          }
        : item,
    ),
  };
}

export function startEditingKnowledgeFolder(
  state: DesktopPrototypeState,
  folderId: string,
): DesktopPrototypeState {
  const containsFolder = (nodes: KnowledgeTreeNode[]): boolean =>
    nodes.some(
      (node) =>
        node.kind === "folder" &&
        (node.id === folderId || containsFolder(node.children)),
    );
  return containsFolder(getKnowledgeTree(state))
    ? { ...state, editingKnowledgeFolderId: folderId }
    : state;
}

function getKnowledgeFolderPathById(
  state: DesktopPrototypeState,
  folderId: string,
): string[] | undefined {
  const materializedFolder = state.knowledgeFolders.find(
    (folder) =>
      folder.projectId === state.activeProjectId &&
      knowledgeFolderId(folder.projectId, folder.path) === folderId,
  );
  if (materializedFolder) return materializedFolder.path;

  for (const document of getProjectDocuments(state)) {
    if (document.deletedAt !== undefined) continue;
    const documentPath = getDocumentFolderPath(document);
    for (let length = 1; length <= documentPath.length; length += 1) {
      const path = documentPath.slice(0, length);
      if (knowledgeFolderId(state.activeProjectId, path) === folderId) {
        return path;
      }
    }
  }
  return undefined;
}

function getKnowledgeFolderPaths(state: DesktopPrototypeState): string[][] {
  const paths = new Map<string, string[]>();
  const addPath = (path: string[]): void => {
    paths.set(knowledgeFolderId(state.activeProjectId, path), path);
  };

  for (const folder of state.knowledgeFolders) {
    if (folder.projectId === state.activeProjectId) addPath(folder.path);
  }
  for (const document of getProjectDocuments(state)) {
    if (document.deletedAt !== undefined) continue;
    const documentPath = getDocumentFolderPath(document);
    for (let length = 1; length <= documentPath.length; length += 1) {
      addPath(documentPath.slice(0, length));
    }
  }
  return [...paths.values()];
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
    selectedKnowledgePath: { kind: "folder", path },
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
  const oldPath = getKnowledgeFolderPathById(state, folderId);
  const trimmedTitle = title.trim();
  if (!oldPath || trimmedTitle.length === 0) {
    return { ...state, editingKnowledgeFolderId: null };
  }
  const nextPath = [...oldPath.slice(0, -1), trimmedTitle];
  if (knowledgePathsEqual(oldPath, nextPath)) {
    return { ...state, editingKnowledgeFolderId: null };
  }
  const hasSiblingCollision = getKnowledgeFolderPaths(state).some(
    (path) =>
      knowledgePathsEqual(path, nextPath) &&
      !knowledgePathsEqual(path, oldPath),
  );
  if (hasSiblingCollision) {
    return { ...state, editingKnowledgeFolderId: null };
  }
  const replacePrefix = (path: string[]): string[] =>
    knowledgePathStartsWith(path, oldPath)
      ? [...nextPath, ...path.slice(oldPath.length)]
      : path;
  const oldFolderId = knowledgeFolderId(state.activeProjectId, oldPath);
  const nextFolderId = knowledgeFolderId(state.activeProjectId, nextPath);
  const replaceFolderIdPrefix = (id: string): string => {
    if (id === oldFolderId) return nextFolderId;
    const nestedPrefix = `${oldFolderId}/`;
    return id.startsWith(nestedPrefix)
      ? `${nextFolderId}${id.slice(oldFolderId.length)}`
      : id;
  };
  const selectedDocument = getDocumentById(state, state.selectedDocumentId);
  const selectedDocumentPath = selectedDocument
    ? getDocumentFolderPath(selectedDocument)
    : undefined;
  return {
    ...state,
    knowledgeFolders: state.knowledgeFolders.map((item) =>
      item.projectId === state.activeProjectId
        ? { ...item, path: replacePrefix(item.path) }
        : item,
    ),
    documents: state.documents.map((document) => {
      if (document.projectId !== state.activeProjectId) return document;
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
    selectedDocumentFolder:
      selectedDocument?.projectId === state.activeProjectId &&
      selectedDocumentPath &&
      knowledgePathStartsWith(selectedDocumentPath, oldPath)
        ? (replacePrefix(selectedDocumentPath).at(-1) ?? "")
        : state.selectedDocumentFolder,
    expandedFolderIds: Array.from(
      new Set(state.expandedFolderIds.map(replaceFolderIdPrefix)),
    ),
    knowledgeExpandedBeforeCollapse: state.knowledgeExpandedBeforeCollapse
      ? Array.from(
          new Set(
            state.knowledgeExpandedBeforeCollapse.map(replaceFolderIdPrefix),
          ),
        )
      : null,
    editingKnowledgeFolderId: null,
  };
}

export function deleteKnowledgeFolder(
  state: DesktopPrototypeState,
  folderId: string,
): DesktopPrototypeState {
  const folder = state.knowledgeFolders.find(
    (item) =>
      item.projectId === state.activeProjectId &&
      knowledgeFolderId(item.projectId, item.path) === folderId,
  );
  const folderPath =
    folder?.path ??
    getProjectDocuments(state)
      .filter((document) => document.deletedAt === undefined)
      .map((document) => getDocumentFolderPath(document))
      .find(
        (path) => knowledgeFolderId(state.activeProjectId, path) === folderId,
      );
  if (!folderPath || folderPath.length === 0) return state;
  const parentPath = folderPath.slice(0, -1);
  const isInFolder = (path: string[]): boolean =>
    knowledgePathStartsWith(path, folderPath);
  const documents = state.documents.map((document) => {
    if (document.projectId !== state.activeProjectId) return document;
    if (document.deletedAt !== undefined) return document;
    const documentPath = getDocumentFolderPath(document);
    if (!isInFolder(documentPath)) return document;
    return {
      ...document,
      folder: parentPath.at(-1) ?? "",
      folderPath: parentPath,
    };
  });
  const selectedDocument = getDocumentById(state, state.selectedDocumentId);
  const selectedDocumentWasMoved = selectedDocument
    ? isInFolder(getDocumentFolderPath(selectedDocument))
    : false;
  return {
    ...state,
    knowledgeFolders: state.knowledgeFolders.filter(
      (item) =>
        item.projectId !== state.activeProjectId ||
        !knowledgePathStartsWith(item.path, folderPath),
    ),
    documents,
    selectedKnowledgeFolderPath:
      state.selectedKnowledgeFolderPath &&
      isInFolder(state.selectedKnowledgeFolderPath)
        ? parentPath
        : state.selectedKnowledgeFolderPath,
    selectedDocumentFolder: selectedDocumentWasMoved
      ? (parentPath.at(-1) ?? "")
      : state.selectedDocumentFolder,
    expandedFolderIds: state.expandedFolderIds.filter(
      (id) => id !== folderId && !id.startsWith(`${folderId}/`),
    ),
    knowledgeExpandedBeforeCollapse:
      state.knowledgeExpandedBeforeCollapse?.filter(
        (id) => id !== folderId && !id.startsWith(`${folderId}/`),
      ) ?? null,
    editingKnowledgeFolderId: null,
  };
}

export function softDeleteKnowledgeDocument(
  state: DesktopPrototypeState,
  documentId: string,
  deletedAt: string,
): DesktopPrototypeState {
  const document = getDocumentById(state, documentId);
  if (
    !document ||
    document.projectId !== state.activeProjectId ||
    document.deletedAt !== undefined
  ) {
    return state;
  }

  const nextState = closeDocumentTab(state, documentId);
  const deletingActiveDocument = state.selectedDocumentId === documentId;
  const deletingSplitDocument = state.splitViewDocumentId === documentId;
  return {
    ...nextState,
    documents: nextState.documents.map((item) =>
      item.id === documentId ? { ...item, deletedAt } : item,
    ),
    documentHistoryBack: nextState.documentHistoryBack.filter(
      (historyDocumentId) => historyDocumentId !== documentId,
    ),
    documentHistoryForward: nextState.documentHistoryForward.filter(
      (historyDocumentId) => historyDocumentId !== documentId,
    ),
    knowledgeSplitEnabled:
      deletingActiveDocument || deletingSplitDocument
        ? false
        : nextState.knowledgeSplitEnabled,
    splitViewDocumentId:
      deletingActiveDocument || deletingSplitDocument
        ? null
        : nextState.splitViewDocumentId,
    activeKnowledgePane:
      deletingActiveDocument || deletingSplitDocument
        ? "primary"
        : nextState.activeKnowledgePane,
  };
}

export function restoreKnowledgeDocument(
  state: DesktopPrototypeState,
  documentId: string,
): DesktopPrototypeState {
  const document = getDocumentById(state, documentId);
  if (
    !document ||
    document.projectId !== state.activeProjectId ||
    document.deletedAt === undefined
  ) {
    return state;
  }

  const originalFolderPath = getDocumentFolderPath(document);
  const restoredFolderPath = getKnowledgeFolderPaths(state).some((path) =>
    knowledgePathsEqual(path, originalFolderPath),
  )
    ? originalFolderPath
    : [];
  const documentWithoutDeletedAt = { ...document };
  delete documentWithoutDeletedAt.deletedAt;
  return {
    ...state,
    documents: state.documents.map((item) =>
      item.id === documentId
        ? {
            ...documentWithoutDeletedAt,
            folder: restoredFolderPath.at(-1) ?? "",
            ...(restoredFolderPath.length === 0
              ? { folderPath: [] }
              : document.folderPath === undefined
                ? {}
                : { folderPath: restoredFolderPath }),
          }
        : item,
    ),
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeInternalDocumentLink(
  content: string[],
  documentId: string,
): string[] {
  const linkPattern = new RegExp(
    `\\[\\[doc:${escapeRegExp(documentId)}\\|([^\\]]+)\\]\\]`,
    "g",
  );
  return content.map((line) => line.replace(linkPattern, "$1"));
}

export function permanentlyDeleteKnowledgeDocument(
  state: DesktopPrototypeState,
  documentId: string,
): DesktopPrototypeState {
  const document = getDocumentById(state, documentId);
  if (
    !document ||
    document.projectId !== state.activeProjectId ||
    document.deletedAt === undefined
  ) {
    return state;
  }

  const nextOpenDocumentIds = state.openDocumentIds.filter(
    (openDocumentId) => openDocumentId !== documentId,
  );
  const fallbackDocumentId =
    state.selectedDocumentId === documentId
      ? (nextOpenDocumentIds.at(-1) ??
        getProjectDocuments(state).find(
          (item) => item.id !== documentId && item.deletedAt === undefined,
        )?.id ??
        null)
      : state.selectedDocumentId;
  const fallbackDocument = getDocumentById(state, fallbackDocumentId);
  const isDocumentSelection = (selection: KnowledgePathSelection): boolean =>
    selection?.kind === "document" && selection.documentId === documentId;
  const cleanContextPanel = (
    contextPanel: DesktopPrototypeState["contextPanel"],
  ): DesktopPrototypeState["contextPanel"] =>
    contextPanel?.kind === "document-context" &&
    contextPanel.documentId === documentId
      ? null
      : contextPanel;
  const cleanRestorablePanel = (
    contextPanel: DesktopPrototypeState["contextPanelBeforeAi"],
  ): DesktopPrototypeState["contextPanelBeforeAi"] =>
    contextPanel?.kind === "document-context" &&
    contextPanel.documentId === documentId
      ? null
      : contextPanel;

  return {
    ...state,
    documents: state.documents
      .filter((item) => item.id !== documentId)
      .map((item) => {
        const content = removeInternalDocumentLink(item.content, documentId);
        return content.every((line, index) => line === item.content[index])
          ? item
          : { ...item, content };
      }),
    tasks: state.tasks.map((task) =>
      task.linkedDocumentIds.includes(documentId)
        ? {
            ...task,
            linkedDocumentIds: task.linkedDocumentIds.filter(
              (linkedDocumentId) => linkedDocumentId !== documentId,
            ),
          }
        : task,
    ),
    selectedDocumentId: fallbackDocumentId,
    selectedDocumentFolder: fallbackDocument?.folder ?? null,
    selectedKnowledgeFolderPath: fallbackDocument
      ? getDocumentFolderPath(fallbackDocument)
      : null,
    selectedKnowledgePath: isDocumentSelection(state.selectedKnowledgePath)
      ? fallbackDocument
        ? {
            kind: "document",
            path: getDocumentFolderPath(fallbackDocument),
            documentId: fallbackDocument.id,
          }
        : null
      : state.selectedKnowledgePath,
    knowledgeBreadcrumbHighlightVisible: isDocumentSelection(
      state.selectedKnowledgePath,
    )
      ? false
      : state.knowledgeBreadcrumbHighlightVisible,
    openDocumentIds: nextOpenDocumentIds,
    documentHistoryBack: state.documentHistoryBack.filter(
      (historyDocumentId) => historyDocumentId !== documentId,
    ),
    documentHistoryForward: state.documentHistoryForward.filter(
      (historyDocumentId) => historyDocumentId !== documentId,
    ),
    knowledgeSplitEnabled:
      state.splitViewDocumentId === documentId
        ? false
        : state.knowledgeSplitEnabled,
    splitViewDocumentId:
      state.splitViewDocumentId === documentId
        ? null
        : state.splitViewDocumentId,
    activeKnowledgePane:
      state.splitViewDocumentId === documentId
        ? "primary"
        : state.activeKnowledgePane,
    editingKnowledgeDocumentId:
      state.editingKnowledgeDocumentId === documentId
        ? null
        : state.editingKnowledgeDocumentId,
    contextPanel: cleanContextPanel(state.contextPanel),
    contextPanelBeforeAi: cleanRestorablePanel(state.contextPanelBeforeAi),
    taskAttachOrigin:
      state.taskAttachOrigin?.documentId === documentId
        ? { ...state.taskAttachOrigin, documentId: null }
        : state.taskAttachOrigin,
    overviewArticlePreviewDocumentId:
      state.overviewArticlePreviewDocumentId === documentId
        ? null
        : state.overviewArticlePreviewDocumentId,
    overviewTaskDetailMaterial:
      state.overviewTaskDetailMaterial?.kind === "knowledge" &&
      state.overviewTaskDetailMaterial.documentId === documentId
        ? { kind: "subtasks" }
        : state.overviewTaskDetailMaterial,
    overviewTaskDetailSplit:
      state.overviewTaskDetailSplit.enabled &&
      state.overviewTaskDetailSplit.documentId === documentId
        ? { enabled: false }
        : state.overviewTaskDetailSplit,
  };
}

function cloneDocument(document: PrototypeDocument): PrototypeDocument {
  return {
    ...document,
    backlinks: [...document.backlinks],
    content: [...document.content],
    folderPath: document.folderPath ? [...document.folderPath] : undefined,
  };
}

function placement(document: PrototypeDocument): KnowledgeDocumentPlacement {
  return {
    deletedAt: document.deletedAt,
    folder: document.folder,
    folderPath: document.folderPath ? [...document.folderPath] : undefined,
    id: document.id,
    order: document.order,
  };
}

function placementsThatChanged(
  state: DesktopPrototypeState,
  nextState: DesktopPrototypeState,
): {
  before: KnowledgeDocumentPlacement[];
  after: KnowledgeDocumentPlacement[];
} {
  const previous = new Map(
    state.documents
      .filter((document) => document.projectId === state.activeProjectId)
      .map((document) => [document.id, placement(document)]),
  );
  const before: KnowledgeDocumentPlacement[] = [];
  const after: KnowledgeDocumentPlacement[] = [];
  for (const document of nextState.documents) {
    if (document.projectId !== state.activeProjectId) continue;
    const previousPlacement = previous.get(document.id);
    const nextPlacement = placement(document);
    if (
      !previousPlacement ||
      previousPlacement.folder !== nextPlacement.folder ||
      previousPlacement.order !== nextPlacement.order ||
      previousPlacement.deletedAt !== nextPlacement.deletedAt ||
      !knowledgePathsEqual(
        previousPlacement.folderPath ?? [],
        nextPlacement.folderPath ?? [],
      )
    ) {
      if (previousPlacement) before.push(previousPlacement);
      after.push(nextPlacement);
    }
  }
  return { after, before };
}

function historyEntryId(
  action: DesktopPrototypeAction,
  state: DesktopPrototypeState,
): string {
  return `${action.type}:${state.activeProjectId}:${state.nextDocumentNumber}:${state.nextKnowledgeFolderNumber}`;
}

export function createKnowledgeStructuralHistoryEntry(
  state: DesktopPrototypeState,
  nextState: DesktopPrototypeState,
  action: DesktopPrototypeAction,
): KnowledgeStructuralHistoryEntry | null {
  if (nextState === state) return null;
  const id = historyEntryId(action, state);
  if (action.type === "create-knowledge-document") {
    const document = nextState.documents.find(
      (item) => !state.documents.some((previous) => previous.id === item.id),
    );
    return document
      ? {
          document: cloneDocument(document),
          id,
          kind: "create-document",
          label: "Создание статьи",
          previousSelectedDocumentId: state.selectedDocumentId,
          wasOpened: nextState.openDocumentIds.includes(document.id),
        }
      : null;
  }
  if (action.type === "create-knowledge-folder") {
    const folder = nextState.knowledgeFolders.find(
      (item) =>
        !state.knowledgeFolders.some((previous) => previous.id === item.id),
    );
    return folder
      ? {
          folder: { ...folder, path: [...folder.path] },
          id,
          kind: "create-folder",
          label: "Создание папки",
        }
      : null;
  }
  if (action.type === "rename-knowledge-folder") {
    const oldPath = getKnowledgeFolderPathById(state, action.folderId);
    if (!oldPath) return null;
    const newPath = [...oldPath.slice(0, -1), action.title.trim()];
    if (knowledgePathsEqual(oldPath, newPath)) return null;
    const hasSiblingCollision = getKnowledgeFolderPaths(state).some(
      (path) =>
        knowledgePathsEqual(path, newPath) &&
        !knowledgePathsEqual(path, oldPath),
    );
    if (hasSiblingCollision) return null;
    return {
      id,
      kind: "rename-folder",
      label: "Переименование папки",
      newPath,
      oldPath,
      projectId: state.activeProjectId,
    };
  }
  if (action.type === "move-knowledge-document") {
    const changed = placementsThatChanged(state, nextState);
    return changed.before.length > 0
      ? {
          ...changed,
          documentId: action.documentId,
          id,
          kind: "move-document",
          label: "Перемещение статьи",
        }
      : null;
  }
  if (action.type === "delete-knowledge-folder") {
    const folderPath = getKnowledgeFolderPathById(state, action.folderId);
    if (!folderPath) return null;
    const documents = state.documents
      .filter(
        (document) =>
          document.projectId === state.activeProjectId &&
          document.deletedAt === undefined &&
          knowledgePathStartsWith(getDocumentFolderPath(document), folderPath),
      )
      .map(placement);
    return {
      documents,
      folderPath,
      folders: state.knowledgeFolders
        .filter(
          (folder) =>
            folder.projectId === state.activeProjectId &&
            knowledgePathStartsWith(folder.path, folderPath),
        )
        .map((folder) => ({ ...folder, path: [...folder.path] })),
      id,
      kind: "delete-folder",
      label: "Удаление папки",
      projectId: state.activeProjectId,
    };
  }
  if (
    action.type === "soft-delete-knowledge-document" ||
    action.type === "restore-knowledge-document"
  ) {
    const beforeDocument = getDocumentById(state, action.documentId);
    const afterDocument = getDocumentById(nextState, action.documentId);
    if (!beforeDocument || !afterDocument) return null;
    return {
      after: placement(afterDocument),
      afterOpened: nextState.openDocumentIds.includes(action.documentId),
      afterSelected: nextState.selectedDocumentId === action.documentId,
      before: placement(beforeDocument),
      beforeOpened: state.openDocumentIds.includes(action.documentId),
      beforeSelected: state.selectedDocumentId === action.documentId,
      documentId: action.documentId,
      id,
      kind:
        action.type === "soft-delete-knowledge-document"
          ? "soft-delete-document"
          : "restore-document",
      label:
        action.type === "soft-delete-knowledge-document"
          ? "Удаление статьи"
          : "Восстановление статьи",
    };
  }
  return null;
}

function applyPlacements(
  state: DesktopPrototypeState,
  placements: KnowledgeDocumentPlacement[],
): DesktopPrototypeState {
  const placementById = new Map(placements.map((item) => [item.id, item]));
  const documents = state.documents.map((document) => {
    const next = placementById.get(document.id);
    if (!next) return document;
    const updated = {
      ...document,
      folder: next.folder,
      folderPath: next.folderPath ? [...next.folderPath] : undefined,
      order: next.order,
    };
    if (next.deletedAt === undefined) delete updated.deletedAt;
    else updated.deletedAt = next.deletedAt;
    return updated;
  });
  const selectedDocument = documents.find(
    (document) => document.id === state.selectedDocumentId,
  );
  return {
    ...state,
    documents,
    selectedDocumentFolder:
      selectedDocument?.folder ?? state.selectedDocumentFolder,
    selectedKnowledgeFolderPath: selectedDocument
      ? getDocumentFolderPath(selectedDocument)
      : state.selectedKnowledgeFolderPath,
    selectedKnowledgePath: selectedDocument
      ? {
          documentId: selectedDocument.id,
          kind: "document" as const,
          path: getDocumentFolderPath(selectedDocument),
        }
      : state.selectedKnowledgePath,
  };
}

function restoreDocumentUi(
  state: DesktopPrototypeState,
  documentId: string,
  selected: boolean,
  opened: boolean,
): DesktopPrototypeState {
  const document = getDocumentById(state, documentId);
  if (!document || document.deletedAt !== undefined) return state;
  const openDocumentIds =
    opened && !state.openDocumentIds.includes(documentId)
      ? [...state.openDocumentIds, documentId]
      : state.openDocumentIds;
  if (!selected) return { ...state, openDocumentIds };
  return {
    ...state,
    activeKnowledgePane: "primary",
    openDocumentIds,
    selectedDocumentFolder: document.folder,
    selectedDocumentId: document.id,
    selectedKnowledgeFolderPath: getDocumentFolderPath(document),
    selectedKnowledgePath: {
      documentId: document.id,
      kind: "document",
      path: getDocumentFolderPath(document),
    },
  };
}

function removeDocumentFromSession(
  state: DesktopPrototypeState,
  documentId: string,
): DesktopPrototypeState {
  const closed = closeDocumentTab(state, documentId);
  return {
    ...closed,
    documentHistoryBack: closed.documentHistoryBack.filter(
      (id) => id !== documentId,
    ),
    documentHistoryForward: closed.documentHistoryForward.filter(
      (id) => id !== documentId,
    ),
    documents: closed.documents.filter(
      (document) => document.id !== documentId,
    ),
    splitViewDocumentId:
      closed.splitViewDocumentId === documentId
        ? null
        : closed.splitViewDocumentId,
  };
}

function applyDeletedDocument(
  state: DesktopPrototypeState,
  placementToApply: KnowledgeDocumentPlacement,
): DesktopPrototypeState {
  const placed = applyPlacements(state, [placementToApply]);
  const closed = closeDocumentTab(placed, placementToApply.id);
  return {
    ...closed,
    documentHistoryBack: closed.documentHistoryBack.filter(
      (id) => id !== placementToApply.id,
    ),
    documentHistoryForward: closed.documentHistoryForward.filter(
      (id) => id !== placementToApply.id,
    ),
    knowledgeSplitEnabled:
      placed.selectedDocumentId === placementToApply.id ||
      placed.splitViewDocumentId === placementToApply.id
        ? false
        : closed.knowledgeSplitEnabled,
    splitViewDocumentId:
      placed.selectedDocumentId === placementToApply.id ||
      placed.splitViewDocumentId === placementToApply.id
        ? null
        : closed.splitViewDocumentId,
  };
}

export function applyKnowledgeStructuralHistoryEntry(
  state: DesktopPrototypeState,
  entry: KnowledgeStructuralHistoryEntry,
  direction: "undo" | "redo",
): DesktopPrototypeState {
  if (entry.kind === "create-document") {
    if (direction === "undo") {
      const removed = removeDocumentFromSession(state, entry.document.id);
      return restoreDocumentUi(
        removed,
        entry.previousSelectedDocumentId ?? "",
        entry.previousSelectedDocumentId !== null,
        entry.previousSelectedDocumentId !== null,
      );
    }
    if (state.documents.some((document) => document.id === entry.document.id))
      return state;
    const next = {
      ...state,
      documents: [...state.documents, cloneDocument(entry.document)],
      openDocumentIds: entry.wasOpened
        ? [...state.openDocumentIds, entry.document.id]
        : state.openDocumentIds,
    };
    return restoreDocumentUi(next, entry.document.id, true, entry.wasOpened);
  }
  if (entry.kind === "create-folder") {
    if (direction === "undo") {
      return {
        ...state,
        editingKnowledgeFolderId: null,
        knowledgeFolders: state.knowledgeFolders.filter(
          (folder) => folder.id !== entry.folder.id,
        ),
      };
    }
    if (
      state.knowledgeFolders.some((folder) => folder.id === entry.folder.id)
    ) {
      return state;
    }
    return {
      ...state,
      knowledgeFolders: [
        ...state.knowledgeFolders,
        { ...entry.folder, path: [...entry.folder.path] },
      ],
      selectedKnowledgeFolderPath: [...entry.folder.path],
      selectedKnowledgePath: { kind: "folder", path: [...entry.folder.path] },
    };
  }
  if (entry.kind === "rename-folder") {
    const fromPath = direction === "undo" ? entry.newPath : entry.oldPath;
    const toPath = direction === "undo" ? entry.oldPath : entry.newPath;
    return renameKnowledgeFolder(
      state,
      knowledgeFolderId(entry.projectId, fromPath),
      toPath.at(-1) ?? "",
    );
  }
  if (entry.kind === "move-document") {
    return applyPlacements(
      state,
      direction === "undo" ? entry.before : entry.after,
    );
  }
  if (entry.kind === "delete-folder") {
    if (direction === "redo") {
      return deleteKnowledgeFolder(
        state,
        knowledgeFolderId(entry.projectId, entry.folderPath),
      );
    }
    const existingFolderIds = new Set(
      state.knowledgeFolders.map((folder) => folder.id),
    );
    return applyPlacements(
      {
        ...state,
        knowledgeFolders: [
          ...state.knowledgeFolders,
          ...entry.folders
            .filter((folder) => !existingFolderIds.has(folder.id))
            .map((folder) => ({ ...folder, path: [...folder.path] })),
        ],
      },
      entry.documents,
    );
  }
  const target = direction === "undo" ? entry.before : entry.after;
  const selected =
    direction === "undo" ? entry.beforeSelected : entry.afterSelected;
  const opened = direction === "undo" ? entry.beforeOpened : entry.afterOpened;
  const next =
    target.deletedAt === undefined
      ? applyPlacements(state, [target])
      : applyDeletedDocument(state, target);
  return target.deletedAt === undefined
    ? restoreDocumentUi(next, entry.documentId, selected, opened)
    : next;
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
    selectedKnowledgePath:
      state.selectedDocumentId === movingDocument.id
        ? {
            kind: "document",
            path: targetFolderPath,
            documentId: movingDocument.id,
          }
        : state.selectedKnowledgePath,
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
    selectedKnowledgePath: nextActiveDocument
      ? {
          kind: "document",
          path: getDocumentFolderPath(nextActiveDocument),
          documentId: nextActiveDocument.id,
        }
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
  if (state.knowledgeSplitEnabled) {
    return {
      ...state,
      knowledgeSplitEnabled: false,
      activeKnowledgePane: "primary",
      editingKnowledgeDocumentId: null,
    };
  }
  const remembered = getDocumentById(state, state.splitViewDocumentId);
  const rememberedIsUsable =
    remembered?.projectId === state.activeProjectId &&
    remembered.id !== state.selectedDocumentId;
  return {
    ...state,
    knowledgeSplitEnabled: true,
    splitViewDocumentId: rememberedIsUsable ? remembered.id : null,
    activeKnowledgePane:
      rememberedIsUsable || state.splitViewDocumentId === null
        ? "secondary"
        : "primary",
    editingKnowledgeDocumentId: null,
  };
}

export function closeKnowledgeSplitView(
  state: DesktopPrototypeState,
): DesktopPrototypeState {
  return {
    ...state,
    knowledgeSplitEnabled: false,
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
    pane === "secondary" && paneState.splitEnabled ? "secondary" : "primary";
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
