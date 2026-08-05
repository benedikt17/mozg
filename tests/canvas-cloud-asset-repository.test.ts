import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CloudCanvasAssetRepositoryError,
  createCloudCanvasAssetRepository,
} from "@/lib/canvas/cloud-canvas-asset-repository";
import type { Database } from "@/lib/supabase/database.types";

type QueryResult = { data: unknown; error: { code?: string } | null };

type FakeBuilder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: (
    onFulfilled?: ((value: QueryResult) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null,
  ) => Promise<unknown>;
};

type StorageApi = {
  upload: ReturnType<typeof vi.fn>;
  download: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};

type FakeClient = {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
  auth: { getUser: ReturnType<typeof vi.fn> };
  storage: { from: ReturnType<typeof vi.fn> };
};

const workspaceId = "22000000-0000-0000-0000-000000000001";
const canvasId = "33000000-0000-0000-0000-000000000001";
const assetId = "62000000-0000-0000-0000-000000000001";
const userId = "12000000-0000-0000-0000-000000000001";
const createdAt = "2026-08-01T10:00:00.000Z";
const readyAt = "2026-08-01T10:01:00.000Z";
const storageKey = `${workspaceId}/${canvasId}/${assetId}/original`;

function assetRow(overrides: Record<string, unknown> = {}) {
  return {
    id: assetId,
    workspace_id: workspaceId,
    canvas_id: canvasId,
    storage_key: storageKey,
    preview_storage_key: null,
    mime_type: "image/png",
    byte_size: 3,
    width: 100,
    height: 80,
    checksum: null,
    created_by: userId,
    created_at: createdAt,
    ready_at: readyAt,
    deleted_at: null,
    ...overrides,
  };
}

function variantRow(overrides: Record<string, unknown> = {}) {
  return {
    workspace_id: workspaceId,
    canvas_id: canvasId,
    asset_id: assetId,
    kind: "thumbnail",
    storage_path: `${workspaceId}/${canvasId}/${assetId}/thumbnail.webp`,
    mime_type: "image/webp",
    byte_size: 10,
    pixel_width: 512,
    pixel_height: 410,
    created_at: createdAt,
    ...overrides,
  };
}

function builder(response: QueryResult): FakeBuilder {
  const value: FakeBuilder = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    is: vi.fn(),
    not: vi.fn(),
    maybeSingle: vi.fn(async () => response),
    then: (onFulfilled, onRejected) =>
      Promise.resolve(response).then(
        onFulfilled ?? undefined,
        onRejected ?? undefined,
      ),
  };
  value.select.mockReturnValue(value);
  value.eq.mockReturnValue(value);
  value.in.mockReturnValue(value);
  value.is.mockReturnValue(value);
  value.not.mockReturnValue(value);
  return value;
}

function fakeClient(
  options: {
    queryResults?: QueryResult[];
    rpcResults?: QueryResult[];
    uploadResults?: QueryResult[];
    downloadResults?: QueryResult[];
    removeResults?: QueryResult[];
    user?: { id: string } | null;
  } = {},
): FakeClient {
  const queryResults = [...(options.queryResults ?? [])];
  const rpcResults = [...(options.rpcResults ?? [])];
  const uploadResults = [...(options.uploadResults ?? [])];
  const downloadResults = [...(options.downloadResults ?? [])];
  const removeResults = [...(options.removeResults ?? [])];
  const storageApi: StorageApi = {
    upload: vi.fn(
      async () =>
        uploadResults.shift() ?? { data: { path: storageKey }, error: null },
    ),
    download: vi.fn(
      async () =>
        downloadResults.shift() ?? { data: new Blob(["png"]), error: null },
    ),
    remove: vi.fn(
      async () =>
        removeResults.shift() ?? { data: [{ name: storageKey }], error: null },
    ),
  };
  return {
    from: vi.fn(() =>
      builder(queryResults.shift() ?? { data: null, error: null }),
    ),
    rpc: vi.fn(async () => rpcResults.shift() ?? { data: null, error: null }),
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: options.user === undefined ? { id: userId } : options.user,
        },
        error: null,
      })),
    },
    storage: {
      from: vi.fn(() => storageApi),
    },
  };
}

function repository(client: FakeClient) {
  return createCloudCanvasAssetRepository({
    supabase: client as unknown as SupabaseClient<Database>,
    idGenerator: () => assetId,
  });
}

const uploadInput = {
  workspaceId,
  canvasId,
  assetId,
  blob: new Blob(["png"], { type: "image/png" }),
  mimeType: "image/png" as const,
  byteSize: 3,
  width: 100,
  height: 80,
};

beforeEach(() => vi.clearAllMocks());

describe("SupabaseCloudCanvasAssetRepository", () => {
  it("reserves, uploads without upsert, finalizes, and returns server metadata", async () => {
    const client = fakeClient({
      rpcResults: [
        { data: [assetRow({ ready_at: null })], error: null },
        { data: [assetRow()], error: null },
      ],
    });

    await expect(repository(client).uploadAsset(uploadInput)).resolves.toEqual(
      expect.objectContaining({
        id: assetId,
        workspaceId,
        canvasId,
        storageKey,
        readyAt,
      }),
    );
    expect(client.rpc).toHaveBeenNthCalledWith(1, "reserve_canvas_asset", {
      target_asset_id: assetId,
      target_byte_size: 3,
      target_canvas_id: canvasId,
      target_height: 80,
      target_mime_type: "image/png",
      target_width: 100,
      target_workspace_id: workspaceId,
    });
    expect(client.storage.from).toHaveBeenCalledWith("canvas-assets");
    const storage = client.storage.from.mock.results[0]?.value as StorageApi;
    expect(storage.upload).toHaveBeenCalledWith(
      storageKey,
      uploadInput.blob,
      expect.objectContaining({ contentType: "image/png", upsert: false }),
    );
  });

  it.each([
    ["unsupported MIME", { mimeType: "image/gif" }, "unsupported-mime"],
    ["wrong byte size", { byteSize: 4 }, "invalid-input"],
    [
      "oversized dimensions",
      { width: 10_000, height: 10_000 },
      "invalid-dimensions",
    ],
  ])("rejects %s before transport", async (_label, overrides, code) => {
    const client = fakeClient();
    await expect(
      repository(client).uploadAsset({ ...uploadInput, ...overrides } as never),
    ).rejects.toMatchObject({ code });
    expect(client.rpc).not.toHaveBeenCalled();
    expect(client.storage.from).not.toHaveBeenCalled();
  });

  it("rejects a malformed or cross-boundary reserve response", async () => {
    const client = fakeClient({
      rpcResults: [
        {
          data: [
            assetRow({ workspace_id: "22000000-0000-0000-0000-000000000002" }),
          ],
          error: null,
        },
      ],
    });

    await expect(
      repository(client).uploadAsset(uploadInput),
    ).rejects.toMatchObject({
      code: "workspace-mismatch",
    });
    expect(client.storage.from).not.toHaveBeenCalled();
  });

  it("cleans the reserved row after upload failure", async () => {
    const client = fakeClient({
      rpcResults: [
        { data: [assetRow({ ready_at: null })], error: null },
        { data: [{ deleted: false }], error: null },
      ],
      uploadResults: [{ data: null, error: { code: "500" } }],
    });

    await expect(
      repository(client).uploadAsset(uploadInput),
    ).rejects.toMatchObject({
      code: "upload-failure",
    });
    const storage = client.storage.from.mock.results[0]?.value as StorageApi;
    expect(storage.remove).toHaveBeenCalledWith([storageKey]);
    expect(client.rpc).toHaveBeenLastCalledWith("delete_canvas_asset", {
      target_asset_id: assetId,
      target_canvas_id: canvasId,
      target_workspace_id: workspaceId,
    });
  });

  it("reports partial cleanup instead of hiding cleanup failures", async () => {
    const client = fakeClient({
      rpcResults: [
        { data: [assetRow({ ready_at: null })], error: null },
        { data: null, error: { code: "500" } },
      ],
      uploadResults: [{ data: null, error: { code: "500" } }],
      removeResults: [{ data: null, error: { code: "500" } }],
    });

    await expect(
      repository(client).uploadAsset(uploadInput),
    ).rejects.toMatchObject({
      code: "partial-cleanup-failure",
    });
  });

  it("loads metadata and downloads binary only after scoped metadata authorization", async () => {
    const client = fakeClient({
      queryResults: [{ data: assetRow(), error: null }],
      downloadResults: [
        { data: new Blob(["png"], { type: "image/png" }), error: null },
      ],
    });

    const result = await repository(client).downloadAsset({
      workspaceId,
      canvasId,
      assetId,
    });
    expect(result).toMatchObject({ id: assetId, workspaceId, canvasId });
    expect(result.blob).toBeInstanceOf(Blob);
    const storage = client.storage.from.mock.results[0]?.value as StorageApi;
    expect(storage.download).toHaveBeenCalledWith(storageKey);
  });

  it("projects missing metadata and hides raw Supabase errors", async () => {
    const missingClient = fakeClient({
      queryResults: [{ data: null, error: null }],
    });
    await expect(
      repository(missingClient).getAssetMetadata({
        workspaceId,
        canvasId,
        assetId,
      }),
    ).rejects.toMatchObject({ code: "not-found" });

    const forbiddenClient = fakeClient({
      queryResults: [{ data: null, error: { code: "42501" } }],
    });
    const error = await repository(forbiddenClient)
      .getAssetMetadata({ workspaceId, canvasId, assetId })
      .catch((cause) => cause);
    expect(error).toBeInstanceOf(CloudCanvasAssetRepositoryError);
    expect(error).toMatchObject({ code: "forbidden" });
    expect((error as Error).message).not.toContain("42501");
  });

  it("deletes Storage first and then soft-deletes metadata", async () => {
    const client = fakeClient({
      queryResults: [{ data: assetRow(), error: null }],
      rpcResults: [{ data: [{ deleted: true }], error: null }],
    });

    await expect(
      repository(client).deleteAsset({ workspaceId, canvasId, assetId }),
    ).resolves.toBeUndefined();
    const storage = client.storage.from.mock.results[0]?.value as StorageApi;
    expect(storage.remove).toHaveBeenCalledWith([storageKey]);
    expect(client.rpc).toHaveBeenCalledWith("delete_canvas_asset", {
      target_asset_id: assetId,
      target_canvas_id: canvasId,
      target_workspace_id: workspaceId,
    });
  });

  it("returns partial-cleanup-failure when metadata deletion fails after Storage removal", async () => {
    const client = fakeClient({
      queryResults: [{ data: assetRow(), error: null }],
      rpcResults: [{ data: null, error: { code: "500" } }],
    });

    await expect(
      repository(client).deleteAsset({ workspaceId, canvasId, assetId }),
    ).rejects.toMatchObject({ code: "partial-cleanup-failure" });
  });

  it("coalesces authentication until the session is explicitly invalidated", async () => {
    const client = fakeClient();
    const assets = repository(client);

    await Promise.all([
      assets.listVariants({ workspaceId, canvasId, assetId }),
      assets.listVariants({ workspaceId, canvasId, assetId }),
    ]);
    await assets.listVariants({ workspaceId, canvasId, assetId });
    expect(client.auth.getUser).toHaveBeenCalledOnce();

    assets.invalidateAuthentication();
    await assets.listVariants({ workspaceId, canvasId, assetId });
    expect(client.auth.getUser).toHaveBeenCalledTimes(2);
  });

  it("loads a scoped variant catalogue in one query and groups it by asset", async () => {
    const secondAssetId = "62000000-0000-0000-0000-000000000002";
    const client = fakeClient({
      queryResults: [
        {
          data: [
            variantRow(),
            variantRow({
              asset_id: secondAssetId,
              storage_path: `${workspaceId}/${canvasId}/${secondAssetId}/preview.webp`,
              kind: "preview",
              pixel_width: 1280,
              pixel_height: 1024,
            }),
          ],
          error: null,
        },
      ],
    });

    const catalogue = await repository(client).listVariantsForAssets({
      workspaceId,
      canvasId,
      assetIds: [assetId, secondAssetId, assetId],
    });

    expect(client.from).toHaveBeenCalledOnce();
    expect(catalogue.get(assetId)).toHaveLength(1);
    expect(catalogue.get(secondAssetId)?.[0]).toMatchObject({
      kind: "preview",
      assetId: secondAssetId,
    });
  });

  it("stores and loads an additive numeric pyramid tier through V2 RPCs", async () => {
    const targetMaxEdge = 1024;
    const tierPath = `${workspaceId}/${canvasId}/${assetId}/edge-${targetMaxEdge}.webp`;
    const tier = variantRow({
      kind: `edge-${targetMaxEdge}`,
      target_max_edge: targetMaxEdge,
      storage_path: tierPath,
      pixel_width: 100,
      pixel_height: 80,
    });
    const blob = new Blob(["webp"], { type: "image/webp" });
    const client = fakeClient({
      queryResults: [
        { data: assetRow(), error: null },
        { data: tier, error: null },
      ],
      rpcResults: [
        { data: [tier], error: null },
        { data: [tier], error: null },
      ],
      downloadResults: [{ data: blob, error: null }],
    });
    const assets = repository(client);

    await expect(
      assets.storeVariantTier({
        workspaceId,
        canvasId,
        assetId,
        targetMaxEdge,
        storagePath: tierPath,
        mimeType: "image/webp",
        byteSize: blob.size,
        pixelWidth: 100,
        pixelHeight: 80,
        createdAt,
        blob,
      }),
    ).resolves.toMatchObject({ targetMaxEdge, storagePath: tierPath });
    expect(client.rpc).toHaveBeenNthCalledWith(
      1,
      "reserve_canvas_asset_variant_v2",
      expect.objectContaining({ requested_max_edge: targetMaxEdge }),
    );
    expect(client.rpc).toHaveBeenNthCalledWith(
      2,
      "finalize_canvas_asset_variant_v2",
      expect.objectContaining({ requested_max_edge: targetMaxEdge }),
    );

    await expect(
      assets.loadVariantTier({ workspaceId, canvasId, assetId, targetMaxEdge }),
    ).resolves.toMatchObject({ targetMaxEdge, storagePath: tierPath, blob });
  });

  it("loads a V2 tier catalogue for many assets with one scoped query", async () => {
    const secondAssetId = "62000000-0000-0000-0000-000000000002";
    const client = fakeClient({
      queryResults: [
        {
          data: [
            variantRow({
              target_max_edge: 512,
              kind: "edge-512",
              storage_path: `${workspaceId}/${canvasId}/${assetId}/edge-512.webp`,
            }),
            variantRow({
              asset_id: secondAssetId,
              target_max_edge: 2048,
              kind: "edge-2048",
              storage_path: `${workspaceId}/${canvasId}/${secondAssetId}/edge-2048.webp`,
            }),
          ],
          error: null,
        },
      ],
    });

    const catalogue = await repository(client).listVariantTiersForAssets({
      workspaceId,
      canvasId,
      assetIds: [assetId, secondAssetId, assetId],
    });

    expect(client.from).toHaveBeenCalledOnce();
    expect(catalogue.get(assetId)?.[0]).toMatchObject({ targetMaxEdge: 512 });
    expect(catalogue.get(secondAssetId)?.[0]).toMatchObject({
      targetMaxEdge: 2048,
    });
  });
});
