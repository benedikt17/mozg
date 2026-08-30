import type {
  CanvasGroup,
  CanvasGroupRepository,
  CreateCanvasGroupInput,
  DeleteCanvasGroupInput,
  MoveCanvasGroupInput,
  MoveCanvasToGroupInput,
  RenameCanvasGroupInput,
} from "@/lib/canvas/canvas-group-repository";
import type {
  CanvasAssetRecord,
  CanvasAssetMetadata,
  CanvasAssetRepository,
  CanvasOriginalLoadReason,
  CanvasRepository,
  CanvasSummary,
  CanvasViewState,
  CanvasViewStateRepository,
  LoadedCanvas,
  StoreLocalCanvasImageInput,
} from "@/lib/canvas/local-canvas-repository";
import type {
  CloudCanvasAssetRepository,
  CloudCanvasAssetMetadata,
} from "@/lib/canvas/cloud-canvas-asset-repository";
import type {
  CloudCanvasRepository,
  CloudCanvasSummary,
  CloudLoadedCanvas,
} from "@/lib/canvas/cloud-canvas-repository";
import {
  CANVAS_DOCUMENT_SCHEMA_VERSION,
  parseCanvasDocumentV2,
} from "@/lib/canvas/canvas-document";
import type { CanvasPendingSaveFlushRegistration } from "@/lib/canvas/canvas-pending-save-lifecycle";
import {
  cloudCanvasRuntimeCache,
  type CloudCanvasRuntimeCache,
} from "@/lib/canvas/cloud-canvas-runtime-cache";
import type {
  CanvasAssetVariantKind,
  CanvasAssetVariantMetadata,
  CanvasAssetVariantRecord,
  CanvasAssetVariantV2Metadata,
  CanvasAssetVariantV2Record,
  StoreCanvasAssetVariantInput,
  StoreCanvasAssetVariantV2Input,
} from "@/lib/canvas/canvas-image-variants";

export type CanvasShellRepository = CanvasRepository &
  CanvasViewStateRepository &
  CanvasGroupRepository;

type CanvasAssetOperationScope = CanvasAssetRepository & {
  isCurrent: () => boolean;
};

function summary(canvas: CloudCanvasSummary): CanvasSummary {
  return {
    id: canvas.id,
    workspaceId: canvas.workspaceId,
    title: canvas.title,
    groupId: canvas.groupId,
    sortOrder: canvas.sortOrder,
    revision: canvas.revision,
    createdAt: canvas.createdAt,
    updatedAt: canvas.updatedAt,
    deletedAt: null,
  };
}

function loadedCanvas(canvas: CloudLoadedCanvas): LoadedCanvas {
  return {
    ...summary(canvas),
    schemaVersion: CANVAS_DOCUMENT_SCHEMA_VERSION,
    document: canvas.document,
  };
}

function assetRecord(
  metadata: CloudCanvasAssetMetadata,
  blob: Blob,
): CanvasAssetRecord {
  return {
    id: metadata.id,
    workspaceId: metadata.workspaceId,
    blob,
    preview: null,
    mimeType: metadata.mimeType,
    byteSize: metadata.byteSize,
    width: metadata.width,
    height: metadata.height,
    checksum: metadata.checksum,
    createdAt: metadata.createdAt,
    readyAt: metadata.readyAt,
    deletedAt: metadata.deletedAt,
  };
}

function assetMetadata(
  metadata: CloudCanvasAssetMetadata,
): CanvasAssetMetadata {
  const {
    id,
    workspaceId,
    mimeType,
    byteSize,
    width,
    height,
    checksum,
    createdAt,
    readyAt,
    deletedAt,
  } = metadata;
  return {
    id,
    workspaceId,
    mimeType,
    byteSize,
    width,
    height,
    checksum,
    createdAt,
    readyAt,
    deletedAt,
  };
}

export class CloudCanvasShellRepository
  implements CanvasShellRepository, CanvasAssetRepository
{
  private activeCanvasId: string | null = null;
  private assetScopeEpoch = 0;
  private pendingSaveFlush: CanvasPendingSaveFlushRegistration | null = null;

  constructor(
    private readonly workspaceId: string,
    private readonly canvasRepository: CloudCanvasRepository,
    private readonly assetRepository: CloudCanvasAssetRepository,
    private readonly runtimeCache: CloudCanvasRuntimeCache = cloudCanvasRuntimeCache,
  ) {}

  registerPendingSaveFlush(
    registration: CanvasPendingSaveFlushRegistration,
  ): void {
    this.pendingSaveFlush = registration;
  }

  beginCanvasNavigation(canvasId: string | null): void {
    this.setActiveCanvas(canvasId);
  }

  beginAssetScope(): CanvasAssetOperationScope {
    const canvasId = this.canvasIdForAssetLookup();
    const epoch = this.assetScopeEpoch;
    return {
      storeImage: (input) => this.storeImageForCanvas(canvasId, input),
      loadAsset: (input) => this.loadAssetForCanvas(canvasId, input),
      getAssetMetadata: (input) =>
        this.getAssetMetadataForCanvas(canvasId, input),
      markAssetDeleted: (input) =>
        this.markAssetDeletedForCanvas(canvasId, input),
      isCurrent: () =>
        this.assetScopeEpoch === epoch && this.activeCanvasId === canvasId,
    };
  }

  async listCanvases(workspaceId: string): Promise<CanvasSummary[]> {
    return (await this.canvasRepository.listCanvases(workspaceId)).map(summary);
  }

  async createCanvas(input: {
    workspaceId: string;
    title: string;
    groupId?: string | null;
  }): Promise<LoadedCanvas> {
    const canvas = loadedCanvas(
      await this.canvasRepository.createCanvas(
        input.workspaceId,
        input.title,
        input.groupId,
      ),
    );
    this.setActiveCanvas(canvas.id);
    return canvas;
  }

  listCanvasGroups(workspaceId: string): Promise<CanvasGroup[]> {
    return this.canvasRepository.listCanvasGroups(workspaceId);
  }
  createCanvasGroup(input: CreateCanvasGroupInput): Promise<CanvasGroup> {
    return this.canvasRepository.createCanvasGroup(input);
  }
  renameCanvasGroup(input: RenameCanvasGroupInput): Promise<CanvasGroup> {
    return this.canvasRepository.renameCanvasGroup(input);
  }
  softDeleteCanvasGroup(input: DeleteCanvasGroupInput) {
    return this.canvasRepository.softDeleteCanvasGroup(input);
  }
  moveCanvasGroup(input: MoveCanvasGroupInput): Promise<CanvasGroup> {
    return this.canvasRepository.moveCanvasGroup(input);
  }
  moveCanvasToGroup(input: MoveCanvasToGroupInput): Promise<void> {
    return this.canvasRepository.moveCanvasToGroup(input);
  }

  async loadCanvas(input: {
    workspaceId: string;
    canvasId: string;
  }): Promise<LoadedCanvas | null> {
    try {
      const canvas = loadedCanvas(
        await this.canvasRepository.loadCanvas(
          input.workspaceId,
          input.canvasId,
        ),
      );
      this.setActiveCanvas(canvas.id);
      return canvas;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async saveCanvas(input: {
    workspaceId: string;
    canvasId: string;
    expectedRevision: number;
    title: string;
    document: LoadedCanvas["document"];
  }): Promise<{ status: "saved" | "conflict"; revision: number }> {
    return this.canvasRepository.saveCanvasDocument({
      ...input,
      document: parseCanvasDocumentV2(input.document),
    });
  }

  async softDeleteCanvas(input: {
    workspaceId: string;
    canvasId: string;
  }): Promise<{ status: "deleted" | "already-deleted" }> {
    if (input.canvasId === this.activeCanvasId) this.setActiveCanvas(null);
    await this.canvasRepository.deleteCanvas(input.workspaceId, input.canvasId);
    return { status: "deleted" };
  }

  async loadViewState(input: {
    canvasId: string;
    userId: string;
  }): Promise<CanvasViewState | null> {
    const view = await this.canvasRepository.loadCanvasViewState(
      this.workspaceId,
      input.canvasId,
    );
    if (!view || view.userId !== input.userId) return null;
    return {
      canvasId: view.canvasId,
      openArticleId: view.openArticleId,
      userId: view.userId,
      viewportX: view.viewportX,
      viewportY: view.viewportY,
      zoom: view.zoom,
      updatedAt: view.updatedAt,
    };
  }

  async saveViewState(input: CanvasViewState): Promise<void> {
    await this.canvasRepository.saveCanvasViewState({
      workspaceId: this.workspaceId,
      canvasId: input.canvasId,
      viewportX: input.viewportX,
      viewportY: input.viewportY,
      zoom: input.zoom,
      openArticleId: input.openArticleId,
    });
  }

  async deleteViewState(): Promise<void> {
    // Cloud view state is intentionally user-scoped and has no delete RPC in V2.
  }

  storeImage(input: StoreLocalCanvasImageInput): Promise<CanvasAssetRecord> {
    return this.storeImageForCanvas(
      this.canvasIdForAssetUpload(input.workspaceId),
      input,
    );
  }

  loadAsset(input: {
    workspaceId: string;
    assetId: string;
    reason?: CanvasOriginalLoadReason;
  }): Promise<CanvasAssetRecord | null> {
    return this.loadAssetForCanvas(this.canvasIdForAssetLookup(), input);
  }

  getAssetMetadata(input: {
    workspaceId: string;
    assetId: string;
  }): Promise<CanvasAssetMetadata | null> {
    return this.getAssetMetadataForCanvas(this.canvasIdForAssetLookup(), input);
  }

  markAssetDeleted(input: {
    workspaceId: string;
    assetId: string;
  }): Promise<void> {
    return this.markAssetDeletedForCanvas(this.canvasIdForAssetLookup(), input);
  }

  listVariants(input: {
    workspaceId: string;
    canvasId: string;
    assetId: string;
  }): Promise<CanvasAssetVariantMetadata[]> {
    return this.assetRepository.listVariants(input);
  }

  listVariantsForAssets(input: {
    workspaceId: string;
    canvasId: string;
    assetIds: readonly string[];
  }): Promise<ReadonlyMap<string, readonly CanvasAssetVariantMetadata[]>> {
    if (this.assetRepository.listVariantsForAssets)
      return this.assetRepository.listVariantsForAssets(input);
    return Promise.all(
      input.assetIds.map(
        async (assetId) =>
          [
            assetId,
            await this.assetRepository.listVariants({ ...input, assetId }),
          ] as const,
      ),
    ).then((entries) => new Map(entries));
  }

  loadVariant(input: {
    workspaceId: string;
    canvasId: string;
    assetId: string;
    kind: CanvasAssetVariantKind;
  }): Promise<CanvasAssetVariantRecord | null> {
    return this.assetRepository.loadVariant(input);
  }

  listVariantTiers(input: {
    workspaceId: string;
    canvasId: string;
    assetId: string;
  }): Promise<CanvasAssetVariantV2Metadata[]> {
    return this.assetRepository.listVariantTiers(input);
  }

  listVariantTiersForAssets(input: {
    workspaceId: string;
    canvasId: string;
    assetIds: readonly string[];
  }): Promise<ReadonlyMap<string, readonly CanvasAssetVariantV2Metadata[]>> {
    if (this.assetRepository.listVariantTiersForAssets)
      return this.assetRepository.listVariantTiersForAssets(input);
    return Promise.all(
      input.assetIds.map(
        async (assetId) =>
          [
            assetId,
            await this.assetRepository.listVariantTiers({ ...input, assetId }),
          ] as const,
      ),
    ).then((entries) => new Map(entries));
  }

  loadVariantTier(input: {
    workspaceId: string;
    canvasId: string;
    assetId: string;
    targetMaxEdge: number;
  }): Promise<CanvasAssetVariantV2Record | null> {
    return this.assetRepository.loadVariantTier(input);
  }

  storeVariantTier(
    input: StoreCanvasAssetVariantV2Input,
  ): Promise<CanvasAssetVariantV2Metadata> {
    return this.assetRepository.storeVariantTier(input);
  }

  storeVariant(
    input: StoreCanvasAssetVariantInput,
  ): Promise<CanvasAssetVariantMetadata> {
    return this.assetRepository.storeVariant(input);
  }

  deleteVariants(input: {
    workspaceId: string;
    canvasId: string;
    assetId: string;
  }): Promise<void> {
    return this.assetRepository.deleteVariants(input);
  }

  close(): void {
    this.invalidateAssetScopes();
    this.activeCanvasId = null;
    const registration = this.pendingSaveFlush;
    if (!registration) return;
    void registration
      .flush()
      .then((state) => {
        if (!state) return;
        const scope = {
          workspaceId: this.workspaceId,
          userId: registration.userId,
        };
        const cached = this.runtimeCache.get(scope, state.canvasId);
        if (!cached) return;
        this.runtimeCache.set({
          ...cached,
          shellState: {
            ...cached.shellState,
            canvasId: state.canvasId,
            title: state.title,
            revision: state.revision,
            status: state.status,
            error: state.error,
            conflictRevision: state.conflictRevision,
            autosaveBlocked: state.autosaveBlocked,
          },
          summaries: cached.summaries.map((canvas) =>
            canvas.id === state.canvasId
              ? {
                  ...canvas,
                  title: state.title,
                  revision: state.revision,
                }
              : canvas,
          ),
        });
      })
      .catch(() => undefined);
  }

  setActiveCanvas(canvasId: string | null): void {
    if (canvasId !== this.activeCanvasId) this.invalidateAssetScopes();
    this.activeCanvasId = canvasId;
  }

  private async storeImageForCanvas(
    canvasId: string,
    input: StoreLocalCanvasImageInput,
  ): Promise<CanvasAssetRecord> {
    const scopedCanvasId = this.canvasIdForAssetScope(
      input.workspaceId,
      canvasId,
    );
    const metadata = await this.assetRepository.uploadAsset({
      workspaceId: input.workspaceId,
      canvasId: scopedCanvasId,
      ...(input.id === undefined ? {} : { assetId: input.id }),
      blob: input.blob,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
      width: input.width,
      height: input.height,
      checksum: input.checksum,
    });
    return assetRecord(metadata, input.blob);
  }

  private async loadAssetForCanvas(
    canvasId: string,
    input: {
      workspaceId: string;
      assetId: string;
      reason?: CanvasOriginalLoadReason;
    },
  ): Promise<CanvasAssetRecord | null> {
    const scopedCanvasId = this.canvasIdForAssetScope(
      input.workspaceId,
      canvasId,
    );
    try {
      const asset = await this.assetRepository.downloadAsset({
        workspaceId: input.workspaceId,
        canvasId: scopedCanvasId,
        assetId: input.assetId,
      });
      return assetRecord(asset, asset.blob);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  private async getAssetMetadataForCanvas(
    canvasId: string,
    input: { workspaceId: string; assetId: string },
  ): Promise<CanvasAssetMetadata | null> {
    const scopedCanvasId = this.canvasIdForAssetScope(
      input.workspaceId,
      canvasId,
    );
    try {
      return assetMetadata(
        await this.assetRepository.getAssetMetadata({
          workspaceId: input.workspaceId,
          canvasId: scopedCanvasId,
          assetId: input.assetId,
        }),
      );
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  private async markAssetDeletedForCanvas(
    canvasId: string,
    input: { workspaceId: string; assetId: string },
  ): Promise<void> {
    await this.assetRepository.deleteAsset({
      workspaceId: input.workspaceId,
      canvasId: this.canvasIdForAssetScope(input.workspaceId, canvasId),
      assetId: input.assetId,
    });
  }

  private invalidateAssetScopes(): void {
    this.assetScopeEpoch += 1;
  }

  private canvasIdForAssetScope(workspaceId: string, canvasId: string): string {
    if (
      workspaceId !== this.workspaceId ||
      typeof canvasId !== "string" ||
      canvasId.trim().length === 0
    ) {
      throw new Error("Cloud Canvas asset operation requires a Canvas scope.");
    }
    return canvasId;
  }

  private canvasIdForAssetUpload(workspaceId: string): string {
    if (workspaceId !== this.workspaceId || !this.activeCanvasId) {
      throw new Error("Cloud Canvas asset upload requires an active Canvas.");
    }
    return this.activeCanvasId;
  }

  private canvasIdForAssetLookup(): string {
    if (!this.activeCanvasId) {
      throw new Error("Cloud Canvas asset lookup requires an active Canvas.");
    }
    return this.activeCanvasId;
  }
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    ((error as { code?: unknown }).code === "not-found" ||
      (error as { code?: unknown }).code === "forbidden")
  );
}
