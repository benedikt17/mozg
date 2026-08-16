import type {
  PrototypeDocument,
  PrototypeProject,
} from "@/prototype/desktop-mock-data";
import type {
  DesktopPrototypeState,
  PrototypeKnowledgeFolder,
} from "@/prototype/state/types";

export type KnowledgeBackupSource = Pick<
  DesktopPrototypeState,
  "documents" | "knowledgeFolders" | "projects"
>;

export type KnowledgeBackupEntry = {
  content: string;
  directory: boolean;
  path: string;
};

export type KnowledgeBackupManifestDocument = {
  deletedAt?: string;
  documentId: string;
  path: string;
  projectId: string;
  title: string;
};

export type KnowledgeBackupManifest = {
  activeDocumentCount: number;
  deletedDocumentCount: number;
  documentCount: number;
  format: "mozg-knowledge-backup";
  generatedAt: string;
  projectCount: number;
  version: 1;
  documents: KnowledgeBackupManifestDocument[];
};

export type KnowledgeBackupArchive = {
  bytes: Uint8Array;
  entries: KnowledgeBackupEntry[];
  fileName: string;
  manifest: KnowledgeBackupManifest;
};

type ProjectDescriptor = Pick<PrototypeProject, "id" | "name">;

type DocumentExport = {
  document: PrototypeDocument;
  folderPath: string[];
  projectRoot: string;
};

const textEncoder = new TextEncoder();
const windowsReservedName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

export function createKnowledgeBackup(
  source: KnowledgeBackupSource,
  generatedAt = new Date(),
): KnowledgeBackupArchive {
  const { entries, manifest } = createKnowledgeBackupEntries(source, generatedAt);
  return {
    bytes: createStoreZip(entries, generatedAt),
    entries,
    fileName: knowledgeBackupFileName(generatedAt),
    manifest,
  };
}

export function createKnowledgeBackupEntries(
  source: KnowledgeBackupSource,
  generatedAt = new Date(),
): {
  entries: KnowledgeBackupEntry[];
  manifest: KnowledgeBackupManifest;
} {
  const projects = getProjectDescriptors(source);
  const projectRootById = createProjectRoots(projects);
  const folderPathByProject = createFolderPathMap(
    projects,
    source.knowledgeFolders,
    source.documents,
  );
  const entries: KnowledgeBackupEntry[] = [];
  const documents: KnowledgeBackupManifestDocument[] = [];
  const directoryPaths = new Set<string>();
  const fileNamesByDirectory = new Map<string, Set<string>>();

  const addDirectory = (path: string): void => {
    const normalized = path.endsWith("/") ? path : `${path}/`;
    if (directoryPaths.has(normalized)) return;
    directoryPaths.add(normalized);
    entries.push({ content: "", directory: true, path: normalized });
  };

  for (const project of projects) {
    const projectRoot = projectRootById.get(project.id);
    if (!projectRoot) continue;
    addDirectory(projectRoot);
    const projectFolders = getProjectFolderPaths(
      project.id,
      source.knowledgeFolders,
      source.documents,
    );
    for (const folderPath of projectFolders) {
      const exportedFolderPath = folderPathByProject.get(
        folderMapKey(project.id, folderPath),
      );
      if (!exportedFolderPath) continue;
      addDirectory(joinPath(projectRoot, ...exportedFolderPath));
    }
  }

  const sortedDocuments = [...source.documents].sort(compareDocuments);
  const activeDocuments: DocumentExport[] = [];
  const deletedDocuments: DocumentExport[] = [];

  for (const document of sortedDocuments) {
    const projectRoot = projectRootById.get(document.projectId);
    if (!projectRoot) continue;
    const originalFolderPath = getDocumentFolderPath(document);
    const folderPath =
      folderPathByProject.get(folderMapKey(document.projectId, originalFolderPath)) ??
      [];
    const target = { document, folderPath, projectRoot };
    if (document.deletedAt === undefined) activeDocuments.push(target);
    else deletedDocuments.push(target);
  }

  const exportDocuments = (
    targets: DocumentExport[],
    rootPrefix: string | null,
  ): void => {
    for (const { document, folderPath, projectRoot } of targets) {
      const directory = rootPrefix
        ? joinPath(rootPrefix, projectRoot, ...folderPath)
        : joinPath(projectRoot, ...folderPath);
      ensureDirectoryChain(addDirectory, directory);
      const usedNames = getOrCreateSet(fileNamesByDirectory, directory);
      const fileName = createUniqueMarkdownName(document.title, usedNames);
      const path = joinPath(directory, fileName);
      entries.push({
        content: document.content.join("\n"),
        directory: false,
        path,
      });
      documents.push({
        ...(document.deletedAt ? { deletedAt: document.deletedAt } : {}),
        documentId: document.id,
        path,
        projectId: document.projectId,
        title: document.title,
      });
    }
  };

  exportDocuments(activeDocuments, null);
  if (deletedDocuments.length > 0) {
    addDirectory("_Корзина");
    exportDocuments(deletedDocuments, "_Корзина");
  }

  const manifest: KnowledgeBackupManifest = {
    activeDocumentCount: activeDocuments.length,
    deletedDocumentCount: deletedDocuments.length,
    documentCount: source.documents.length,
    documents,
    format: "mozg-knowledge-backup",
    generatedAt: generatedAt.toISOString(),
    projectCount: projects.length,
    version: 1,
  };

  entries.unshift({
    content: `${JSON.stringify(manifest, null, 2)}\n`,
    directory: false,
    path: "manifest.json",
  });

  return { entries, manifest };
}

export function knowledgeBackupFileName(generatedAt: Date): string {
  const date = [
    generatedAt.getUTCFullYear().toString().padStart(4, "0"),
    (generatedAt.getUTCMonth() + 1).toString().padStart(2, "0"),
    generatedAt.getUTCDate().toString().padStart(2, "0"),
  ].join("-");
  return `MOZG-Knowledge-Backup-${date}.zip`;
}

function getProjectDescriptors(source: KnowledgeBackupSource): ProjectDescriptor[] {
  const result: ProjectDescriptor[] = source.projects.map(({ id, name }) => ({
    id,
    name,
  }));
  const knownIds = new Set(result.map((project) => project.id));
  const referencedIds = new Set([
    ...source.documents.map((document) => document.projectId),
    ...source.knowledgeFolders.map((folder) => folder.projectId),
  ]);
  for (const projectId of referencedIds) {
    if (knownIds.has(projectId)) continue;
    result.push({ id: projectId, name: `Неизвестный проект ${projectId}` });
    knownIds.add(projectId);
  }
  return result;
}

function createProjectRoots(projects: ProjectDescriptor[]): Map<string, string> {
  const result = new Map<string, string>();
  const usedRootNames = new Set<string>(["_Корзина"]);
  for (const project of projects) {
    result.set(
      project.id,
      createUniqueSegment(project.name, usedRootNames, "Проект"),
    );
  }
  return result;
}

function createFolderPathMap(
  projects: ProjectDescriptor[],
  folders: PrototypeKnowledgeFolder[],
  documents: PrototypeDocument[],
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const project of projects) {
    const paths = getProjectFolderPaths(project.id, folders, documents);
    const usedNamesByParent = new Map<string, Set<string>>();
    for (const path of paths) {
      const parent = path.slice(0, -1);
      const parentExported =
        result.get(folderMapKey(project.id, parent)) ?? [];
      const parentKey = parentExported.join("/");
      const usedNames = getOrCreateSet(usedNamesByParent, parentKey);
      const segment = createUniqueSegment(
        path.at(-1) ?? "Папка",
        usedNames,
        "Папка",
      );
      result.set(folderMapKey(project.id, path), [...parentExported, segment]);
    }
  }
  return result;
}

function getProjectFolderPaths(
  projectId: string,
  folders: PrototypeKnowledgeFolder[],
  documents: PrototypeDocument[],
): string[][] {
  const paths = new Map<string, string[]>();
  const addPath = (path: string[]): void => {
    for (let index = 1; index <= path.length; index += 1) {
      const prefix = path.slice(0, index);
      paths.set(prefix.join("\u0000"), prefix);
    }
  };
  for (const folder of folders) {
    if (folder.projectId === projectId) addPath(folder.path);
  }
  for (const document of documents) {
    if (document.projectId === projectId) addPath(getDocumentFolderPath(document));
  }
  return [...paths.values()].sort((left, right) => {
    if (left.length !== right.length) return left.length - right.length;
    return left.join("\u0000").localeCompare(right.join("\u0000"), "ru");
  });
}

function getDocumentFolderPath(document: PrototypeDocument): string[] {
  return document.folderPath ?? (document.folder ? [document.folder] : []);
}

function compareDocuments(left: PrototypeDocument, right: PrototypeDocument): number {
  const projectOrder = left.projectId.localeCompare(right.projectId);
  if (projectOrder !== 0) return projectOrder;
  const folderOrder = getDocumentFolderPath(left)
    .join("\u0000")
    .localeCompare(getDocumentFolderPath(right).join("\u0000"), "ru");
  if (folderOrder !== 0) return folderOrder;
  const explicitOrder = (left.order ?? 0) - (right.order ?? 0);
  if (explicitOrder !== 0) return explicitOrder;
  const titleOrder = left.title.localeCompare(right.title, "ru");
  return titleOrder !== 0 ? titleOrder : left.id.localeCompare(right.id);
}

function folderMapKey(projectId: string, path: string[]): string {
  return `${projectId}\u0001${path.join("\u0000")}`;
}

function createUniqueSegment(
  input: string,
  usedNames: Set<string>,
  fallback: string,
): string {
  const base = sanitizePathSegment(input, fallback);
  if (!usedNames.has(base.toLocaleLowerCase("ru"))) {
    usedNames.add(base.toLocaleLowerCase("ru"));
    return base;
  }
  let suffix = 2;
  while (usedNames.has(`${base} (${suffix})`.toLocaleLowerCase("ru"))) {
    suffix += 1;
  }
  const unique = `${base} (${suffix})`;
  usedNames.add(unique.toLocaleLowerCase("ru"));
  return unique;
}

function createUniqueMarkdownName(title: string, usedNames: Set<string>): string {
  const base = sanitizePathSegment(title, "document");
  const first = `${base}.md`;
  if (!usedNames.has(first.toLocaleLowerCase("ru"))) {
    usedNames.add(first.toLocaleLowerCase("ru"));
    return first;
  }
  let suffix = 2;
  while (usedNames.has(`${base} (${suffix}).md`.toLocaleLowerCase("ru"))) {
    suffix += 1;
  }
  const unique = `${base} (${suffix}).md`;
  usedNames.add(unique.toLocaleLowerCase("ru"));
  return unique;
}

function sanitizePathSegment(input: string, fallback: string): string {
  let value = input
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/[ .]+$/g, "")
    .trim();
  if (value === "." || value === "..") value = "";
  if (!value) value = fallback;
  if (windowsReservedName.test(value)) value = `_${value}`;
  return value.slice(0, 120);
}

function getOrCreateSet(
  map: Map<string, Set<string>>,
  key: string,
): Set<string> {
  const existing = map.get(key);
  if (existing) return existing;
  const created = new Set<string>();
  map.set(key, created);
  return created;
}

function ensureDirectoryChain(
  addDirectory: (path: string) => void,
  directory: string,
): void {
  const segments = directory.split("/").filter(Boolean);
  for (let index = 1; index <= segments.length; index += 1) {
    addDirectory(segments.slice(0, index).join("/"));
  }
}

function joinPath(...segments: string[]): string {
  return segments.filter(Boolean).join("/");
}

function createStoreZip(entries: KnowledgeBackupEntry[], modifiedAt: Date): Uint8Array {
  if (entries.length > 65_535) {
    throw new Error("Knowledge backup contains too many ZIP entries");
  }
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  const { dosDate, dosTime } = toDosDateTime(modifiedAt);
  let localOffset = 0;
  let centralSize = 0;

  for (const entry of entries) {
    const name = textEncoder.encode(entry.path);
    const data = entry.directory ? new Uint8Array() : textEncoder.encode(entry.content);
    const checksum = crc32(data);
    const localHeader = new Uint8Array(30);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, dosTime, true);
    localView.setUint16(12, dosDate, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, data.byteLength, true);
    localView.setUint32(22, data.byteLength, true);
    localView.setUint16(26, name.byteLength, true);
    localView.setUint16(28, 0, true);
    localChunks.push(localHeader, name, data);

    const centralHeader = new Uint8Array(46);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, dosTime, true);
    centralView.setUint16(14, dosDate, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, data.byteLength, true);
    centralView.setUint32(24, data.byteLength, true);
    centralView.setUint16(28, name.byteLength, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, entry.directory ? 0x10 : 0, true);
    centralView.setUint32(42, localOffset, true);
    centralChunks.push(centralHeader, name);

    localOffset += localHeader.byteLength + name.byteLength + data.byteLength;
    centralSize += centralHeader.byteLength + name.byteLength;
  }

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, localOffset, true);
  endView.setUint16(20, 0, true);

  return concatBytes([...localChunks, ...centralChunks, end]);
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function toDosDateTime(date: Date): { dosDate: number; dosTime: number } {
  const year = Math.min(Math.max(date.getUTCFullYear(), 1980), 2107);
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const second = Math.floor(date.getUTCSeconds() / 2);
  return {
    dosDate: ((year - 1980) << 9) | (month << 5) | day,
    dosTime: (hour << 11) | (minute << 5) | second,
  };
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
