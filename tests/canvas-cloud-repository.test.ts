import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CloudCanvasRepositoryError,
  createCloudCanvasRepository,
  type SaveCanvasDocumentInput,
} from "@/lib/canvas/cloud-canvas-repository";
import type { Database } from "@/lib/supabase/database.types";
import type { CanvasDocumentV2 } from "@/lib/canvas/canvas-document";

type QueryResult = { data: unknown; error: { code?: string } | null };

type FakeBuilder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  then: (
    onFulfilled?: ((value: QueryResult) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null,
  ) => Promise<unknown>;
};

type FakeClient = {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
  auth: { getUser: ReturnType<typeof vi.fn> };
};

const workspaceId = "workspace-1";
const canvasId = "canvas-1";
const timestamps = {
  created: "2026-08-01T10:00:00.000Z",
  updated: "2026-08-01T11:00:00.000Z",
};
const document: CanvasDocumentV2 = {
  schemaVersion: 2,
  nodes: [
    {
      id: "text-1",
      kind: "text",
      position: { x: 10, y: 20 },
      size: { width: 100, height: 80 },
      zIndex: 0,
      markdown: "# Cloud",
    },
  ],
  edges: [],
};

function canvasRow(overrides: Record<string, unknown> = {}) {
  return {
    id: canvasId,
    workspace_id: workspaceId,
    title: "Cloud Canvas",
    schema_version: 2,
    document,
    revision: 4,
    created_at: timestamps.created,
    updated_at: timestamps.updated,
    deleted_at: null,
    created_by: "user-1",
    ...overrides,
  };
}

function viewStateRow(overrides: Record<string, unknown> = {}) {
  return {
    canvas_id: canvasId,
    user_id: "user-1",
    viewport_x: 4,
    viewport_y: -2,
    zoom: 1.5,
    updated_at: timestamps.updated,
    ...overrides,
  };
}

function builder(
  response: QueryResult,
  onUpsert?: (value: unknown) => void,
): FakeBuilder {
  const value: FakeBuilder = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
    maybeSingle: vi.fn(async () => response),
    upsert: vi.fn(async (payload: unknown) => {
      onUpsert?.(payload);
      return response;
    }),
    then: (onFulfilled, onRejected) =>
      Promise.resolve(response).then(
        onFulfilled ?? undefined,
        onRejected ?? undefined,
      ),
  };
  value.select.mockReturnValue(value);
  value.eq.mockReturnValue(value);
  value.is.mockReturnValue(value);
  value.order.mockReturnValue(value);
  return value;
}

function fakeClient(
  options: {
    queryResults?: QueryResult[];
    rpcResults?: QueryResult[];
    user?: { id: string } | null;
    onUpsert?: (value: unknown) => void;
  } = {},
): FakeClient {
  const queryResults = [...(options.queryResults ?? [])];
  const rpcResults = [...(options.rpcResults ?? [])];
  const client: FakeClient = {
    from: vi.fn(() =>
      builder(
        queryResults.shift() ?? { data: null, error: null },
        options.onUpsert,
      ),
    ),
    rpc: vi.fn(async () => rpcResults.shift() ?? { data: null, error: null }),
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: options.user === undefined ? { id: "user-1" } : options.user,
        },
        error: null,
      })),
    },
  };
  return client;
}

function repository(client: FakeClient) {
  return createCloudCanvasRepository({
    supabase: client as unknown as SupabaseClient<Database>,
  });
}

const loadInput = { workspaceId, canvasId };

beforeEach(() => vi.clearAllMocks());

describe("SupabaseCloudCanvasRepository", () => {
  it("lists active V2 summaries in the requested workspace without documents", async () => {
    const client = fakeClient({
      queryResults: [{ data: [canvasRow()], error: null }],
    });

    await expect(repository(client).listCanvases(workspaceId)).resolves.toEqual(
      [
        {
          id: canvasId,
          workspaceId,
          title: "Cloud Canvas",
          groupId: null,
          sortOrder: 0,
          revision: 4,
          schemaVersion: 2,
          createdAt: timestamps.created,
          updatedAt: timestamps.updated,
        },
      ],
    );
    const query = client.from.mock.results[0]?.value as FakeBuilder;
    expect(query.select).toHaveBeenCalledWith(
      "id,workspace_id,title,group_id,sort_order,schema_version,revision,created_at,updated_at,deleted_at",
    );
    expect(query.eq).toHaveBeenCalledWith("workspace_id", workspaceId);
    expect(query.eq).toHaveBeenCalledWith("schema_version", 2);
    expect(query.is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("creates through the RPC, then returns the canonical loaded V2 row", async () => {
    const client = fakeClient({
      rpcResults: [{ data: [{ id: canvasId, revision: 1 }], error: null }],
      queryResults: [
        {
          data: canvasRow({ revision: 1, document: { ...document } }),
          error: null,
        },
      ],
    });

    const result = await repository(client).createCanvas(
      workspaceId,
      "New Canvas",
    );

    expect(result).toMatchObject({ schemaVersion: 2, revision: 1, document });
    expect(client.rpc).toHaveBeenCalledWith("create_canvas", {
      target_group_id: null,
      target_workspace_id: workspaceId,
      target_title: "New Canvas",
    });
  });

  it("rejects a V1 cloud document instead of normalizing it to V2", async () => {
    const client = fakeClient({
      queryResults: [
        {
          data: canvasRow({
            document: { schemaVersion: 1, nodes: [], edges: [] },
          }),
          error: null,
        },
      ],
    });

    await expect(
      repository(client).loadCanvas(
        ...(Object.values(loadInput) as [string, string]),
      ),
    ).rejects.toMatchObject({
      code: "invalid-server-document",
    });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("fails closed on a mismatched workspace row", async () => {
    const client = fakeClient({
      queryResults: [
        { data: canvasRow({ workspace_id: "workspace-foreign" }), error: null },
      ],
    });

    await expect(
      repository(client).loadCanvas(workspaceId, canvasId),
    ).rejects.toMatchObject({
      code: "server-contract",
    });
  });

  it("returns saved and conflict CAS results using the server revision", async () => {
    const input: SaveCanvasDocumentInput = {
      workspaceId,
      canvasId,
      expectedRevision: 4,
      title: "Saved Canvas",
      document,
    };
    const client = fakeClient({
      queryResults: [
        { data: canvasRow(), error: null },
        { data: canvasRow(), error: null },
      ],
      rpcResults: [
        { data: [{ status: "saved", revision: 5 }], error: null },
        { data: [{ status: "conflict", revision: 6 }], error: null },
      ],
    });
    const repo = repository(client);

    await expect(repo.saveCanvasDocument(input)).resolves.toEqual({
      status: "saved",
      revision: 5,
    });
    await expect(repo.saveCanvasDocument(input)).resolves.toEqual({
      status: "conflict",
      revision: 6,
    });
    expect(client.rpc).toHaveBeenNthCalledWith(1, "save_canvas_document", {
      target_canvas_id: canvasId,
      target_expected_revision: 4,
      target_title: "Saved Canvas",
      target_document: document,
    });
    expect(client.rpc).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid V1 input before transport", async () => {
    const client = fakeClient();
    const invalidInput = {
      workspaceId,
      canvasId,
      expectedRevision: 1,
      title: "Canvas",
      document: { schemaVersion: 1, nodes: [], edges: [] },
    } as unknown as SaveCanvasDocumentInput;

    await expect(
      repository(client).saveCanvasDocument(invalidInput),
    ).rejects.toMatchObject({
      code: "invalid-input",
    });
    expect(client.from).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("renames through the narrow RPC without changing document revision", async () => {
    const client = fakeClient({
      queryResults: [{ data: canvasRow(), error: null }],
      rpcResults: [
        {
          data: [
            {
              id: canvasId,
              workspace_id: workspaceId,
              title: "Renamed",
              schema_version: 2,
              revision: 4,
              created_at: timestamps.created,
              updated_at: timestamps.updated,
              deleted_at: null,
            },
          ],
          error: null,
        },
      ],
    });

    await expect(
      repository(client).renameCanvas(workspaceId, canvasId, "Renamed"),
    ).resolves.toMatchObject({
      title: "Renamed",
      revision: 4,
      schemaVersion: 2,
    });
    expect(client.rpc).toHaveBeenCalledWith("rename_canvas", {
      target_canvas_id: canvasId,
      target_title: "Renamed",
    });
  });

  it("deletes only through the soft-delete RPC", async () => {
    const client = fakeClient({
      queryResults: [{ data: canvasRow(), error: null }],
      rpcResults: [{ data: [{ deleted: true }], error: null }],
    });

    await expect(
      repository(client).deleteCanvas(workspaceId, canvasId),
    ).resolves.toBeUndefined();
    expect(client.rpc).toHaveBeenCalledWith("delete_canvas", {
      target_canvas_id: canvasId,
    });
  });

  it("loads and saves the authenticated user's separate viewport state", async () => {
    const upserted: unknown[] = [];
    const client = fakeClient({
      queryResults: [
        { data: canvasRow(), error: null },
        { data: viewStateRow(), error: null },
        { data: canvasRow(), error: null },
        { data: null, error: null },
      ],
      onUpsert: (value) => upserted.push(value),
    });
    const repo = repository(client);

    await expect(
      repo.loadCanvasViewState(workspaceId, canvasId),
    ).resolves.toMatchObject({
      canvasId,
      userId: "user-1",
      viewportX: 4,
      viewportY: -2,
      zoom: 1.5,
    });
    await expect(
      repo.saveCanvasViewState({
        workspaceId,
        canvasId,
        viewportX: 8,
        viewportY: -4,
        zoom: 2,
      }),
    ).resolves.toBeUndefined();
    expect(upserted).toEqual([
      {
        canvas_id: canvasId,
        user_id: "user-1",
        viewport_x: 8,
        viewport_y: -4,
        zoom: 2,
      },
    ]);
  });

  it("projects access errors without exposing Supabase messages", async () => {
    const client = fakeClient({
      queryResults: [{ data: null, error: { code: "42501" } }],
    });

    const error = await repository(client)
      .loadCanvas(workspaceId, canvasId)
      .catch((cause) => cause);
    expect(error).toBeInstanceOf(CloudCanvasRepositoryError);
    expect(error).toMatchObject({ code: "forbidden" });
    expect((error as Error).message).not.toContain("42501");
  });
});
