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
import { createEmptyCanvasDocumentV2 } from "@/lib/canvas/canvas-document";

const WORKSPACE = "20000000-0000-0000-0000-000000000001";
const PROJECT_A = "project-a";
const PROJECT_B = "project-b";
const CANVAS_A = "30000000-0000-0000-0000-000000000001";
const CANVAS_B = "30000000-0000-0000-0000-000000000002";
const CANVAS_NEW = "30000000-0000-0000-0000-000000000003";
const NOW = "2026-08-09T00:00:00.000Z";

type CanvasRow = {
  id: string;
  workspace_id: string;
  project_id: string;
  deleted_at: string | null;
};

type Filter = { field: string; value: unknown };

class FakeQuery implements PromiseLike<{ data: CanvasRow[]; error: null }> {
  private readonly filters: Filter[] = [];

  constructor(private readonly rows: CanvasRow[]) {}

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

  maybeSingle(): Promise<{ data: CanvasRow | null; error: null }> {
    return Promise.resolve({ data: this.filtered()[0] ?? null, error: null });
  }

  then<TResult1 = { data: CanvasRow[]; error: null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: CanvasRow[]; error: null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: this.filtered(), error: null }).then(
      onfulfilled,
      onrejected,
    );
  }

  private filtered(): CanvasRow[] {
    return this.rows.filter((row) =>
      this.filters.every(({ field, value }) =>
        (row as unknown as Record<string, unknown>)[field] === value,
      ),
    );
  }
}

class FakeSupabase {
  readonly rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  readonly canvasRows: CanvasRow[] = [
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

  from(table: string): FakeQuery {
    if (table !== "canvases" && table !== "canvas_groups") {
      throw new Error(`Unexpected table ${table}`);
    }
    return new FakeQuery(table === "canvases" ? this.canvasRows : []);
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

function baseRepository(log: string[]): CloudCanvasRepository {
  return {
    listCanvases: async () => [summary(CANVAS_A), summary(CANVAS_B), summary(CANVAS_NEW)],
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
    listCanvasGroups: async () => [],
    createCanvasGroup: async () => {
      throw new Error("unscoped group create must not be used");
    },
    renameCanvasGroup: async () => {
      throw new Error("unused");
    },
    softDeleteCanvasGroup: async () => ({ status: "deleted" }),
    moveCanvasGroup: async () => {
      throw new Error("unused");
    },
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
  it("lists only Canvases owned by the active Project", async () => {
    const fake = new FakeSupabase();
    const repository = scoped(fake, []);

    await expect(repository.listCanvases(WORKSPACE)).resolves.toEqual([
      summary(CANVAS_A),
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
});
