import type { DesktopDomainSnapshotV3 } from "@/prototype/persistence/desktop-snapshot-contracts";

export type KnowledgeCatalog = Pick<
  DesktopDomainSnapshotV3,
  "projects" | "documents"
>;

export type KnowledgeEntry = {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  folderPath: string[];
  markdown: string;
};

export function knowledgeEntries(snapshot: KnowledgeCatalog): KnowledgeEntry[] {
  const projectNames = new Map(
    snapshot.projects.map((project) => [project.id, project.name]),
  );
  return snapshot.documents
    .filter((document) => document.deletedAt === undefined)
    .map((document) => ({
      id: document.id,
      projectId: document.projectId,
      projectName: projectNames.get(document.projectId) ?? "",
      title: document.title,
      folderPath:
        document.folderPath ?? (document.folder ? [document.folder] : []),
      markdown: document.content.join("\n"),
    }));
}

export function pageEntries(
  entries: readonly KnowledgeEntry[],
  offset: number,
  limit: number,
): {
  total: number;
  nextOffset: number | null;
  items: Omit<KnowledgeEntry, "markdown">[];
} {
  const items = entries.slice(offset, offset + limit).map((entry) => ({
    id: entry.id,
    projectId: entry.projectId,
    projectName: entry.projectName,
    title: entry.title,
    folderPath: entry.folderPath,
  }));
  return {
    total: entries.length,
    nextOffset: offset + limit < entries.length ? offset + limit : null,
    items,
  };
}

export function searchEntries(
  entries: readonly KnowledgeEntry[],
  query: string,
): KnowledgeEntry[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  return entries.filter((entry) =>
    [entry.title, entry.projectName, ...entry.folderPath, entry.markdown].some(
      (value) => value.toLocaleLowerCase().includes(needle),
    ),
  );
}
