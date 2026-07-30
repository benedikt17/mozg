import { beforeEach, describe, expect, it, vi } from "vitest";
import v1Fixture from "./fixtures/desktop-domain-snapshot-v1.json";
import { initialDesktopPrototypeState } from "@/prototype/desktop-state";
import { createDesktopDomainSnapshot } from "@/prototype/persistence/domain-snapshot";
import type { DesktopCloudSnapshotRow } from "@/prototype/persistence/cloud-snapshot-bridge";
import {
  loadDesktopCloudSnapshot,
  type DesktopCloudSnapshotLoadResult,
} from "@/lib/supabase/desktop-snapshot-loader";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

type QueryBuilder = {
  select: () => QueryBuilder;
  eq: () => QueryBuilder;
  limit: () => Promise<QueryResult>;
  maybeSingle: () => Promise<QueryResult>;
};

type LoaderClient = {
  auth: { getUser: () => Promise<QueryResult> };
  from: (table: string) => QueryBuilder;
  rpc: ReturnType<typeof vi.fn>;
};

const snapshot = createDesktopDomainSnapshot(initialDesktopPrototypeState);

function createRow(
  overrides: Partial<DesktopCloudSnapshotRow> = {},
): DesktopCloudSnapshotRow {
  return {
    workspace_id: "workspace-local",
    schema_version: 2,
    snapshot,
    revision: 9,
    updated_at: "2026-07-29T10:00:00.000Z",
    ...overrides,
  };
}

function configureClient(options: {
  user?: { id: string } | null;
  userError?: { message: string } | null;
  memberships?: unknown;
  workspace?: unknown;
  row?: unknown;
  membershipError?: { message: string } | null;
  workspaceError?: { message: string } | null;
  snapshotError?: { message: string } | null;
}): LoaderClient {
  const results: Record<string, QueryResult> = {
    workspace_members: {
      data: options.memberships ?? [{ workspace_id: "workspace-local" }],
      error: options.membershipError ?? null,
    },
    workspaces: {
      data:
        options.workspace === undefined
          ? { id: "workspace-local", name: "Лукоморье" }
          : options.workspace,
      error: options.workspaceError ?? null,
    },
    workspace_snapshots: {
      data: options.row === undefined ? createRow() : options.row,
      error: options.snapshotError ?? null,
    },
  };
  const client: LoaderClient = {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user:
            options.user === undefined ? { id: "user-local" } : options.user,
        },
        error: options.userError ?? null,
      })),
    },
    from: vi.fn((table: string) => {
      const result = results[table];
      const builder: QueryBuilder = {
        select: () => builder,
        eq: () => builder,
        limit: async () => result,
        maybeSingle: async () => result,
      };
      return builder;
    }),
    rpc: vi.fn(),
  };
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loadDesktopCloudSnapshot", () => {
  it("loads the authenticated workspace snapshot and revision", async () => {
    configureClient({});

    const result = await loadDesktopCloudSnapshot();

    expect(result).toMatchObject({
      kind: "ready",
      bootstrap: {
        workspaceId: "workspace-local",
        workspaceName: "Лукоморье",
        schemaVersion: 2,
        revision: 9,
      },
    });
  });

  it("does not query workspace data without a session", async () => {
    const client = configureClient({ user: null });

    const result = await loadDesktopCloudSnapshot();

    expect(result).toEqual({ kind: "unauthenticated" });
    expect(client.from).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("does not query workspace data when the session read fails", async () => {
    const client = configureClient({ userError: { message: "read failed" } });

    const result = await loadDesktopCloudSnapshot();

    expect(result).toEqual({ kind: "unauthenticated" });
    expect(client.from).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("returns workspace-unavailable when no membership is available", async () => {
    configureClient({ memberships: [] });

    const result = await loadDesktopCloudSnapshot();

    expect(result).toEqual({ kind: "workspace-unavailable" });
  });

  it("returns workspace-unavailable when RLS hides a foreign workspace", async () => {
    configureClient({
      memberships: [{ workspace_id: "workspace-foreign" }],
      workspace: null,
    });

    const result = await loadDesktopCloudSnapshot();

    expect(result).toEqual({ kind: "workspace-unavailable" });
  });

  it("returns workspace-unavailable for membership read errors", async () => {
    configureClient({ membershipError: { message: "read failed" } });

    const result = await loadDesktopCloudSnapshot();

    expect(result).toEqual({ kind: "workspace-unavailable" });
  });

  it("returns snapshot-missing when the workspace has no snapshot", async () => {
    configureClient({ row: null });

    const result = await loadDesktopCloudSnapshot();

    expect(result).toEqual({ kind: "snapshot-missing" });
  });

  it("returns unsupported-schema for a future schema version", async () => {
    configureClient({ row: createRow({ schema_version: 3 }) });

    const result = await loadDesktopCloudSnapshot();

    expect(result).toEqual({ kind: "unsupported-schema", schemaVersion: 3 });
  });

  it("loads a v1 row as a migrated v2 runtime snapshot", async () => {
    configureClient({
      row: createRow({ schema_version: 1, snapshot: v1Fixture }),
    });

    const result = await loadDesktopCloudSnapshot();

    expect(result).toMatchObject({
      kind: "ready",
      bootstrap: { schemaVersion: 2, revision: 9 },
    });
    if (result.kind !== "ready") return;
    expect(
      result.bootstrap.snapshot.tasks[0]?.subtasks[0]?.detailsMarkdown,
    ).toBe("");
  });

  it("returns invalid-snapshot for a malformed payload", async () => {
    configureClient({ row: createRow({ snapshot: {} }) });

    const result = await loadDesktopCloudSnapshot();

    expect(result).toEqual({ kind: "invalid-snapshot" });
  });

  it("returns unavailable for snapshot read errors", async () => {
    configureClient({ snapshotError: { message: "read failed" } });

    const result: DesktopCloudSnapshotLoadResult =
      await loadDesktopCloudSnapshot();

    expect(result).toEqual({ kind: "unavailable" });
  });

  it("has no save or CAS RPC path", async () => {
    const client = configureClient({});

    await loadDesktopCloudSnapshot();

    expect(client.rpc).not.toHaveBeenCalled();
  });
});
