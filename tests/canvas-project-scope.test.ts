import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  ProjectScopedCloudCanvasRepository,
} from "@/lib/canvas/project-scoped-cloud-canvas-repository";
import type {
  CloudCanvasRepository,
  CloudCanvasSummary,
  CloudLoadedCanvas,
} from "@/lib/canvas/cloud-canvas-repository";
import type { CanvasGroup } from "@/lib/canvas/canvas-group-repository";
import { createEmptyCanvasDocumentV2 } from "@/lib/canvas/canvas-document";

const WORKSPACE = "20000000-0000-0000-0000-000000000001";
const PROJECT_A = "project-a";
const PROJECT_B = "project-b";
const CANVAS_A = "30000000-0000-0000-0000-000000000001";
const CANVAS_B = "30000000-0000-0000-0000-000000000002";
const CANVAS_NEW = "30000000-0000-0000-0000-000000000003";
const GROUP_A = "40000000-0000-0000-0000-000000000001";
const GROUP_B = "40000000-0000-0000-0000-000000000002";
const GROUP_NEW = "40000000-0000-0000-0000-000000000003";
const NOW = "2026-08-09T00:00:00.000Z";

type ScopeRow = {
  id: string;
  workspace_id: string;
  project_id: string | null;
  deleted_at: string | null;
};

type Filter = { field: string; value: unknown };

class FakeQuery implements PromiseLike<{ data: ScopeRow[]; error: null }> {
  private readonly filters: Filter[] = [];

  constructor(private readonly rows: ScopeRow[]) {}

  select(): this {
    return this;
  }

  eq(field: string, value: unknown): this {
    this.filters.push({ field, value });
    return this;
  }

  is(field: string, value: unknown): this {
    this.filters.push({ field, value });
    return this;
  }

  maybeSingle(): Promise<{ data: ScopeRow | null; error: null }> {
    return Promise.resolve({ data: this.filtered()[0] ?? null, error: null });
  }

  then<TResult1 = { data: ScopeRow[]; error: null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: ScopeRow[]; error: null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: this.filtered(), error: null }).then(
      onfulfilled,
      onrejected,
    );
  }

  private filtered(): ScopeRow[] {
    return this.rows.filter((row) =>
      this.filters.every(({ field, value }) =>
        (row as unknown as Record<string, unknown>)[field] === value,
      ),
    );
  }
}

class FakeSupabase {
  readonly rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  readonly canvasRows: ScopeRow[] = [
    {
      id: CANVAS_A,
      workspace_id: WORKSPACE,
      project_id: PROJECT_A,
      deleted_at: null,
    },
    {
      id: CANVAS_B,
      workspace_id: WORKSPACE,
      project_id: PROJECT_B,
      deleted_at: null,
    },
  ];
  readonly groupRows: ScopeRow[] = [
    {
      id: GROUP_A,
      workspace_id: WORKSPACE,
      project_id: PROJECT_A,
      deleted_at: null,
    },
    {
      id: GROUP_B,
      workspace_id: WORKSPACE,
      project_id: PROJECT_B,
      deleted_at: null,
    },
  ];

  from(table: string): FakeQuery {
    if (table === "canvases") return new FakeQuery(this.canvasRows);
    if (table === "canvas_groups") return new FakeQuery(this.groupRows);
    throw new Error(`Unexpected table ${table}`);
  }

  async rpc(name: string, args: Record<string, unknown>) {
    this.rpcCalls.push({ name, args });
    if (name === "create_canvas_for_project") {
      this.canvasRows.push({
        id: CANVAS_NEW,
        workspace_id: WORKSPACE,
        project_id: String(args.target_project_id),
        deleted_at: null,
      });
      return { data: [{ id: CANVAS_NEW, revision: 1 }], error: null };
    }
    if (name === "create_canvas_group_for_project") {
      this.groupRows.push({
        id: GROUP_NEW,
        workspace_id: WORKSPACE,
        project_id: String(args.target_project_id),
        deleted_at: null,
      });
      return { data: [{ id: GROUP_NEW }], error: null };
    }
    throw new Error(`Unexpected RPC ${name}`);
  }
}

function summary(id: string): CloudCanvasSummary {
  return {
    id,
    workspaceId: WORKSPACE,
    title: id,
    groupId: null,
    sortOrder: 0,
    revision: 1,
    schemaVersion: 2,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function loaded(id: string): CloudLoadedCanvas {
  return { ...summary(id), document: createEmptyCanvasDocumentV2() };
}

function group(id: string): CanvasGroup {
  return {
    id,
    workspaceId: WORKSPACE,
    parentGroupId: null,
    title: id,
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  };
}

function baseRepository(log: string[]): CloudCanvasRepository {
  return {
    listCanvases: async () => [
      summary(CANVAS_A),
      summary(CANVAS_B),
      summary(CANVAS_NEW),
    ],
    createCanvas: async () => {
      throw new Error("unscoped create must not be used");
    },
    loadCanvas: async (_workspaceId, canvasId) => {
      log.push(`load:${canvasId}`);
      return loaded(canvasId);
    },
    renameCanvas: async (_workspaceId, canvasId) => summary(canvasId),
    deleteCanvas: async () => undefined,
    saveCanvasDocument: async (input) => ({
      status: "saved",
      revision: input.expectedRevision + 1,
    }),
    loadCanvasViewState: async () => null,
    saveCanvasViewState: async () => undefined,
    listCanvasGroups: async () => [group(GROUP_A), group(GROUP_B), group(GROUP_NEW)],
    createCanvasGroup: async () => {
      throw new Error("unscoped group create must not be used");
    },
    renameCanvasGroup: async (input) => group(input.groupId),
    softDeleteCanvasGroup: async () => ({ status: "deleted" }),
    moveCanvasGroup: async (input) => group(input.groupId),
    moveCanvasToGroup: async () => undefined,
  };
}

function scoped(fake: FakeSupabase, log: string[]) {
  return new ProjectScopedCloudCanvasRepository({
    supabase: fake as unknown as SupabaseClient<Database>,
    repository: baseRepository(log),
    workspaceId: WORKSPACE,
    projectId: PROJECT_A,
  });
}

describe("Canvas project scope", () => {
  it("lists only Canvases and groups owned by the active Project", async () => {
    const fake = new FakeSupabase();
    const repository = scoped(fake, []);

    await expect(repository.listCanvases(WORKSPACE)).resolves.toEqual([
      summary(CANVAS_A),
    ]);
    await expect(repository.listCanvasGroups(WORKSPACE)).resolves.toEqual([
      group(GROUP_A),
    ]);
  });

  it("blocks loading a Canvas from another Project before base hydration", async () => {
    const fake = new FakeSupabase();
    const log: string[] = [];
    const repository = scoped(fake, log);

    await expect(repository.loadCanvas(WORKSPACE, CANVAS_B)).rejects.toMatchObject({
      code: "not-found",
    });
    expect(log).toEqual([]);
  });

  it("creates a Canvas through the explicit active-Project RPC", async () => {
    const fake = new FakeSupabase();
    const log: string[] = [];
    const repository = scoped(fake, log);

    await expect(
      repository.createCanvas(WORKSPACE, "Project A Canvas"),
    ).resolves.toMatchObject({ id: CANVAS_NEW, workspaceId: WORKSPACE });
    expect(fake.rpcCalls).toEqual([
      {
        name: "create_canvas_for_project",
        args: {
          target_group_id: null,
          target_project_id: PROJECT_A,
          target_title: "Project A Canvas",
          target_workspace_id: WORKSPACE,
        },
      },
    ]);
    expect(log).toEqual([`load:${CANVAS_NEW}`]);
  });

  it("creates groups through the explicit active-Project RPC", async () => {
    const fake = new FakeSupabase();
    const repository = scoped(fake, []);

    await expect(
      repository.createCanvasGroup({
        workspaceId: WORKSPACE,
        title: "Project A group",
      }),
    ).resolves.toEqual(group(GROUP_NEW));
    expect(fake.rpcCalls).toEqual([
      {
        name: "create_canvas_group_for_project",
        args: {
          target_parent_group_id: null,
          target_project_id: PROJECT_A,
          target_title: "Project A group",
          target_workspace_id: WORKSPACE,
        },
      },
    ]);
  });

  it("rejects cross-Project group mutations before delegating", async () => {
    const fake = new FakeSupabase();
    const repository = scoped(fake, []);

    await expect(
      repository.moveCanvasToGroup({
        workspaceId: WORKSPACE,
        canvasId: CANVAS_A,
        groupId: GROUP_B,
      }),
    ).rejects.toMatchObject({ code: "not-found" });
  });
});
