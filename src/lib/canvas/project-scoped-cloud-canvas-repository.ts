import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type {
  CanvasGroup,
  CanvasGroupRepository,
  CreateCanvasGroupInput,
  DeleteCanvasGroupInput,
  MoveCanvasGroupInput,
  MoveCanvasToGroupInput,
  RenameCanvasGroupInput,
} from "@/lib/canvas/canvas-group-repository";
import {
  CloudCanvasRepositoryError,
  type CloudCanvasRepository,
  type CloudCanvasSaveResult,
  type CloudCanvasSummary,
  type CloudCanvasViewState,
  type CloudLoadedCanvas,
  type SaveCanvasDocumentInput,
  type SaveCanvasViewStateInput,
} from "@/lib/canvas/cloud-canvas-repository";

export type ProjectScopedCloudCanvasRepositoryOptions = {
  supabase: SupabaseClient<Database>;
  repository: CloudCanvasRepository;
  workspaceId: string;
  projectId: string;
};

type SupabaseErrorLike = { code?: string };

function identifier(value: string, field: string): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > 256 ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new CloudCanvasRepositoryError(
      "invalid-input",
      `${field} is invalid.`,
    );
  }
  return value;
}

function projectError(cause: unknown, operation: string): CloudCanvasRepositoryError {
  if (cause instanceof CloudCanvasRepositoryError) return cause;
  const code =
    typeof cause === "object" && cause !== null
      ? (cause as SupabaseErrorLike).code
      : undefined;
  if (code === "42501" || code === "403") {
    return new CloudCanvasRepositoryError(
      "forbidden",
      "Cloud Canvas project access is forbidden.",
      { operation, code },
    );
  }
  if (code === "22023") {
    return new CloudCanvasRepositoryError(
      "invalid-input",
      "Cloud Canvas project scope was rejected.",
      { operation, code },
    );
  }
  return new CloudCanvasRepositoryError(
    "unexpected",
    "Cloud Canvas project-scoped operation failed.",
    { operation, code },
  );
}

export class ProjectScopedCloudCanvasRepository
  implements CloudCanvasRepository, CanvasGroupRepository
{
  private readonly supabase: SupabaseClient<Database>;
  private readonly repository: CloudCanvasRepository;
  private readonly workspaceId: string;
  private readonly projectId: string;

  constructor(options: ProjectScopedCloudCanvasRepositoryOptions) {
    this.supabase = options.supabase;
    this.repository = options.repository;
    this.workspaceId = identifier(options.workspaceId, "workspaceId");
    this.projectId = identifier(options.projectId, "projectId");
  }

  async listCanvases(workspaceId: string): Promise<CloudCanvasSummary[]> {
    this.assertWorkspace(workspaceId);
    try {
      const allowed = await this.canvasIds();
      const canvases = await this.repository.listCanvases(this.workspaceId);
      return canvases.filter((canvas) => allowed.has(canvas.id));
    } catch (cause) {
      throw projectError(cause, "list");
    }
  }

  async createCanvas(
    workspaceId: string,
    title: string,
    groupId: string | null = null,
  ): Promise<CloudLoadedCanvas> {
    this.assertWorkspace(workspaceId);
    try {
      if (groupId) await this.assertGroup(groupId);
      const { data, error } = await this.supabase.rpc(
        "create_canvas_for_project",
        {
          target_group_id: groupId as string,
          target_project_id: this.projectId,
          target_title: title,
          target_workspace_id: this.workspaceId,
        },
      );
      if (error) throw error;
      const canvasId = data?.[0]?.id;
      if (typeof canvasId !== "string" || canvasId.trim().length === 0) {
        throw new CloudCanvasRepositoryError(
          "server-contract",
          "Project-scoped Canvas create returned an invalid id.",
        );
      }
      return await this.loadCanvas(this.workspaceId, canvasId);
    } catch (cause) {
      throw projectError(cause, "create");
    }
  }

  async loadCanvas(
    workspaceId: string,
    canvasId: string,
  ): Promise<CloudLoadedCanvas> {
    this.assertWorkspace(workspaceId);
    try {
      await this.assertCanvas(canvasId);
      return await this.repository.loadCanvas(this.workspaceId, canvasId);
    } catch (cause) {
      if (
        cause instanceof CloudCanvasRepositoryError &&
        cause.code === "not-found"
      ) {
        throw cause;
      }
      throw projectError(cause, "load");
    }
  }

  async renameCanvas(
    workspaceId: string,
    canvasId: string,
    title: string,
  ): Promise<CloudCanvasSummary> {
    this.assertWorkspace(workspaceId);
    await this.assertCanvas(canvasId);
    return this.repository.renameCanvas(this.workspaceId, canvasId, title);
  }

  async deleteCanvas(workspaceId: string, canvasId: string): Promise<void> {
    this.assertWorkspace(workspaceId);
    await this.assertCanvas(canvasId);
    await this.repository.deleteCanvas(this.workspaceId, canvasId);
  }

  async saveCanvasDocument(
    input: SaveCanvasDocumentInput,
  ): Promise<CloudCanvasSaveResult> {
    this.assertWorkspace(input.workspaceId);
    await this.assertCanvas(input.canvasId);
    return this.repository.saveCanvasDocument(input);
  }

  async loadCanvasViewState(
    workspaceId: string,
    canvasId: string,
  ): Promise<CloudCanvasViewState | null> {
    this.assertWorkspace(workspaceId);
    await this.assertCanvas(canvasId);
    return this.repository.loadCanvasViewState(this.workspaceId, canvasId);
  }

  async saveCanvasViewState(input: SaveCanvasViewStateInput): Promise<void> {
    this.assertWorkspace(input.workspaceId);
    await this.assertCanvas(input.canvasId);
    await this.repository.saveCanvasViewState(input);
  }

  async listCanvasGroups(workspaceId: string): Promise<CanvasGroup[]> {
    this.assertWorkspace(workspaceId);
    try {
      const allowed = await this.groupIds();
      const groups = await this.repository.listCanvasGroups(this.workspaceId);
      return groups.filter((group) => allowed.has(group.id));
    } catch (cause) {
      throw projectError(cause, "list-groups");
    }
  }

  async createCanvasGroup(input: CreateCanvasGroupInput): Promise<CanvasGroup> {
    this.assertWorkspace(input.workspaceId);
    try {
      if (input.parentGroupId) await this.assertGroup(input.parentGroupId);
      const { data, error } = await this.supabase.rpc(
        "create_canvas_group_for_project",
        {
          target_parent_group_id: input.parentGroupId as string,
          target_project_id: this.projectId,
          target_title: input.title,
          target_workspace_id: this.workspaceId,
        },
      );
      if (error) throw error;
      const groupId = data?.[0]?.id;
      if (typeof groupId !== "string" || groupId.trim().length === 0) {
        throw new CloudCanvasRepositoryError(
          "server-contract",
          "Project-scoped Canvas group create returned an invalid id.",
        );
      }
      const groups = await this.listCanvasGroups(this.workspaceId);
      const created = groups.find((group) => group.id === groupId);
      if (!created) {
        throw new CloudCanvasRepositoryError(
          "server-contract",
          "Created Canvas group was not returned by its project scope.",
        );
      }
      return created;
    } catch (cause) {
      throw projectError(cause, "create-group");
    }
  }

  async renameCanvasGroup(input: RenameCanvasGroupInput): Promise<CanvasGroup> {
    this.assertWorkspace(input.workspaceId);
    await this.assertGroup(input.groupId);
    return this.repository.renameCanvasGroup(input);
  }

  async softDeleteCanvasGroup(
    input: DeleteCanvasGroupInput,
  ): Promise<{ status: "deleted" | "already-deleted" }> {
    this.assertWorkspace(input.workspaceId);
    await this.assertGroup(input.groupId);
    return this.repository.softDeleteCanvasGroup(input);
  }

  async moveCanvasGroup(input: MoveCanvasGroupInput): Promise<CanvasGroup> {
    this.assertWorkspace(input.workspaceId);
    await this.assertGroup(input.groupId);
    if (input.parentGroupId) await this.assertGroup(input.parentGroupId);
    return this.repository.moveCanvasGroup(input);
  }

  async moveCanvasToGroup(input: MoveCanvasToGroupInput): Promise<void> {
    this.assertWorkspace(input.workspaceId);
    await this.assertCanvas(input.canvasId);
    if (input.groupId) await this.assertGroup(input.groupId);
    await this.repository.moveCanvasToGroup(input);
  }

  private assertWorkspace(workspaceId: string): void {
    if (identifier(workspaceId, "workspaceId") !== this.workspaceId) {
      throw new CloudCanvasRepositoryError(
        "forbidden",
        "Cloud Canvas operation crossed the workspace boundary.",
      );
    }
  }

  private async canvasIds(): Promise<Set<string>> {
    const { data, error } = await this.supabase
      .from("canvases")
      .select("id")
      .eq("workspace_id", this.workspaceId)
      .eq("project_id", this.projectId)
      .is("deleted_at", null);
    if (error) throw error;
    return new Set((data ?? []).map((row) => row.id));
  }

  private async groupIds(): Promise<Set<string>> {
    const { data, error } = await this.supabase
      .from("canvas_groups")
      .select("id")
      .eq("workspace_id", this.workspaceId)
      .eq("project_id", this.projectId)
      .is("deleted_at", null);
    if (error) throw error;
    return new Set((data ?? []).map((row) => row.id));
  }

  private async assertCanvas(canvasId: string): Promise<void> {
    const scopedCanvasId = identifier(canvasId, "canvasId");
    const { data, error } = await this.supabase
      .from("canvases")
      .select("id")
      .eq("workspace_id", this.workspaceId)
      .eq("project_id", this.projectId)
      .eq("id", scopedCanvasId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new CloudCanvasRepositoryError(
        "not-found",
        "Cloud Canvas is unavailable in the active project.",
      );
    }
  }

  private async assertGroup(groupId: string): Promise<void> {
    const scopedGroupId = identifier(groupId, "groupId");
    const { data, error } = await this.supabase
      .from("canvas_groups")
      .select("id")
      .eq("workspace_id", this.workspaceId)
      .eq("project_id", this.projectId)
      .eq("id", scopedGroupId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new CloudCanvasRepositoryError(
        "not-found",
        "Canvas group is unavailable in the active project.",
      );
    }
  }
}

export function createProjectScopedCloudCanvasRepository(
  options: ProjectScopedCloudCanvasRepositoryOptions,
): CloudCanvasRepository {
  return new ProjectScopedCloudCanvasRepository(options);
}
