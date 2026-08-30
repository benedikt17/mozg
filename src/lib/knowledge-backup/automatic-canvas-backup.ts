import { parseCanvasDocumentV2 } from "@/lib/canvas/canvas-document";
import {
  createCanvasPortableBackupEntries,
  type CanvasPortableBackupFile,
} from "@/prototype/canvases/canvas-portable-export";
import type {
  PrototypeDocument,
  PrototypeProject,
} from "@/prototype/desktop-mock-data";
import type {
  KnowledgeBackupCanvasBundle,
  KnowledgeBackupEntry,
  KnowledgeBackupManifestCanvas,
} from "@/prototype/knowledge/knowledge-backup-export";

export type AutomaticCanvasBackupCanvas = {
  document: unknown;
  groupId: string | null;
  id: string;
  projectId: string;
  revision: number;
  title: string;
};

export type AutomaticCanvasBackupGroup = {
  id: string;
  parentGroupId: string | null;
  projectId: string;
  title: string;
};

export type AutomaticCanvasBackupSource = {
  canvases: readonly AutomaticCanvasBackupCanvas[];
  documents: readonly PrototypeDocument[];
  files: readonly CanvasPortableBackupFile[];
  groups: readonly AutomaticCanvasBackupGroup[];
  projects: readonly Pick<PrototypeProject, "id" | "name">[];
};

/** Builds directory entries to append to the regular Knowledge backup ZIP. */
export function createAutomaticCanvasBackupBundle(
  source: AutomaticCanvasBackupSource,
  generatedAt = new Date(),
): KnowledgeBackupCanvasBundle {
  const projectNames = new Map(
    source.projects.map((project) => [project.id, project.name]),
  );
  const groupsById = new Map(source.groups.map((group) => [group.id, group]));
  const activeArticles = new Map(
    source.documents
      .filter((document) => document.deletedAt === undefined)
      .map((document) => [document.id, document]),
  );
  const filesById = new Map(source.files.map((file) => [file.id, file]));
  const entries: KnowledgeBackupEntry[] = [];
  const canvases: KnowledgeBackupManifestCanvas[] = [];
  const usedRoots = new Set<string>();

  for (const canvas of [...source.canvases].sort(compareCanvases)) {
    const document = parseCanvasDocumentV2(canvas.document);
    const projectName = projectNames.get(canvas.projectId) ?? "Неизвестный проект";
    const root = uniquePath(
      [
        "Холсты",
        projectName,
        ...canvasGroupPath(canvas, groupsById),
        canvas.title,
      ].map((segment) => safeSegment(segment)),
      usedRoots,
      canvas.id,
    );
    const articleIds = new Set(
      document.nodes
        .filter((node) => node.kind === "article")
        .map((node) => node.articleId),
    );
    const fileIds = new Set(
      document.nodes.flatMap((node) => {
        if (node.kind === "pdf") return [node.fileId];
        if (node.kind === "image" && "fileId" in node) return [node.fileId];
        return [];
      }),
    );
    const portable = createCanvasPortableBackupEntries(
      {
        articles: [...articleIds]
          .map((articleId) => activeArticles.get(articleId))
          .filter((article): article is PrototypeDocument => article !== undefined)
          .map((article) => ({
            articleId: article.id,
            markdown: article.content.join("\n"),
            title: article.title,
          })),
        canvasId: canvas.id,
        document,
        files: [...fileIds]
          .map((fileId) => filesById.get(fileId))
          .filter(
            (file): file is CanvasPortableBackupFile => file !== undefined,
          ),
        revision: canvas.revision,
        title: canvas.title,
      },
      generatedAt,
    );
    for (const entry of portable.entries) {
      entries.push({
        content: entry.content,
        directory: false,
        path: `${root}/${entry.path}`,
      });
    }
    canvases.push({
      canvasId: canvas.id,
      nodeCount: document.nodes.length,
      path: root,
      projectId: canvas.projectId,
      revision: canvas.revision,
      title: canvas.title,
    });
  }

  return { canvases, entries };
}

function canvasGroupPath(
  canvas: AutomaticCanvasBackupCanvas,
  groupsById: ReadonlyMap<string, AutomaticCanvasBackupGroup>,
): string[] {
  const path: string[] = [];
  const visited = new Set<string>();
  let groupId = canvas.groupId;
  while (groupId && !visited.has(groupId)) {
    visited.add(groupId);
    const group = groupsById.get(groupId);
    if (!group || group.projectId !== canvas.projectId) break;
    path.unshift(group.title);
    groupId = group.parentGroupId;
  }
  return path;
}

function compareCanvases(
  left: AutomaticCanvasBackupCanvas,
  right: AutomaticCanvasBackupCanvas,
): number {
  const project = left.projectId.localeCompare(right.projectId);
  if (project !== 0) return project;
  const title = left.title.localeCompare(right.title, "ru");
  return title !== 0 ? title : left.id.localeCompare(right.id);
}

function uniquePath(
  segments: string[],
  usedPaths: Set<string>,
  canvasId: string,
): string {
  const base = segments.join("/");
  if (!usedPaths.has(base)) {
    usedPaths.add(base);
    return base;
  }
  const unique = `${base} (${safeSegment(canvasId).slice(0, 8)})`;
  usedPaths.add(unique);
  return unique;
}

function safeSegment(value: string): string {
  const segment = value
    .normalize("NFC")
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/[ .]+$/g, "")
    .trim()
    .slice(0, 100);
  return segment && segment !== "." && segment !== ".." ? segment : "Без названия";
}
