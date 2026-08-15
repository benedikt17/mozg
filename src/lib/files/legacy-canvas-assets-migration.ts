import type { CloudCanvasAssetRepository } from "@/lib/canvas/cloud-canvas-asset-repository";
import type {
  CloudCanvasRepository,
  CloudLoadedCanvas,
} from "@/lib/canvas/cloud-canvas-repository";
import { parseCanvasDocumentV2 } from "@/lib/canvas/canvas-document";
import { generateAndStoreProjectFileImageVariantsBestEffort } from "@/lib/files/project-file-image-variant-generation";
import type { ProjectFileImageVariantRepository } from "@/lib/files/project-file-image-variants";
import type {
  ProjectFileRecord,
  ProjectFileRepository,
  ProjectFileMimeType,
} from "@/lib/files/project-file-repository";
import { CloudProjectFileRepositoryError } from "@/lib/files/project-file-runtime";

export type LegacyCanvasAssetMigrationItem = {
  canvasId: string;
  canvasTitle: string;
  assetId: string;
  targetFileId: string;
  targetName: string;
  mimeType: ProjectFileMimeType;
  byteSize: number;
  width: number;
  height: number;
  checksum: string | null;
  alreadyMigrated: boolean;
};

export type LegacyCanvasAssetMigrationPlan = {
  workspaceId: string;
  projectId: string;
  canvasesScanned: number;
  canvasesWithLegacyAssets: number;
  legacyReferences: number;
  distinctLegacyAssets: number;
  alreadyMigratedAssets: number;
  items: LegacyCanvasAssetMigrationItem[];
};

export type LegacyCanvasAssetMigrationResult = {
  migratedAssets: number;
  reusedAssets: number;
  migratedCanvases: number;
  legacyReferencesRewritten: number;
};

export class LegacyCanvasAssetMigrationError extends Error {
  constructor(
    message: string,
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "LegacyCanvasAssetMigrationError";
  }
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

function sanitizeFileStem(value: string): string {
  const trimmed = value.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/gu, " ");
  const collapsed = trimmed.replace(/\s+/gu, " ").trim();
  return (collapsed || "Холст").slice(0, 180);
}

function targetName(
  canvasTitle: string,
  index: number,
  mimeType: string,
): string {
  const padded = String(index + 1).padStart(2, "0");
  return `${sanitizeFileStem(canvasTitle)} — изображение ${padded}.${extensionForMimeType(mimeType)}`;
}

function isImageMimeType(value: string): value is ProjectFileMimeType {
  return (
    value === "image/png" || value === "image/jpeg" || value === "image/webp"
  );
}

function legacyAssetIds(canvas: CloudLoadedCanvas): string[] {
  const parsed = parseCanvasDocumentV2(canvas.document);
  return parsed.nodes.flatMap((node) => {
    if (node.kind !== "image" || !("assetId" in node)) return [];
    return [node.assetId];
  });
}

async function getExistingProjectFile(input: {
  repository: ProjectFileRepository;
  workspaceId: string;
  projectId: string;
  fileId: string;
}): Promise<ProjectFileRecord | null> {
  try {
    return await input.repository.getFile({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      fileId: input.fileId,
    });
  } catch (error) {
    if (
      error instanceof CloudProjectFileRepositoryError &&
      error.code === "not-found"
    ) {
      return null;
    }
    throw error;
  }
}

function assertCompatibleExistingFile(
  item: LegacyCanvasAssetMigrationItem,
  existing: ProjectFileRecord,
): void {
  if (
    existing.deletedAt !== null ||
    existing.readyAt === null ||
    existing.mimeType !== item.mimeType ||
    existing.byteSize !== item.byteSize ||
    existing.width !== item.width ||
    existing.height !== item.height
  ) {
    throw new LegacyCanvasAssetMigrationError(
      "Existing Project File with legacy asset UUID is incompatible.",
      {
        assetId: item.assetId,
        existingFileId: existing.id,
      },
    );
  }
}

export async function planLegacyCanvasAssetsMigration(input: {
  workspaceId: string;
  projectId: string;
  canvasRepository: CloudCanvasRepository;
  legacyAssetRepository: CloudCanvasAssetRepository;
  projectFileRepository: ProjectFileRepository;
}): Promise<LegacyCanvasAssetMigrationPlan> {
  const summaries = await input.canvasRepository.listCanvases(
    input.workspaceId,
  );
  const items: LegacyCanvasAssetMigrationItem[] = [];
  let legacyReferences = 0;
  let canvasesWithLegacyAssets = 0;

  for (const summary of summaries) {
    const canvas = await input.canvasRepository.loadCanvas(
      input.workspaceId,
      summary.id,
    );
    const ids = legacyAssetIds(canvas);
    if (ids.length === 0) continue;
    canvasesWithLegacyAssets += 1;
    legacyReferences += ids.length;

    const uniqueIds = [...new Set(ids)];
    for (const [index, assetId] of uniqueIds.entries()) {
      const metadata = await input.legacyAssetRepository.getAssetMetadata({
        workspaceId: input.workspaceId,
        canvasId: canvas.id,
        assetId,
      });
      if (!metadata.readyAt || metadata.deletedAt) {
        throw new LegacyCanvasAssetMigrationError(
          "Legacy Canvas asset is not ready for migration.",
          { canvasId: canvas.id, assetId },
        );
      }
      if (!isImageMimeType(metadata.mimeType)) {
        throw new LegacyCanvasAssetMigrationError(
          "Legacy Canvas asset MIME type is unsupported by Project Files.",
          { canvasId: canvas.id, assetId, mimeType: metadata.mimeType },
        );
      }

      const draft: LegacyCanvasAssetMigrationItem = {
        canvasId: canvas.id,
        canvasTitle: canvas.title,
        assetId,
        targetFileId: assetId,
        targetName: targetName(canvas.title, index, metadata.mimeType),
        mimeType: metadata.mimeType,
        byteSize: metadata.byteSize,
        width: metadata.width,
        height: metadata.height,
        checksum: metadata.checksum,
        alreadyMigrated: false,
      };
      const existing = await getExistingProjectFile({
        repository: input.projectFileRepository,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        fileId: assetId,
      });
      if (existing) {
        assertCompatibleExistingFile(draft, existing);
        draft.alreadyMigrated = true;
      }
      items.push(draft);
    }
  }

  const distinctIds = new Set(items.map((item) => item.assetId));
  if (distinctIds.size !== items.length) {
    throw new LegacyCanvasAssetMigrationError(
      "A legacy asset UUID is referenced by more than one Canvas. Migration intentionally refuses cross-Canvas legacy identity.",
    );
  }

  return {
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    canvasesScanned: summaries.length,
    canvasesWithLegacyAssets,
    legacyReferences,
    distinctLegacyAssets: items.length,
    alreadyMigratedAssets: items.filter((item) => item.alreadyMigrated).length,
    items,
  };
}

async function ensureProjectFile(input: {
  item: LegacyCanvasAssetMigrationItem;
  workspaceId: string;
  projectId: string;
  legacyAssetRepository: CloudCanvasAssetRepository;
  projectFileRepository: ProjectFileRepository;
  projectFileVariantRepository: ProjectFileImageVariantRepository;
}): Promise<"migrated" | "reused"> {
  const existing = await getExistingProjectFile({
    repository: input.projectFileRepository,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    fileId: input.item.targetFileId,
  });
  if (existing) {
    assertCompatibleExistingFile(input.item, existing);
    return "reused";
  }

  const legacy = await input.legacyAssetRepository.downloadAsset({
    workspaceId: input.workspaceId,
    canvasId: input.item.canvasId,
    assetId: input.item.assetId,
  });
  if (legacy.blob.size !== input.item.byteSize) {
    throw new LegacyCanvasAssetMigrationError(
      "Legacy original byte size changed during migration.",
      { assetId: input.item.assetId },
    );
  }

  const uploaded = await input.projectFileRepository.uploadFile({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    fileId: input.item.targetFileId,
    folderId: null,
    name: input.item.targetName,
    originalName: input.item.targetName,
    blob: legacy.blob,
    mimeType: input.item.mimeType,
    byteSize: input.item.byteSize,
    checksum: input.item.checksum,
    width: input.item.width,
    height: input.item.height,
  });

  await generateAndStoreProjectFileImageVariantsBestEffort({
    repository: input.projectFileVariantRepository,
    file: uploaded,
    sourceBlob: legacy.blob,
  });
  return "migrated";
}

function rewriteCanvasLegacyReferences(
  canvas: CloudLoadedCanvas,
  expectedAssetIds: ReadonlySet<string>,
): { document: CloudLoadedCanvas["document"]; rewritten: number } {
  const parsed = parseCanvasDocumentV2(canvas.document);
  let rewritten = 0;
  const document = parseCanvasDocumentV2({
    ...parsed,
    nodes: parsed.nodes.map((node) => {
      if (node.kind !== "image" || !("assetId" in node)) return node;
      if (!expectedAssetIds.has(node.assetId)) return node;
      const { assetId, ...rest } = node;
      rewritten += 1;
      return { ...rest, fileId: assetId };
    }),
  });
  return { document, rewritten };
}

export async function runLegacyCanvasAssetsMigration(input: {
  plan: LegacyCanvasAssetMigrationPlan;
  canvasRepository: CloudCanvasRepository;
  legacyAssetRepository: CloudCanvasAssetRepository;
  projectFileRepository: ProjectFileRepository;
  projectFileVariantRepository: ProjectFileImageVariantRepository;
  onProgress?: (message: string) => void;
}): Promise<LegacyCanvasAssetMigrationResult> {
  let migratedAssets = 0;
  let reusedAssets = 0;
  let migratedCanvases = 0;
  let legacyReferencesRewritten = 0;

  for (const item of input.plan.items) {
    input.onProgress?.(`Файл: ${item.targetName}`);
    const status = await ensureProjectFile({
      item,
      workspaceId: input.plan.workspaceId,
      projectId: input.plan.projectId,
      legacyAssetRepository: input.legacyAssetRepository,
      projectFileRepository: input.projectFileRepository,
      projectFileVariantRepository: input.projectFileVariantRepository,
    });
    if (status === "migrated") migratedAssets += 1;
    else reusedAssets += 1;
  }

  const byCanvas = new Map<string, Set<string>>();
  for (const item of input.plan.items) {
    const ids = byCanvas.get(item.canvasId) ?? new Set<string>();
    ids.add(item.assetId);
    byCanvas.set(item.canvasId, ids);
  }

  for (const [canvasId, assetIds] of byCanvas) {
    input.onProgress?.(`Холст: ${canvasId}`);
    const canvas = await input.canvasRepository.loadCanvas(
      input.plan.workspaceId,
      canvasId,
    );
    const rewritten = rewriteCanvasLegacyReferences(canvas, assetIds);
    if (rewritten.rewritten === 0) continue;

    for (const assetId of assetIds) {
      const target = await input.projectFileRepository.getFile({
        workspaceId: input.plan.workspaceId,
        projectId: input.plan.projectId,
        fileId: assetId,
      });
      const item = input.plan.items.find(
        (candidate) => candidate.assetId === assetId,
      );
      if (!item) {
        throw new LegacyCanvasAssetMigrationError(
          "Migration plan lost a legacy asset item.",
          { canvasId, assetId },
        );
      }
      assertCompatibleExistingFile(item, target);
    }

    const result = await input.canvasRepository.saveCanvasDocument({
      workspaceId: input.plan.workspaceId,
      canvasId,
      expectedRevision: canvas.revision,
      title: canvas.title,
      document: rewritten.document,
    });
    if (result.status !== "saved") {
      throw new LegacyCanvasAssetMigrationError(
        "Canvas changed during legacy asset migration. Project Files were kept, but Canvas JSON was not overwritten.",
        { canvasId, currentRevision: result.revision },
      );
    }
    migratedCanvases += 1;
    legacyReferencesRewritten += rewritten.rewritten;
  }

  return {
    migratedAssets,
    reusedAssets,
    migratedCanvases,
    legacyReferencesRewritten,
  };
}
