import type { CanvasAssetRecord } from "@/lib/canvas/local-canvas-repository";
import type {
  CanvasAssetVariantKind,
  CanvasAssetVariantMetadata,
  CanvasAssetVariantRecord,
  CanvasAssetVariantV2Record,
  CanvasImagePyramidTargetMaxEdge,
} from "@/lib/canvas/canvas-image-variants";

export type CanvasImageLoadScope = {
  userId?: string;
  workspaceId: string;
  canvasId: string;
};

function scopeKey(scope: CanvasImageLoadScope): string {
  return [scope.userId ?? "local", scope.workspaceId, scope.canvasId].join(
    "\u0000",
  );
}

function retainUntilFailure<T>(
  cache: Map<string, Promise<T>>,
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  const existing = cache.get(key);
  if (existing) return existing;
  const pending = load();
  cache.set(key, pending);
  void pending.catch(() => {
    if (cache.get(key) === pending) cache.delete(key);
  });
  return pending;
}

/**
 * Canvas-lifecycle cache for runtime-only asset work. It stores no object URLs
 * and is cleared whenever its owner changes Canvas scope or unmounts.
 */
export class CanvasImageLoadCache {
  private readonly metadata = new Map<
    string,
    Promise<readonly CanvasAssetVariantMetadata[]>
  >();
  private readonly catalogues = new Map<
    string,
    Promise<ReadonlyMap<string, readonly CanvasAssetVariantMetadata[]>>
  >();
  private readonly variants = new Map<
    string,
    Promise<CanvasAssetVariantRecord | null>
  >();
  private readonly variantTiers = new Map<
    string,
    Promise<CanvasAssetVariantV2Record | null>
  >();
  private readonly assets = new Map<
    string,
    Promise<CanvasAssetRecord | null>
  >();

  variantsForAsset(
    scope: CanvasImageLoadScope,
    assetId: string,
    load: () => Promise<readonly CanvasAssetVariantMetadata[]>,
  ): Promise<readonly CanvasAssetVariantMetadata[]> {
    return retainUntilFailure(
      this.metadata,
      `${scopeKey(scope)}\u0000${assetId}`,
      load,
    );
  }

  catalogue(
    scope: CanvasImageLoadScope,
    assetIds: readonly string[],
    load: () => Promise<
      ReadonlyMap<string, readonly CanvasAssetVariantMetadata[]>
    >,
  ): Promise<ReadonlyMap<string, readonly CanvasAssetVariantMetadata[]>> {
    const ids = [...new Set(assetIds)].sort().join(",");
    return retainUntilFailure(
      this.catalogues,
      `${scopeKey(scope)}\u0000${ids}`,
      load,
    );
  }

  variant(
    scope: CanvasImageLoadScope,
    assetId: string,
    kind: CanvasAssetVariantKind,
    load: () => Promise<CanvasAssetVariantRecord | null>,
  ): Promise<CanvasAssetVariantRecord | null> {
    return retainUntilFailure(
      this.variants,
      `${scopeKey(scope)}\u0000${assetId}\u0000${kind}`,
      load,
    );
  }

  variantTier(
    scope: CanvasImageLoadScope,
    assetId: string,
    targetMaxEdge: CanvasImagePyramidTargetMaxEdge,
    load: () => Promise<CanvasAssetVariantV2Record | null>,
  ): Promise<CanvasAssetVariantV2Record | null> {
    return retainUntilFailure(
      this.variantTiers,
      `${scopeKey(scope)}\u0000${assetId}\u0000edge-${targetMaxEdge}`,
      load,
    );
  }

  asset(
    scope: CanvasImageLoadScope,
    assetId: string,
    load: () => Promise<CanvasAssetRecord | null>,
  ): Promise<CanvasAssetRecord | null> {
    return retainUntilFailure(
      this.assets,
      `${scopeKey(scope)}\u0000${assetId}`,
      load,
    );
  }

  invalidateVariants(scope: CanvasImageLoadScope, assetId: string): void {
    const prefix = `${scopeKey(scope)}\u0000`;
    for (const key of this.metadata.keys()) {
      if (key === `${prefix}${assetId}`) this.metadata.delete(key);
    }
    for (const key of this.variants.keys()) {
      if (key.startsWith(`${prefix}${assetId}\u0000`))
        this.variants.delete(key);
    }
    for (const key of this.variantTiers.keys()) {
      if (key.startsWith(`${prefix}${assetId}\u0000`))
        this.variantTiers.delete(key);
    }
    for (const key of this.catalogues.keys()) {
      if (key.startsWith(prefix)) this.catalogues.delete(key);
    }
  }

  clearScope(scope: CanvasImageLoadScope): void {
    const prefix = `${scopeKey(scope)}\u0000`;
    for (const cache of [
      this.metadata,
      this.catalogues,
      this.variants,
      this.variantTiers,
      this.assets,
    ]) {
      for (const key of cache.keys())
        if (key.startsWith(prefix)) cache.delete(key);
    }
  }

  clear(): void {
    this.metadata.clear();
    this.catalogues.clear();
    this.variants.clear();
    this.variantTiers.clear();
    this.assets.clear();
  }
}
