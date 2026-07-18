import type { PrototypeDocument } from "@/prototype/desktop-mock-data";
import type {
  DesktopPrototypeState,
  KnowledgePaneState,
  KnowledgeTreeNode,
} from "@/prototype/desktop-state";

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
